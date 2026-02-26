import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
import { organizations } from "./organizations";

export const scoringRules = sqliteTable("scoring_rules", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  objective: text("objective", {
    enum: ["sell_website", "sell_ai_agent", "sell_optimization", "global"],
  }).notNull(),
  field: text("field").notNull(),
  operator: text("operator", {
    enum: ["eq", "neq", "gt", "lt", "gte", "lte", "in", "not_in"],
  }).notNull(),
  value: text("value", { mode: "json" }).notNull(),
  points: integer("points").notNull(),
  label: text("label").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
