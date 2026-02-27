import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
import { organization } from "./auth";

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Default"),
    keyHash: text("key_hash").notNull(),
    keyPrefix: text("key_prefix").notNull(), // e.g. "pak_abc12345" — first 12 chars for display
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("api_keys_org_idx").on(table.organizationId),
    index("api_keys_prefix_idx").on(table.keyPrefix),
  ]
);
