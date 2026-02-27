import { Job } from "bullmq";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { aiProviders } from "@/db/schema/ai-providers";
import { auditLogs } from "@/db/schema/audit-logs";
import { leads } from "@/db/schema/leads";
import { scoringRules } from "@/db/schema/scoring-rules";
import { classifyLead } from "@/lib/enrichment/ai-classifier";
import { enrichWithRDAP } from "@/lib/enrichment/rdap";
import { scoreLead, type ScoringRuleInput } from "@/lib/enrichment/scorer";
import { checkWebsite } from "@/lib/enrichment/website-check";
import { extractDomain, sleep } from "@/lib/helpers";
import { getModel } from "@/lib/ai/provider-registry";

const enrichmentJobSchema = z.object({
  leadId: z.string(),
  organizationId: z.string(),
  type: z.enum(["rdap", "website", "score", "classify", "full"]).default("full"),
  extractionJobId: z.string().optional(),
});

type EnrichmentJobData = z.infer<typeof enrichmentJobSchema>;

function pickLeadSnapshot(lead: typeof leads.$inferSelect) {
  return {
    name: lead.name,
    category: lead.category,
    city: lead.city,
    hasWebsite: lead.hasWebsite,
    googleRating: lead.googleRating,
    googleReviewCount: lead.googleReviewCount,
    websiteStatus: lead.websiteStatus,
    aiSummary: lead.aiSummary,
  };
}

export async function processEnrichment(job: Job<EnrichmentJobData>) {
  const data = enrichmentJobSchema.parse(job.data);

  const lead = await db.query.leads.findFirst({
    where: and(eq(leads.id, data.leadId), eq(leads.organizationId, data.organizationId)),
  });

  if (!lead) {
    console.warn(`[enrichment] lead not found: ${data.leadId}`);
    return;
  }

  const patch: Partial<typeof leads.$inferInsert> = {
    updatedAt: new Date(),
  };

  const shouldRunRdap = data.type === "rdap" || data.type === "full";
  const shouldRunWebsite = data.type === "website" || data.type === "full";
  const shouldRunScore = data.type === "score" || data.type === "full";
  const shouldRunClassify = data.type === "classify" || data.type === "full";

  if (shouldRunRdap) {
    const domain = extractDomain(lead.website);
    if (domain?.endsWith(".com.br")) {
      await sleep(3_000);
      const rdap = await enrichWithRDAP(domain);
      patch.whoisEmail = rdap.whoisEmail;
      patch.whoisResponsible = rdap.whoisResponsible;
      patch.domainRegistrar = rdap.domainRegistrar;
      patch.domainCreatedAt = rdap.domainCreatedAt;
    }
  }

  if (shouldRunWebsite && lead.website) {
    const website = await checkWebsite(lead.website);
    patch.websiteStatus = website.websiteStatus;
    patch.hasSsl = website.hasSsl;
    patch.email = patch.email ?? website.email ?? lead.email;
    patch.hasWebsite = website.websiteStatus !== "error";
  }

  let scoreResult:
    | {
        score: number;
        breakdown: Record<string, number>;
        explanation: string;
      }
    | undefined;

  if (shouldRunScore) {
    const rules = await db.query.scoringRules.findMany({
      where: and(
        eq(scoringRules.organizationId, data.organizationId),
        eq(scoringRules.active, true),
        inArray(scoringRules.objective, [
          "global",
          "sell_website",
          "sell_ai_agent",
          "sell_optimization",
        ])
      ),
    });

    scoreResult = scoreLead(
      {
        ...lead,
        ...patch,
      } as Record<string, unknown>,
      rules.map(
        (rule): ScoringRuleInput => ({
          field: rule.field,
          operator: rule.operator,
          value: rule.value,
          points: rule.points,
          label: rule.label,
          active: rule.active,
        })
      )
    );

    patch.score = scoreResult.score;
    patch.scoreBreakdown = scoreResult.breakdown;
    patch.scoreExplanation = scoreResult.explanation;
    patch.scoredAt = new Date();
    patch.scoringVersion = lead.scoringVersion + 1;
  }

  if (shouldRunClassify) {
    const provider = await db.query.aiProviders.findFirst({
      where: and(
        eq(aiProviders.organizationId, data.organizationId),
        eq(aiProviders.isActive, true),
        eq(aiProviders.isDefault, true)
      ),
    });

    const model = provider ? getModel(provider) : undefined;
    const classification = await classifyLead(
      {
        ...pickLeadSnapshot(lead),
        ...pickLeadSnapshot({
          ...lead,
          ...patch,
        } as typeof leads.$inferSelect),
      },
      model
    );

    patch.aiClassification = classification.classification;
    patch.aiClassificationConfidence = classification.confidence;
    patch.aiSummary = classification.summary;
    patch.aiSuggestedApproach = classification.suggestedApproach;
    patch.aiQualifiedAt = new Date();
  }

  patch.enrichedAt = new Date();
  patch.enrichmentVersion = lead.enrichmentVersion + 1;
  patch.status = shouldRunScore ? "scored" : "enriched";

  await db.update(leads).set(patch).where(eq(leads.id, lead.id));

  await db.insert(auditLogs).values({
    organizationId: data.organizationId,
    action: "lead_enriched",
    entityType: "lead",
    entityId: lead.id,
    metadata: {
      type: data.type,
      score: scoreResult?.score ?? lead.score,
      classification: patch.aiClassification ?? lead.aiClassification,
    },
  });
}
