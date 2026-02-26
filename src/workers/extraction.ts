import { Job } from "bullmq";

export async function processExtraction(job: Job) {
  console.log("[extraction] Processing:", job.id, job.data);
  // Implementation in Task 11 (Apify Google Maps extraction)
}
