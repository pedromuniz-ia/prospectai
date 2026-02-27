import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema/audit-logs";
import { campaigns } from "@/db/schema/campaigns";
import { messages } from "@/db/schema/messages";
import { createNotificationRecord } from "@/lib/notifications";

export async function getDeliveryFailureRate(
  organizationId: string,
  whatsappInstanceId: string,
  now = new Date()
) {
  const threshold = new Date(now.getTime() - 60 * 60 * 1000);

  const [stats] = await db
    .select({
      total: sql<number>`count(*)`,
      failed: sql<number>`sum(case when ${messages.status} = 'failed' then 1 else 0 end)`,
    })
    .from(messages)
    .where(
      and(
        eq(messages.organizationId, organizationId),
        eq(messages.whatsappInstanceId, whatsappInstanceId),
        eq(messages.direction, "outbound"),
        gte(messages.createdAt, threshold)
      )
    );

  const total = Number(stats?.total ?? 0);
  const failed = Number(stats?.failed ?? 0);

  if (total === 0) {
    return {
      total,
      failed,
      rate: 0,
    };
  }

  return {
    total,
    failed,
    rate: failed / total,
  };
}

export async function enforceAntiBan(
  organizationId: string,
  whatsappInstanceId: string,
  now = new Date()
) {
  const metrics = await getDeliveryFailureRate(
    organizationId,
    whatsappInstanceId,
    now
  );

  if (metrics.rate <= 0.2 || metrics.total < 10) {
    return {
      paused: false,
      ...metrics,
    };
  }

  await db
    .update(campaigns)
    .set({
      status: "paused",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(campaigns.organizationId, organizationId),
        eq(campaigns.whatsappInstanceId, whatsappInstanceId),
        eq(campaigns.status, "active")
      )
    );

  await db.insert(auditLogs).values({
    organizationId,
    action: "anti_ban_pause",
    entityType: "whatsapp_instance",
    entityId: whatsappInstanceId,
    metadata: {
      failureRate: metrics.rate,
      failed: metrics.failed,
      total: metrics.total,
    },
  });

  await createNotificationRecord({
    organizationId,
    type: "campaign_paused",
    title: "Campanha pausada automaticamente",
    body: `Falhas de entrega acima de 20% na ultima hora (${Math.round(
      metrics.rate * 100
    )}%).`,
    entityType: "whatsapp_instance",
    entityId: whatsappInstanceId,
  });

  return {
    paused: true,
    ...metrics,
  };
}
