import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
import { organization } from "./auth";

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id),
    type: text("type", {
      enum: [
        "lead_replied",
        "campaign_paused",
        "instance_disconnected",
        "ai_needs_review",
        "extraction_complete",
      ],
    }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("notifications_org_read_idx").on(table.organizationId, table.read),
    index("notifications_org_created_idx").on(table.organizationId, table.createdAt),
  ]
);
