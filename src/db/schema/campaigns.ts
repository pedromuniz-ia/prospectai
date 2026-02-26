import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
import { organizations } from "./organizations";
import { whatsappInstances } from "./whatsapp-instances";
import { aiProviders } from "./ai-providers";

export const campaigns = sqliteTable("campaigns", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  objective: text("objective", {
    enum: [
      "sell_website",
      "sell_ai_agent",
      "sell_optimization",
      "sell_automation",
      "custom",
    ],
  }).notNull(),
  status: text("status", {
    enum: ["draft", "active", "paused", "completed"],
  })
    .notNull()
    .default("draft"),

  // Segmentation filters
  filters: text("filters", { mode: "json" }),

  // Cadence
  scheduleStart: text("schedule_start").default("09:00"),
  scheduleEnd: text("schedule_end").default("18:00"),
  scheduleDays: text("schedule_days", { mode: "json" }).$type<string[]>(),
  minInterval: integer("min_interval").notNull().default(180),
  maxInterval: integer("max_interval").notNull().default(300),
  dailyLimit: integer("daily_limit").notNull().default(40),
  dailySent: integer("daily_sent").notNull().default(0),

  // Messages
  firstMessageVariants: text("first_message_variants", {
    mode: "json",
  }).$type<string[]>(),

  // AI config
  aiEnabled: integer("ai_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  aiProviderId: text("ai_provider_id").references(() => aiProviders.id),
  aiModel: text("ai_model"),
  aiSystemPrompt: text("ai_system_prompt"),
  aiMaxAutoReplies: integer("ai_max_auto_replies").notNull().default(3),
  aiTemperature: real("ai_temperature").notNull().default(0.7),

  whatsappInstanceId: text("whatsapp_instance_id").references(
    () => whatsappInstances.id
  ),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
