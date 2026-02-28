import "./lib/runtime-env-bootstrap";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { processExtraction } from "./workers/extraction";
import { processEnrichment } from "./workers/enrichment";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ioredis version mismatch between bullmq's bundled copy and top-level
const connection: any = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  reconnectOnError: () => true,
});

connection.on("error", (err: Error) => {
  console.error("[worker] Redis connection error:", err.message);
});

const extractionWorker = new Worker("extraction", processExtraction, {
  connection,
  concurrency: 2,
});

const enrichmentWorker = new Worker("enrichment", processEnrichment, {
  connection,
  concurrency: 5,
});

// Log worker errors instead of crashing
extractionWorker.on("error", (err) => {
  console.error("[worker][extraction] Error:", err.message);
});

enrichmentWorker.on("error", (err) => {
  console.error("[worker][enrichment] Error:", err.message);
});

let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[worker] Received ${signal}. Shutting down gracefully...`);

  // Close workers first (waits for in-progress jobs to finish, up to 10s)
  try {
    await Promise.allSettled([
      extractionWorker.close(),
      enrichmentWorker.close(),
    ]);
    console.log("[worker] BullMQ workers closed");
  } catch (err) {
    console.error("[worker] Error closing BullMQ workers:", err);
  }

  // Then disconnect Redis
  try {
    await connection.quit();
    console.log("[worker] Redis connection closed");
  } catch (err) {
    console.error("[worker] Error disconnecting Redis:", err);
  }

  console.log("[worker] Shutdown complete");
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Prevent crashes from killing the worker
process.on("uncaughtException", (err) => {
  console.error("[worker] Uncaught exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[worker] Unhandled rejection:", reason);
});

console.log("[worker] Started — 2 workers (extraction, enrichment)");

