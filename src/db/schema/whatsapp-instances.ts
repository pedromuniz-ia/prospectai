import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
import { organizations } from "./organizations";

export const whatsappInstances = sqliteTable("whatsapp_instances", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  instanceName: text("instance_name").notNull(),
  instanceId: text("instance_id"),
  phone: text("phone"),
  status: text("status", {
    enum: ["disconnected", "connecting", "connected", "banned"],
  })
    .notNull()
    .default("disconnected"),
  qrCode: text("qr_code"),
  webhookUrl: text("webhook_url"),
  dailyMessageLimit: integer("daily_message_limit").notNull().default(80),
  dailyMessagesSent: integer("daily_messages_sent").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
