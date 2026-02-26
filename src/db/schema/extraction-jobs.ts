import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
import { organizations } from "./organizations";

export const extractionJobs = sqliteTable("extraction_jobs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  type: text("type", {
    enum: ["apify_gmaps", "rdap_whois", "website_check"],
  }).notNull(),
  status: text("status", {
    enum: ["pending", "running", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  config: text("config", { mode: "json" }),
  apifyRunId: text("apify_run_id"),
  totalFound: integer("total_found").notNull().default(0),
  totalNew: integer("total_new").notNull().default(0),
  totalDuplicate: integer("total_duplicate").notNull().default(0),
  totalEnriched: integer("total_enriched").notNull().default(0),
  errorMessage: text("error_message"),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
