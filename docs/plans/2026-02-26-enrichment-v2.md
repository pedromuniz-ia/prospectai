# Enrichment Pipeline v2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the enrichment pipeline with WhatsApp validation, Instagram scraping, improved Google Maps field mapping, 3 bug fixes, and smarter AI classification.

**Architecture:** Add 14 new columns to the `leads` table, fix 3 bugs in Apify mapping (website fallback to Maps URL, closed businesses, missing fields), create 2 new enrichment modules (whatsapp-check, instagram-check), wire them into the enrichment worker with cascade re-enrichment, and feed richer data to the AI classifier.

**Tech Stack:** Drizzle ORM (SQLite), BullMQ workers, Evolution API (WhatsApp), Apify (Instagram scraper), AI SDK

---

## Task 1: Add new columns to leads schema

**Files:**
- Modify: `src/db/schema/leads.ts:33-42`

**Step 1: Add Google Maps columns after `sourceId` (line 33)**

After the `sourceId` field, add:

```typescript
// Google Maps (Apify enrichment)
googlePlaceId: text("google_place_id"),
googleMapsUrl: text("google_maps_url"),
googleRank: integer("google_rank"),
imageUrl: text("image_url"),
```

**Step 2: Add WhatsApp + Instagram columns after `instagramUrl` (line 42)**

After the `instagramUrl` field, add:

```typescript
// WhatsApp enrichment
hasWhatsapp: integer("has_whatsapp", { mode: "boolean" }),
whatsappIsBusinessAccount: integer("whatsapp_is_business_account", { mode: "boolean" }),
whatsappBusinessDescription: text("whatsapp_business_description"),
whatsappBusinessEmail: text("whatsapp_business_email"),
whatsappBusinessWebsite: text("whatsapp_business_website"),

// Instagram enrichment
instagramUsername: text("instagram_username"),
instagramFollowers: integer("instagram_followers"),
instagramBiography: text("instagram_biography"),
instagramExternalUrl: text("instagram_external_url"),
instagramIsBusinessAccount: integer("instagram_is_business_account", { mode: "boolean" }),
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in leads.ts

**Step 4: Commit**

```bash
git add src/db/schema/leads.ts
git commit -m "feat(schema): add 14 new columns for WhatsApp, Instagram, and Google Maps enrichment"
```

---

## Task 2: Fix bugs and expand Apify mapping

**Files:**
- Modify: `src/lib/apify.ts:4-57`

**Step 1: Expand `RawApifyItem` type (lines 4-18)**

Replace the entire `RawApifyItem` type with:

```typescript
type RawApifyItem = {
  title?: string;
  phone?: string;
  phoneUnformatted?: string;
  website?: string;
  url?: string;
  address?: string;
  neighborhood?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
  categoryName?: string;
  categories?: string[];
  totalScore?: number;
  reviewsCount?: number;
  openingHours?: unknown;
  location?: { lat?: number; lng?: number };
  placeId?: string;
  imageUrl?: string;
  rank?: number;
  permanentlyClosed?: boolean;
  temporarilyClosed?: boolean;
};
```

**Step 2: Expand `ExtractedLead` type (lines 20-34)**

Replace with:

```typescript
export type ExtractedLead = {
  name: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  category: string | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  businessHours: unknown;
  latitude: number | null;
  longitude: number | null;
  domain: string | null;
  googleMapsUrl: string | null;
  googlePlaceId: string | null;
  googleRank: number | null;
  neighborhood: string | null;
  postalCode: string | null;
  imageUrl: string | null;
  phoneUnformatted: string | null;
};
```

**Step 3: Fix `mapItem()` — 3 bugs + new fields (lines 36-58)**

Replace entire function with:

```typescript
function mapItem(item: RawApifyItem): ExtractedLead | null {
  if (!item.title) return null;

  // BUG-02 fix: filter closed businesses
  if (item.permanentlyClosed || item.temporarilyClosed) return null;

  const parsedState = item.state ?? item.address?.split(",").at(-1)?.trim() ?? null;

  // BUG-01 fix: website never falls back to item.url (that's the Maps link)
  const website = item.website ?? null;

  return {
    name: item.title,
    phone: item.phone?.trim() ?? null,
    website,
    address: item.address ?? null,
    city: item.city ?? null,
    state: parsedState,
    category: item.categoryName ?? item.categories?.[0] ?? null,
    googleRating: typeof item.totalScore === "number" ? item.totalScore : null,
    googleReviewCount: typeof item.reviewsCount === "number" ? item.reviewsCount : null,
    businessHours: item.openingHours ?? null,
    latitude: typeof item.location?.lat === "number" ? item.location.lat : null,
    longitude: typeof item.location?.lng === "number" ? item.location.lng : null,
    domain: extractDomain(website),
    googleMapsUrl: item.url ?? null,
    googlePlaceId: item.placeId ?? null,
    googleRank: typeof item.rank === "number" ? item.rank : null,
    neighborhood: item.neighborhood ?? null,
    postalCode: item.postalCode ?? null,
    imageUrl: item.imageUrl ?? null,
    phoneUnformatted: item.phoneUnformatted ?? null,
  };
}
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in apify.ts

**Step 5: Commit**

```bash
git add src/lib/apify.ts
git commit -m "fix(apify): fix website/Maps URL fallback, filter closed businesses, map 7 new fields"
```

---

## Task 3: Pass new fields from extraction worker to DB insert

**Files:**
- Modify: `src/workers/extraction.ts:95-116`

**Step 1: Add new fields to the `db.insert(leads).values()` block**

In the `.values({...})` object (around line 97-115), add these fields before the closing `}`:

```typescript
    // New fields from enriched Apify data
    neighborhood: result.neighborhood,
    zipCode: result.postalCode,
    googlePlaceId: result.googlePlaceId,
    googleMapsUrl: result.googleMapsUrl,
    googleRank: result.googleRank,
    imageUrl: result.imageUrl,
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add src/workers/extraction.ts
git commit -m "feat(extraction): persist new Google Maps fields to leads table"
```

---

## Task 4: Generate database migration

**Step 1: Generate migration with drizzle-kit**

Run: `npx drizzle-kit generate --name=enrichment_v2`

Expected: Creates a file in `migrations/` with 14 `ALTER TABLE` statements.

**Step 2: Review the generated SQL**

Verify it contains all 14 new columns: `google_place_id`, `google_maps_url`, `google_rank`, `image_url`, `has_whatsapp`, `whatsapp_is_business_account`, `whatsapp_business_description`, `whatsapp_business_email`, `whatsapp_business_website`, `instagram_username`, `instagram_followers`, `instagram_biography`, `instagram_external_url`, `instagram_is_business_account`.

**Step 3: Commit**

```bash
git add migrations/
git commit -m "chore(db): add enrichment_v2 migration (14 new lead columns)"
```

---

## Task 5: Add WhatsApp methods to Evolution API client

**Files:**
- Modify: `src/lib/evolution-api.ts:93-281`

**Step 1: Add 3 new response interfaces (after `SetPresenceInput`, before `// ── Webhook Event Types ──`, line 94)**

Insert before line 95:

```typescript
export interface WhatsappNumberCheck {
  exists: boolean;
  jid: string;
  number: string;
}

export interface WhatsappProfile {
  name?: string;
  status?: string;
  picture?: string;
}

export interface WhatsappBusinessProfile {
  description?: string;
  email?: string;
  website?: string[];
  category?: string;
  address?: string;
}
```

**Step 2: Add 3 new methods to `EvolutionAPI` class (before closing `}` of class, after `setPresence` method, line 280)**

Insert before line 281:

```typescript
  // POST /chat/whatsappNumbers/{instance}
  async checkWhatsappNumbers(
    instanceName: string,
    numbers: string[]
  ): Promise<WhatsappNumberCheck[]> {
    return this.request<WhatsappNumberCheck[]>(
      "POST",
      `/chat/whatsappNumbers/${encodeURIComponent(instanceName)}`,
      { numbers }
    );
  }

  // POST /chat/fetchProfile/{instance}
  async fetchProfile(
    instanceName: string,
    number: string
  ): Promise<WhatsappProfile> {
    return this.request<WhatsappProfile>(
      "POST",
      `/chat/fetchProfile/${encodeURIComponent(instanceName)}`,
      { number }
    );
  }

  // POST /chat/fetchBusinessProfile/{instance}
  async fetchBusinessProfile(
    instanceName: string,
    number: string
  ): Promise<WhatsappBusinessProfile> {
    return this.request<WhatsappBusinessProfile>(
      "POST",
      `/chat/fetchBusinessProfile/${encodeURIComponent(instanceName)}`,
      { number }
    );
  }
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/evolution-api.ts
git commit -m "feat(evolution-api): add checkWhatsappNumbers, fetchProfile, fetchBusinessProfile methods"
```

---

## Task 6: Create WhatsApp enrichment module

**Files:**
- Create: `src/lib/enrichment/whatsapp-check.ts`

**Step 1: Create the file**

```typescript
import { getEvolutionAPI } from "@/lib/evolution-api";

export type WhatsappCheckResult = {
  hasWhatsapp: boolean;
  isBusinessAccount: boolean | null;
  businessDescription: string | null;
  businessEmail: string | null;
  businessWebsite: string | null;
  businessCategory: string | null;
};

const emptyResult: WhatsappCheckResult = {
  hasWhatsapp: false,
  isBusinessAccount: null,
  businessDescription: null,
  businessEmail: null,
  businessWebsite: null,
  businessCategory: null,
};

export async function checkWhatsapp(
  phone: string,
  instanceName: string
): Promise<WhatsappCheckResult> {
  try {
    const api = getEvolutionAPI();

    const [check] = await api.checkWhatsappNumbers(instanceName, [phone]);
    if (!check?.exists) return emptyResult;

    try {
      const business = await api.fetchBusinessProfile(instanceName, phone);
      return {
        hasWhatsapp: true,
        isBusinessAccount: true,
        businessDescription: business.description ?? null,
        businessEmail: business.email ?? null,
        businessWebsite: business.website?.[0] ?? null,
        businessCategory: business.category ?? null,
      };
    } catch {
      return {
        hasWhatsapp: true,
        isBusinessAccount: false,
        businessDescription: null,
        businessEmail: null,
        businessWebsite: null,
        businessCategory: null,
      };
    }
  } catch {
    return emptyResult;
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/enrichment/whatsapp-check.ts
git commit -m "feat(enrichment): add WhatsApp number validation and business profile check"
```

---

## Task 7: Add Instagram link extraction to website-check

**Files:**
- Modify: `src/lib/enrichment/website-check.ts:5-118`

**Step 1: Add `instagramUrl` to `WebsiteCheckResult` type (line 5-9)**

Replace the type:

```typescript
export type WebsiteCheckResult = {
  websiteStatus: WebsiteStatus;
  hasSsl: boolean;
  email: string | null;
  instagramUrl: string | null;
};
```

**Step 2: Add Instagram regex + parser (after `parkedPatterns`, line 18)**

Insert after line 18:

```typescript
const INSTAGRAM_REGEX = /instagram\.com\/([a-zA-Z0-9_.]+)\/?/;

function parseInstagramUrl(html: string): string | null {
  const match = html.match(INSTAGRAM_REGEX);
  if (!match) return null;
  const username = match[1];
  if (["sharer", "share", "p", "reel", "explore", "stories", "accounts"].includes(username)) return null;
  return `https://instagram.com/${username}`;
}
```

**Step 3: Add `instagramUrl: null` to all early returns**

In the 3 early-return blocks (error with no domain ~line 44-48, HTTP error ~line 67-71, no baseResponse ~line 75-80), add `instagramUrl: null` to each returned object.

Also add to the `baseResponse.status >= 400` return (~line 83-88).

**Step 4: Extract Instagram from HTML in the paths loop**

Declare `instagramUrl` alongside `email` (after line 92):

```typescript
let instagramUrl: string | null = null;
```

Inside the loop, after `parseEmail`, add:

```typescript
if (!instagramUrl) {
  instagramUrl = parseInstagramUrl(html);
}
```

Update the loop break condition:

```typescript
if (email && instagramUrl && websiteStatus !== "parked") break;
```

**Step 5: Add `instagramUrl` to the final return**

```typescript
return {
  websiteStatus,
  hasSsl,
  email,
  instagramUrl,
};
```

**Step 6: Fix enrichment.ts compile — add `instagramUrl` handling**

In `src/workers/enrichment.ts`, the `checkWebsite` call (line 72-77) now returns `instagramUrl`. Add after the existing website check block:

```typescript
if (website.instagramUrl) {
  patch.instagramUrl = patch.instagramUrl ?? website.instagramUrl ?? lead.instagramUrl;
  patch.hasInstagram = Boolean(patch.instagramUrl);
}
```

**Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 8: Commit**

```bash
git add src/lib/enrichment/website-check.ts src/workers/enrichment.ts
git commit -m "feat(website-check): extract Instagram links from HTML during website scraping"
```

---

## Task 8: Create Instagram enrichment module

**Files:**
- Create: `src/lib/enrichment/instagram-check.ts`

**Step 1: Create the file**

```typescript
import { ApifyClient } from "apify-client";

export type InstagramCheckResult = {
  username: string | null;
  followersCount: number | null;
  biography: string | null;
  externalUrl: string | null;
  isBusinessAccount: boolean | null;
  businessCategory: string | null;
  profileUrl: string | null;
};

const emptyResult: InstagramCheckResult = {
  username: null,
  followersCount: null,
  biography: null,
  externalUrl: null,
  isBusinessAccount: null,
  businessCategory: null,
  profileUrl: null,
};

export async function checkInstagram(
  instagramUrl: string
): Promise<InstagramCheckResult> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return emptyResult;

  try {
    const client = new ApifyClient({ token });
    const match = instagramUrl.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
    if (!match) return emptyResult;
    const username = match[1];

    const run = await client.actor("apify/instagram-profile-scraper").call({
      usernames: [username],
    });

    if (!run.defaultDatasetId) return emptyResult;

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    const profile = items[0] as Record<string, unknown> | undefined;
    if (!profile) return emptyResult;

    return {
      username: typeof profile.username === "string" ? profile.username : null,
      followersCount: typeof profile.followersCount === "number" ? profile.followersCount : null,
      biography: typeof profile.biography === "string" ? profile.biography : null,
      externalUrl: typeof profile.externalUrl === "string" ? profile.externalUrl : null,
      isBusinessAccount: typeof profile.isBusinessAccount === "boolean" ? profile.isBusinessAccount : null,
      businessCategory: typeof profile.businessCategoryName === "string" ? profile.businessCategoryName : null,
      profileUrl: `https://instagram.com/${username}`,
    };
  } catch {
    return emptyResult;
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/enrichment/instagram-check.ts
git commit -m "feat(enrichment): add Instagram profile scraping via Apify"
```

---

## Task 9: Wire WhatsApp + Instagram phases into enrichment worker

**Files:**
- Modify: `src/workers/enrichment.ts`

This is the largest task. It modifies the enrichment pipeline to add WhatsApp and Instagram phases with cascade re-enrichment.

**Step 1: Add new imports (top of file)**

Add after existing imports:

```typescript
import { checkWhatsapp } from "@/lib/enrichment/whatsapp-check";
import { checkInstagram } from "@/lib/enrichment/instagram-check";
import { whatsappInstances } from "@/db/schema/whatsapp-instances";
```

**Step 2: Expand `enrichmentJobSchema` type enum (line 19)**

Change from:
```typescript
type: z.enum(["rdap", "website", "score", "classify", "full"]).default("full"),
```
To:
```typescript
type: z.enum(["rdap", "website", "whatsapp", "instagram", "score", "classify", "full"]).default("full"),
```

**Step 3: Add conditional flags (after line 57)**

After `shouldRunClassify`, add:

```typescript
const shouldRunWhatsapp = data.type === "whatsapp" || data.type === "full";
const shouldRunInstagram = data.type === "instagram" || data.type === "full";
```

**Step 4: Add WhatsApp phase (after the website check block, after ~line 77)**

Insert after the website check block:

```typescript
  if (shouldRunWhatsapp && lead.phone) {
    const connectedInstance = await db.query.whatsappInstances.findFirst({
      where: and(
        eq(whatsappInstances.organizationId, data.organizationId),
        eq(whatsappInstances.status, "connected")
      ),
    });

    if (connectedInstance) {
      const wa = await checkWhatsapp(lead.phone, connectedInstance.instanceName);
      patch.hasWhatsapp = wa.hasWhatsapp;
      patch.whatsappIsBusinessAccount = wa.isBusinessAccount;
      patch.whatsappBusinessDescription = wa.businessDescription;
      patch.whatsappBusinessEmail = wa.businessEmail;
      patch.whatsappBusinessWebsite = wa.businessWebsite;

      // Cascade: WA Business revealed a website we didn't have
      if (wa.businessWebsite && !lead.website && !patch.website) {
        patch.website = wa.businessWebsite;
        patch.hasWebsite = true;
        const siteCheck = await checkWebsite(wa.businessWebsite);
        patch.websiteStatus = siteCheck.websiteStatus;
        patch.hasSsl = siteCheck.hasSsl;
        patch.email = patch.email ?? siteCheck.email ?? lead.email;
        patch.hasWebsite = siteCheck.websiteStatus !== "error";
        patch.instagramUrl = patch.instagramUrl ?? siteCheck.instagramUrl ?? lead.instagramUrl;
        patch.hasInstagram = Boolean(patch.instagramUrl);
      }
    }
  }
```

**Step 5: Add Instagram phase (after WhatsApp phase, before scoring)**

```typescript
  const websiteAfterWa = patch.website ?? lead.website;
  const instagramAfterChecks = patch.instagramUrl ?? lead.instagramUrl;

  if (shouldRunInstagram && !websiteAfterWa && instagramAfterChecks) {
    const ig = await checkInstagram(instagramAfterChecks);
    patch.instagramUsername = ig.username;
    patch.instagramFollowers = ig.followersCount;
    patch.instagramBiography = ig.biography;
    patch.instagramExternalUrl = ig.externalUrl;
    patch.instagramIsBusinessAccount = ig.isBusinessAccount;
    if (ig.profileUrl) {
      patch.instagramUrl = ig.profileUrl;
      patch.hasInstagram = true;
    }

    // Cascade: Instagram revealed a website
    if (ig.externalUrl && !websiteAfterWa) {
      patch.website = ig.externalUrl;
      patch.hasWebsite = true;
      const siteCheck = await checkWebsite(ig.externalUrl);
      patch.websiteStatus = siteCheck.websiteStatus;
      patch.hasSsl = siteCheck.hasSsl;
      patch.email = patch.email ?? siteCheck.email ?? lead.email;
      patch.hasWebsite = siteCheck.websiteStatus !== "error";
    }
  }
```

**Step 6: Update `pickLeadSnapshot()` (lines 25-36)**

Replace with:

```typescript
function pickLeadSnapshot(lead: typeof leads.$inferSelect) {
  return {
    name: lead.name,
    category: lead.category,
    city: lead.city,
    hasWebsite: lead.hasWebsite,
    googleRating: lead.googleRating,
    googleReviewCount: lead.googleReviewCount,
    websiteStatus: lead.websiteStatus,
    aiSummary: lead.aiSummary,
    googleRank: lead.googleRank,
    hasWhatsapp: lead.hasWhatsapp,
    whatsappIsBusinessAccount: lead.whatsappIsBusinessAccount,
    whatsappBusinessDescription: lead.whatsappBusinessDescription,
    instagramFollowers: lead.instagramFollowers,
    instagramBiography: lead.instagramBiography,
    instagramIsBusinessAccount: lead.instagramIsBusinessAccount,
  };
}
```

**Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 8: Commit**

```bash
git add src/workers/enrichment.ts
git commit -m "feat(enrichment): add WhatsApp and Instagram phases with cascade re-enrichment"
```

---

## Task 10: Update AI classifier with enriched data

**Files:**
- Modify: `src/lib/enrichment/ai-classifier.ts:19-88`

**Step 1: Expand `ClassificationLeadInput` type (lines 19-28)**

Replace with:

```typescript
type ClassificationLeadInput = {
  name: string | null;
  category: string | null;
  city: string | null;
  hasWebsite: boolean | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  websiteStatus: string | null;
  aiSummary?: string | null;
  googleRank: number | null;
  hasWhatsapp: boolean | null;
  whatsappIsBusinessAccount: boolean | null;
  whatsappBusinessDescription: string | null;
  instagramFollowers: number | null;
  instagramBiography: string | null;
  instagramIsBusinessAccount: boolean | null;
};
```

**Step 2: Update `needs_automation` heuristic (line 51-58)**

Replace the `(lead.googleReviewCount ?? 0) >= 80` block with:

```typescript
if ((lead.googleReviewCount ?? 0) >= 80 && (lead.instagramFollowers ?? 0) >= 500) {
  return {
    classification: "needs_automation",
    confidence: 0.82,
    summary: "Lead com volume relevante e presença digital consolidada.",
    suggestedApproach:
      "Automação de atendimento com IA para escalar sem aumentar equipe.",
  };
}
```

**Step 3: Update LLM prompt (lines 78-88)**

Replace the prompt array with:

```typescript
const prompt = [
  "Classifique este lead para prospeccao B2B via WhatsApp.",
  "Responda estritamente no schema definido.",
  `Nome: ${lead.name ?? "N/A"}`,
  `Categoria: ${lead.category ?? "N/A"}`,
  `Cidade: ${lead.city ?? "N/A"}`,
  `Tem website: ${String(lead.hasWebsite)}`,
  `Status website: ${lead.websiteStatus ?? "N/A"}`,
  `Google rating: ${lead.googleRating ?? "N/A"}`,
  `Google reviews: ${lead.googleReviewCount ?? "N/A"}`,
  `Posicao no Maps: ${lead.googleRank ?? "N/A"}`,
  `Tem WhatsApp: ${lead.hasWhatsapp ?? "N/A"}`,
  `WhatsApp Business: ${lead.whatsappIsBusinessAccount ?? "N/A"}`,
  lead.whatsappBusinessDescription ? `Desc. WA Business: ${lead.whatsappBusinessDescription}` : "",
  `Seguidores Instagram: ${lead.instagramFollowers ?? "N/A"}`,
  lead.instagramBiography ? `Bio Instagram: ${lead.instagramBiography}` : "",
].filter(Boolean).join("\n");
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 5: Commit**

```bash
git add src/lib/enrichment/ai-classifier.ts
git commit -m "feat(classifier): enrich AI classification with WhatsApp, Instagram, and Maps rank data"
```

---

## Task 11: Final verification

**Step 1: Full TypeScript check**

Run: `npx tsc --noEmit --pretty`
Expected: 0 errors

**Step 2: Run existing tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 3: Verify migration applies (dry run)**

Run: `npx drizzle-kit push --dry-run` (if available) or review the generated SQL manually.

**Step 4: Final commit (if any fixes needed)**

---

## Pipeline Execution Order (Reference)

After implementation, the enrichment worker runs phases in this order:

```
1. RDAP           — .com.br domain registrant data
2. Website Check  — status + SSL + email + Instagram link from HTML
3. WhatsApp       — validate number, Business profile
   └── Cascade: if found website → re-run Website Check
4. Instagram      — [CONDITIONAL: only if still no website]
   └── Cascade: if found website → re-run Website Check
5. Score          — recalculate with updated data
6. Classify       — AI with all enriched data
```

## Trust Hierarchy (Never Overwrite Higher Source)

```
1. Google Maps (Apify)         — base
2. WhatsApp Business profile   — owner fills
3. Instagram externalUrl       — owner fills
4. Website HTML (links)        — inferred
5. RDAP/WHOIS                  — technical
```
