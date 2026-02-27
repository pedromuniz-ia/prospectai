"use server";

import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema/audit-logs";
import { extractionJobs } from "@/db/schema/extraction-jobs";
import { extractionQueue } from "@/lib/queue";

export type ExtractionConfig = {
  query: string;
  city: string;
  state: string;
  maxResults: number;
};

export async function startExtraction(
  organizationId: string,
  config: ExtractionConfig
) {
  const [job] = await db
    .insert(extractionJobs)
    .values({
      organizationId,
      type: "apify_gmaps",
      status: "pending",
      config,
    })
    .returning();

  await extractionQueue.add("apify-gmaps", {
    organizationId,
    query: config.query,
    city: config.city,
    state: config.state,
    maxResults: config.maxResults,
    extractionJobId: job.id,
  });

  return job;
}

export async function getExtractionJobs(organizationId: string) {
  return db.query.extractionJobs.findMany({
    where: eq(extractionJobs.organizationId, organizationId),
    orderBy: [desc(extractionJobs.createdAt)],
    limit: 30,
  });
}

export async function savePreset(
  organizationId: string,
  preset: { name: string; query: string; city: string; state: string; maxResults: number }
) {
  const presetId = createId();

  await db.insert(auditLogs).values({
    organizationId,
    action: "save_extraction_preset",
    entityType: "extraction_preset",
    entityId: presetId,
    metadata: preset,
  });

  return {
    id: presetId,
    ...preset,
  };
}

export async function getPresets(organizationId: string) {
  const rows = await db.query.auditLogs.findMany({
    where: and(
      eq(auditLogs.organizationId, organizationId),
      eq(auditLogs.entityType, "extraction_preset")
    ),
    orderBy: [desc(auditLogs.createdAt)],
    limit: 20,
  });

  return rows
    .map((row) => {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      if (!metadata.query || !metadata.city || !metadata.state) return null;
      return {
        id: row.entityId,
        name: String(metadata.name ?? "Preset sem nome"),
        query: String(metadata.query),
        city: String(metadata.city),
        state: String(metadata.state),
        maxResults: Number(metadata.maxResults ?? 25),
      };
    })
    .filter((preset): preset is NonNullable<typeof preset> => Boolean(preset));
}
