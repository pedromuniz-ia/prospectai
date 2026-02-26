import "dotenv/config";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { processExtraction } from "./workers/extraction";
import { processEnrichment } from "./workers/enrichment";
import { processCadence } from "./workers/cadence";
import { processAiReply } from "./workers/ai-reply";
import { processMessageSend } from "./workers/message-send";
import { processScheduler } from "./workers/scheduler";

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

// ── Workers ──

new Worker("extraction", processExtraction, {
  connection,
  concurrency: 2,
});

new Worker("enrichment", processEnrichment, {
  connection,
  concurrency: 5,
});

new Worker("cadence", processCadence, {
  connection,
  concurrency: 1,
});

new Worker("ai-reply", processAiReply, {
  connection,
  concurrency: 3,
});

new Worker("message-send", processMessageSend, {
  connection,
  concurrency: 1,
  limiter: { max: 1, duration: 10_000 }, // 1 message per 10 seconds
});

new Worker("scheduler", processScheduler, {
  connection,
  concurrency: 1,
});

// ── Job Schedulers (cron) ──

const schedulerQueue = new Queue("scheduler", { connection });

async function setupSchedulers() {
  // Feed cadence queue every minute
  await schedulerQueue.upsertJobScheduler(
    "feed-cadence",
    { pattern: "*/1 * * * *" },
    { name: "feed-cadence" }
  );

  // Reset daily counters at midnight
  await schedulerQueue.upsertJobScheduler(
    "reset-counters",
    { pattern: "0 0 * * *" },
    { name: "reset-counters" }
  );

  // Advance warmup at 1am
  await schedulerQueue.upsertJobScheduler(
    "warmup-advance",
    { pattern: "0 1 * * *" },
    { name: "warmup-advance" }
  );

  // Health check every 5 minutes
  await schedulerQueue.upsertJobScheduler(
    "health-check",
    { pattern: "*/5 * * * *" },
    { name: "health-check" }
  );
}

setupSchedulers()
  .then(() => {
    console.log("[worker] Process started — 6 workers + 4 cron schedulers");
  })
  .catch((err) => {
    console.error("[worker] Failed to start:", err);
    process.exit(1);
  });

// Graceful shutdown
function shutdown() {
  console.log("[worker] Shutting down...");
  connection.disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
