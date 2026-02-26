import { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { whatsappInstances } from "@/db/schema/whatsapp-instances";
import { enforceAntiBan } from "@/lib/cadence/anti-ban";
import {
  advanceWarmupDay,
  feedCadenceQueue,
  resetDailyCounters,
} from "@/lib/cadence/scheduler";
import { createNotificationRecord } from "@/lib/notifications";

export async function processScheduler(job: Job) {
  switch (job.name) {
    case "feed-cadence": {
      const summary = await feedCadenceQueue();
      console.log(
        `[scheduler] feed-cadence queued=${summary.queuedJobs} campaigns=${summary.campaignsProcessed}`
      );
      break;
    }

    case "reset-counters":
      await resetDailyCounters();
      console.log("[scheduler] daily counters reset");
      break;

    case "warmup-advance":
      await advanceWarmupDay();
      console.log("[scheduler] warmup advanced");
      break;

    case "health-check": {
      const instances = await db.query.whatsappInstances.findMany({
        where: eq(whatsappInstances.status, "connected"),
      });

      for (const instance of instances) {
        await enforceAntiBan(instance.organizationId, instance.id);
      }

      const disconnected = await db.query.whatsappInstances.findMany({
        where: eq(whatsappInstances.status, "disconnected"),
      });

      for (const instance of disconnected) {
        await createNotificationRecord({
          organizationId: instance.organizationId,
          type: "instance_disconnected",
          title: "Instância desconectada",
          body: `${instance.instanceName} está desconectada.`,
          entityType: "whatsapp_instance",
          entityId: instance.id,
        });
      }

      break;
    }

    default:
      console.log("[scheduler] Unknown job:", job.name);
  }
}
