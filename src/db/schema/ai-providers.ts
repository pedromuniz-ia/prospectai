import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
import { organizations } from "./organizations";

export const aiProviders = sqliteTable("ai_providers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  provider: text("provider", {
    enum: [
      "openai",
      "anthropic",
      "google",
      "groq",
      "together",
      "fireworks",
      "openai_compatible",
    ],
  }).notNull(),
  label: text("label").notNull(),
  apiKey: text("api_key").notNull(),
  baseUrl: text("base_url"),
  defaultModel: text("default_model").notNull(),
  availableModels: text("available_models", { mode: "json" }).$type<
    string[]
  >(),
  isDefault: integer("is_default", { mode: "boolean" })
    .notNull()
    .default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
