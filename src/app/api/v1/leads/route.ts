import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { leads } from "@/db/schema/leads";
import { validateApiKey } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const minScore = Number(searchParams.get("min_score") ?? 0);
  const maxScore = Number(searchParams.get("max_score") ?? 100);
  const hasWhatsapp = searchParams.get("has_whatsapp");
  const hasWebsite = searchParams.get("has_website");
  const classificationParam = searchParams.get("classification");
  const statusParam = searchParams.get("status");
  const since = searchParams.get("since");
  const limit = Math.min(Number(searchParams.get("limit") ?? 100), 500);
  const offset = Number(searchParams.get("offset") ?? 0);

  const conditions = [
    eq(leads.organizationId, auth.organizationId),
    gte(leads.score, minScore),
    lte(leads.score, maxScore),
  ];

  if (hasWhatsapp === "true") conditions.push(eq(leads.hasWhatsapp, true));
  if (hasWhatsapp === "false") conditions.push(eq(leads.hasWhatsapp, false));
  if (hasWebsite === "true") conditions.push(eq(leads.hasWebsite, true));
  if (hasWebsite === "false") conditions.push(eq(leads.hasWebsite, false));

  if (classificationParam) {
    const classifications = classificationParam.split(",").filter(Boolean);
    if (classifications.length > 0) {
      conditions.push(
        inArray(
          leads.aiClassification,
          classifications as (typeof leads.aiClassification._.data)[]
        )
      );
    }
  }

  if (statusParam) {
    const statuses = statusParam.split(",").filter(Boolean);
    if (statuses.length > 0) {
      conditions.push(
        inArray(leads.status, statuses as (typeof leads.status._.data)[])
      );
    }
  }

  if (since) {
    const sinceDate = new Date(since);
    if (!isNaN(sinceDate.getTime())) {
      conditions.push(gte(leads.updatedAt, sinceDate));
    }
  }

  const rows = await db.query.leads.findMany({
    where: and(...conditions),
    limit,
    offset,
    orderBy: (l, { desc }) => [desc(l.score)],
    columns: {
      id: true,
      name: true,
      phone: true,
      email: true,
      website: true,
      address: true,
      city: true,
      state: true,
      neighborhood: true,
      zipCode: true,
      category: true,
      googleRating: true,
      googleReviewCount: true,
      googleMapsUrl: true,
      googlePlaceId: true,
      googleRank: true,
      imageUrl: true,
      hasWebsite: true,
      websiteStatus: true,
      hasSsl: true,
      hasWhatsapp: true,
      whatsappIsBusinessAccount: true,
      whatsappBusinessDescription: true,
      whatsappBusinessEmail: true,
      whatsappBusinessWebsite: true,
      hasInstagram: true,
      instagramUrl: true,
      instagramUsername: true,
      instagramFollowers: true,
      instagramBiography: true,
      instagramIsBusinessAccount: true,
      instagramExternalUrl: true,
      score: true,
      aiClassification: true,
      aiClassificationConfidence: true,
      aiSummary: true,
      aiSuggestedApproach: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      enrichedAt: true,
    },
  });

  return NextResponse.json({
    data: rows,
    meta: {
      total: rows.length,
      limit,
      offset,
      hasMore: rows.length === limit,
    },
  });
}
