import { and, asc, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { campaignLeads } from "@/db/schema/campaign-leads";
import { campaigns } from "@/db/schema/campaigns";
import { warmupConfigs } from "@/db/schema/warmup-configs";
import { whatsappInstances } from "@/db/schema/whatsapp-instances";
import { cadenceQueue } from "@/lib/queue";
import {
  buildDispatchPlan,
  isWithinScheduleWindow,
} from "@/lib/cadence/scheduler-core";

export { buildDispatchPlan, isWithinScheduleWindow } from "@/lib/cadence/scheduler-core";

async function getWarmupLimit(
  organizationId: string,
  whatsappInstanceId: string | null
): Promise<number | null> {
  if (!whatsappInstanceId) return null;

  const config = await db.query.warmupConfigs.findFirst({
    where: and(
      eq(warmupConfigs.organizationId, organizationId),
      eq(warmupConfigs.whatsappInstanceId, whatsappInstanceId)
    ),
  });

  if (!config) return null;
  return config.currentDailyLimit;
}

export async function feedCadenceQueue(now = new Date()) {
  const activeCampaigns = await db.query.campaigns.findMany({
    where: eq(campaigns.status, "active"),
    orderBy: [asc(campaigns.createdAt)],
  });

  const summary = {
    queuedJobs: 0,
    campaignsProcessed: 0,
  };

  for (const campaign of activeCampaigns) {
    const inWindow = isWithinScheduleWindow(
      {
        scheduleStart: campaign.scheduleStart,
        scheduleEnd: campaign.scheduleEnd,
        scheduleDays: campaign.scheduleDays ?? null,
      },
      now
    );

    if (!inWindow) continue;

    const instance = campaign.whatsappInstanceId
      ? await db.query.whatsappInstances.findFirst({
          where: eq(whatsappInstances.id, campaign.whatsappInstanceId),
        })
      : null;

    if (!instance || instance.status !== "connected") continue;

    if (campaign.dailySent >= campaign.dailyLimit) continue;
    if (instance.dailyMessagesSent >= instance.dailyMessageLimit) continue;

    const warmupLimit = await getWarmupLimit(
      campaign.organizationId,
      campaign.whatsappInstanceId
    );

    const remainingCampaign = campaign.dailyLimit - campaign.dailySent;
    const remainingInstance =
      instance.dailyMessageLimit - instance.dailyMessagesSent;
    const remainingWarmup =
      typeof warmupLimit === "number"
        ? Math.max(warmupLimit - instance.dailyMessagesSent, 0)
        : Number.MAX_SAFE_INTEGER;

    const remaining = Math.min(remainingCampaign, remainingInstance, remainingWarmup);

    if (remaining <= 0) continue;

    const pendingLeads = await db.query.campaignLeads.findMany({
      where: and(
        eq(campaignLeads.campaignId, campaign.id),
        eq(campaignLeads.status, "pending")
      ),
      orderBy: [desc(campaignLeads.campaignScore), asc(campaignLeads.createdAt)],
      limit: remaining,
    });

    if (!pendingLeads.length) continue;

    const delays = buildDispatchPlan(
      pendingLeads.length,
      campaign.minInterval,
      campaign.maxInterval
    );

    for (const [index, campaignLead] of pendingLeads.entries()) {
      await cadenceQueue.add(
        "cadence-send",
        {
          campaignLeadId: campaignLead.id,
          campaignId: campaign.id,
          organizationId: campaign.organizationId,
          whatsappInstanceId: campaign.whatsappInstanceId,
        },
        {
          delay: delays[index],
        }
      );

      await db
        .update(campaignLeads)
        .set({
          status: "queued",
          scheduledAt: new Date(now.getTime() + delays[index]),
          updatedAt: new Date(),
        })
        .where(eq(campaignLeads.id, campaignLead.id));

      summary.queuedJobs += 1;
    }

    summary.campaignsProcessed += 1;
  }

  return summary;
}

export async function resetDailyCounters() {
  await db
    .update(campaigns)
    .set({ dailySent: 0, updatedAt: new Date() })
    .where(gt(campaigns.dailySent, 0));

  await db
    .update(whatsappInstances)
    .set({ dailyMessagesSent: 0, updatedAt: new Date() })
    .where(gt(whatsappInstances.dailyMessagesSent, 0));
}

export async function advanceWarmupDay() {
  const rows = await db.query.warmupConfigs.findMany({
    where: eq(warmupConfigs.warmupCompleted, false),
  });

  for (const row of rows) {
    const nextDay = row.currentDay + 1;
    const matched = row.schedule.find(
      (entry) => nextDay >= entry.days[0] && nextDay <= entry.days[1]
    );

    const limit = matched?.limit ?? row.currentDailyLimit;

    await db
      .update(warmupConfigs)
      .set({
        currentDay: nextDay,
        currentDailyLimit: limit,
        warmupCompleted: nextDay >= 15,
        completedAt: nextDay >= 15 ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(warmupConfigs.id, row.id));
  }
}
