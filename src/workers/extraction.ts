import { Job } from "bullmq";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs } from "@/db/schema/audit-logs";
import { extractionJobs } from "@/db/schema/extraction-jobs";
import { leads } from "@/db/schema/leads";
import { enrichmentQueue } from "@/lib/queue";
import { runGoogleMapsScraper } from "@/lib/apify";
import { createNotificationRecord } from "@/lib/notifications";
import { normalizePhone } from "@/lib/helpers";

const extractionJobSchema = z.object({
  organizationId: z.string(),
  query: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  maxResults: z.number().min(1).max(200),
  extractionJobId: z.string(),
});

type ExtractionJobData = z.infer<typeof extractionJobSchema>;

async function findDuplicateLead(
  organizationId: string,
  name: string,
  phone: string | null,
  website: string | null,
  googlePlaceId: string | null
) {
  // 1. googlePlaceId is the most reliable key
  if (googlePlaceId) {
    const byPlaceId = await db.query.leads.findFirst({
      where: and(
        eq(leads.organizationId, organizationId),
        eq(leads.googlePlaceId, googlePlaceId)
      ),
    });
    if (byPlaceId) return byPlaceId;
  }

  // 2. Phone (normalized)
  if (phone) {
    const byPhone = await db.query.leads.findFirst({
      where: and(eq(leads.organizationId, organizationId), eq(leads.phone, phone)),
      orderBy: [desc(leads.createdAt)],
    });
    if (byPhone) return byPhone;
  }

  // 3. Name + website
  if (website) {
    return db.query.leads.findFirst({
      where: and(
        eq(leads.organizationId, organizationId),
        eq(leads.name, name),
        eq(leads.website, website)
      ),
      orderBy: [desc(leads.createdAt)],
    });
  }

  return db.query.leads.findFirst({
    where: and(eq(leads.organizationId, organizationId), eq(leads.name, name)),
    orderBy: [desc(leads.createdAt)],
  });
}

export async function processExtraction(job: Job<ExtractionJobData>) {
  const data = extractionJobSchema.parse(job.data);

  await db
    .update(extractionJobs)
    .set({
      status: "running",
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(extractionJobs.id, data.extractionJobId));

  try {
    const results = await runGoogleMapsScraper({
      searchQuery: data.query,
      locationQuery: `${data.city}, ${data.state}`,
      maxResults: data.maxResults,
    });

    let totalNew = 0;
    let totalDuplicate = 0;
    const newLeadIds: string[] = [];

    for (const result of results) {
      const phone = normalizePhone(result.phone);
      const duplicate = await findDuplicateLead(
        data.organizationId,
        result.name,
        phone,
        result.website,
        result.googlePlaceId
      );

      if (duplicate) {
        totalDuplicate += 1;
        continue;
      }

      const [createdLead] = await db
        .insert(leads)
        .values({
          organizationId: data.organizationId,
          name: result.name,
          phone,
          website: result.website,
          hasWebsite: Boolean(result.website),
          address: result.address,
          city: result.city,
          state: result.state,
          category: result.category,
          sourceType: "apify_gmaps",
          sourceId: data.extractionJobId,
          googleRating: result.googleRating,
          googleReviewCount: result.googleReviewCount,
          businessHours: result.businessHours,
          latitude: result.latitude,
          longitude: result.longitude,
          googlePlaceId: result.googlePlaceId,
          googleMapsUrl: result.googleMapsUrl,
          googleRank: result.googleRank,
          imageUrl: result.imageUrl,
          status: "new",
        })
        .returning();

      totalNew += 1;
      newLeadIds.push(createdLead.id);

      await enrichmentQueue.add("enrichment-full", {
        leadId: createdLead.id,
        organizationId: data.organizationId,
        type: "full",
      });
    }

    await db
      .update(extractionJobs)
      .set({
        status: "completed",
        totalFound: results.length,
        totalNew,
        totalDuplicate,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(extractionJobs.id, data.extractionJobId));

    await db.insert(auditLogs).values({
      organizationId: data.organizationId,
      action: "extraction_completed",
      entityType: "extraction_job",
      entityId: data.extractionJobId,
      metadata: {
        query: data.query,
        city: data.city,
        state: data.state,
        totalFound: results.length,
        totalNew,
        totalDuplicate,
      },
    });

    await createNotificationRecord({
      organizationId: data.organizationId,
      type: "extraction_complete",
      title: "Extração concluída",
      body: `${totalNew} novos leads adicionados (${totalDuplicate} duplicados).`,
      entityType: "extraction_job",
      entityId: data.extractionJobId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido na extração";

    await db
      .update(extractionJobs)
      .set({
        status: "failed",
        errorMessage: message,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(extractionJobs.id, data.extractionJobId));

    throw error;
  }
}
