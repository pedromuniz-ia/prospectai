# Leads Table Fixes + PATCH API

## Problems

1. **WhatsApp column empty** — `hasWhatsapp` is in `LeadRow` but shows "—" for all leads. Need to verify enrichment worker is saving results correctly.
2. **Instagram not clickable** — `InstagramBadge` only shows "IG" badge + follower count. Missing `instagramUsername`/`instagramUrl` in `LeadRow` type, no link to profile.
3. **Website column polluted** — Shows non-website URLs like `wa.me/...`, `instagram.com/...`, `linktr.ee/...` in the website column. Needs filtering.
4. **No PATCH endpoint** — No way to mark a lead as contacted via API, risking duplicate outreach.

## Changes

### 1. WhatsApp diagnosis

Verify enrichment worker saves `hasWhatsapp` correctly. If data exists in DB but not rendering, fix frontend. If data missing from DB, fix enrichment pipeline.

### 2. Instagram — clickable @username

- Add `instagramUsername` and `instagramUrl` to `LeadRow` type
- Update `InstagramBadge` to accept username, render as clickable `@username` linking to `https://instagram.com/{username}`
- Pass new fields in `data-table.tsx`

### 3. Website URL sanitization

Create `isActualWebsite(url)` utility that rejects social/messaging platform URLs:
- `wa.me`, `api.whatsapp.com`
- `instagram.com`, `facebook.com`, `twitter.com`, `tiktok.com`
- `linktr.ee`, `youtube.com`

Apply in:
- Frontend rendering (immediate fix for existing data)
- Enrichment pipeline (prevent future pollution)

### 4. PATCH /api/v1/leads/:id

```
PATCH /api/v1/leads/:id
Authorization: Bearer <api_key>

{
  "status": "contacted",
  "contactMethod": "manual" | "api" | "whatsapp" | "email"
}
```

- Same API key auth as existing GET endpoint
- Scoped by `organizationId` (multi-tenancy)
- When status = "contacted": auto-increment `contactAttempts`, set `lastContactedAt`
- Updatable fields: `status`, `doNotContact`
- Returns updated lead

## Files

| File | Change |
|------|--------|
| `src/app/(dashboard)/leads/data-table.tsx` | Add `instagramUsername`, `instagramUrl` to `LeadRow`; filter website URLs |
| `src/app/(dashboard)/leads/columns.tsx` | Update `InstagramBadge` props + render clickable @handle |
| `src/lib/utils.ts` or new `src/lib/url-utils.ts` | `isActualWebsite()` helper |
| `src/workers/enrichment.ts` | Verify WhatsApp save; apply website sanitization on save |
| `src/app/api/v1/leads/[id]/route.ts` | New PATCH endpoint |
| `src/lib/actions/leads.ts` | Verify fields returned by `getLeads()` |
