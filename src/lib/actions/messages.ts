"use server";

import { and, asc, desc, eq, inArray, not, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiProviders } from "@/db/schema/ai-providers";
import { campaignLeads } from "@/db/schema/campaign-leads";
import { campaigns } from "@/db/schema/campaigns";
import { leads } from "@/db/schema/leads";
import { messageTemplates } from "@/db/schema/message-templates";
import { messages } from "@/db/schema/messages";
import { whatsappInstances } from "@/db/schema/whatsapp-instances";
import { createNotificationRecord } from "@/lib/notifications";
import { messageSendQueue } from "@/lib/queue";
import { generateReply } from "@/lib/ai/generate-reply";
import { formatRelativeTime } from "@/lib/helpers";

export type ConversationFilter =
  | "needs_action"
  | "all"
  | "unread"
  | "awaiting_ai"
  | "needs_review";

async function getLeadConversationInfo(leadId: string, organizationId: string) {
  const lead = await db.query.leads.findFirst({
    where: and(eq(leads.id, leadId), eq(leads.organizationId, organizationId)),
  });

  if (!lead) return null;

  const lastMessage = await db.query.messages.findFirst({
    where: and(eq(messages.leadId, leadId), eq(messages.organizationId, organizationId)),
    orderBy: [desc(messages.createdAt)],
  });

  if (!lastMessage) return null;

  const [{ unreadCount }] = await db
    .select({ unreadCount: sql<number>`count(*)` })
    .from(messages)
    .where(
      and(
        eq(messages.organizationId, organizationId),
        eq(messages.leadId, leadId),
        eq(messages.direction, "inbound"),
        not(eq(messages.status, "read"))
      )
    );

  const context = await db.query.campaignLeads.findFirst({
    where: and(
      eq(campaignLeads.organizationId, organizationId),
      eq(campaignLeads.leadId, leadId)
    ),
    orderBy: [desc(campaignLeads.updatedAt)],
  });

  return {
    lead,
    context,
    lastMessage,
    unreadCount: Number(unreadCount ?? 0),
    relativeTime: formatRelativeTime(lastMessage.createdAt),
  };
}

function passesFilter(
  filter: ConversationFilter,
  info: NonNullable<Awaited<ReturnType<typeof getLeadConversationInfo>>>
) {
  if (filter === "all") return true;

  if (filter === "unread") return info.unreadCount > 0;

  if (filter === "awaiting_ai" || filter === "needs_review") {
    return Boolean(info.context?.needsHumanReview);
  }

  if (filter === "needs_action") {
    return (
      info.unreadCount > 0 ||
      Boolean(info.context?.needsHumanReview) ||
      info.lastMessage.direction === "inbound"
    );
  }

  return true;
}

export async function getConversations(
  organizationId: string,
  filter: ConversationFilter = "needs_action"
) {
  const distinctLeads = await db
    .selectDistinct({ leadId: messages.leadId })
    .from(messages)
    .where(eq(messages.organizationId, organizationId));

  const items = (
    await Promise.all(
      distinctLeads.map((row) =>
        getLeadConversationInfo(row.leadId, organizationId)
      )
    )
  ).filter((item): item is NonNullable<typeof item> => Boolean(item));

  const filtered = items.filter((item) => passesFilter(filter, item));

  return filtered
    .map((item) => {
      const recencyWeight = Math.max(
        1,
        Math.floor(
          (Date.now() - new Date(item.lastMessage.createdAt).getTime()) / 60_000
        )
      );

      const priority = item.lead.score * 10 + Math.max(0, 3_000 - recencyWeight);

      return {
        leadId: item.lead.id,
        leadName: item.lead.name,
        leadCity: item.lead.city,
        score: item.lead.score,
        status: item.lead.status,
        aiClassification: item.lead.aiClassification,
        pipelineStage: item.context?.pipelineStage,
        needsHumanReview: item.context?.needsHumanReview ?? false,
        unreadCount: item.unreadCount,
        lastMessage: {
          id: item.lastMessage.id,
          direction: item.lastMessage.direction,
          content: item.lastMessage.content,
          source: item.lastMessage.source,
          createdAt: item.lastMessage.createdAt,
          relative: item.relativeTime,
        },
        priority,
      };
    })
    .sort((a, b) => b.priority - a.priority);
}

export async function getMessages(leadId: string) {
  return db.query.messages.findMany({
    where: eq(messages.leadId, leadId),
    orderBy: [desc(messages.createdAt)],
    limit: 150,
  });
}

export async function getLeadConversationContext(leadId: string) {
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });

  if (!lead) return null;

  const campaignContext = await db
    .select({
      campaignLeadId: campaignLeads.id,
      campaignId: campaigns.id,
      campaignName: campaigns.name,
      campaignStatus: campaigns.status,
      pipelineStage: campaignLeads.pipelineStage,
      needsHumanReview: campaignLeads.needsHumanReview,
      autoRepliesSent: campaignLeads.autoRepliesSent,
    })
    .from(campaignLeads)
    .innerJoin(campaigns, eq(campaigns.id, campaignLeads.campaignId))
    .where(eq(campaignLeads.leadId, leadId))
    .orderBy(desc(campaignLeads.updatedAt))
    .limit(1);

  return {
    lead,
    campaignContext: campaignContext[0] ?? null,
  };
}

export async function markAsRead(leadId: string) {
  await db
    .update(messages)
    .set({
      status: "read",
      readAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(messages.leadId, leadId), eq(messages.direction, "inbound")));
}

export async function sendMessage(input: {
  leadId: string;
  content: string;
  source?: "manual" | "ai_approved" | "cadence" | "ai_auto";
}) {
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, input.leadId),
  });

  if (!lead?.phone) {
    throw new Error("Lead sem telefone válido.");
  }

  const campaignContext = await db
    .select({
      campaignLeadId: campaignLeads.id,
      campaignId: campaigns.id,
      whatsappInstanceId: campaigns.whatsappInstanceId,
    })
    .from(campaignLeads)
    .innerJoin(campaigns, eq(campaigns.id, campaignLeads.campaignId))
    .where(eq(campaignLeads.leadId, input.leadId))
    .orderBy(desc(campaignLeads.updatedAt))
    .limit(1);

  const fallbackInstance = await db.query.whatsappInstances.findFirst({
    where: and(
      eq(whatsappInstances.organizationId, lead.organizationId),
      eq(whatsappInstances.status, "connected")
    ),
    orderBy: [desc(whatsappInstances.updatedAt)],
  });

  const whatsappInstanceId =
    campaignContext[0]?.whatsappInstanceId ?? fallbackInstance?.id;

  if (!whatsappInstanceId) {
    throw new Error("Nenhuma instância WhatsApp conectada.");
  }

  await messageSendQueue.add("manual-send", {
    organizationId: lead.organizationId,
    leadId: lead.id,
    phone: lead.phone,
    content: input.content,
    source: input.source ?? "manual",
    campaignLeadId: campaignContext[0]?.campaignLeadId ?? null,
    whatsappInstanceId,
  });

  return { queued: true };
}

export async function updateConversationStage(
  campaignLeadId: string,
  stage: (typeof campaignLeads.$inferInsert)["pipelineStage"]
) {
  const [updated] = await db
    .update(campaignLeads)
    .set({
      pipelineStage: stage,
      updatedAt: new Date(),
    })
    .where(eq(campaignLeads.id, campaignLeadId))
    .returning();

  return updated;
}

export async function generateAiReplySuggestion(leadId: string) {
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });

  if (!lead) {
    throw new Error("Lead não encontrado.");
  }

  const context = await db
    .select({
      campaignLeadId: campaignLeads.id,
      campaign: campaigns,
    })
    .from(campaignLeads)
    .innerJoin(campaigns, eq(campaigns.id, campaignLeads.campaignId))
    .where(eq(campaignLeads.leadId, leadId))
    .orderBy(desc(campaignLeads.updatedAt))
    .limit(1);

  if (!context[0]) {
    return {
      text: `Oi! Obrigado pela mensagem. Posso te explicar em 2 minutos como aumentar a previsibilidade das vendas no WhatsApp?`,
    };
  }

  const history = await db.query.messages.findMany({
    where: eq(messages.leadId, leadId),
    orderBy: [desc(messages.createdAt)],
    limit: 25,
  });

  const provider = await db.query.aiProviders.findFirst({
    where: and(
      eq(aiProviders.organizationId, lead.organizationId),
      eq(aiProviders.isActive, true),
      inArray(aiProviders.id, [context[0].campaign.aiProviderId ?? ""])
    ),
  });

  if (!provider) {
    return {
      text: "Recebi seu retorno. Consigo te mostrar rapidamente uma abordagem objetiva para aumentar suas oportunidades no WhatsApp. Pode ser agora?",
    };
  }

  const text = await generateReply({
    lead,
    campaign: context[0].campaign,
    provider,
    messages: history
      .reverse()
      .map((message) => ({
        direction: message.direction,
        content: message.content,
      })),
  });

  return { text };
}

export async function getMessageTemplates(organizationId: string) {
  return db.query.messageTemplates.findMany({
    where: eq(messageTemplates.organizationId, organizationId),
    orderBy: [asc(messageTemplates.shortcut)],
  });
}

export async function notifyAiNeedsReview(input: {
  organizationId: string;
  leadId: string;
  campaignId: string;
}) {
  return createNotificationRecord({
    organizationId: input.organizationId,
    type: "ai_needs_review",
    title: "IA precisa de revisão humana",
    body: "Uma resposta foi sinalizada para aprovação manual.",
    entityType: "lead",
    entityId: input.leadId,
  });
}
