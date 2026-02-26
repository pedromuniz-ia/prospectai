import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
import { organization } from "./auth";
import { whatsappInstances } from "./whatsapp-instances";

export const warmupConfigs = sqliteTable("warmup_configs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  whatsappInstanceId: text("whatsapp_instance_id")
    .notNull()
    .references(() => whatsappInstances.id),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id),
  currentDay: integer("current_day").notNull().default(1),
  currentDailyLimit: integer("current_daily_limit").notNull().default(10),
  warmupCompleted: integer("warmup_completed", { mode: "boolean" })
    .notNull()
    .default(false),
  startedAt: integer("started_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  schedule: text("schedule", { mode: "json" })
    .$type<{ days: [number, number]; limit: number }[]>()
    .notNull()
    .$defaultFn(() => [
      { days: [1, 3], limit: 10 },
      { days: [4, 7], limit: 25 },
      { days: [8, 14], limit: 50 },
      { days: [15, 999], limit: 80 },
    ]),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
