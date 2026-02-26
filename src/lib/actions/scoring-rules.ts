"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { leads } from "@/db/schema/leads";
import { scoringRules } from "@/db/schema/scoring-rules";
import { enrichmentQueue } from "@/lib/queue";

export async function getScoringRules(organizationId: string, objective?: string) {
  return db.query.scoringRules.findMany({
    where:
      objective && objective !== "all"
        ? and(
            eq(scoringRules.organizationId, organizationId),
            eq(
              scoringRules.objective,
              objective as (typeof scoringRules.$inferSelect)["objective"]
            )
          )
        : eq(scoringRules.organizationId, organizationId),
    orderBy: [asc(scoringRules.objective), desc(scoringRules.points)],
  });
}

export async function createScoringRule(
  input: Omit<typeof scoringRules.$inferInsert, "id" | "createdAt" | "updatedAt">
) {
  const [created] = await db.insert(scoringRules).values(input).returning();
  return created;
}

export async function updateScoringRule(
  ruleId: string,
  input: Partial<Omit<typeof scoringRules.$inferInsert, "id" | "organizationId">>
) {
  const [updated] = await db
    .update(scoringRules)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(scoringRules.id, ruleId))
    .returning();

  return updated;
}

export async function deleteScoringRule(ruleId: string) {
  await db.delete(scoringRules).where(eq(scoringRules.id, ruleId));
}

export async function seedDefaultScoringRules(organizationId: string) {
  const existing = await db.query.scoringRules.findMany({
    where: eq(scoringRules.organizationId, organizationId),
    limit: 1,
  });

  if (existing.length > 0) {
    return { seeded: false };
  }

  await db.insert(scoringRules).values([
    {
      organizationId,
      objective: "global",
      field: "hasWebsite",
      operator: "eq",
      value: false,
      points: 30,
      label: "Sem website",
      active: true,
    },
    {
      organizationId,
      objective: "global",
      field: "googleReviewCount",
      operator: "lt",
      value: 40,
      points: 15,
      label: "Baixo volume de avaliações",
      active: true,
    },
    {
      organizationId,
      objective: "sell_ai_agent",
      field: "googleReviewCount",
      operator: "gte",
      value: 80,
      points: 20,
      label: "Alto volume de atendimento",
      active: true,
    },
  ]);

  return { seeded: true };
}

export async function recalculateAllLeadScores(organizationId: string) {
  const leadRows = await db
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.organizationId, organizationId));

  for (const row of leadRows) {
    await enrichmentQueue.add("recalculate-score", {
      leadId: row.id,
      organizationId,
      type: "score",
    });
  }

  return {
    queued: leadRows.length,
  };
}

export async function getScoreRuleObjectives(organizationId: string) {
  const rows = await db
    .selectDistinct({ objective: scoringRules.objective })
    .from(scoringRules)
    .where(eq(scoringRules.organizationId, organizationId));

  return ["all", ...rows.map((row) => row.objective)].filter(
    (value, index, all) => all.indexOf(value) === index
  );
}
