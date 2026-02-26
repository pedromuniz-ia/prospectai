import { Job } from "bullmq";

export async function processCadence(job: Job) {
  console.log("[cadence] Processing:", job.id, job.data);
  // Implementation in Task 14 (message selection, variation, scheduling)
}
