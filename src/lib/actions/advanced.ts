"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aiProviders } from "@/db/schema/ai-providers";
import { extractionJobs } from "@/db/schema/extraction-jobs";
import { leads } from "@/db/schema/leads";
import { scoringRules } from "@/db/schema/scoring-rules";

export async function exportOrganizationData(organizationId: string) {
  const [
    leadRows,
    aiRows,
    scoringRows,
    extractionRows,
  ] = await Promise.all([
    db.query.leads.findMany({ where: eq(leads.organizationId, organizationId) }),
    db.query.aiProviders.findMany({ where: eq(aiProviders.organizationId, organizationId) }),
    db.query.scoringRules.findMany({ where: eq(scoringRules.organizationId, organizationId) }),
    db.query.extractionJobs.findMany({ where: eq(extractionJobs.organizationId, organizationId) }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    organizationId,
    leads: leadRows,
    aiProviders: aiRows,
    scoringRules: scoringRows,
    extractionJobs: extractionRows,
  };
}

export async function checkApifyTokenStatus(): Promise<{ configured: boolean }> {
  return { configured: !!process.env.APIFY_TOKEN };
}
