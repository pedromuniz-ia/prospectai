import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
import { organization } from "./auth";

export const leads = sqliteTable(
  "leads",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id),

    // Raw data (extraction)
    name: text("name").notNull(),
    phone: text("phone"),
    phoneSecondary: text("phone_secondary"),
    email: text("email"),
    website: text("website"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    neighborhood: text("neighborhood"),
    zipCode: text("zip_code"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    category: text("category"),
    subcategory: text("subcategory"),
    sourceType: text("source_type", {
      enum: ["apify_gmaps", "manual", "csv_import", "extension"],
    }),
    sourceId: text("source_id"),

    // Google Maps data
    googlePlaceId: text("google_place_id"),
    googleMapsUrl: text("google_maps_url"),
    googleRank: integer("google_rank"),
    imageUrl: text("image_url"),

    // Enriched data
    hasWebsite: integer("has_website", { mode: "boolean" }),
    websiteStatus: text("website_status", {
      enum: ["active", "inactive", "parked", "error"],
    }),
    hasSsl: integer("has_ssl", { mode: "boolean" }),
    hasWhatsapp: integer("has_whatsapp", { mode: "boolean" }),
    whatsappIsBusinessAccount: integer("whatsapp_is_business_account", { mode: "boolean" }),
    whatsappBusinessDescription: text("whatsapp_business_description"),
    whatsappBusinessEmail: text("whatsapp_business_email"),
    whatsappBusinessWebsite: text("whatsapp_business_website"),
    hasInstagram: integer("has_instagram", { mode: "boolean" }),
    instagramUrl: text("instagram_url"),
    instagramUsername: text("instagram_username"),
    instagramFollowers: integer("instagram_followers"),
    instagramBiography: text("instagram_biography"),
    instagramIsBusinessAccount: integer("instagram_is_business_account", { mode: "boolean" }),
    instagramExternalUrl: text("instagram_external_url"),
    hasGoogleBusiness: integer("has_google_business", { mode: "boolean" }).default(true),
    googleRating: real("google_rating"),
    googleReviewCount: integer("google_review_count"),
    businessHours: text("business_hours", { mode: "json" }),
    domainRegistrar: text("domain_registrar"),
    domainCreatedAt: text("domain_created_at"),
    whoisEmail: text("whois_email"),
    whoisResponsible: text("whois_responsible"),
    enrichedAt: integer("enriched_at", { mode: "timestamp" }),
    enrichmentVersion: integer("enrichment_version").notNull().default(0),

    // AI qualification
    aiClassification: text("ai_classification", {
      enum: [
        "needs_website",
        "needs_optimization",
        "needs_ai_agent",
        "needs_automation",
        "low_fit",
      ],
    }),
    aiClassificationConfidence: real("ai_classification_confidence"),
    aiSummary: text("ai_summary"),
    aiSuggestedApproach: text("ai_suggested_approach"),
    aiQualifiedAt: integer("ai_qualified_at", { mode: "timestamp" }),

    // Scoring
    score: integer("score").notNull().default(0),
    scoreBreakdown: text("score_breakdown", { mode: "json" }),
    scoreExplanation: text("score_explanation"),
    scoredAt: integer("scored_at", { mode: "timestamp" }),
    scoringVersion: integer("scoring_version").notNull().default(0),

    // Status & control
    status: text("status", {
      enum: [
        "new",
        "enriched",
        "scored",
        "queued",
        "contacted",
        "replied",
        "interested",
        "proposal",
        "won",
        "lost",
        "blocked",
      ],
    })
      .notNull()
      .default("new"),
    lostReason: text("lost_reason"),
    doNotContact: integer("do_not_contact", { mode: "boolean" })
      .notNull()
      .default(false),
    contactAttempts: integer("contact_attempts").notNull().default(0),
    lastContactedAt: integer("last_contacted_at", { mode: "timestamp" }),
    lastRepliedAt: integer("last_replied_at", { mode: "timestamp" }),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("leads_organization_id_idx").on(table.organizationId),
    index("leads_status_idx").on(table.organizationId, table.status),
    index("leads_score_idx").on(table.organizationId, table.score),
    index("leads_phone_idx").on(table.phone),
  ]
);
