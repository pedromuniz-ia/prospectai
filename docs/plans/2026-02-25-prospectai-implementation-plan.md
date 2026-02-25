# ProspectAI MVP — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a WhatsApp prospecting engine with mini CRM, AI-powered conversations, lead scoring, and anti-ban cadence — as a multi-tenant web app.

**Architecture:** Next.js 15 App Router monolith with a separate BullMQ worker process. Turso (SQLite) via Drizzle ORM for persistence. Evolution API for WhatsApp. Vercel AI SDK for multi-provider LLM integration. Redis for job queues.

**Tech Stack:** Next.js 15, React, Tailwind CSS, shadcn/ui, Jotai, Better Auth, Drizzle ORM, Turso, BullMQ, Redis, Vercel AI SDK, Apify Client, dnd-kit, Evolution API

**Design doc:** `docs/plans/2026-02-25-prospectai-mvp-design.md`

---

## Phase 1: Foundation

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/lib/utils.ts`, `components.json`

**Step 1: Initialize Next.js project**

```bash
cd c:/Users/pedro/Desktop/Coding/prospectai
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack
```

Accept defaults. This creates the full Next.js 15 scaffold with App Router.

**Step 2: Install shadcn/ui**

```bash
npx shadcn@latest init
```

Select: New York style, Zinc base color, CSS variables = yes.

**Step 3: Install core dependencies**

```bash
npm install jotai zod
npm install -D @types/node
```

**Step 4: Add initial shadcn components**

```bash
npx shadcn@latest add button card input label badge tabs dialog sheet sonner separator dropdown-menu avatar tooltip scroll-area
```

**Step 5: Set up fonts**

Modify `src/app/layout.tsx`:
- Import `Geist` and `Geist_Mono` from `next/font/google` (already included by create-next-app)
- Add `Instrument_Serif` from `next/font/google` for display font
- Apply as CSS variables: `--font-sans`, `--font-mono`, `--font-display`

**Step 6: Configure dark mode**

Update `tailwind.config.ts` to add `darkMode: "class"`. Update `src/app/globals.css` with the design palette CSS variables:

```css
:root {
  --background: 0 0% 4%;        /* #0A0A0B */
  --foreground: 240 5% 93%;     /* #EDEDEF */
  --card: 240 4% 8%;            /* #141416 */
  --border: 240 5% 12%;         /* #1F1F23 */
  --muted-foreground: 240 4% 46%; /* #71717A */
  --primary: 217 91% 60%;       /* #3B82F6 */
  --destructive: 0 84% 60%;     /* #EF4444 */
  /* ... complete palette per design doc section 7.1 */
}
```

**Step 7: Verify dev server runs**

```bash
npm run dev
```

Expected: App loads at `http://localhost:3000` with dark background.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js 15 project with shadcn/ui and dark theme"
```

---

### Task 2: Database Schema + Drizzle + Turso

**Files:**
- Create: `src/db/index.ts`, `src/db/schema.ts`, `drizzle.config.ts`, `.env.local`
- Create: `src/db/schema/organizations.ts`, `src/db/schema/leads.ts`, `src/db/schema/campaigns.ts`, `src/db/schema/messages.ts`, `src/db/schema/campaign-leads.ts`, `src/db/schema/whatsapp-instances.ts`, `src/db/schema/ai-providers.ts`, `src/db/schema/scoring-rules.ts`, `src/db/schema/extraction-jobs.ts`, `src/db/schema/warmup-configs.ts`, `src/db/schema/audit-logs.ts`, `src/db/schema/message-templates.ts`

**Step 1: Install Drizzle + Turso dependencies**

```bash
npm install drizzle-orm @libsql/client
npm install -D drizzle-kit
```

**Step 2: Create `.env.local`**

```env
# Database - use local file for dev, Turso URL for prod
TURSO_CONNECTION_URL=file:local.db
TURSO_AUTH_TOKEN=

# Evolution API
EVOLUTION_API_URL=https://your-evolution-api.com
EVOLUTION_API_KEY=your-api-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
BETTER_AUTH_SECRET=generate-a-random-secret-here

# Apify
APIFY_TOKEN=

# Redis
REDIS_URL=redis://localhost:6379
```

**Step 3: Create `drizzle.config.ts`**

```typescript
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env.local' });

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_CONNECTION_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
```

**Step 4: Create `src/db/index.ts`**

```typescript
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const client = createClient({
  url: process.env.TURSO_CONNECTION_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
```

**Step 5: Create schema files**

Create each schema file per the design doc section 5. Use `sqliteTable` from `drizzle-orm/sqlite-core`. Key patterns:

- All tables have `organizationId` column (multi-tenant isolation)
- Use `text('id').$defaultFn(() => createId())` for cuid primary keys (use `@paralleldrive/cuid2`)
- Use `integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())` for timestamps
- JSON fields use `text('field_name', { mode: 'json' })`
- Create indexes for: `leads(organizationId)`, `messages(leadId, createdAt)`, `campaign_leads(campaignId, leadId)`, `audit_logs(organizationId, createdAt)`

Install cuid2:
```bash
npm install @paralleldrive/cuid2
```

Create `src/db/schema/index.ts` that re-exports all schema files.

**Step 6: Generate and apply migrations**

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

Expected: Migration files created in `./migrations/`, local SQLite DB created.

**Step 7: Verify schema**

```bash
npx drizzle-kit studio
```

Expected: Drizzle Studio opens and shows all 12 tables.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Drizzle ORM schema with all 12 tables for multi-tenant CRM"
```

---

### Task 3: Authentication (Better Auth + Organizations)

**Files:**
- Create: `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/app/api/auth/[...all]/route.ts`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`, `src/middleware.ts`

**Step 1: Install Better Auth**

```bash
npm install better-auth
```

**Step 2: Create `src/lib/auth.ts`**

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { db } from "@/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  plugins: [
    organization(),
  ],
  emailAndPassword: {
    enabled: true,
  },
});
```

**Step 3: Generate Better Auth tables**

```bash
npx @better-auth/cli generate
npx drizzle-kit push
```

This adds Better Auth's required tables (user, session, account, organization, member, invitation) to the schema.

**Step 4: Create `src/lib/auth-client.ts`**

```typescript
import { createAuthClient } from "better-auth/client";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    organizationClient(),
  ],
});
```

**Step 5: Create API route `src/app/api/auth/[...all]/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

**Step 6: Create `src/middleware.ts`**

Protect all routes except `/login`, `/register`, `/api/auth/*`, and `/api/webhooks/*` (Evolution API webhooks need to be public).

**Step 7: Create login and register pages**

Simple forms using shadcn Form + Input + Button. Call `authClient.signIn.email()` and `authClient.signUp.email()`.

**Step 8: Test auth flow**

```bash
npm run dev
```

Navigate to `/register`, create account, verify redirect to `/`. Navigate to `/login`, sign in, verify session works.

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: add Better Auth with email/password and organization plugin"
```

---

### Task 4: App Shell (Layout + Sidebar + Status Bar)

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`, `src/components/sidebar.tsx`, `src/components/status-bar.tsx`, `src/components/user-nav.tsx`
- Create: `src/app/(dashboard)/page.tsx` (redirects to /inbox)

**Step 1: Install additional shadcn components**

```bash
npx shadcn@latest add command popover
```

**Step 2: Create sidebar component**

5-item navigation per design doc 7.2:
- Inbox (MessageSquare icon)
- Leads (Users icon)
- Campanhas (Rocket icon)
- Extração (Database icon)
- --- separator ---
- Config (Settings icon)

Use `usePathname()` for active state. Icons from `lucide-react` (included with shadcn).

**Step 3: Create status bar component**

Persistent 2-line bar at the top:
- Line 1: Unread count, needs review count, active campaigns count
- Line 2: WhatsApp instance status, warm-up day, daily messages, delivery rate

Data fetched via Server Component or SWR polling (every 30s).

**Step 4: Create dashboard layout**

`src/app/(dashboard)/layout.tsx`: sidebar on left (w-56), status bar at top, content area fills remaining space. Auth check — if not authenticated, redirect to `/login`.

**Step 5: Create redirect from `/` to `/inbox`**

The dashboard home page redirects to `/inbox`.

**Step 6: Verify layout renders**

```bash
npm run dev
```

Expected: Sidebar renders with 5 nav items, status bar shows placeholder data, dark theme applied.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add app shell with sidebar navigation and status bar"
```

---

## Phase 2: Core Infrastructure

### Task 5: Evolution API Integration Layer

**Files:**
- Create: `src/lib/evolution-api.ts`, `src/app/(dashboard)/settings/whatsapp/page.tsx`, `src/app/api/webhooks/evolution/route.ts`

**Step 1: Create Evolution API client**

`src/lib/evolution-api.ts` — A typed client wrapping the Evolution API REST endpoints:

```typescript
class EvolutionAPI {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) { ... }

  // POST /api/instance/create
  async createInstance(config: CreateInstanceInput): Promise<CreateInstanceResponse>

  // GET /instance/connectionState/{instance}
  async getConnectionState(instanceName: string): Promise<{ state: string }>

  // POST /message/sendText/{instance}
  async sendText(instanceName: string, input: SendTextInput): Promise<SendTextResponse>

  // POST /webhook/set/{instance}
  async setWebhook(instanceName: string, config: WebhookConfig): Promise<void>

  // GET /instance/fetchInstances
  async fetchInstances(): Promise<Instance[]>
}
```

Key types based on Context7 docs:
- `SendTextInput`: `{ number: string, text: string, delay?: number }`
- `CreateInstanceInput`: `{ instanceName: string, integration: "WHATSAPP-BAILEYS", qrcode: true, ... }`
- Webhook events to subscribe: `MESSAGES_UPSERT`, `QRCODE_UPDATED`, `CONNECTION_UPDATE`, `MESSAGES_UPDATE`

**Step 2: Create webhook receiver**

`src/app/api/webhooks/evolution/route.ts`:
- POST handler that receives Evolution API webhook events
- Route based on event type:
  - `MESSAGES_UPSERT` → save inbound message to DB, update lead status
  - `QRCODE_UPDATED` → update instance QR code in DB
  - `CONNECTION_UPDATE` → update instance status in DB
  - `MESSAGES_UPDATE` → update message delivery/read status
- Must be public (excluded from auth middleware)

**Step 3: Create WhatsApp settings page**

`src/app/(dashboard)/settings/whatsapp/page.tsx`:
- List existing instances with status badges
- "Connect new number" button → calls `createInstance` → shows QR code
- QR code polling: fetch instance state every 3 seconds until `state === "open"`
- Disconnect button

**Step 4: Write test for Evolution API client**

Create `src/lib/__tests__/evolution-api.test.ts`:
- Mock fetch calls
- Test `createInstance`, `sendText`, `getConnectionState`, `setWebhook`
- Test error handling (401, 404, 500)

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

Add to `package.json`:
```json
"scripts": { "test": "vitest" }
```

Create `vitest.config.ts` with path aliases matching tsconfig.

**Step 5: Run tests**

```bash
npm test -- --run src/lib/__tests__/evolution-api.test.ts
```

Expected: All tests pass.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Evolution API client, webhook receiver, and WhatsApp settings page"
```

---

### Task 6: Redis + BullMQ Worker Setup

**Files:**
- Create: `src/lib/queue.ts`, `src/worker.ts`, `src/workers/index.ts`
- Create: `src/workers/extraction.ts`, `src/workers/enrichment.ts`, `src/workers/cadence.ts`, `src/workers/ai-reply.ts`, `src/workers/message-send.ts`

**Step 1: Install BullMQ + Redis**

```bash
npm install bullmq ioredis
npm install -D tsx
```

**Step 2: Create queue definitions**

`src/lib/queue.ts`:

```typescript
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

export const extractionQueue = new Queue('extraction', { connection });
export const enrichmentQueue = new Queue('enrichment', { connection });
export const cadenceQueue = new Queue('cadence', { connection });
export const aiReplyQueue = new Queue('ai-reply', { connection });
export const messageSendQueue = new Queue('message-send', { connection });
```

**Step 3: Create worker process entry point**

`src/worker.ts`:

```typescript
import IORedis from 'ioredis';
import { Worker } from 'bullmq';
import { processExtraction } from './workers/extraction';
import { processEnrichment } from './workers/enrichment';
import { processCadence } from './workers/cadence';
import { processAiReply } from './workers/ai-reply';
import { processMessageSend } from './workers/message-send';

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

// Workers
new Worker('extraction', processExtraction, { connection, concurrency: 2 });
new Worker('enrichment', processEnrichment, { connection, concurrency: 5 });
new Worker('cadence', processCadence, { connection, concurrency: 1 });
new Worker('ai-reply', processAiReply, { connection, concurrency: 3 });
new Worker('message-send', processMessageSend, {
  connection,
  concurrency: 1,
  limiter: { max: 1, duration: 10_000 }, // 1 msg every 10s
});

// Job Schedulers (cron)
const schedulerQueue = new Queue('scheduler', { connection });

// Feed cadence queue every minute
await schedulerQueue.upsertJobScheduler('feed-cadence', {
  pattern: '*/1 * * * *',
}, { name: 'feed-cadence' });

// Reset daily counters at midnight
await schedulerQueue.upsertJobScheduler('reset-counters', {
  pattern: '0 0 * * *',
}, { name: 'reset-counters' });

// Health check every 5 minutes
await schedulerQueue.upsertJobScheduler('health-check', {
  pattern: '*/5 * * * *',
}, { name: 'health-check' });

console.log('Worker process started');
```

**Step 4: Create stub worker processors**

Each file in `src/workers/` exports a processor function:

```typescript
// src/workers/extraction.ts
import { Job } from 'bullmq';

export async function processExtraction(job: Job) {
  console.log('Processing extraction:', job.data);
  // Implementation in Task 11
}
```

Create stubs for all 5 workers.

**Step 5: Add worker script to package.json**

```json
"scripts": {
  "worker": "tsx watch src/worker.ts",
  "worker:prod": "tsx src/worker.ts"
}
```

**Step 6: Verify worker starts**

```bash
npm run worker
```

Expected: "Worker process started" logged. Worker connects to Redis and waits for jobs.

Note: Requires Redis running locally. Install via:
```bash
# Windows (WSL or Docker)
docker run -d --name redis -p 6379:6379 redis:alpine
```

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add BullMQ worker process with 5 queues and cron schedulers"
```

---

## Phase 3: Lead Management

### Task 7: Leads CRUD + Table UI

**Files:**
- Create: `src/app/(dashboard)/leads/page.tsx`, `src/app/(dashboard)/leads/columns.tsx`, `src/app/(dashboard)/leads/data-table.tsx`
- Create: `src/app/api/leads/route.ts` (or use Server Actions)
- Create: `src/lib/actions/leads.ts` (Server Actions)

**Step 1: Install DataTable dependencies**

```bash
npm install @tanstack/react-table
npx shadcn@latest add table checkbox select
```

**Step 2: Create leads Server Actions**

`src/lib/actions/leads.ts`:
- `getLeads(orgId, filters)` — paginated, filterable, sortable query
- `getLead(id)` — single lead with full details
- `createLead(data)` — manual lead creation
- `updateLead(id, data)` — update lead fields
- `deleteLead(id)` — soft delete or hard delete
- `bulkAddToCampaign(leadIds, campaignId)` — bulk operation

Filters support: category, city, score range, status, hasWebsite, campaignId, aiClassification.
Sort by: score DESC (default), name, lastContactedAt, createdAt.
Pagination: cursor-based or offset (offset simpler for MVP).

**Step 3: Create DataTable component**

`src/app/(dashboard)/leads/data-table.tsx`:
- Uses `@tanstack/react-table` with shadcn Table
- Columns: Name, Category, City, Score (colored Badge), Last Contact (relative time), Status (Badge)
- Row hover shows inline actions: [+ Campaign] [Chat] [Move stage]
- Stale indicator: if `lastContactedAt > 3 days ago && status === "contacted"`, show clock icon
- Multi-select with checkboxes for bulk actions
- Toolbar: search input + filter dropdowns + view toggle button (Table | Board)

**Step 4: Create leads page**

`src/app/(dashboard)/leads/page.tsx`:
- Server Component that fetches initial leads
- Passes to client DataTable
- Filter state managed in URL search params (for shareable links)

**Step 5: Create lead detail drawer**

Use shadcn Sheet (side drawer):
- All lead data organized in sections: Info, Enrichment, Score Breakdown, AI Classification, Campaigns, Recent Messages
- Score breakdown as horizontal bars with labels and points
- Action buttons: Open conversation, Edit, Move in pipeline

**Step 6: Test the leads page**

```bash
npm run dev
```

Seed some test leads directly via Drizzle Studio or a seed script. Navigate to `/leads`, verify table renders with filters and sorting.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add leads table with filters, sorting, score display, and detail drawer"
```

---

### Task 8: Extraction — Apify Integration

**Files:**
- Create: `src/lib/apify.ts`, `src/app/(dashboard)/extraction/page.tsx`, `src/lib/actions/extraction.ts`
- Modify: `src/workers/extraction.ts`

**Step 1: Install Apify client**

```bash
npm install apify-client
```

**Step 2: Create Apify client wrapper**

`src/lib/apify.ts`:

```typescript
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: process.env.APIFY_TOKEN! });

export async function runGoogleMapsScraper(input: {
  searchQuery: string;     // e.g., "Restaurante"
  locationQuery: string;   // e.g., "São Paulo, SP"
  maxResults: number;
}) {
  // Use the Google Maps Scraper actor: "apify/google-maps-scraper"
  const { defaultDatasetId } = await client.actor('apify/google-maps-scraper').call({
    searchStringsArray: [`${input.searchQuery} em ${input.locationQuery}`],
    maxCrawledPlacesPerSearch: input.maxResults,
    language: 'pt-BR',
    // ... other config
  });

  const { items } = await client.dataset(defaultDatasetId).listItems();
  return items;
}
```

Map Apify output fields to our lead schema:
- `title` → `name`
- `phone` → `phone`
- `website` → `website`
- `address` → `address`
- `city` → `city`
- `state` → `state` (parse from address)
- `categoryName` → `category`
- `totalScore` → `googleRating`
- `reviewsCount` → `googleReviewCount`
- `openingHours` → `businessHours` (JSON)
- `location.lat/lng` → `latitude/longitude`

**Step 3: Implement extraction worker**

`src/workers/extraction.ts`:
- Receives job with `{ organizationId, query, city, state, maxResults, extractionJobId }`
- Calls `runGoogleMapsScraper`
- For each result: check for duplicates (by phone or website+name), create lead if new
- Updates `extraction_jobs` row with progress: `totalFound`, `totalNew`, `totalDuplicate`
- After extraction, enqueue enrichment jobs for all new leads

**Step 4: Create extraction page**

`src/app/(dashboard)/extraction/page.tsx`:
- Form: search query input, city select, state select, max results slider
- Saved presets: list of saved searches with one-click re-run
- Job list: shows extraction jobs with progress bars, results summary, "View leads" link
- Submit creates `extraction_jobs` row and enqueues to `extraction` queue

**Step 5: Create extraction Server Actions**

`src/lib/actions/extraction.ts`:
- `startExtraction(orgId, config)` — creates job row, enqueues
- `getExtractionJobs(orgId)` — list recent jobs
- `savePreset(orgId, preset)` / `getPresets(orgId)` — saved searches

**Step 6: Test extraction flow**

Requires valid `APIFY_TOKEN` in `.env.local`. Run a small extraction (5 results) and verify leads appear in the database.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Apify Google Maps extraction with job tracking and deduplication"
```

---

### Task 9: Enrichment Pipeline

**Files:**
- Create: `src/lib/enrichment/rdap.ts`, `src/lib/enrichment/website-check.ts`, `src/lib/enrichment/scorer.ts`, `src/lib/enrichment/ai-classifier.ts`
- Modify: `src/workers/enrichment.ts`

**Step 1: Create RDAP (Registro.br) enrichment**

`src/lib/enrichment/rdap.ts`:

```typescript
export async function enrichWithRDAP(domain: string): Promise<{
  whoisEmail: string | null;
  whoisResponsible: string | null;
  domainRegistrar: string | null;
  domainCreatedAt: string | null;
}> {
  // Only for .com.br domains
  if (!domain.endsWith('.com.br')) return { whoisEmail: null, ... };

  const response = await fetch(`https://rdap.registro.br/domain/${domain}`, {
    headers: { 'Accept': 'application/json' },
  });

  // Parse vcardArray from response entities
  // Extract email: entity.vcardArray[1] → find field where [0] === 'email'
  // Extract responsible name from 'fn' field
  // ...
}
```

Port logic from PCZ Data Extractor's `popup.js` WHOIS tab.

**Step 2: Create website check enrichment**

`src/lib/enrichment/website-check.ts`:

```typescript
export async function checkWebsite(domain: string): Promise<{
  websiteStatus: 'active' | 'inactive' | 'parked' | 'error';
  hasSsl: boolean;
  email: string | null;  // extracted from site
}> {
  // Try HTTPS first, fallback to HTTP
  // Check response status
  // Parse HTML for email regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  // Check common paths: /, /contato, /contact, /fale-conosco, /about
  // Detect parked domains (common patterns)
}
```

Port logic from PCZ Data Extractor's `popup.js` email extraction tab.

**Step 3: Create scoring engine**

`src/lib/enrichment/scorer.ts`:

```typescript
export async function scoreLead(
  lead: Lead,
  rules: ScoringRule[],
): Promise<{
  score: number;
  breakdown: Record<string, number>;
  explanation: string;
}> {
  // For each active rule:
  //   Evaluate: lead[rule.field] matches rule.operator + rule.value?
  //   If yes: add rule.points to score, add to breakdown
  // Generate explanation string from top contributing rules
  // Return total score, breakdown object, explanation text
}
```

**Step 4: Create AI classifier**

`src/lib/enrichment/ai-classifier.ts`:

```typescript
import { generateObject } from 'ai';
import { z } from 'zod';

const classificationSchema = z.object({
  classification: z.enum(['needs_website', 'needs_optimization', 'needs_ai_agent', 'needs_automation', 'low_fit']),
  confidence: z.number().min(0).max(1),
  summary: z.string().max(200),
  suggestedApproach: z.string().max(300),
});

export async function classifyLead(lead: Lead, aiProvider: AIProviderConfig) {
  // Build prompt with lead data: name, category, city, hasWebsite, googleRating, reviewCount, etc.
  // Call generateObject with classificationSchema
  // Return typed result
}
```

Note: uses `generateObject` from AI SDK (check version — if v6, use `generateText` with `Output.object()`).

**Step 5: Implement enrichment worker**

`src/workers/enrichment.ts`:
- Receives job with `{ leadId, organizationId, type }` where type = `rdap | website | score | classify | full`
- `full` runs all 4 in sequence: RDAP → website check → score → AI classify
- 3-second delay between RDAP calls (rate limiting)
- Updates lead row after each step
- Creates audit_log entry

**Step 6: Write tests for scorer**

`src/lib/enrichment/__tests__/scorer.test.ts`:
- Test various rule combinations
- Test operator logic (eq, neq, gt, lt, gte, lte, in, not_in)
- Test score explanation generation

```bash
npm test -- --run src/lib/enrichment/__tests__/scorer.test.ts
```

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add enrichment pipeline — RDAP, website check, scoring, AI classification"
```

---

## Phase 4: Campaign Engine

### Task 10: Campaigns CRUD + Wizard UI

**Files:**
- Create: `src/app/(dashboard)/campaigns/page.tsx`, `src/app/(dashboard)/campaigns/new/page.tsx`
- Create: `src/lib/actions/campaigns.ts`
- Create: `src/components/campaign-wizard.tsx`

**Step 1: Create campaign Server Actions**

`src/lib/actions/campaigns.ts`:
- `getCampaigns(orgId)` — list with stats (leads count, sent, reply rate)
- `getCampaign(id)` — single campaign with full details
- `createCampaign(data)` — create + assign matching leads to campaign_leads
- `updateCampaign(id, data)` — update config
- `pauseCampaign(id)` / `resumeCampaign(id)` — toggle status
- `getMatchingLeadsPreview(orgId, filters)` — returns count + sample for wizard preview

**Step 2: Create campaign wizard (3-step)**

`src/components/campaign-wizard.tsx`:

**Step 1 of wizard — Objective + Filters + Preview:**
- Objective dropdown: sell_website, sell_ai_agent, sell_optimization, sell_automation, custom
- Selecting objective auto-fills recommended filters (e.g., sell_website → hasWebsite: false)
- Filter controls: categories multi-select, cities multi-select, min score slider, has website toggle
- Live preview: "342 leads found, 89 with score > 60" — updates as filters change

**Step 2 of wizard — Cadence + Messages + AI:**
- WhatsApp instance select (only connected ones)
- Schedule: start time, end time, days of week checkboxes
- Intervals: min/max interval sliders (seconds)
- Daily limit input
- First message variants: textarea list, minimum 5 variants, with "Add variant" button
- AI config: provider select, model select, system prompt textarea (with template pre-filled by objective), max auto-replies, temperature slider

**Step 3 of wizard — Review + Simulation:**
- Full summary of all settings
- Simulation: "{N} leads, ~{X} business days, completion ~{date}"
- Safety check: daily volume vs warm-up limit, warning if over
- "Launch campaign" button

**Step 3: Create campaigns list page**

Campaign cards showing: name, objective badge, instance, leads/sent/replied counts, reply rate %, AI model, cadence summary. Prominent pause/resume button. Click opens campaign detail.

**Step 4: Test campaign creation**

Create a test campaign via wizard. Verify campaign_leads rows are created with correct scores.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add campaign CRUD with 3-step wizard, filters, and simulation preview"
```

---

### Task 11: Cadence Engine + Anti-ban

**Files:**
- Modify: `src/workers/cadence.ts`, `src/workers/message-send.ts`
- Create: `src/lib/cadence/scheduler.ts`, `src/lib/cadence/message-variants.ts`, `src/lib/cadence/anti-ban.ts`

**Step 1: Create cadence scheduler**

`src/lib/cadence/scheduler.ts`:
- Called by the `feed-cadence` cron job every minute
- For each active campaign:
  1. Check: within schedule window? (`scheduleStart/End/Days`)
  2. Check: `dailySent < dailyLimit`?
  3. Check: instance connected and within `dailyMessageLimit`?
  4. Check: warm-up limit (from `warmup_configs`)?
  5. Query `campaign_leads WHERE status = 'pending' ORDER BY campaignScore DESC LIMIT remaining`
  6. For each lead, enqueue to `cadence` queue with staggered delay:
     - Lead 1: `delay = random(0, 30) * 1000`
     - Lead N: `delay = random(minInterval, maxInterval) * N * 1000`
  7. Add long pause every ~15 leads: extra `random(600, 1200) * 1000` ms

**Step 2: Create message variant system**

`src/lib/cadence/message-variants.ts`:

```typescript
export function selectVariant(variants: string[], lastUsedIndex: number): {
  message: string;
  index: number;
} {
  // Never repeat the same variant consecutively
  // Random selection excluding lastUsedIndex
}

export function applyMicroVariations(message: string): string {
  // Random micro-changes to avoid fingerprinting:
  // - Add/remove trailing emoji (from safe list: 😊👋🙂)
  // - "Oi" ↔ "Oii" ↔ "Oi!"
  // - "tudo bem?" ↔ "td bem?" ↔ "tudo bem"
  // - Add/remove "!" or "?"
  // - Capitalize or lowercase first letter
  // Only apply 0-2 changes per message
}
```

**Step 3: Implement cadence worker**

`src/workers/cadence.ts`:
- Receives `{ campaignLeadId, campaignId }`
- Double-check: still within schedule? limit not reached?
- Select variant + apply micro-variations
- Enqueue to `message-send` queue

**Step 4: Implement message-send worker**

`src/workers/message-send.ts`:
- Rate limited: 1 job per 8-15 seconds (randomized via limiter config)
- Receives `{ leadId, phone, content, campaignLeadId, source, whatsappInstanceId }`
- Send "composing" status via Evolution API (if supported)
- Wait proportional delay (content.length * 50ms, capped at 3s) — simulates typing
- Call `evolutionApi.sendText(instanceName, { number: phone, text: content })`
- On success: save to `messages` table, update `campaign_leads.status`, increment counters
- On error (invalid number): mark lead as `skipped`
- On error (rate limit / ban signal): pause the entire queue, create alert

**Step 5: Create anti-ban monitor**

`src/lib/cadence/anti-ban.ts`:
- Track delivery failure rate in a sliding 1-hour window
- If >20% failures: auto-pause all campaigns for that instance
- Log warning to `audit_logs`
- Surface alert via status bar (to be consumed by UI later)

**Step 6: Write tests for cadence logic**

`src/lib/cadence/__tests__/scheduler.test.ts`:
- Test schedule window checking
- Test staggered delay calculation
- Test long pause insertion every ~15 leads
- Test daily limit enforcement

`src/lib/cadence/__tests__/message-variants.test.ts`:
- Test no consecutive repeats
- Test micro-variations produce different output

```bash
npm test -- --run src/lib/cadence/__tests__/
```

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add cadence engine with anti-ban layers, message variants, and rate limiting"
```

---

## Phase 5: Conversations + AI

### Task 12: Inbox (Conversations UI)

**Files:**
- Create: `src/app/(dashboard)/inbox/page.tsx`, `src/app/(dashboard)/inbox/conversation-list.tsx`, `src/app/(dashboard)/inbox/chat-view.tsx`, `src/app/(dashboard)/inbox/lead-context.tsx`
- Create: `src/lib/actions/messages.ts`

**Step 1: Create messages Server Actions**

`src/lib/actions/messages.ts`:
- `getConversations(orgId, filter)` — list conversations with last message, unread count, lead score
  - Filters: `needs_action` (default), `all`, `unread`, `awaiting_ai`, `needs_review`
  - Sort: priority (score * recency weight), or chronological
- `getMessages(leadId)` — full message history for a lead
- `sendMessage(leadId, content, source)` — manual message send
- `markAsRead(leadId)` — mark conversation as read

**Step 2: Create 3-column Inbox layout**

`src/app/(dashboard)/inbox/page.tsx`:
- Left column (w-80): conversation list
- Center column (flex-1): chat view
- Right column (w-72): lead context panel (collapsible)

**Step 3: Create conversation list**

`src/app/(dashboard)/inbox/conversation-list.tsx`:
- Filter tabs at top: "Precisa ação (7)" | "Todas" | "Não lidas" | "Aguard. IA"
- Each item: lead name, last message preview (truncated), score badge, time ago, unread dot
- Color coding: green = replied, yellow = awaiting, red = negative response, gray = sent/no reply
- "Próximo →" button at bottom: opens highest-priority unhandled conversation
- Selected state highlights current conversation

**Step 4: Create chat view**

`src/app/(dashboard)/inbox/chat-view.tsx`:
- Message bubbles: outbound (right, accent color), inbound (left, surface color)
- Each message shows: content, time, source tag (cadência / IA auto / IA aprovada / manual)
- AI suggestion card: when `needsHumanReview` or when AI generates a pending response
  - Shows suggested text in editable textarea
  - Buttons: [Enviar] [Editar] [Pular]
- Compose bar at bottom: textarea + send button
- Action buttons: [Gerar com IA] [/snippets dropdown]
- `/` command triggers template search (from `message_templates` table)

**Step 5: Create lead context panel**

`src/app/(dashboard)/inbox/lead-context.tsx`:
- Lead header: name, category, city
- Score with breakdown bars
- AI classification badge + summary
- Campaign info + pipeline stage
- "Marcar como" dropdown: Interessado, Proposta enviada, Ganho, Perdido (updates `campaign_leads.pipelineStage`)
- Quick data: phone, website, rating, reviews, business hours

**Step 6: Wire up webhook to UI**

When a new message arrives via webhook:
- Save to DB (already done in Task 5)
- The conversation list needs to update. Options for MVP:
  - **Polling**: SWR/React Query with `refetchInterval: 5000` (simplest)
  - **SSE**: Server-Sent Events endpoint for real-time (better UX, more complex)
  - Start with polling, upgrade to SSE later

**Step 7: Test inbox flow**

Send a test message from WhatsApp to the connected number. Verify it appears in Inbox.
Send a message from Inbox, verify it arrives on WhatsApp.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Inbox with 3-column layout, conversation list, chat view, and lead context"
```

---

### Task 13: AI Reply Integration

**Files:**
- Create: `src/lib/ai/provider-registry.ts`, `src/lib/ai/generate-reply.ts`
- Modify: `src/workers/ai-reply.ts`
- Create: `src/app/(dashboard)/settings/ai/page.tsx`
- Create: `src/lib/actions/ai-providers.ts`

**Step 1: Install AI SDK providers**

```bash
npm install ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google
```

**Step 2: Create provider registry**

`src/lib/ai/provider-registry.ts`:

```typescript
import { openai, createOpenAI } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

export function getModel(provider: AIProvider) {
  switch (provider.provider) {
    case 'openai':
      return openai(provider.defaultModel, { apiKey: provider.apiKey });
    case 'anthropic':
      return anthropic(provider.defaultModel, { apiKey: provider.apiKey });
    case 'google':
      return google(provider.defaultModel, { apiKey: provider.apiKey });
    case 'openai_compatible':
      // For Groq, MiniMax, Together, etc.
      const custom = createOpenAI({ apiKey: provider.apiKey, baseURL: provider.baseUrl! });
      return custom(provider.defaultModel);
    default:
      throw new Error(`Unknown provider: ${provider.provider}`);
  }
}
```

**Step 3: Create reply generator**

`src/lib/ai/generate-reply.ts`:

```typescript
import { generateText } from 'ai';
import { getModel } from './provider-registry';

export async function generateReply(input: {
  lead: Lead;
  messages: Message[];
  campaign: Campaign;
  provider: AIProvider;
}) {
  const model = getModel(input.provider);

  const systemPrompt = input.campaign.aiSystemPrompt
    .replace('{name}', input.lead.name)
    .replace('{category}', input.lead.category)
    .replace('{city}', input.lead.city)
    // ... other template variables

  const messageHistory = input.messages.map(m => ({
    role: m.direction === 'inbound' ? 'user' as const : 'assistant' as const,
    content: m.content,
  }));

  const { text } = await generateText({
    model,
    system: systemPrompt,
    messages: messageHistory,
    temperature: input.campaign.aiTemperature,
    maxTokens: 300, // Keep responses short for WhatsApp
  });

  return text;
}
```

**Step 4: Implement ai-reply worker**

`src/workers/ai-reply.ts`:
- Receives `{ campaignLeadId, leadId, organizationId }`
- Fetch: lead, campaign, AI provider, message history
- Check: `autoRepliesSent < aiMaxAutoReplies`?
  - If exceeded: set `needsHumanReview = true`, stop
- Call `generateReply`
- Add human-like delay: `random(30, 180) * 1000` ms
- Send "composing" via Evolution API
- Typing delay: `text.length * 40` ms (capped at 5s)
- Enqueue to `message-send` with `source: 'ai_auto'`
- Increment `autoRepliesSent`

**Step 5: Create AI providers settings page**

`src/app/(dashboard)/settings/ai/page.tsx`:
- List configured providers with: label, provider type, model, status
- "Add provider" dialog: type select, API key input, base URL (if openai_compatible), model input
- "Test" button: sends a simple prompt to verify API key works
- "Set as default" toggle

**Step 6: Add "Generate with AI" button to chat**

In `chat-view.tsx`:
- "Gerar com IA" button calls a Server Action that:
  1. Gets the lead's active campaign + AI provider
  2. Calls `generateReply`
  3. Returns suggested text
  4. Displays in the AI suggestion card for approval

**Step 7: Test AI flow end-to-end**

1. Configure an AI provider in settings
2. Create a campaign with AI enabled
3. Receive an inbound message
4. Verify AI suggestion appears in Inbox
5. Approve and send

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: add AI reply integration with multi-provider support and generate-on-demand"
```

---

## Phase 6: Pipeline, Polish & UX

### Task 14: Kanban Board View

**Files:**
- Create: `src/app/(dashboard)/leads/board-view.tsx`, `src/components/kanban-card.tsx`, `src/components/kanban-column.tsx`

**Step 1: Install dnd-kit**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Step 2: Create kanban column component**

`src/components/kanban-column.tsx`:
- Droppable container with `useDroppable`
- Header: stage name, count badge
- Scrollable card list
- Collapsible

**Step 3: Create kanban card component**

`src/components/kanban-card.tsx`:
- Draggable with `useSortable`
- Shows: lead name, score badge (color-coded), last message snippet (6 words), days-in-stage counter
- Click opens lead drawer
- Compact design with good contrast

**Step 4: Create board view**

`src/app/(dashboard)/leads/board-view.tsx`:
- 5 columns: Novo | Contatado | Interessado | Proposta | Fechado
- "Fechado" column has sub-badges: won (green) / lost (red)
- `DndContext` with `closestCorners` collision detection
- `onDragEnd`: update `campaign_leads.pipelineStage` via Server Action
- Filter bar: campaign select, score range, days-in-stage
- Campaign filter is required (kanban is per-campaign)

**Step 5: Wire up view toggle in leads page**

In `src/app/(dashboard)/leads/page.tsx`:
- Toggle button: Table (list icon) | Board (kanban icon)
- State stored in URL param: `?view=table` or `?view=board`
- Both views share the same filter state

**Step 6: Test drag and drop**

Create a campaign with leads in various stages. Verify drag between columns updates the database.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add kanban board view with drag-and-drop and campaign filter"
```

---

### Task 15: Scoring Rules UI + Warm-up Config

**Files:**
- Create: `src/app/(dashboard)/settings/scoring/page.tsx`, `src/app/(dashboard)/settings/warmup/page.tsx`
- Create: `src/lib/actions/scoring-rules.ts`, `src/lib/actions/warmup.ts`

**Step 1: Create scoring rules page**

- Objective filter tabs: Global, Sell Website, Sell AI Agent, Sell Optimization
- Table of rules: field, operator, value, points, label, active toggle
- "Add rule" form: field select (from lead fields), operator select, value input, points input, label input
- "Recalculate all leads" button: enqueues bulk enrichment jobs with type `score`
- Pre-seed default rules per the design doc (hasWebsite=false → 30pts, etc.)

**Step 2: Create warm-up config page**

- Per-instance warm-up status: current day, current limit, progress bar
- Schedule table: editable day ranges and limits
- Auto-advance toggle (cron job advances day daily)
- Manual override: set specific daily limit

**Step 3: Implement recalculation**

When "Recalculate all leads" is clicked:
- Enqueue enrichment jobs for all leads in org with `type: 'score'`
- Show progress: "Recalculating... 234/1247"

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add scoring rules UI and warm-up configuration"
```

---

### Task 16: Message Templates + Snippets

**Files:**
- Create: `src/app/(dashboard)/settings/templates/page.tsx`
- Create: `src/lib/actions/templates.ts`
- Modify: `src/app/(dashboard)/inbox/chat-view.tsx` (add snippet picker)

**Step 1: Create templates settings page**

- List of templates: shortcut, title, content preview
- CRUD: create/edit/delete templates
- Shortcut must be unique per org, alphanumeric + hyphens

**Step 2: Add snippet picker to chat**

In chat-view:
- When user types `/` in compose textarea, show filtered dropdown of templates
- Selecting a template inserts its content into the textarea
- Also accessible via button next to compose bar

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add message templates with /shortcut insertion in chat"
```

---

### Task 17: Command Palette

**Files:**
- Create: `src/components/command-palette.tsx`
- Modify: `src/app/(dashboard)/layout.tsx` (mount command palette)

**Step 1: Create command palette**

Uses shadcn `Command` component (already installed):

```typescript
// Trigger: Ctrl+K / Cmd+K
// Sections:
//   Leads: fuzzy search by name → navigate to lead
//   Actions: "Nova extração", "Criar campanha", "Conectar WhatsApp"
//   Quick filters: "Leads score > 80", "Sem resposta 3+ dias"
//   Navigation: "Ir para Inbox", "Ir para Campanhas", etc.
```

- Global keyboard listener for `Ctrl+K`
- Leads search hits a Server Action with debounced input
- Actions trigger navigation or dialogs

**Step 2: Mount in dashboard layout**

Add `<CommandPalette />` to `src/app/(dashboard)/layout.tsx`.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add Cmd+K command palette with lead search and quick actions"
```

---

### Task 18: Notifications System

**Files:**
- Create: `src/components/notification-bell.tsx`, `src/lib/actions/notifications.ts`
- Create: `src/db/schema/notifications.ts` (add table)

**Step 1: Add notifications table**

```
notifications
├── id (cuid)
├── organizationId
├── type ("lead_replied" | "campaign_paused" | "instance_disconnected" | "ai_needs_review" | "extraction_complete")
├── title (text)
├── body (text)
├── entityType (nullable)
├── entityId (nullable)
├── read (boolean, default false)
├── createdAt
```

**Step 2: Create notification bell component**

- Bell icon in header with unread count badge
- Click opens popover with notification list
- Each notification: icon by type, title, body, time ago
- Click navigates to relevant entity (lead, campaign, etc.)
- "Mark all as read" button

**Step 3: Create notifications in key flows**

Add notification creation to:
- Webhook handler: when high-score lead replies
- Anti-ban monitor: when campaign auto-pauses
- Extraction worker: when job completes
- AI reply worker: when `needsHumanReview` is set
- Connection update: when instance disconnects

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add notification system with bell icon and event-driven alerts"
```

---

### Task 19: Settings Page (General + Organization)

**Files:**
- Create: `src/app/(dashboard)/settings/page.tsx`, `src/app/(dashboard)/settings/layout.tsx`
- Create: `src/app/(dashboard)/settings/general/page.tsx`

**Step 1: Create settings layout**

Tab navigation: Conta | WhatsApp | IA & Modelos | Lead Scoring | Templates | Avançado

Each tab is a sub-page under `/settings/`.

**Step 2: Create general settings**

- Organization name, slug
- Invite team members (Better Auth organization invitations)
- Danger zone: delete organization

**Step 3: Create advanced settings**

- Webhook URL display (for Evolution API)
- Export all data (JSON)
- Apify API token config

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add settings layout with tabs and general/advanced pages"
```

---

## Phase 7: Integration Testing + Deploy Prep

### Task 20: End-to-End Flow Testing

**Step 1: Test complete prospecting flow**

Manual E2E test checklist:
1. Register account, create organization
2. Connect WhatsApp via QR code in settings
3. Run extraction: "Restaurante São Paulo", 10 results
4. Verify leads appear with enriched data and scores
5. Create campaign: sell_website objective, score > 50 filter
6. Launch campaign, verify messages are sent with randomized intervals
7. Reply from WhatsApp, verify message appears in Inbox
8. Verify AI generates suggestion in Inbox
9. Approve AI response, verify it sends
10. Move lead through pipeline in kanban
11. Check notifications for key events
12. Pause campaign, verify sending stops

**Step 2: Fix bugs found during testing**

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during E2E flow testing"
```

---

### Task 21: Production Deploy Setup

**Files:**
- Create: `Dockerfile`, `docker-compose.yml`, `.env.production`
- Create: `ecosystem.config.js` (PM2 config for worker)

**Step 1: Create Docker setup**

`docker-compose.yml`:
- Service 1: `app` — Next.js app (port 3000)
- Service 2: `worker` — BullMQ worker process
- Service 3: `redis` — Redis for queues

The Evolution API is already running on the VPS, so just network them.

**Step 2: Create PM2 config (alternative to Docker)**

If deploying directly on VPS without Docker:

```javascript
module.exports = {
  apps: [
    {
      name: 'prospectai-web',
      script: 'node_modules/.bin/next',
      args: 'start',
      env: { NODE_ENV: 'production', PORT: 3000 },
    },
    {
      name: 'prospectai-worker',
      script: 'node_modules/.bin/tsx',
      args: 'src/worker.ts',
      env: { NODE_ENV: 'production' },
    },
  ],
};
```

**Step 3: Configure Turso production database**

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create database
turso db create prospectai

# Get connection URL and token
turso db show prospectai --url
turso db tokens create prospectai
```

Update `.env.production` with Turso URL and token.

**Step 4: Deploy and verify**

```bash
npm run build
npm run start  # or pm2 start ecosystem.config.js
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add production deploy configuration with Docker and PM2"
```

---

## Summary

| Phase | Tasks | Focus |
|---|---|---|
| Phase 1 | Tasks 1-4 | Scaffold, DB, Auth, App Shell |
| Phase 2 | Tasks 5-6 | Evolution API, BullMQ Worker |
| Phase 3 | Tasks 7-9 | Leads Table, Extraction, Enrichment |
| Phase 4 | Tasks 10-11 | Campaigns, Cadence Engine |
| Phase 5 | Tasks 12-13 | Inbox/Conversations, AI Reply |
| Phase 6 | Tasks 14-18 | Kanban, Scoring UI, Templates, Cmd+K, Notifications |
| Phase 7 | Tasks 19-21 | Settings, E2E Testing, Deploy |

**Total: 21 tasks, 7 phases.**

Each phase produces a working, committable increment. Phase 1-5 is the core MVP. Phase 6-7 is polish and production-readiness.
