"use server";

import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lte,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import { campaignLeads } from "@/db/schema/campaign-leads";
import { campaigns } from "@/db/schema/campaigns";
import { leads } from "@/db/schema/leads";
import { messages } from "@/db/schema/messages";
import { normalizePhone, safeJsonParse } from "@/lib/helpers";

export type LeadFilters = {
  search?: string;
  category?: string[];
  city?: string[];
  status?: string[];
  scoreMin?: number;
  scoreMax?: number;
  hasWebsite?: boolean;
  campaignId?: string;
  aiClassification?: string[];
  sortBy?: "score" | "name" | "lastContactedAt" | "createdAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

function buildLeadWhere(organizationId: string, filters: LeadFilters) {
  const clauses = [eq(leads.organizationId, organizationId)];

  if (filters.search) {
    const pattern = `%${filters.search.toLowerCase()}%`;
    clauses.push(
      sql`lower(${leads.name}) like ${pattern} or lower(coalesce(${leads.phone}, '')) like ${pattern}`
    );
  }

  if (filters.category?.length) {
    clauses.push(inArray(leads.category, filters.category));
  }

  if (filters.city?.length) {
    clauses.push(inArray(leads.city, filters.city));
  }

  if (filters.status?.length) {
    clauses.push(inArray(leads.status, filters.status as Array<(typeof leads.$inferSelect)["status"]>));
  }

  if (typeof filters.scoreMin === "number") {
    clauses.push(gte(leads.score, filters.scoreMin));
  }

  if (typeof filters.scoreMax === "number") {
    clauses.push(lte(leads.score, filters.scoreMax));
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

  if (filters.campaignId) {
    const subquery = db
      .select({ leadId: campaignLeads.leadId })
      .from(campaignLeads)
      .where(eq(campaignLeads.campaignId, filters.campaignId));

    clauses.push(inArray(leads.id, subquery));
  }

  return and(...clauses);
}

function buildLeadOrder(filters: LeadFilters) {
  const sortOrder = filters.sortOrder ?? "desc";
  const sortBy = filters.sortBy ?? "score";

  const sort = sortOrder === "asc" ? asc : desc;

  switch (sortBy) {
    case "name":
      return [sort(leads.name)];
    case "lastContactedAt":
      return [sort(leads.lastContactedAt), desc(leads.score)];
    case "createdAt":
      return [sort(leads.createdAt)];
    case "score":
    default:
      return [sort(leads.score), desc(leads.createdAt)];
  }
}

export async function getLeads(organizationId: string, filters: LeadFilters = {}) {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 100);
  const offset = (page - 1) * pageSize;

  const where = buildLeadWhere(organizationId, filters);

  const rows = await db
    .select()
    .from(leads)
    .where(where)
    .orderBy(...buildLeadOrder(filters))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(where);

  return {
    rows,
    count,
    page,
    pageSize,
  };
}

export async function getLead(id: string) {
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, id),
  });

  if (!lead) return null;

  const campaignRows = await db
    .select({
      campaignLeadId: campaignLeads.id,
      campaignId: campaigns.id,
      campaignName: campaigns.name,
      campaignStatus: campaigns.status,
      pipelineStage: campaignLeads.pipelineStage,
      leadStatus: campaignLeads.status,
      campaignScore: campaignLeads.campaignScore,
      needsHumanReview: campaignLeads.needsHumanReview,
    })
    .from(campaignLeads)
    .innerJoin(campaigns, eq(campaigns.id, campaignLeads.campaignId))
    .where(eq(campaignLeads.leadId, id))
    .orderBy(desc(campaignLeads.createdAt));

  const recentMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.leadId, id))
    .orderBy(desc(messages.createdAt))
    .limit(20);

  return {
    ...lead,
    campaignRows,
    recentMessages,
    parsedScoreBreakdown: safeJsonParse<Record<string, number>>(
      typeof lead.scoreBreakdown === "string" ? lead.scoreBreakdown : null,
      {}
    ),
  };
}

export async function createLead(
  input: Omit<
    typeof leads.$inferInsert,
    "id" | "createdAt" | "updatedAt" | "hasWebsite"
  >
) {
  const normalizedPhone = normalizePhone(input.phone);
  const [created] = await db
    .insert(leads)
    .values({
      ...input,
      phone: normalizedPhone,
      hasWebsite: Boolean(input.website),
      sourceType: input.sourceType ?? "manual",
    })
    .returning();

  return created;
}

export async function updateLead(
  id: string,
  input: Partial<Omit<typeof leads.$inferInsert, "id" | "organizationId">>
) {
  const payload: Partial<typeof leads.$inferInsert> = {
    ...input,
    updatedAt: new Date(),
  };

  if (input.phone) {
    payload.phone = normalizePhone(input.phone);
  }

  if (typeof input.website !== "undefined") {
    payload.hasWebsite = Boolean(input.website);
  }

  const [updated] = await db
    .update(leads)
    .set(payload)
    .where(eq(leads.id, id))
    .returning();

  return updated;
}

export async function deleteLead(id: string) {
  // MVP soft-delete to preserve message and campaign history.
  const [updated] = await db
    .update(leads)
    .set({
      doNotContact: true,
      status: "blocked",
      updatedAt: new Date(),
    })
    .where(eq(leads.id, id))
    .returning();

  return updated;
}

export async function bulkAddToCampaign(
  leadIds: string[],
  campaignId: string,
  organizationId: string
) {
  if (!leadIds.length) return { inserted: 0 };

  const payload = leadIds.map((leadId) => ({
    campaignId,
    leadId,
    organizationId,
    campaignScore: 0,
    status: "pending" as const,
    pipelineStage: "new" as const,
  }));

  await db
    .insert(campaignLeads)
    .values(payload)
    .onConflictDoNothing({
      target: [campaignLeads.campaignId, campaignLeads.leadId],
    });

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(campaignLeads)
    .where(
      and(
        eq(campaignLeads.campaignId, campaignId),
        inArray(campaignLeads.leadId, leadIds)
      )
    );

  return {
    inserted: count,
  };
}

export async function getLeadBoard(
  organizationId: string,
  campaignId: string,
  filters?: { minScore?: number; maxScore?: number }
) {
  const clauses = [
    eq(campaignLeads.organizationId, organizationId),
    eq(campaignLeads.campaignId, campaignId),
  ];

  if (typeof filters?.minScore === "number") {
    clauses.push(gte(campaignLeads.campaignScore, filters.minScore));
  }

  if (typeof filters?.maxScore === "number") {
    clauses.push(lte(campaignLeads.campaignScore, filters.maxScore));
  }

  const rows = await db
    .select({
      campaignLeadId: campaignLeads.id,
      pipelineStage: campaignLeads.pipelineStage,
      status: campaignLeads.status,
      campaignScore: campaignLeads.campaignScore,
      contactedAt: campaignLeads.contactedAt,
      leadId: leads.id,
      leadName: leads.name,
      leadCategory: leads.category,
      leadCity: leads.city,
      leadScore: leads.score,
      leadUpdatedAt: leads.updatedAt,
    })
    .from(campaignLeads)
    .innerJoin(leads, eq(leads.id, campaignLeads.leadId))
    .where(and(...clauses))
    .orderBy(desc(campaignLeads.campaignScore), desc(campaignLeads.updatedAt));

  return rows;
}

export async function updateCampaignLeadStage(
  campaignLeadId: string,
  pipelineStage: (typeof campaignLeads.$inferInsert)["pipelineStage"]
) {
  const [updated] = await db
    .update(campaignLeads)
    .set({
      pipelineStage,
      updatedAt: new Date(),
    })
    .where(eq(campaignLeads.id, campaignLeadId))
    .returning();

  return updated;
}

export async function getFilterOptions(organizationId: string) {
  const categoryRows = await db
    .selectDistinct({ category: leads.category })
    .from(leads)
    .where(and(eq(leads.organizationId, organizationId), sql`${leads.category} is not null`))
    .orderBy(asc(leads.category));

  const cityRows = await db
    .selectDistinct({ city: leads.city })
    .from(leads)
    .where(and(eq(leads.organizationId, organizationId), sql`${leads.city} is not null`))
    .orderBy(asc(leads.city));

  return {
    categories: categoryRows.map((r) => r.category!),
    cities: cityRows.map((r) => r.city!),
  };
}

export async function searchLeadsQuick(
  organizationId: string,
  query: string,
  limit = 8
) {
  const pattern = `%${query.toLowerCase()}%`;

  return db
    .select({
      id: leads.id,
      name: leads.name,
      city: leads.city,
      score: leads.score,
      status: leads.status,
    })
    .from(leads)
    .where(
      and(
        eq(leads.organizationId, organizationId),
        sql`lower(${leads.name}) like ${pattern}`
      )
    )
    .orderBy(desc(leads.score), asc(leads.name))
    .limit(limit);
}
