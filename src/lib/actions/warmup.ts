"use server";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { warmupConfigs } from "@/db/schema/warmup-configs";
import { whatsappInstances } from "@/db/schema/whatsapp-instances";

export async function getWarmupConfigs(organizationId: string) {
  const rows = await db
    .select({
      config: warmupConfigs,
      instance: whatsappInstances,
    })
    .from(warmupConfigs)
    .innerJoin(
      whatsappInstances,
      eq(whatsappInstances.id, warmupConfigs.whatsappInstanceId)
    )
    .where(eq(warmupConfigs.organizationId, organizationId))
    .orderBy(asc(whatsappInstances.instanceName));

  return rows;
}

export async function ensureWarmupConfig(
  organizationId: string,
  whatsappInstanceId: string
) {
  const existing = await db.query.warmupConfigs.findFirst({
    where: and(
      eq(warmupConfigs.organizationId, organizationId),
      eq(warmupConfigs.whatsappInstanceId, whatsappInstanceId)
    ),
  });

  if (existing) return existing;

  const [created] = await db
    .insert(warmupConfigs)
    .values({
      organizationId,
      whatsappInstanceId,
      currentDay: 1,
      currentDailyLimit: 10,
      warmupCompleted: false,
    })
    .returning();

  return created;
}

export async function updateWarmupSchedule(
  configId: string,
  schedule: Array<{ days: [number, number]; limit: number }>
) {
  const [updated] = await db
    .update(warmupConfigs)
    .set({
      schedule,
      updatedAt: new Date(),
    })
    .where(eq(warmupConfigs.id, configId))
    .returning();

  return updated;
}

export async function setWarmupDailyLimit(configId: string, limit: number) {
  const [updated] = await db
    .update(warmupConfigs)
    .set({
      currentDailyLimit: limit,
      updatedAt: new Date(),
    })
    .where(eq(warmupConfigs.id, configId))
    .returning();

  return updated;
}

export async function setWarmupCurrentDay(configId: string, day: number) {
  const [updated] = await db
    .update(warmupConfigs)
    .set({
      currentDay: day,
      warmupCompleted: day >= 15,
      completedAt: day >= 15 ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(warmupConfigs.id, configId))
    .returning();

  return updated;
}
