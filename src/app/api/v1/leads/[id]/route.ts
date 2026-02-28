import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { leads } from "@/db/schema/leads";
import { validateApiKey } from "@/lib/api-auth";

const patchSchema = z.object({
  status: z
    .enum([
      "new", "enriched", "scored", "queued", "contacted",
      "replied", "interested", "proposal", "won", "lost", "blocked",
    ])
    .optional(),
  doNotContact: z.boolean().optional(),
  contactMethod: z
    .enum(["manual", "api", "whatsapp", "email", "phone"])
    .optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const lead = await db.query.leads.findFirst({
    where: and(eq(leads.id, id), eq(leads.organizationId, auth.organizationId)),
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json({ data: lead });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { status, doNotContact } = parsed.data;

  // Verify lead belongs to this organization
  const existing = await db.query.leads.findFirst({
    where: and(eq(leads.id, id), eq(leads.organizationId, auth.organizationId)),
    columns: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const patch: Partial<typeof leads.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (status !== undefined) {
    patch.status = status;
  }

  if (doNotContact !== undefined) {
    patch.doNotContact = doNotContact;
  }

  // Auto-track contact attempt when status is "contacted"
  if (status === "contacted") {
    patch.lastContactedAt = new Date();
  }

  const [updated] = await db
    .update(leads)
    .set(
      status === "contacted"
        ? { ...patch, contactAttempts: sql`${leads.contactAttempts} + 1` }
        : patch
    )
    .where(eq(leads.id, id))
    .returning();

  return NextResponse.json({ data: updated });
}
