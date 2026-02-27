"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aiProviders } from "@/db/schema/ai-providers";
import { campaignLeads } from "@/db/schema/campaign-leads";
import { campaigns } from "@/db/schema/campaigns";
import { extractionJobs } from "@/db/schema/extraction-jobs";
import { leads } from "@/db/schema/leads";
import { messageTemplates } from "@/db/schema/message-templates";
import { messages } from "@/db/schema/messages";
import { scoringRules } from "@/db/schema/scoring-rules";
import { warmupConfigs } from "@/db/schema/warmup-configs";
import { whatsappInstances } from "@/db/schema/whatsapp-instances";

export async function exportOrganizationData(organizationId: string) {
  const [
    leadRows,
    campaignRows,
    campaignLeadRows,
    messageRows,
    instanceRows,
    aiRows,
    scoringRows,
    templateRows,
    extractionRows,
    warmupRows,
  ] = await Promise.all([
    db.query.leads.findMany({ where: eq(leads.organizationId, organizationId) }),
    db.query.campaigns.findMany({ where: eq(campaigns.organizationId, organizationId) }),
    db.query.campaignLeads.findMany({ where: eq(campaignLeads.organizationId, organizationId) }),
    db.query.messages.findMany({ where: eq(messages.organizationId, organizationId) }),
    db.query.whatsappInstances.findMany({ where: eq(whatsappInstances.organizationId, organizationId) }),
    db.query.aiProviders.findMany({ where: eq(aiProviders.organizationId, organizationId) }),
    db.query.scoringRules.findMany({ where: eq(scoringRules.organizationId, organizationId) }),
    db.query.messageTemplates.findMany({ where: eq(messageTemplates.organizationId, organizationId) }),
    db.query.extractionJobs.findMany({ where: eq(extractionJobs.organizationId, organizationId) }),
    db.query.warmupConfigs.findMany({ where: eq(warmupConfigs.organizationId, organizationId) }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    organizationId,
    leads: leadRows,
    campaigns: campaignRows,
    campaignLeads: campaignLeadRows,
    messages: messageRows,
    whatsappInstances: instanceRows,
    aiProviders: aiRows,
    scoringRules: scoringRows,
    templates: templateRows,
    extractionJobs: extractionRows,
    warmupConfigs: warmupRows,
  };
}

export async function checkApifyTokenStatus(): Promise<{ configured: boolean }> {
  return { configured: !!process.env.APIFY_TOKEN };
}
