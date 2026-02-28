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
import { leads } from "@/db/schema/leads";
import { normalizePhone, safeJsonParse } from "@/lib/helpers";
import { enrichmentQueue } from "@/lib/queue";

export async function reenrichLead(id: string, organizationId: string) {
  await enrichmentQueue.add("enrichment-full", {
    leadId: id,
    organizationId,
    type: "full",
  });
  return { success: true };
}

export type LeadFilters = {
  search?: string;
  category?: string[];
  city?: string[];
  status?: string[];
  scoreMin?: number;
  scoreMax?: number;
  hasWebsite?: boolean;
  aiClassification?: string[];
  sortBy?: "score" | "name" | "createdAt";
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

  return and(...clauses);
}

function buildLeadOrder(filters: LeadFilters) {
  const sortOrder = filters.sortOrder ?? "desc";
  const sortBy = filters.sortBy ?? "score";

  const sort = sortOrder === "asc" ? asc : desc;

  switch (sortBy) {
    case "name":
      return [sort(leads.name)];
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

  return {
    ...lead,
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
