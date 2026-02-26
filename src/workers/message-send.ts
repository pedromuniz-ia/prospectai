import { Job } from "bullmq";

export async function processMessageSend(job: Job) {
  console.log("[message-send] Processing:", job.id, job.data);
  // Implementation in Task 14 (Evolution API send with anti-ban delays)
}
