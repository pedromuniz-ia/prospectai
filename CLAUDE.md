# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (run in two terminals)
npm run dev          # Next.js frontend + API (port 3000)
npm run worker       # BullMQ background workers (watch mode)

# Database
npx drizzle-kit migrate   # Apply pending migrations
npx drizzle-kit push      # Sync schema without migrations (dev with partial tables)
npx drizzle-kit generate  # Generate migration from schema changes

# Testing & Quality
npm test             # Run all Vitest tests
npm test -- <file>   # Run a single test file
npm run lint         # ESLint

# Production
npm run build
npm run worker:prod  # Workers without watch mode
```

Redis is required for BullMQ. Start it via `docker-compose up redis` or ensure it's running at `REDIS_URL`.

## Architecture

ProspectAI is a B2B prospecting platform that extracts leads from Google Maps, enriches them with multi-source data, classifies with AI, and manages automated WhatsApp outreach.

### Request Flow

```
Browser
  → Next.js Server Components (data reads)
  → Server Actions in src/lib/actions/ (mutations)
  → Drizzle ORM → Turso (LibSQL/SQLite)
  → Redis BullMQ queues → Workers in src/workers/
  → External APIs: Apify, Evolution API (WhatsApp), AI models
```

### Key Layers

**App Router** (`src/app/`)
- `(auth)/` — public login/register pages
- `(dashboard)/` — protected routes: leads, campaigns, extraction, inbox, settings
- `api/auth/` — Better Auth handler
- `api/webhooks/evolution/` — WhatsApp incoming message webhook

**Server Actions** (`src/lib/actions/`) — all data mutations go through here. Every action filters by `organizationId` for multi-tenancy.

**Workers** (`src/workers/`) — BullMQ processors. Entry point is `src/worker.ts` which bootstraps all workers and cron jobs.

| Worker | Purpose |
|--------|---------|
| `extraction` | Polls Apify for Google Maps results, creates leads |
| `enrichment` | Full pipeline: website → WhatsApp → Instagram → RDAP → AI classifier → scorer |
| `cadence` | Processes scheduled message sequences |
| `ai-reply` | Generates automatic AI replies for incoming WhatsApp messages |
| `message-send` | Delivers WhatsApp messages via Evolution API (rate: 1 msg/10s) |
| `scheduler` | Cron coordinator: feeds cadence queue (1min), resets counters (midnight), warmup advance (1am) |

**Enrichment Modules** (`src/lib/enrichment/`) — each module is standalone and called sequentially by the enrichment worker:
1. `website-check.ts` — HEAD request, SSL, response code classification
2. `whatsapp-check.ts` — phone validation via Evolution API
3. `instagram-check.ts` — username extraction + follower count scraping
4. `rdap.ts` — domain WHOIS for .com.br domains
5. `ai-classifier.ts` — Claude/GPT/Gemini with heuristic fallback
6. `scorer.ts` — configurable rule-based scoring

### Database

Drizzle ORM with Turso (LibSQL/SQLite). Schema in `src/db/schema/`, one file per domain.

For local dev: `TURSO_CONNECTION_URL=file:local.db` (no auth token needed).

The `leads` table is the central model. Key enum columns:
- `status`: `new | enriched | scored | queued | contacted | replied | interested | proposal | won | lost | blocked`
- `aiClassification`: `needs_website | optimization | ai_agent | automation | low_fit`
- `websiteStatus`: `active | inactive | parked | error`

All queries must scope by `organizationId` — multi-tenancy is enforced at the application layer, not the DB.

### Auth

Better Auth with organization support. Session is validated in `src/middleware.ts`. The session object provides `session.session.activeOrganizationId` for scoping queries.

### UI Patterns

- **Components**: shadcn/ui in `src/components/ui/`, custom design system in `src/components/ds/` (StatusBadge, SlidePanel, etc.)
- **State**: Jotai atoms for client state; Server Components + `revalidatePath` for server state
- **Tables**: TanStack React Table with server-side filtering on the leads page
- **Drag & Drop**: dnd-kit for lead kanban/reordering

### Queue Initialization

Redis queues use a Proxy-based lazy initialization in `src/lib/queue.ts` — queues are only connected when first accessed. This avoids crashing the Next.js server if Redis is unavailable.

## Environment Variables

```env
TURSO_CONNECTION_URL=file:local.db      # or libsql://... for Turso cloud
TURSO_AUTH_TOKEN=                        # not needed for file:
REDIS_URL=redis://localhost:6379
BETTER_AUTH_SECRET=<random>
BETTER_AUTH_URL=http://localhost:3000
APIFY_TOKEN=
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
ANTHROPIC_API_KEY=                       # at least one AI key required
OPENAI_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Migrations

Schema changes require:
1. Edit files in `src/db/schema/`
2. Run `npx drizzle-kit generate` to create SQL migration
3. Run `npx drizzle-kit migrate` to apply

Migration files live in `migrations/`. The `migrations/meta/_journal.json` tracks applied migrations.
