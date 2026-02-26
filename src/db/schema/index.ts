// Better Auth tables
export {
  user,
  session,
  account,
  verification,
  organization,
  member,
  invitation,
} from "./auth";

// App tables
export { whatsappInstances } from "./whatsapp-instances";
export { leads } from "./leads";
export { campaigns } from "./campaigns";
export { campaignLeads } from "./campaign-leads";
export { messages } from "./messages";
export { aiProviders } from "./ai-providers";
export { scoringRules } from "./scoring-rules";
export { extractionJobs } from "./extraction-jobs";
export { warmupConfigs } from "./warmup-configs";
export { auditLogs } from "./audit-logs";
export { messageTemplates } from "./message-templates";
