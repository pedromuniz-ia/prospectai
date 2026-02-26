"use server";

import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import { campaignLeads } from "@/db/schema/campaign-leads";
import { campaigns } from "@/db/schema/campaigns";
import { leads } from "@/db/schema/leads";
import { whatsappInstances } from "@/db/schema/whatsapp-instances";
import { aiProviders } from "@/db/schema/ai-providers";

export type CampaignFilters = {
  categories?: string[];
  cities?: string[];
  minScore?: number;
  hasWebsite?: boolean;
  aiClassification?: string[];
};

function buildLeadFilterWhere(
  organizationId: string,
  filters: CampaignFilters
) {
  const clauses = [
    eq(leads.organizationId, organizationId),
    eq(leads.doNotContact, false),
  ];

  if (filters.categories?.length) {
    clauses.push(inArray(leads.category, filters.categories));
  }

  if (filters.cities?.length) {
    clauses.push(inArray(leads.city, filters.cities));
  }

  if (typeof filters.minScore === "number") {
    clauses.push(gte(leads.score, filters.minScore));
  }

  if (typeof filters.hasWebsite === "boolean") {
    clauses.push(eq(leads.hasWebsite, filters.hasWebsite));
  }

  if (filters.aiClassification?.length) {
    const values = filters.aiClassification.filter(
      (value): value is Exclude<(typeof leads.$inferSelect)["aiClassification"], null> =>
        value !== null
    );
    if (values.length) {
      clauses.push(inArray(leads.aiClassification, values));
    }
  }

  return and(...clauses);
}

async function matchLeads(
  organizationId: string,
  filters: CampaignFilters
) {
  return db
    .select()
    .from(leads)
    .where(buildLeadFilterWhere(organizationId, filters))
    .orderBy(desc(leads.score), asc(leads.createdAt));
}

export async function getCampaigns(organizationId: string) {
  const rows = await db.query.campaigns.findMany({
    where: eq(campaigns.organizationId, organizationId),
    orderBy: [desc(campaigns.createdAt)],
  });

  const withStats = await Promise.all(
    rows.map(async (campaign) => {
      const [stats] = await db
        .select({
          leadsCount: sql<number>`count(*)`,
          sent: sql<number>`sum(case when ${campaignLeads.status} in ('sent','replied','converted') then 1 else 0 end)`,
          replied: sql<number>`sum(case when ${campaignLeads.status} in ('replied','converted') then 1 else 0 end)`,
        })
        .from(campaignLeads)
        .where(eq(campaignLeads.campaignId, campaign.id));

      const leadsCount = Number(stats?.leadsCount ?? 0);
      const sent = Number(stats?.sent ?? 0);
      const replied = Number(stats?.replied ?? 0);

      return {
        ...campaign,
        stats: {
          leadsCount,
          sent,
          replied,
          replyRate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
        },
      };
    })
  );

  return withStats;
}

export async function getCampaign(campaignId: string) {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
  });

  if (!campaign) return null;

  const leadsRows = await db
    .select({
      campaignLeadId: campaignLeads.id,
      leadId: leads.id,
      leadName: leads.name,
      city: leads.city,
      score: campaignLeads.campaignScore,
      status: campaignLeads.status,
      pipelineStage: campaignLeads.pipelineStage,
      needsHumanReview: campaignLeads.needsHumanReview,
    })
    .from(campaignLeads)
    .innerJoin(leads, eq(leads.id, campaignLeads.leadId))
    .where(eq(campaignLeads.campaignId, campaignId))
    .orderBy(desc(campaignLeads.campaignScore), asc(campaignLeads.createdAt));

  return {
    ...campaign,
    leads: leadsRows,
  };
}

export async function getMatchingLeadsPreview(
  organizationId: string,
  filters: CampaignFilters
) {
  const where = buildLeadFilterWhere(organizationId, filters);

  const [summary] = await db
    .select({
      count: sql<number>`count(*)`,
      highScoreCount: sql<number>`sum(case when ${leads.score} > 60 then 1 else 0 end)`,
    })
    .from(leads)
    .where(where);

  const sample = await db
    .select({
      id: leads.id,
      name: leads.name,
      city: leads.city,
      score: leads.score,
      category: leads.category,
    })
    .from(leads)
    .where(where)
    .orderBy(desc(leads.score))
    .limit(8);

  return {
    count: Number(summary?.count ?? 0),
    highScoreCount: Number(summary?.highScoreCount ?? 0),
    sample,
  };
}

export async function createCampaign(input: {
  organizationId: string;
  name: string;
  objective: (typeof campaigns.$inferInsert)["objective"];
  filters: CampaignFilters;
  scheduleStart?: string;
  scheduleEnd?: string;
  scheduleDays?: string[];
  minInterval?: number;
  maxInterval?: number;
  dailyLimit?: number;
  firstMessageVariants: string[];
  aiEnabled?: boolean;
  aiProviderId?: string | null;
  aiModel?: string | null;
  aiSystemPrompt?: string | null;
  aiMaxAutoReplies?: number;
  aiTemperature?: number;
  whatsappInstanceId?: string | null;
}) {
  // Validate FK references exist before inserting
  let validWhatsappInstanceId: string | null = null;
  if (input.whatsappInstanceId) {
    const instance = await db.query.whatsappInstances.findFirst({
      where: eq(whatsappInstances.id, input.whatsappInstanceId),
      columns: { id: true },
    });
    validWhatsappInstanceId = instance?.id ?? null;
  }

  let validAiProviderId: string | null = null;
  if (input.aiProviderId) {
    const provider = await db.query.aiProviders.findFirst({
      where: eq(aiProviders.id, input.aiProviderId),
      columns: { id: true },
    });
    validAiProviderId = provider?.id ?? null;
  }

  const [created] = await db
    .insert(campaigns)
    .values({
      organizationId: input.organizationId,
      name: input.name,
      objective: input.objective,
      status: "draft",
      filters: input.filters,
      scheduleStart: input.scheduleStart ?? "09:00",
      scheduleEnd: input.scheduleEnd ?? "18:00",
      scheduleDays: input.scheduleDays ?? ["mon", "tue", "wed", "thu", "fri"],
      minInterval: input.minInterval ?? 180,
      maxInterval: input.maxInterval ?? 300,
      dailyLimit: input.dailyLimit ?? 40,
      firstMessageVariants: input.firstMessageVariants,
      aiEnabled: input.aiEnabled ?? true,
      aiProviderId: validAiProviderId,
      aiModel: input.aiModel ?? null,
      aiSystemPrompt: input.aiSystemPrompt ?? null,
      aiMaxAutoReplies: input.aiMaxAutoReplies ?? 3,
      aiTemperature: input.aiTemperature ?? 0.7,
      whatsappInstanceId: validWhatsappInstanceId,
    })
    .returning();

  const matchedLeads = await matchLeads(input.organizationId, input.filters);

  if (matchedLeads.length) {
    await db.insert(campaignLeads).values(
      matchedLeads.map((lead) => ({
        campaignId: created.id,
        leadId: lead.id,
        organizationId: input.organizationId,
        campaignScore: lead.score,
        campaignScoreBreakdown: lead.scoreBreakdown,
        status: "pending" as const,
        pipelineStage: "new" as const,
      }))
    );
  }

  return {
    campaign: created,
    matchedLeadsCount: matchedLeads.length,
  };
}

export async function updateCampaign(
  campaignId: string,
  input: Partial<Omit<typeof campaigns.$inferInsert, "id" | "organizationId">>
) {
  const [updated] = await db
    .update(campaigns)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaignId))
    .returning();

  return updated;
}

export async function pauseCampaign(campaignId: string) {
  const [updated] = await db
    .update(campaigns)
    .set({
      status: "paused",
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaignId))
    .returning();

  return updated;
}

export async function resumeCampaign(campaignId: string) {
  const [updated] = await db
    .update(campaigns)
    .set({
      status: "active",
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaignId))
    .returning();

  return updated;
}

export async function getLeadCampaignContext(leadId: string) {
  return db.query.campaignLeads.findFirst({
    where: and(eq(campaignLeads.leadId, leadId), inArray(campaignLeads.status, ["pending", "queued", "sent", "replied"])),
    orderBy: [desc(campaignLeads.updatedAt)],
  });
}
