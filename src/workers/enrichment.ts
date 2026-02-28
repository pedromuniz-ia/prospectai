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
import { checkWhatsapp } from "@/lib/enrichment/whatsapp-check";
import { checkInstagram } from "@/lib/enrichment/instagram-check";
import { enrichWithCNPJ } from "@/lib/enrichment/cnpj-check";
import { enrichWithLinkedin } from "@/lib/enrichment/linkedin-check";
import { extractDomain, isActualWebsite, sleep } from "@/lib/helpers";
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
      console.log(`[enrichment] Running RDAP check for ${domain}`);
      await sleep(3_000);
      const rdap = await enrichWithRDAP(domain);
      patch.whoisEmail = rdap.whoisEmail;
      patch.whoisResponsible = rdap.whoisResponsible;
      patch.domainRegistrar = rdap.domainRegistrar;
      patch.domainCreatedAt = rdap.domainCreatedAt;
    } else if (domain) {
      console.log(`[enrichment] Skipping RDAP — Only .com.br supported for now: ${domain}`);
    }
  }

  let foundInstagramUrl: string | null = null;

  if (shouldRunWebsite && lead.website) {
    console.log(`[enrichment] Checking website: ${lead.website}`);
    const website = await checkWebsite(lead.website);
    patch.websiteStatus = website.websiteStatus;
    patch.hasSsl = website.hasSsl;
    patch.email = patch.email ?? website.email ?? lead.email;
    patch.hasWebsite = website.websiteStatus !== "error";
    patch.linkedinUrl = website.linkedinUrl ?? lead.linkedinUrl;
    patch.cnpj = website.cnpj ?? lead.cnpj;

    if (website.instagramUrl) {
      console.log(`[enrichment] Found Instagram URL on website: ${website.instagramUrl}`);
      foundInstagramUrl = website.instagramUrl;
    }
  }

  // CNPJ Enrichment
  const cnpjToEnrich = patch.cnpj ?? lead.cnpj;
  if (cnpjToEnrich && (data.type === "full" || data.type === "rdap")) {
    console.log(`[enrichment] Extracting official data for CNPJ: ${cnpjToEnrich}`);
    const cnpjData = await enrichWithCNPJ(cnpjToEnrich);
    patch.legalName = cnpjData.legalName;
    patch.foundingDate = cnpjData.foundingDate;
    patch.capitalSocial = cnpjData.capitalSocial;
    patch.primaryCnae = cnpjData.primaryCnae;
    patch.partners = cnpjData.partners;
  }

  // WhatsApp check
  if (data.type === "full" && lead.phone) {
    console.log(`[enrichment] Checking WhatsApp for ${lead.phone}`);
    await sleep(1_000);
    const wa = await checkWhatsapp(lead.phone);
    console.log(`[enrichment] WhatsApp result for ${lead.phone}: ${wa.hasWhatsapp}`);
    patch.hasWhatsapp = wa.hasWhatsapp;
    patch.whatsappIsBusinessAccount = wa.isBusinessAccount;
    patch.whatsappBusinessDescription = wa.businessDescription;
    patch.whatsappBusinessEmail = wa.businessEmail;
    patch.whatsappBusinessWebsite = wa.businessWebsite;
  }

  // Instagram check
  if (data.type === "full") {
    const igUrl = lead.website?.includes("instagram.com")
      ? lead.website
      : (foundInstagramUrl ?? null);

    if (igUrl) {
      console.log(`[enrichment] Running Instagram enrichment for: ${igUrl}`);
      const ig = await checkInstagram(igUrl);
      patch.hasInstagram = Boolean(ig.username);
      patch.instagramUsername = ig.username;
      patch.instagramUrl = ig.profileUrl;
      patch.instagramFollowers = ig.followersCount;
      patch.instagramBiography = ig.biography;
      patch.instagramIsBusinessAccount = ig.isBusinessAccount;
      patch.instagramExternalUrl = ig.externalUrl;
    } else {
      console.log(`[enrichment] No Instagram URL found for lead ${lead.id}`);
    }
  }

  // LinkedIn Enrichment
  const linkedinUrl = patch.linkedinUrl ?? lead.linkedinUrl;
  if (linkedinUrl && data.type === "full") {
    console.log(`[enrichment] Scraping LinkedIn profile: ${linkedinUrl}`);
    const li = await enrichWithLinkedin(linkedinUrl);
    patch.hasLinkedin = Boolean(li.employeeCountRange);
    patch.employeeCountRange = li.employeeCountRange;
    // We could add industry/headquarters if we add them to the schema
  }

  // Sanitize website field — clear if it's a social/messaging URL
  if (!isActualWebsite(lead.website)) {
    patch.website = null;
    patch.hasWebsite = false;
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
