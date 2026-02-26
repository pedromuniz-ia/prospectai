import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { whatsappInstances } from "@/db/schema/whatsapp-instances";
import { messages } from "@/db/schema/messages";
import { leads } from "@/db/schema/leads";
import { campaignLeads } from "@/db/schema/campaign-leads";
import { campaigns } from "@/db/schema/campaigns";
import {
  type WebhookEvent,
  type MessagesUpsertData,
  type ConnectionUpdateData,
  type QRCodeUpdateData,
  type MessagesUpdateData,
  extractMessageText,
  detectMediaType,
  phoneFromJid,
} from "@/lib/evolution-api";
import { createNotificationRecord } from "@/lib/notifications";
import { aiReplyQueue } from "@/lib/queue";

// ── Webhook Event Handlers ──

type EventHandler = (
  instanceName: string,
  data: unknown
) => Promise<void>;

const eventHandlers: Record<string, EventHandler> = {
  "messages.upsert": handleMessagesUpsert,
  MESSAGES_UPSERT: handleMessagesUpsert,
  "connection.update": handleConnectionUpdate,
  CONNECTION_UPDATE: handleConnectionUpdate,
  "qrcode.updated": handleQRCodeUpdate,
  QRCODE_UPDATED: handleQRCodeUpdate,
  "messages.update": handleMessagesUpdate,
  MESSAGES_UPDATE: handleMessagesUpdate,
};

async function handleMessagesUpsert(
  instanceName: string,
  rawData: unknown
): Promise<void> {
  // Evolution API may send array or single object
  const items = Array.isArray(rawData) ? rawData : [rawData];

  for (const item of items) {
    const data = item as MessagesUpsertData;

    // Skip outbound messages (fromMe)
    if (data.key?.fromMe) continue;

    const phone = phoneFromJid(data.key?.remoteJid ?? "");
    if (!phone) continue;

    // Find the instance in our DB
    const instance = await db.query.whatsappInstances.findFirst({
      where: eq(whatsappInstances.instanceName, instanceName),
    });
    if (!instance) return;

    // Find lead by phone within the same org
    const lead = await db.query.leads.findFirst({
      where: and(
        eq(leads.organizationId, instance.organizationId),
        eq(leads.phone, phone)
      ),
    });
    if (!lead) return;

    const text = extractMessageText(data);
    const mediaType = detectMediaType(data);

    // Save inbound message
    const campaignContext = await db
      .select({
        campaignLeadId: campaignLeads.id,
        campaignId: campaigns.id,
        aiEnabled: campaigns.aiEnabled,
      })
      .from(campaignLeads)
      .innerJoin(campaigns, eq(campaigns.id, campaignLeads.campaignId))
      .where(eq(campaignLeads.leadId, lead.id))
      .orderBy(desc(campaignLeads.updatedAt))
      .limit(1);

    const activeCampaign = campaignContext[0] ?? null;

    await db.insert(messages).values({
      organizationId: instance.organizationId,
      leadId: lead.id,
      campaignLeadId: activeCampaign?.campaignLeadId ?? null,
      whatsappInstanceId: instance.id,
      direction: "inbound",
      content: text ?? "[media]",
      mediaType,
      source: "webhook",
      evolutionMessageId: data.key?.id,
      status: "delivered",
      sentAt: data.messageTimestamp
        ? new Date(Number(data.messageTimestamp) * 1000)
        : new Date(),
    });

    // Update lead status
    await db
      .update(leads)
      .set({
        status: lead.status === "contacted" ? "replied" : lead.status,
        lastRepliedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, lead.id));

    if (activeCampaign) {
      await db
        .update(campaignLeads)
        .set({
          status: "replied",
          pipelineStage: "replied",
          updatedAt: new Date(),
        })
        .where(eq(campaignLeads.id, activeCampaign.campaignLeadId));

      if (activeCampaign.aiEnabled) {
        await aiReplyQueue.add("ai-reply", {
          campaignLeadId: activeCampaign.campaignLeadId,
          leadId: lead.id,
          organizationId: instance.organizationId,
        });
      }
    }

    if (lead.score >= 70) {
      await createNotificationRecord({
        organizationId: instance.organizationId,
        type: "lead_replied",
        title: "Lead quente respondeu",
        body: `${lead.name} respondeu e está com score ${lead.score}.`,
        entityType: "lead",
        entityId: lead.id,
      });
    }
  }
}

async function handleConnectionUpdate(
  instanceName: string,
  rawData: unknown
): Promise<void> {
  const data = rawData as ConnectionUpdateData;

  const statusMap = {
    open: "connected",
    close: "disconnected",
    connecting: "connecting",
  } as const satisfies Record<string, string>;

  const newStatus = statusMap[data.state] ?? "disconnected";

  await db
    .update(whatsappInstances)
    .set({
      status: newStatus as "connected" | "disconnected" | "connecting",
      updatedAt: new Date(),
    })
    .where(eq(whatsappInstances.instanceName, instanceName));

  if (newStatus === "disconnected") {
    const instance = await db.query.whatsappInstances.findFirst({
      where: eq(whatsappInstances.instanceName, instanceName),
    });

    if (instance) {
      await createNotificationRecord({
        organizationId: instance.organizationId,
        type: "instance_disconnected",
        title: "Instância desconectada",
        body: `${instance.instanceName} foi desconectada.`,
        entityType: "whatsapp_instance",
        entityId: instance.id,
      });
    }
  }
}

async function handleQRCodeUpdate(
  instanceName: string,
  rawData: unknown
): Promise<void> {
  const data = rawData as QRCodeUpdateData;

  await db
    .update(whatsappInstances)
    .set({
      qrCode: data.base64,
      status: "connecting",
      updatedAt: new Date(),
    })
    .where(eq(whatsappInstances.instanceName, instanceName));
}

async function handleMessagesUpdate(
  instanceName: string,
  rawData: unknown
): Promise<void> {
  const items = Array.isArray(rawData) ? rawData : [rawData];

  for (const item of items) {
    const data = item as MessagesUpdateData;
    const messageId = data.key?.id;
    if (!messageId) continue;

    // Status codes: 2 = sent, 3 = delivered, 4 = read
    const statusCode = data.update?.status;
    if (!statusCode) continue;

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (statusCode >= 2) {
      updates.status = "sent";
      updates.sentAt = new Date();
    }
    if (statusCode >= 3) {
      updates.status = "delivered";
      updates.deliveredAt = new Date();
    }
    if (statusCode >= 4) {
      updates.status = "read";
      updates.readAt = new Date();
    }

    await db
      .update(messages)
      .set(updates)
      .where(eq(messages.evolutionMessageId, messageId));
  }
}

// ── Route Handler ──

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as WebhookEvent;

    const { event, instance: instanceName, data } = body;

    if (!event || !instanceName) {
      return NextResponse.json(
        { error: "Missing event or instance" },
        { status: 400 }
      );
    }

    const handler = eventHandlers[event];

    if (handler) {
      // Fire-and-forget — don't block the webhook response
      handler(instanceName, data).catch((err) => {
        console.error(`[webhook] Error handling ${event}:`, err);
      });
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
