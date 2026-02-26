import { Job } from "bullmq";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { campaignLeads } from "@/db/schema/campaign-leads";
import { campaigns } from "@/db/schema/campaigns";
import { leads } from "@/db/schema/leads";
import { applyMicroVariations, selectVariant } from "@/lib/cadence/message-variants";
import { isWithinScheduleWindow } from "@/lib/cadence/scheduler";
import { messageSendQueue } from "@/lib/queue";

const cadenceJobSchema = z.object({
  campaignLeadId: z.string(),
  campaignId: z.string(),
  organizationId: z.string(),
  whatsappInstanceId: z.string(),
});

type CadenceJobData = z.infer<typeof cadenceJobSchema>;

export async function processCadence(job: Job<CadenceJobData>) {
  const data = cadenceJobSchema.parse(job.data);

  const campaign = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.id, data.campaignId),
      eq(campaigns.organizationId, data.organizationId)
    ),
  });

  if (!campaign || campaign.status !== "active") return;

  if (!isWithinScheduleWindow(campaign)) return;
  if (campaign.dailySent >= campaign.dailyLimit) return;

  const campaignLead = await db.query.campaignLeads.findFirst({
    where: and(
      eq(campaignLeads.id, data.campaignLeadId),
      eq(campaignLeads.campaignId, data.campaignId)
    ),
  });

  if (!campaignLead) return;
  if (!["queued", "pending"].includes(campaignLead.status)) return;

  const lead = await db.query.leads.findFirst({
    where: and(
      eq(leads.id, campaignLead.leadId),
      eq(leads.organizationId, data.organizationId),
      eq(leads.doNotContact, false)
    ),
  });

  if (!lead?.phone) {
    await db
      .update(campaignLeads)
      .set({
        status: "skipped",
        updatedAt: new Date(),
      })
      .where(eq(campaignLeads.id, campaignLead.id));
    return;
  }

  const variants =
    campaign.firstMessageVariants?.filter((variant) => variant.trim().length > 0) ?? [];
  const fallback = `Oi ${lead.name}, tudo bem? Vi seu negócio e tenho uma ideia rápida para aumentar as oportunidades no WhatsApp.`; // fallback when campaign variants are empty

  const selected = selectVariant(
    variants.length ? variants : [fallback],
    lead.contactAttempts % Math.max(variants.length, 1)
  );
  const content = applyMicroVariations(selected.message);

  await messageSendQueue.add("cadence-message-send", {
    organizationId: data.organizationId,
    leadId: lead.id,
    phone: lead.phone,
    content,
    source: "cadence",
    campaignLeadId: campaignLead.id,
    whatsappInstanceId: data.whatsappInstanceId,
  });

  await db
    .update(campaignLeads)
    .set({
      status: "queued",
      updatedAt: new Date(),
    })
    .where(eq(campaignLeads.id, campaignLead.id));
}
