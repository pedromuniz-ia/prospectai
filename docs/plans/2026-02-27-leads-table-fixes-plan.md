# Leads Table Fixes + PATCH API — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix WhatsApp/Instagram/Website display in leads table, sanitize website URLs, and add PATCH /api/v1/leads/:id endpoint.

**Architecture:** 4 independent fixes: (1) wire whatsapp-check + instagram-check into enrichment pipeline, (2) make Instagram badge show clickable @username, (3) filter non-website URLs from website column, (4) new PATCH REST endpoint with API key auth.

**Tech Stack:** Next.js App Router, Drizzle ORM, TypeScript, BullMQ workers, Evolution API, Apify

---

## Root Cause Analysis

- **WhatsApp empty:** `src/workers/enrichment.ts` never calls `checkWhatsapp()` from `src/lib/enrichment/whatsapp-check.ts`. The module exists but is not wired into the pipeline.
- **Instagram not clickable:** `LeadRow` type in `data-table.tsx` lacks `instagramUsername`/`instagramUrl`. `InstagramBadge` only renders "IG" badge without link.
- **Website polluted:** Apify returns any URL in the `website` field (wa.me, instagram.com, linktr.ee). No filtering at extraction or enrichment time.
- **No PATCH endpoint:** Only GET exists at `/api/v1/leads/`.

---

### Task 1: Add `isActualWebsite()` helper

**Files:**
- Modify: `src/lib/helpers.ts`

**Step 1: Add the helper function at the end of `src/lib/helpers.ts`**

```typescript
const SOCIAL_HOSTS = new Set([
  "wa.me",
  "api.whatsapp.com",
  "chat.whatsapp.com",
  "instagram.com",
  "www.instagram.com",
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "fb.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "www.tiktok.com",
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "linktr.ee",
  "bit.ly",
]);

export function isActualWebsite(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const withProtocol = url.startsWith("http") ? url : `https://${url}`;
    const host = new URL(withProtocol).hostname.toLowerCase();
    return !SOCIAL_HOSTS.has(host);
  } catch {
    return false;
  }
}
```

**Step 2: Commit**

```
feat: add isActualWebsite() helper to filter social/messaging URLs
```

---

### Task 2: Wire WhatsApp + Instagram checks into enrichment worker

**Files:**
- Modify: `src/workers/enrichment.ts`

**Step 1: Add imports for whatsapp-check, instagram-check, and whatsapp-instances**

At the top of `enrichment.ts`, add:

```typescript
import { checkWhatsapp } from "@/lib/enrichment/whatsapp-check";
import { checkInstagram } from "@/lib/enrichment/instagram-check";
import { whatsappInstances } from "@/db/schema/whatsapp-instances";
import { isActualWebsite } from "@/lib/helpers";
```

**Step 2: Add WhatsApp enrichment step after website check (after line 77)**

Insert after the `shouldRunWebsite` block, before scoring:

```typescript
// WhatsApp check
if (data.type === "full" && lead.phone) {
  const instance = await db.query.whatsappInstances.findFirst({
    where: and(
      eq(whatsappInstances.organizationId, data.organizationId),
      eq(whatsappInstances.status, "connected")
    ),
  });

  if (instance) {
    await sleep(2_000);
    const wa = await checkWhatsapp(lead.phone, instance.instanceName);
    patch.hasWhatsapp = wa.hasWhatsapp;
    patch.whatsappIsBusinessAccount = wa.isBusinessAccount;
    patch.whatsappBusinessDescription = wa.businessDescription;
    patch.whatsappBusinessEmail = wa.businessEmail;
    patch.whatsappBusinessWebsite = wa.businessWebsite;
  }
}
```

**Step 3: Add Instagram enrichment step after WhatsApp**

Insert after the WhatsApp block:

```typescript
// Instagram check — use website field if it's an instagram URL, otherwise skip
if (data.type === "full") {
  const igUrl = lead.website?.includes("instagram.com") ? lead.website : null;
  if (igUrl) {
    const ig = await checkInstagram(igUrl);
    patch.hasInstagram = Boolean(ig.username);
    patch.instagramUsername = ig.username;
    patch.instagramUrl = ig.profileUrl;
    patch.instagramFollowers = ig.followersCount;
    patch.instagramBiography = ig.biography;
    patch.instagramIsBusinessAccount = ig.isBusinessAccount;
    patch.instagramExternalUrl = ig.externalUrl;
  }
}
```

**Step 4: Add website sanitization — clear website field if it's a social URL**

After the Instagram check block, add:

```typescript
// Sanitize website field — clear if it's a social/messaging URL
if (!isActualWebsite(lead.website)) {
  patch.website = null;
  patch.hasWebsite = false;
}
```

**Step 5: Commit**

```
feat: wire whatsapp-check + instagram-check into enrichment pipeline
```

---

### Task 3: Update LeadRow type and InstagramBadge

**Files:**
- Modify: `src/app/(dashboard)/leads/data-table.tsx`
- Modify: `src/app/(dashboard)/leads/columns.tsx`

**Step 1: Add `instagramUsername` to `LeadRow` type in `data-table.tsx`**

Add to the `LeadRow` type (around line 62):

```typescript
instagramUsername?: string | null;
```

**Step 2: Update `InstagramBadge` in `columns.tsx` to accept username and render clickable link**

Replace the current `InstagramBadge` component:

```typescript
export function InstagramBadge({
  hasInstagram,
  followers,
  username,
}: {
  hasInstagram: boolean | null;
  followers: number | null;
  username: string | null;
}) {
  if (!hasInstagram) {
    return <span className="text-muted-foreground/40 text-xs">—</span>;
  }

  if (username) {
    return (
      <a
        href={`https://instagram.com/${username}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 hover:text-pink-300 transition-colors"
      >
        <span className="rounded bg-pink-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-pink-400">
          @{username}
        </span>
      </a>
    );
  }

  const formatted =
    followers != null
      ? followers >= 1000
        ? `${(followers / 1000).toFixed(1)}k`
        : String(followers)
      : null;

  return (
    <span className="inline-flex items-center gap-1">
      <span className="rounded bg-pink-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-pink-400">
        IG
      </span>
      {formatted && (
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {formatted}
        </span>
      )}
    </span>
  );
}
```

**Step 3: Pass `username` to `InstagramBadge` in `data-table.tsx`**

Update the Instagram cell (around line 411-415):

```tsx
<InstagramBadge
  hasInstagram={lead.hasInstagram ?? null}
  followers={lead.instagramFollowers ?? null}
  username={lead.instagramUsername ?? null}
/>
```

**Step 4: Commit**

```
feat: make Instagram badge show clickable @username
```

---

### Task 4: Filter website column in frontend

**Files:**
- Modify: `src/app/(dashboard)/leads/data-table.tsx`

**Step 1: Import `isActualWebsite` at top of file**

```typescript
import { isActualWebsite } from "@/lib/helpers";
```

**Step 2: Update website cell rendering (around line 419-434)**

Replace the website cell logic to use `isActualWebsite`:

```tsx
{col("website") && (
  <TableCell className="text-muted-foreground text-xs max-w-32 truncate">
    {lead.website && isActualWebsite(lead.website) ? (
      <a
        href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-primary transition-colors"
      >
        {lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
      </a>
    ) : (
      <span className="text-muted-foreground/40">—</span>
    )}
  </TableCell>
)}
```

**Step 3: Commit**

```
fix: filter social/messaging URLs from website column display
```

---

### Task 5: Create PATCH /api/v1/leads/:id endpoint

**Files:**
- Create: `src/app/api/v1/leads/[id]/route.ts`

**Step 1: Create the route file**

```typescript
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

  const { status, doNotContact, contactMethod } = parsed.data;

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
```

**Step 2: Commit**

```
feat: add PATCH /api/v1/leads/:id endpoint for status updates
```

---

## Task Order

Tasks 1-5 are mostly sequential:
1. Task 1 (helper) — no dependencies
2. Task 2 (enrichment worker) — depends on Task 1
3. Task 3 (Instagram badge) — independent of Tasks 1-2
4. Task 4 (website filter frontend) — depends on Task 1
5. Task 5 (PATCH API) — fully independent

Parallelizable: Tasks 3 and 5 can run in parallel with Tasks 1→2→4.
