# Lead Gen Focus — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Strip ProspectAI down to pure lead gen (extraction + enrichment + export), removing all outreach code, then add configurable leads UI and a REST export API.

**Architecture:** Three phases — Clean (delete outreach), Build (dedup + API + export), Polish (UI). Each phase ends in a green TypeScript build. No new dependencies unless strictly necessary.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM / SQLite, BullMQ, shadcn/ui + `src/components/ds/`, TanStack Table (not currently used — will add for column visibility), bcrypt for API key hashing.

---

## PHASE 1 — CLEAN

---

### Task 1: Remove outreach pages

**Files to delete:**
- `src/app/(dashboard)/inbox/` (entire folder — 4 files)
- `src/app/(dashboard)/campaigns/` (entire folder — 2 files)
- `src/components/campaign-wizard.tsx`

**Step 1: Delete the folders and file**

```bash
rm -rf src/app/\(dashboard\)/inbox
rm -rf src/app/\(dashboard\)/campaigns
rm src/components/campaign-wizard.tsx
```

**Step 2: Verify TypeScript compiles (errors expected — fix in later tasks)**

Run: `npx tsc --noEmit --pretty 2>&1 | head -40`
Expected: errors referencing inbox/campaigns imports — that's fine for now.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove inbox and campaigns pages"
```

---

### Task 2: Remove outreach workers

**Files to delete:**
- `src/workers/cadence.ts`
- `src/workers/ai-reply.ts`
- `src/workers/message-send.ts`
- `src/workers/scheduler.ts`
- `src/lib/cadence/` (entire folder — 5 files including tests)
- `src/lib/ai/generate-reply.ts`

**Step 1: Delete files**

```bash
rm src/workers/cadence.ts src/workers/ai-reply.ts src/workers/message-send.ts src/workers/scheduler.ts
rm -rf src/lib/cadence
rm src/lib/ai/generate-reply.ts
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove outreach workers and cadence lib"
```

---

### Task 3: Clean worker.ts and queue.ts

**Files:**
- Modify: `src/worker.ts`
- Modify: `src/lib/queue.ts`

**Step 1: Replace `src/worker.ts` with cleaned version**

```typescript
import "./lib/runtime-env-bootstrap";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { processExtraction } from "./workers/extraction";
import { processEnrichment } from "./workers/enrichment";

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

new Worker("extraction", processExtraction, {
  connection,
  concurrency: 2,
});

new Worker("enrichment", processEnrichment, {
  connection,
  concurrency: 5,
});

function shutdown() {
  console.log("[worker] Shutting down...");
  connection.disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("[worker] Started — 2 workers (extraction, enrichment)");
```

**Step 2: Replace `src/lib/queue.ts` with cleaned version**

```typescript
import { Queue } from "bullmq";
import IORedis from "ioredis";

let redisConnection: IORedis | null = null;
const queueCache = new Map<string, Queue>();

function getRedisConnection() {
  if (redisConnection) return redisConnection;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is not configured.");

  redisConnection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    enableReadyCheck: false,
  });

  return redisConnection;
}

function getQueue(name: string) {
  const existing = queueCache.get(name);
  if (existing) return existing;

  const queue = new Queue(name, { connection: getRedisConnection() });
  queueCache.set(name, queue);
  return queue;
}

function createLazyQueue(name: string) {
  return new Proxy({} as Queue, {
    get(_target, property, receiver) {
      const queue = getQueue(name) as unknown as Record<PropertyKey, unknown>;
      const value = Reflect.get(queue, property, receiver);
      if (typeof value === "function") {
        return (value as (...args: unknown[]) => unknown).bind(queue);
      }
      return value;
    },
  });
}

export const extractionQueue = createLazyQueue("extraction");
export const enrichmentQueue = createLazyQueue("enrichment");
```

**Step 3: Commit**

```bash
git add src/worker.ts src/lib/queue.ts
git commit -m "chore: remove outreach queues and workers from bootstrap"
```

---

### Task 4: Remove outreach DB schemas

**Files to delete:**
- `src/db/schema/campaigns.ts`
- `src/db/schema/campaign-leads.ts`
- `src/db/schema/messages.ts`
- `src/db/schema/message-templates.ts`
- `src/db/schema/warmup-configs.ts`

**Files to modify:**
- `src/db/schema/index.ts` — remove exports for deleted schemas

**Step 1: Delete schema files**

```bash
rm src/db/schema/campaigns.ts src/db/schema/campaign-leads.ts src/db/schema/messages.ts src/db/schema/message-templates.ts src/db/schema/warmup-configs.ts
```

**Step 2: Update `src/db/schema/index.ts`**

Replace entire file with:

```typescript
// Better Auth tables
export {
  user,
  session,
  account,
  verification,
  organization,
  member,
  invitation,
} from "./auth";

// App tables
export { whatsappInstances } from "./whatsapp-instances";
export { leads } from "./leads";
export { aiProviders } from "./ai-providers";
export { scoringRules } from "./scoring-rules";
export { extractionJobs } from "./extraction-jobs";
export { auditLogs } from "./audit-logs";
export { notifications } from "./notifications";
```

**Step 3: Generate DROP migration**

Run: `npx drizzle-kit generate --name=drop_outreach_tables`

Expected: creates a migration with DROP TABLE statements for campaigns, campaign_leads, messages, message_templates, warmup_configs.

**Step 4: Apply migration**

Run: `npx drizzle-kit push`

Expected: `No changes detected` (push syncs schema; drops happen when you next run migrate on a fresh DB).

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove outreach DB schemas (campaigns, messages, warmup)"
```

---

### Task 5: Clean evolution-api.ts

Remove types and helpers only used by outreach (sendText, setPresence, message webhooks).

**Files:**
- Modify: `src/lib/evolution-api.ts`

**Step 1: Remove unused types and interfaces**

Delete these interfaces/types (they're only used by deleted workers):
- `SendTextInput`
- `SendTextResponse`
- `SetPresenceInput`
- `MessagesUpsertData`
- `ConnectionUpdateData`
- `QRCodeUpdateData`
- `MessagesUpdateData`
- `WebhookEvent`

**Step 2: Remove unused methods from `EvolutionAPI` class**

Delete these methods:
- `sendText()`
- `setPresence()`

Keep: `createInstance`, `getConnectionState`, `setWebhook`, `fetchInstances`, `logoutInstance`, `deleteInstance`, `checkWhatsappNumbers`, `fetchProfile`, `fetchBusinessProfile`

**Step 3: Remove unused helper functions**

Delete:
- `extractMessageText()`
- `detectMediaType()`

Keep:
- `phoneFromJid()`
- `getEvolutionAPI()`

**Step 4: Delete the evolution webhook API route**

```bash
rm src/app/api/webhooks/evolution/route.ts
```

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -40`

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: strip outreach methods from evolution-api.ts"
```

---

### Task 6: Remove outreach actions

**Files to delete:**
- `src/lib/actions/campaigns.ts`
- `src/lib/actions/messages.ts`
- `src/lib/actions/templates.ts`
- `src/lib/actions/warmup.ts`

**Step 1: Delete files**

```bash
rm src/lib/actions/campaigns.ts src/lib/actions/messages.ts src/lib/actions/templates.ts src/lib/actions/warmup.ts
```

**Step 2: Check for remaining imports**

Run: `grep -r "actions/campaigns\|actions/messages\|actions/templates\|actions/warmup" src/ --include="*.ts" --include="*.tsx"`

Expected: no results.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove outreach server actions"
```

---

### Task 7: Clean sidebar and settings nav

**Files:**
- Modify: `src/components/sidebar.tsx`
- Modify: `src/app/(dashboard)/settings/layout.tsx`
- Delete: `src/app/(dashboard)/settings/templates/page.tsx`
- Delete: `src/app/(dashboard)/settings/warmup/page.tsx`

**Step 1: Update sidebar — remove Inbox and Campaigns**

In `src/components/sidebar.tsx`, replace `navItems`:

```typescript
const navItems = [
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/extraction", label: "Extração", icon: Database },
];
```

Remove `MessageSquare` and `Rocket` from lucide imports.

**Step 2: Delete settings pages**

```bash
rm src/app/\(dashboard\)/settings/templates/page.tsx
rm src/app/\(dashboard\)/settings/warmup/page.tsx
```

**Step 3: Update settings layout to remove deleted tabs**

Read `src/app/(dashboard)/settings/layout.tsx` and remove the `templates` and `warmup` nav links.

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -40`

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: clean nav — remove inbox, campaigns, warmup, templates"
```

---

### Task 8: Fix data-table.tsx — remove outreach references

**Files:**
- Modify: `src/app/(dashboard)/leads/data-table.tsx`

**Step 1: Remove outreach-specific UI**

From the `LeadsDataTable` component:
1. Remove the `onBulkAdd` prop and its button ("Adicionar em campanha")
2. Remove the inbox link button (`<Link href="/inbox?leadId=...">`)
3. Remove `PlusCircle`, `MessageSquare`, `Link` imports that are now unused
4. Simplify the header to just show lead count

Remove from the component type:
```typescript
onBulkAdd: () => void;  // remove this prop
```

Remove from JSX (the "Adicionar em campanha" button and inbox icon button).

**Step 2: Verify TypeScript compiles cleanly**

Run: `npx tsc --noEmit --pretty 2>&1`
Expected: 0 errors.

**Step 3: Run tests**

Run: `npm test`
Expected: all pass.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: clean leads table — remove outreach action buttons"
```

---

## PHASE 2 — BUILD

---

### Task 9: Improve deduplication with googlePlaceId

**Files:**
- Modify: `src/workers/extraction.ts:24-56`

**Step 1: Update `findDuplicateLead()` to check googlePlaceId first**

Replace the entire `findDuplicateLead` function with:

```typescript
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
```

**Step 2: Update the call site to pass googlePlaceId**

In `processExtraction`, update the `findDuplicateLead` call (~line 83):

```typescript
const duplicate = await findDuplicateLead(
  data.organizationId,
  result.name,
  phone,
  result.website,
  result.googlePlaceId  // new param
);
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 4: Commit**

```bash
git add src/workers/extraction.ts
git commit -m "feat(extraction): use googlePlaceId as primary dedup key"
```

---

### Task 10: Add API keys schema + migration

**Files:**
- Create: `src/db/schema/api-keys.ts`
- Modify: `src/db/schema/index.ts`

**Step 1: Create `src/db/schema/api-keys.ts`**

```typescript
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
```

**Step 2: Add to `src/db/schema/index.ts`**

Add after notifications export:

```typescript
export { apiKeys } from "./api-keys";
```

**Step 3: Generate migration**

Run: `npx drizzle-kit generate --name=add_api_keys`

**Step 4: Apply**

Run: `npx drizzle-kit push`

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(schema): add api_keys table"
```

---

### Task 11: API key actions

**Files:**
- Create: `src/lib/actions/api-keys.ts`

**Step 1: Install bcryptjs**

Run: `npm install bcryptjs && npm install -D @types/bcryptjs`

**Step 2: Create `src/lib/actions/api-keys.ts`**

```typescript
"use server";

import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { apiKeys } from "@/db/schema/api-keys";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

async function getOrgId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.session.activeOrganizationId) throw new Error("No active organization");
  return session.session.activeOrganizationId;
}

export async function generateApiKey(name: string = "Default") {
  const organizationId = await getOrgId();

  // Generate a secure random key: "pak_" + 32 random hex chars
  const rawKey = `pak_${randomBytes(20).toString("hex")}`;
  const keyPrefix = rawKey.slice(0, 12); // "pak_" + 8 chars
  const keyHash = await bcrypt.hash(rawKey, 10);

  // Delete existing key for this org (one key per org)
  await db.delete(apiKeys).where(eq(apiKeys.organizationId, organizationId));

  await db.insert(apiKeys).values({
    organizationId,
    name,
    keyHash,
    keyPrefix,
  });

  revalidatePath("/settings/integrations");

  // Return the raw key ONCE — never stored in plain text
  return { key: rawKey, prefix: keyPrefix };
}

export async function revokeApiKey() {
  const organizationId = await getOrgId();
  await db.delete(apiKeys).where(eq(apiKeys.organizationId, organizationId));
  revalidatePath("/settings/integrations");
}

export async function getApiKeyInfo() {
  const organizationId = await getOrgId();
  return db.query.apiKeys.findFirst({
    where: eq(apiKeys.organizationId, organizationId),
    columns: { id: true, name: true, keyPrefix: true, lastUsedAt: true, createdAt: true },
  });
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(api-keys): add generate/revoke/info server actions"
```

---

### Task 12: Settings → Integrations page

**Files:**
- Create: `src/app/(dashboard)/settings/integrations/page.tsx`
- Modify: `src/app/(dashboard)/settings/layout.tsx` — add Integrations tab

**Step 1: Read settings layout to understand tab structure**

Read `src/app/(dashboard)/settings/layout.tsx` before editing.

**Step 2: Add Integrations tab to settings layout**

Add a link to `/settings/integrations` in the settings nav tabs.

**Step 3: Create `src/app/(dashboard)/settings/integrations/page.tsx`**

This page:
- Server component that loads current key info via `getApiKeyInfo()`
- Shows key prefix if key exists: `pak_abc1****`
- Generate button → calls `generateApiKey()` → reveals full key in a one-time modal/alert
- Revoke button → confirm dialog → calls `revokeApiKey()`
- Shows `lastUsedAt` if set
- Shows n8n usage instructions (static copy):
  - URL: `GET /api/v1/leads`
  - Header: `Authorization: Bearer <sua-chave>`

```typescript
import { getApiKeyInfo } from "@/lib/actions/api-keys";
import { ApiKeyManager } from "./api-key-manager"; // client component

export default async function IntegrationsPage() {
  const keyInfo = await getApiKeyInfo();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Integrações</h2>
        <p className="text-sm text-muted-foreground">
          Use a API key para integrar com n8n, Zapier ou qualquer ferramenta externa.
        </p>
      </div>
      <ApiKeyManager keyInfo={keyInfo ?? null} />
    </div>
  );
}
```

**Step 4: Create `src/app/(dashboard)/settings/integrations/api-key-manager.tsx`** (client component)

```typescript
"use client";

import { useState } from "react";
import { generateApiKey, revokeApiKey } from "@/lib/actions/api-keys";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog, LoadingButton } from "@/components/ds";
import { toast } from "sonner";

// ... full implementation with:
// - "Gerar chave" button that reveals key in a highlighted code block
// - "Copiar" button for the key
// - Warning: "Esta chave só é exibida uma vez"
// - Existing key display: shows prefix + "••••••••••••••••••••"
// - "Revogar" button with confirm dialog
// - n8n snippet example showing how to use the key
```

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(settings): add Integrations page with API key management"
```

---

### Task 13: REST export API endpoint

**Files:**
- Create: `src/lib/api-auth.ts`
- Create: `src/app/api/v1/leads/route.ts`

**Step 1: Create `src/lib/api-auth.ts`**

```typescript
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema/api-keys";

export async function validateApiKey(
  authHeader: string | null
): Promise<{ organizationId: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;

  const rawKey = authHeader.slice(7);
  if (!rawKey.startsWith("pak_")) return null;

  const prefix = rawKey.slice(0, 12);

  const keyRecord = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.keyPrefix, prefix),
  });

  if (!keyRecord) return null;

  const valid = await bcrypt.compare(rawKey, keyRecord.keyHash);
  if (!valid) return null;

  // Update lastUsedAt asynchronously (fire and forget)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, keyRecord.id))
    .catch(() => {});

  return { organizationId: keyRecord.organizationId };
}
```

**Step 2: Create `src/app/api/v1/leads/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte, inArray, isNotNull } from "drizzle-orm";
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
        inArray(leads.aiClassification, classifications as typeof leads.aiClassification._.data[])
      );
    }
  }

  if (statusParam) {
    const statuses = statusParam.split(",").filter(Boolean);
    if (statuses.length > 0) {
      conditions.push(
        inArray(leads.status, statuses as typeof leads.status._.data[])
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
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(api): add GET /api/v1/leads export endpoint with API key auth"
```

---

## PHASE 3 — POLISH

---

### Task 14: Redesign leads data-table — configurable columns

This is the most design-intensive task. The goal is a polished, information-dense table with toggleable columns and enrichment data.

**Files:**
- Modify: `src/app/(dashboard)/leads/data-table.tsx`
- Modify: `src/app/(dashboard)/leads/columns.tsx`

**Design goals:**
- Column visibility persisted in `localStorage` key `"leads-columns-v1"`
- Columns panel: dropdown with checkboxes, grouped by category
- New enrichment columns: WhatsApp badge, Instagram (badge + follower count), Maps rank pill, business photo thumbnail, AI classification chip
- Export dropdown: "Exportar CSV" / "Exportar JSON"
- Remove stale "Inativo" logic (outreach concept)
- Clean, dense rows — no wasted space

**Step 1: Update `src/app/(dashboard)/leads/columns.tsx` — add new badge components**

```typescript
import { Badge } from "@/components/ui/badge";
import { StatusBadge as DsStatusBadge } from "@/components/ds";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function scoreTone(score: number) {
  if (score >= 80) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (score >= 60) return "bg-sky-500/20 text-sky-300 border-sky-500/40";
  if (score >= 40) return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  return "bg-zinc-500/20 text-zinc-300 border-zinc-500/40";
}

export function ScoreBadge({ score }: { score: number }) {
  return (
    <Badge className={cn("font-mono tabular-nums text-xs", scoreTone(score))}>
      {score}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <DsStatusBadge domain="leadStatus" value={status} />;
}

export function WhatsappBadge({
  hasWhatsapp,
  isBusiness,
}: {
  hasWhatsapp: boolean | null;
  isBusiness: boolean | null;
}) {
  if (!hasWhatsapp) {
    return <span className="text-muted-foreground/40 text-xs">—</span>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1">
          <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-green-400">
            WA
          </span>
          {isBusiness && (
            <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[10px] font-bold text-amber-400">
              B
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {isBusiness ? "WhatsApp Business" : "WhatsApp pessoal"}
      </TooltipContent>
    </Tooltip>
  );
}

export function InstagramBadge({
  hasInstagram,
  followers,
}: {
  hasInstagram: boolean | null;
  followers: number | null;
}) {
  if (!hasInstagram) {
    return <span className="text-muted-foreground/40 text-xs">—</span>;
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

export function RankBadge({ rank }: { rank: number | null }) {
  if (rank == null) return <span className="text-muted-foreground/40 text-xs">—</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[11px] font-mono font-medium text-red-400/80">
          #{rank}
        </span>
      </TooltipTrigger>
      <TooltipContent>Posição #{rank} no Google Maps</TooltipContent>
    </Tooltip>
  );
}

const classificationLabels: Record<string, { label: string; color: string }> = {
  needs_website: { label: "Precisa de site", color: "bg-violet-500/20 text-violet-300 border-violet-500/30" },
  needs_optimization: { label: "Otimização", color: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
  needs_ai_agent: { label: "Agente IA", color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
  needs_automation: { label: "Automação", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  low_fit: { label: "Baixo fit", color: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30" },
};

export function ClassificationBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground/40 text-xs">—</span>;
  const meta = classificationLabels[value] ?? { label: value, color: "bg-zinc-500/20 text-zinc-300" };
  return (
    <Badge className={cn("text-[11px] border", meta.color)}>
      {meta.label}
    </Badge>
  );
}
```

**Step 2: Full rewrite of `src/app/(dashboard)/leads/data-table.tsx`**

The new data table:

```typescript
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Download,
  MoveRight,
  SlidersHorizontal,
  Database,
} from "lucide-react";
import { EmptyState } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ScoreBadge,
  StatusBadge,
  WhatsappBadge,
  InstagramBadge,
  RankBadge,
  ClassificationBadge,
} from "@/app/(dashboard)/leads/columns";

// ── Types ──

type LeadRow = {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  score: number;
  status: string;
  createdAt: Date;
  imageUrl: string | null;
  googleMapsUrl: string | null;
  googleRank: number | null;
  hasWhatsapp: boolean | null;
  whatsappIsBusinessAccount: boolean | null;
  hasInstagram: boolean | null;
  instagramFollowers: number | null;
  aiClassification: string | null;
};

// ── Column definitions ──

type ColumnId =
  | "score"
  | "status"
  | "classification"
  | "whatsapp"
  | "instagram"
  | "website"
  | "rank"
  | "city"
  | "category"
  | "photo"
  | "createdAt";

const COLUMN_LABELS: Record<ColumnId, string> = {
  score: "Score",
  status: "Status",
  classification: "Classificação IA",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  website: "Website",
  rank: "Rank Maps",
  city: "Cidade",
  category: "Categoria",
  photo: "Foto",
  createdAt: "Criado em",
};

const DEFAULT_COLUMNS: Record<ColumnId, boolean> = {
  score: true,
  status: true,
  classification: true,
  whatsapp: true,
  instagram: true,
  website: true,
  rank: true,
  city: true,
  category: false,
  photo: false,
  createdAt: false,
};

const STORAGE_KEY = "leads-columns-v1";

function loadColumnVisibility(): Record<ColumnId, boolean> {
  if (typeof window === "undefined") return DEFAULT_COLUMNS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_COLUMNS, ...JSON.parse(stored) };
  } catch {}
  return DEFAULT_COLUMNS;
}

// ── Component ──

export function LeadsDataTable({
  leads,
  selected,
  onToggle,
  onToggleAll,
  onOpenLead,
}: {
  leads: LeadRow[];
  selected: string[];
  onToggle: (leadId: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onOpenLead: (leadId: string) => void;
}) {
  const [columns, setColumns] = useState<Record<ColumnId, boolean>>(DEFAULT_COLUMNS);

  useEffect(() => {
    setColumns(loadColumnVisibility());
  }, []);

  const toggleColumn = useCallback((col: ColumnId, visible: boolean) => {
    setColumns((prev) => {
      const next = { ...prev, [col]: visible };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetColumns = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setColumns(DEFAULT_COLUMNS);
  }, []);

  const allSelected = leads.length > 0 && selected.length === leads.length;
  const someSelected = selected.length > 0 && selected.length < leads.length;

  const visibleColumns = (Object.keys(columns) as ColumnId[]).filter(
    (col) => columns[col]
  );

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={Database}
        title="Nenhum lead encontrado"
        description="Ajuste os filtros ou inicie uma nova extração para popular a base."
      />
    );
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 backdrop-blur-sm overflow-hidden">
      {/* Table toolbar */}
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-2.5 gap-3">
        <span className="text-xs text-muted-foreground">
          {selected.length > 0
            ? `${selected.length} selecionado${selected.length > 1 ? "s" : ""}`
            : `${leads.length} leads`}
        </span>

        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportLeads(leads, "csv")}>
                Exportar CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportLeads(leads, "json")}>
                Exportar JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Column toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Colunas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Visibilidade
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(Object.keys(COLUMN_LABELS) as ColumnId[]).map((col) => (
                <DropdownMenuCheckboxItem
                  key={col}
                  checked={columns[col]}
                  onCheckedChange={(v) => toggleColumn(col, v)}
                  className="text-xs"
                >
                  {COLUMN_LABELS[col]}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={resetColumns} className="text-xs text-muted-foreground">
                Restaurar padrão
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 pl-4">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={(v) => {
                  if (v === "indeterminate") return;
                  onToggleAll(Boolean(v));
                }}
              />
            </TableHead>
            <TableHead>Nome</TableHead>
            {columns.photo && <TableHead className="w-10">Foto</TableHead>}
            {columns.score && <TableHead className="w-16">Score</TableHead>}
            {columns.status && <TableHead>Status</TableHead>}
            {columns.classification && <TableHead>Classificação</TableHead>}
            {columns.whatsapp && <TableHead className="w-20">WhatsApp</TableHead>}
            {columns.instagram && <TableHead className="w-24">Instagram</TableHead>}
            {columns.rank && <TableHead className="w-16">Rank</TableHead>}
            {columns.city && <TableHead>Cidade</TableHead>}
            {columns.category && <TableHead>Categoria</TableHead>}
            {columns.createdAt && <TableHead>Criado</TableHead>}
            <TableHead className="w-10 pr-4" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {leads.map((lead) => {
            const checked = selected.includes(lead.id);
            return (
              <TableRow
                key={lead.id}
                data-state={checked ? "selected" : undefined}
                className="group"
              >
                <TableCell className="pl-4">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => onToggle(lead.id, Boolean(v))}
                  />
                </TableCell>

                <TableCell>
                  <button
                    type="button"
                    onClick={() => onOpenLead(lead.id)}
                    className="text-left text-sm font-medium hover:text-primary transition-colors"
                  >
                    {lead.name}
                  </button>
                  {lead.googleMapsUrl && (
                    <a
                      href={lead.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors truncate max-w-48 mt-0.5"
                    >
                      Ver no Maps ↗
                    </a>
                  )}
                </TableCell>

                {columns.photo && (
                  <TableCell>
                    {lead.imageUrl ? (
                      <Image
                        src={lead.imageUrl}
                        alt={lead.name}
                        width={32}
                        height={32}
                        className="rounded-md object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-md bg-muted/50" />
                    )}
                  </TableCell>
                )}

                {columns.score && (
                  <TableCell>
                    <ScoreBadge score={lead.score} />
                  </TableCell>
                )}

                {columns.status && (
                  <TableCell>
                    <StatusBadge status={lead.status} />
                  </TableCell>
                )}

                {columns.classification && (
                  <TableCell>
                    <ClassificationBadge value={lead.aiClassification} />
                  </TableCell>
                )}

                {columns.whatsapp && (
                  <TableCell>
                    <WhatsappBadge
                      hasWhatsapp={lead.hasWhatsapp}
                      isBusiness={lead.whatsappIsBusinessAccount}
                    />
                  </TableCell>
                )}

                {columns.instagram && (
                  <TableCell>
                    <InstagramBadge
                      hasInstagram={lead.hasInstagram}
                      followers={lead.instagramFollowers}
                    />
                  </TableCell>
                )}

                {columns.rank && (
                  <TableCell>
                    <RankBadge rank={lead.googleRank} />
                  </TableCell>
                )}

                {columns.city && (
                  <TableCell className="text-sm text-muted-foreground">
                    {lead.city ?? "—"}
                  </TableCell>
                )}

                {columns.category && (
                  <TableCell className="text-sm text-muted-foreground max-w-32 truncate">
                    {lead.category ?? "—"}
                  </TableCell>
                )}

                {columns.createdAt && (
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {new Date(lead.createdAt).toLocaleDateString("pt-BR")}
                  </TableCell>
                )}

                <TableCell className="pr-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onOpenLead(lead.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoveRight className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Ver detalhes</TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Export helpers ──

function exportLeads(leads: LeadRow[], format: "csv" | "json") {
  let content: string;
  let filename: string;
  let type: string;

  if (format === "json") {
    content = JSON.stringify(leads, null, 2);
    filename = `leads-${new Date().toISOString().slice(0, 10)}.json`;
    type = "application/json";
  } else {
    const headers = [
      "id", "name", "city", "category", "score", "status",
      "hasWhatsapp", "hasInstagram", "instagramFollowers",
      "googleRank", "aiClassification", "createdAt",
    ];
    const rows = leads.map((l) =>
      [
        l.id, l.name, l.city ?? "", l.category ?? "", l.score, l.status,
        l.hasWhatsapp ?? "", l.hasInstagram ?? "", l.instagramFollowers ?? "",
        l.googleRank ?? "", l.aiClassification ?? "",
        new Date(l.createdAt).toISOString(),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    content = [headers.join(","), ...rows].join("\n");
    filename = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    type = "text/csv";
  }

  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

**Step 3: Update leads page to pass new fields**

Read `src/app/(dashboard)/leads/page.tsx` and add the new fields to the query:
`imageUrl`, `googleRank`, `hasInstagram`, `instagramFollowers`, `whatsappIsBusinessAccount`, `aiClassification`

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1`
Expected: 0 errors.

**Step 5: Run lint**

Run: `npm run lint`
Expected: no errors.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(leads): redesign table — configurable columns, enrichment badges, export"
```

---

### Task 15: Final verification

**Step 1: Full TypeScript check**

Run: `npx tsc --noEmit --pretty`
Expected: 0 errors.

**Step 2: Run all tests**

Run: `npm test`
Expected: all pass.

**Step 3: Lint**

Run: `npm run lint`
Expected: 0 errors.

**Step 4: Manual smoke test**

Start dev server: `npm run dev`

Check:
- [ ] Sidebar shows only Leads, Extração, Configurações
- [ ] `/inbox` returns 404
- [ ] `/campaigns` returns 404
- [ ] Settings tabs: General, AI, WhatsApp, Scoring, Integrações, Advanced
- [ ] Integrações page generates and copies API key
- [ ] `GET /api/v1/leads` returns 401 without key
- [ ] `GET /api/v1/leads` returns data with valid key
- [ ] Leads table has column toggle dropdown
- [ ] Export CSV/JSON downloads correctly

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup and verification — lead gen focus complete"
```
