import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
import { organizations } from "./organizations";
import { leads } from "./leads";
import { campaignLeads } from "./campaign-leads";
import { whatsappInstances } from "./whatsapp-instances";

export const messages = sqliteTable(
  "messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id),
    campaignLeadId: text("campaign_lead_id").references(
      () => campaignLeads.id
    ),
    whatsappInstanceId: text("whatsapp_instance_id").references(
      () => whatsappInstances.id
    ),
    direction: text("direction", { enum: ["inbound", "outbound"] }).notNull(),
    content: text("content").notNull(),
    mediaType: text("media_type", {
      enum: ["text", "image", "audio", "video", "document"],
    }),
    mediaUrl: text("media_url"),
    source: text("source", {
      enum: ["manual", "ai_auto", "ai_approved", "cadence", "webhook"],
    }),
    aiGenerated: integer("ai_generated", { mode: "boolean" })
      .notNull()
      .default(false),
    aiModel: text("ai_model"),
    evolutionMessageId: text("evolution_message_id"),
    status: text("status", {
      enum: ["pending", "sent", "delivered", "read", "failed"],
    })
      .notNull()
      .default("pending"),
    sentAt: integer("sent_at", { mode: "timestamp" }),
    deliveredAt: integer("delivered_at", { mode: "timestamp" }),
    readAt: integer("read_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("messages_lead_id_created_at_idx").on(
      table.leadId,
      table.createdAt
    ),
    index("messages_campaign_lead_id_idx").on(
      table.campaignLeadId,
      table.createdAt
    ),
    index("messages_organization_id_idx").on(table.organizationId),
  ]
);
