import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
import { organization } from "./auth";
import { campaigns } from "./campaigns";
import { leads } from "./leads";

export const campaignLeads = sqliteTable(
  "campaign_leads",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id),
    campaignScore: integer("campaign_score").notNull().default(0),
    campaignScoreBreakdown: text("campaign_score_breakdown", {
      mode: "json",
    }),
    status: text("status", {
      enum: [
        "pending",
        "queued",
        "sent",
        "replied",
        "converted",
        "rejected",
        "skipped",
      ],
    })
      .notNull()
      .default("pending"),
    pipelineStage: text("pipeline_stage", {
      enum: [
        "new",
        "approached",
        "replied",
        "interested",
        "proposal",
        "won",
        "lost",
      ],
    })
      .notNull()
      .default("new"),
    scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
    contactedAt: integer("contacted_at", { mode: "timestamp" }),
    autoRepliesSent: integer("auto_replies_sent").notNull().default(0),
    needsHumanReview: integer("needs_human_review", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("campaign_leads_unique_idx").on(
      table.campaignId,
      table.leadId
    ),
    index("campaign_leads_campaign_id_idx").on(table.campaignId),
    index("campaign_leads_lead_id_idx").on(table.leadId),
    index("campaign_leads_status_idx").on(table.campaignId, table.status),
  ]
);
