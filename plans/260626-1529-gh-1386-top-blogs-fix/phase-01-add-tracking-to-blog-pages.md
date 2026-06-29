# Phase 01 — Add tracking to blog pages + URL normalization

## Context links

- Plan: [plan.md](plan.md)
- Source: `src/components/site-renderer/SiteLayoutShell.tsx`,
  `src/components/site-renderer/TrackingManager.tsx`,
  `src/app/sites/[slug]/products/[productSlug]/page.tsx`
- Aggregators (read-only, DO NOT edit): `src/lib/dashboard/traffic-data.ts:74`,
  `src/components/dashboard/views/AnalyticsView.tsx:92`

## Overview

- **Priority:** P1
- **Status:** completed
- **Description:** Make blog (and product) pages emit normalized `pageview` events through a
  single tracking point in `SiteLayoutShell`.

## Key insights (validated against middleware)

`window.location.pathname` reflects the **browser** URL, not the internal rewrite:

| Access mode | Browser pathname | After normalize |
|-------------|------------------|-----------------|
| Direct/local (`/sites/{slug}/blog/x`) — middleware no rewrite | `/sites/mystore/blog/x` | `/blog/x` |
| Subdomain (`mystore.platform.com/blog/x`) — `NextResponse.rewrite` | `/blog/x` | `/blog/x` (no-op) |
| Custom domain (`mystore.com/blog/x`) — `NextResponse.rewrite` | `/blog/x` | `/blog/x` (no-op) |

→ Regex is **idempotent and safe**: only direct-access traffic carries the `/sites/{slug}` prefix.
Bug #1 (missing TrackingManager) is the primary cause of the empty widget for ALL domains;
Bug #2 (normalization) hardens direct-access analytics + keeps page/blog URLs consistent.

## Requirements

- Functional: blog detail page POSTs a `pageview` with `pageUrl` starting `/blog/`.
- Functional: product page emits exactly one pageview (no double-count).
- Non-functional: no schema change, no `'use client'` on the shell, owner views still skip tracking.

## Architecture

`SiteLayoutShell` (server component) renders `TrackingManager` (client) as a child — same as how
it already renders client block components. `site.id` + `isOwner` already in shell props.
Normalization lives inside `TrackingManager` so every caller benefits (DRY).

## Related code files

**Modify:**
- `src/components/site-renderer/TrackingManager.tsx` — normalize `pageUrl`.
- `src/components/site-renderer/SiteLayoutShell.tsx` — import + render `TrackingManager`.
- `src/app/sites/[slug]/products/[productSlug]/page.tsx` — **remove** inline `<TrackingManager>`
  (line ~208) + its now-unused import (line ~10) to prevent double-tracking.

**Do NOT touch:** `SiteRenderer.tsx` (own TrackingManager, not shell-based),
`traffic-data.ts`, `AnalyticsView.tsx`, `analytics` collection, `db-setup.js`.

## Implementation steps

1. **`TrackingManager.tsx`** — replace the body of the `fetch` payload's `pageUrl`:
   ```ts
   const pageUrl = window.location.pathname.replace(/^\/sites\/[^/]+/, '') || '/'
   ```
   Compute before `fetch(...)`; pass `pageUrl` in the JSON body instead of
   `window.location.pathname`. No other change to the effect.

2. **`SiteLayoutShell.tsx`** — add import:
   ```ts
   import { TrackingManager } from './TrackingManager'
   ```
   Inside the `<OwnerProvider>` return (e.g. right after `<GoogleFontsLoader .../>`), render:
   ```tsx
   <TrackingManager siteId={String(site.id)} isOwner={!!isOwner} />
   ```

3. **`products/[productSlug]/page.tsx`** — delete the inline
   `<TrackingManager siteId={String(site.id)} isOwner={isOwner} />` (now rendered by the shell)
   and remove the unused `import { TrackingManager }` line. Verify no other use of the import remains.

4. Compile check: `npx tsc --noEmit` (or `npm run build`'s typecheck) — expect 0 errors.

## Todo list

- [x] Normalize `pageUrl` in `TrackingManager.tsx`
- [x] Render `TrackingManager` from `SiteLayoutShell.tsx` (import + JSX)
- [x] Remove inline `TrackingManager` + unused import from product page
- [x] Typecheck passes (`npx tsc --noEmit`)
- [x] Manual: visit a published blog post (incognito) → row in `analytics` with `pageUrl` `/blog/...`

## Success criteria

- Blog post visit (non-owner) → `pageview` row, `pageUrl` starts `/blog/`.
- Product page load → exactly one `pageview` (grep network / count rows).
- Owner-authenticated visits still skip tracking (`isOwner` guard intact).

## Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Double-tracking on product pages | High (if step 3 skipped) | High | Step 3 removes inline copy; phase-02 has no product double-count test but manual check required |
| Historical rows keep old `/sites/{slug}/...` URLs → split entries in Top Pages during transition | Medium | Low | Self-heals as 7d/30d lookback rolls forward; production subdomain traffic already clean. No backfill needed |
| Owner mis-detected as visitor (over/under count) | Low | Low | Unchanged `isOwner` logic; pre-existing behavior |
| `site.id` undefined in shell | Low | Med | `String(site.id)` mirrors product page's existing usage; type guarantees `id` present |

## Rollback

Revert the 3 files. No DB/schema/env change → clean revert, no cascading effect. Analytics simply
returns to pre-fix state (blog pages untracked).

## Security considerations

No new endpoint; reuses existing `/api/analytics/track` (tenant-scoped writes). Normalization is a
pure string strip — no injection surface. `pageUrl` already stored as-is today.

## Next steps

→ Phase 02 (tests). Sequential — tests assert the normalization added here.
