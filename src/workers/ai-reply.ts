import { Job } from "bullmq";

export async function processAiReply(job: Job) {
  console.log("[ai-reply] Processing:", job.id, job.data);
  // Implementation in Task 15 (AI SDK multi-provider response generation)
}
