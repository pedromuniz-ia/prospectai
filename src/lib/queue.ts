import { Queue } from "bullmq";
import IORedis from "ioredis";

export const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

export const extractionQueue = new Queue("extraction", { connection });
export const enrichmentQueue = new Queue("enrichment", { connection });
export const cadenceQueue = new Queue("cadence", { connection });
export const aiReplyQueue = new Queue("ai-reply", { connection });
export const messageSendQueue = new Queue("message-send", { connection });
export const schedulerQueue = new Queue("scheduler", { connection });
