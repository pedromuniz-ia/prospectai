import { Job } from "bullmq";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { campaignLeads } from "@/db/schema/campaign-leads";
import { campaigns } from "@/db/schema/campaigns";
import { leads } from "@/db/schema/leads";
import { messages } from "@/db/schema/messages";
import { whatsappInstances } from "@/db/schema/whatsapp-instances";
import { enforceAntiBan } from "@/lib/cadence/anti-ban";
import { getEvolutionAPI } from "@/lib/evolution-api";
import { randomInt, sleep } from "@/lib/helpers";

const messageSendJobSchema = z.object({
  organizationId: z.string(),
  leadId: z.string(),
  phone: z.string(),
  content: z.string().min(1),
  source: z.enum(["manual", "ai_auto", "ai_approved", "cadence"]).default("manual"),
  campaignLeadId: z.string().nullable().optional(),
  whatsappInstanceId: z.string(),
});

type MessageSendJobData = z.infer<typeof messageSendJobSchema>;

function isInvalidNumberError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /invalid|not.exists|jid|number/i.test(error.message);
}

export async function processMessageSend(job: Job<MessageSendJobData>) {
  const data = messageSendJobSchema.parse(job.data);

  const instance = await db.query.whatsappInstances.findFirst({
    where: and(
      eq(whatsappInstances.id, data.whatsappInstanceId),
      eq(whatsappInstances.organizationId, data.organizationId)
    ),
  });

  if (!instance) {
    throw new Error("WhatsApp instance not found");
  }

  if (instance.status !== "connected") {
    throw new Error("WhatsApp instance is not connected");
  }

  const evolution = getEvolutionAPI();

  try {
    await evolution.setPresence(instance.instanceName, { presence: "composing" });
  } catch {
    // Presence is optional.
  }

  const typingDelay = Math.min(data.content.length * 50, 3_000);
  await sleep(typingDelay);

  try {
    const response = await evolution.sendText(instance.instanceName, {
      number: data.phone,
      text: data.content,
    });

    await db.insert(messages).values({
      organizationId: data.organizationId,
      leadId: data.leadId,
      campaignLeadId: data.campaignLeadId ?? null,
      whatsappInstanceId: data.whatsappInstanceId,
      direction: "outbound",
      content: data.content,
      mediaType: "text",
      source: data.source,
      aiGenerated: data.source.startsWith("ai_"),
      evolutionMessageId: response.key.id,
      status: "sent",
      sentAt: new Date(),
    });

    await db
      .update(leads)
      .set({
        status: "contacted",
        contactAttempts: sql`${leads.contactAttempts} + 1`,
        lastContactedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, data.leadId));

    if (data.campaignLeadId) {
      await db
        .update(campaignLeads)
        .set({
          status: "sent",
          contactedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(campaignLeads.id, data.campaignLeadId));

      const context = await db.query.campaignLeads.findFirst({
        where: eq(campaignLeads.id, data.campaignLeadId),
      });

      if (context) {
        await db
          .update(campaigns)
          .set({
            dailySent: sql`${campaigns.dailySent} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(campaigns.id, context.campaignId));
      }
    }

    await db
      .update(whatsappInstances)
      .set({
        dailyMessagesSent: sql`${whatsappInstances.dailyMessagesSent} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(whatsappInstances.id, data.whatsappInstanceId));
  } catch (error) {
    await db.insert(messages).values({
      organizationId: data.organizationId,
      leadId: data.leadId,
      campaignLeadId: data.campaignLeadId ?? null,
      whatsappInstanceId: data.whatsappInstanceId,
      direction: "outbound",
      content: data.content,
      mediaType: "text",
      source: data.source,
      aiGenerated: data.source.startsWith("ai_"),
      status: "failed",
      sentAt: new Date(),
    });

    if (data.campaignLeadId) {
      await db
        .update(campaignLeads)
        .set({
          status: isInvalidNumberError(error) ? "skipped" : "pending",
          updatedAt: new Date(),
        })
        .where(eq(campaignLeads.id, data.campaignLeadId));
    }

    if (isInvalidNumberError(error)) {
      await db
        .update(leads)
        .set({
          status: "blocked",
          doNotContact: true,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, data.leadId));
    }

    await enforceAntiBan(data.organizationId, data.whatsappInstanceId);

    throw error;
  } finally {
    await sleep(randomInt(8_000, 15_000));
  }
}
