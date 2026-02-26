import { Job } from "bullmq";

export async function processEnrichment(job: Job) {
  console.log("[enrichment] Processing:", job.id, job.data);
  // Implementation in Task 12 (RDAP, website check, scoring, AI classification)
}
