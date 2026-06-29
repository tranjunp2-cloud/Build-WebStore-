---
title: "fix(dashboard): Top Blogs widget no data — GH-1386"
description: "Add tracking to blog pages and fix URL normalization so Top Blogs widget shows actual view counts."
status: completed
priority: P1
effort: 2h
branch: staging
tags: [bug, analytics, dashboard, F03, F22]
created: 2026-06-26
completed: 2026-06-26
---

# GH-1386 — Top Blogs widget shows no data despite traffic

## Problem

Dashboard "Top Blogs" widget always empty. Two independent root causes:

- **Bug #1 (primary):** Blog detail page renders `<SiteLayoutShell>` (not `SiteRenderer`).
  `TrackingManager` only lives in `SiteRenderer.tsx:563-564` → **zero `pageview` events
  ever created for blog pages**, regardless of domain.
- **Bug #2 (correctness):** Aggregators check `url.startsWith('/blog/')`
  (`AnalyticsView.tsx:92`, `traffic-data.ts:74`). On direct `/sites/{slug}/...` access the
  tracked pathname is `/sites/{slug}/blog/{post}` → never matches.

## Fix approach — Option A: normalize URL in TrackingManager

Single fix point; aggregation logic in `AnalyticsView.tsx` + `traffic-data.ts` stays untouched.
Render `TrackingManager` from `SiteLayoutShell` (covers all shell-wrapped pages) and strip the
`/sites/{slug}` prefix inside `TrackingManager` before POSTing to `/api/analytics/track`.

### Data flow (after fix)

```
Blog page → SiteLayoutShell → <TrackingManager siteId isOwner>
  → window.location.pathname  (e.g. /sites/mystore/blog/post  OR  /blog/post on subdomain)
  → normalize: replace(/^\/sites\/[^/]+/,'') || '/'   → /blog/post
  → POST /api/analytics/track {event:'pageview', pageUrl:'/blog/post', ...}
  → analytics collection row (tenant-scoped)
  → traffic-data.ts / AnalyticsView: url.startsWith('/blog/') ✓ → blogViews → Top Blogs widget
```

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 01 | Add tracking to blog pages + URL normalization | completed | [phase-01](phase-01-add-tracking-to-blog-pages.md) |
| 02 | Unit tests for URL normalization | completed | [phase-02](phase-02-tests.md) |

## Critical decision — double-tracking guard (read before coding)

`products/[productSlug]/page.tsx:208` **already** renders `<TrackingManager>` *inside*
`SiteLayoutShell`. Adding `TrackingManager` to the shell **without removing that inline copy
= duplicate pageview events on every product page.** Phase 01 therefore also removes the inline
copy from the product page (DRY: tracking lives in exactly one place — the shell).

`SiteRenderer.tsx:564` keeps its own `TrackingManager` (SiteRenderer does **not** use the shell)
— no conflict, do not touch.

## Constraints

- DO NOT modify `AnalyticsView.tsx` or `traffic-data.ts` (normalize approach makes it unnecessary).
- DO NOT change the `analytics` collection schema — no migration, no `db-setup.js` entry.
- DO NOT add `'use client'` to `SiteLayoutShell` (server component renders client child fine).
- Keep each phase file < 200 lines.

## Success criteria

- Visiting a published blog post creates a `pageview` row with `pageUrl` starting `/blog/`.
- Top Blogs widget lists blog posts with view counts after traffic.
- Product pages emit exactly **one** pageview per load (no regression, no double-count).
- `npm test` green; existing `TC-F09-TRACK-01..08` still pass.

## Dependencies

Phase 02 depends on Phase 01 (tests assert the normalization added in Phase 01). Sequential.

## Out of scope / follow-up

- QA doc TC-ID rows for the new normalization cases (docs-manager) — see phase-02 note.
- Backfill/normalization of historical un-normalized analytics rows (not required; lookback
  window self-heals). See phase-01 Risk.
