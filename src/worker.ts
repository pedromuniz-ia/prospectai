import "./lib/runtime-env-bootstrap";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { processExtraction } from "./workers/extraction";
import { processEnrichment } from "./workers/enrichment";

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

new Worker("extraction", processExtraction, {
  connection,
  concurrency: 2,
});

new Worker("enrichment", processEnrichment, {
  connection,
  concurrency: 5,
});

function shutdown() {
  console.log("[worker] Shutting down...");
  connection.disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("[worker] Started — 2 workers (extraction, enrichment)");
