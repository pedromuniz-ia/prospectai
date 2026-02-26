import { Job } from "bullmq";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { aiProviders } from "@/db/schema/ai-providers";
import { campaignLeads } from "@/db/schema/campaign-leads";
import { campaigns } from "@/db/schema/campaigns";
import { leads } from "@/db/schema/leads";
import { messages } from "@/db/schema/messages";
import { createNotificationRecord } from "@/lib/notifications";
import { messageSendQueue } from "@/lib/queue";
import { generateReply } from "@/lib/ai/generate-reply";
import { randomInt, sleep } from "@/lib/helpers";

const aiReplyJobSchema = z.object({
  campaignLeadId: z.string(),
  leadId: z.string(),
  organizationId: z.string(),
});

type AiReplyJobData = z.infer<typeof aiReplyJobSchema>;

export async function processAiReply(job: Job<AiReplyJobData>) {
  const data = aiReplyJobSchema.parse(job.data);

  const campaignLead = await db.query.campaignLeads.findFirst({
    where: and(
      eq(campaignLeads.id, data.campaignLeadId),
      eq(campaignLeads.organizationId, data.organizationId)
    ),
  });
  if (!campaignLead) return;

  const campaign = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.id, campaignLead.campaignId),
      eq(campaigns.organizationId, data.organizationId)
    ),
  });

  const lead = await db.query.leads.findFirst({
    where: and(eq(leads.id, data.leadId), eq(leads.organizationId, data.organizationId)),
  });

  if (!campaign || !lead || !campaign.aiEnabled) return;

  if (campaignLead.autoRepliesSent >= campaign.aiMaxAutoReplies) {
    await db
      .update(campaignLeads)
      .set({
        needsHumanReview: true,
        updatedAt: new Date(),
      })
      .where(eq(campaignLeads.id, campaignLead.id));

    await createNotificationRecord({
      organizationId: data.organizationId,
      type: "ai_needs_review",
      title: "Limite de respostas automáticas atingido",
      body: `${lead.name} precisa de revisão manual para continuar a conversa.`,
      entityType: "lead",
      entityId: lead.id,
    });
    return;
  }

  const provider = await db.query.aiProviders.findFirst({
    where: and(
      eq(aiProviders.organizationId, data.organizationId),
      eq(aiProviders.id, campaign.aiProviderId ?? ""),
      eq(aiProviders.isActive, true)
    ),
  });

  if (!provider) {
    await db
      .update(campaignLeads)
      .set({
        needsHumanReview: true,
        updatedAt: new Date(),
      })
      .where(eq(campaignLeads.id, campaignLead.id));
    return;
  }

  const history = await db.query.messages.findMany({
    where: eq(messages.leadId, lead.id),
    orderBy: [desc(messages.createdAt)],
    limit: 25,
  });

  const replyText = await generateReply({
    lead,
    campaign,
    provider,
    messages: history
      .reverse()
      .map((message) => ({
        direction: message.direction,
        content: message.content,
      })),
  });

  const humanDelayMs = randomInt(30, 180) * 1_000;
  await sleep(humanDelayMs);

  if (!lead.phone || !campaign.whatsappInstanceId) {
    await db
      .update(campaignLeads)
      .set({
        needsHumanReview: true,
        updatedAt: new Date(),
      })
      .where(eq(campaignLeads.id, campaignLead.id));
    return;
  }

  await messageSendQueue.add("ai-auto-message", {
    organizationId: data.organizationId,
    leadId: lead.id,
    phone: lead.phone,
    content: replyText,
    source: "ai_auto",
    campaignLeadId: campaignLead.id,
    whatsappInstanceId: campaign.whatsappInstanceId,
  });

  await db
    .update(campaignLeads)
    .set({
      autoRepliesSent: campaignLead.autoRepliesSent + 1,
      updatedAt: new Date(),
    })
    .where(eq(campaignLeads.id, campaignLead.id));
}
