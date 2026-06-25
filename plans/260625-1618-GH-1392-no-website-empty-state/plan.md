---
title: "GH-1392 — CMS no-website empty state guard"
description: "Show rocket 'No website' empty state across CMS dashboard pages when tenant has no usable site."
status: pending
priority: P1
effort: 8h
branch: fix/1392-cms-no-website-empty-state
tags: [frontend, ux, dashboard, i18n, guard]
created: 2026-06-25
---

# GH-1392 — CMS "No website" empty state guard

Guide users with no website to create one first. When current tenant has **no usable site**,
show the rocket empty state + "+ Create New Website" CTA on guarded CMS pages; let excluded
pages render normally.

## Ground truth (from scout + verification)
- Component **already exists**: `src/components/dashboard/DashboardEmptyState.tsx` — matches spec. REUSE.
- "Usable site" filter (used in 2 places today) = `!generationStatus || generationStatus ∈ {'none','completed'}`.
- Issue's `/cms/*` paths are WRONG → real routes under `(dashboard)` group (see phase-02 for verified list).
- Layout `(dashboard)/layout.tsx` is server, already resolves `tenantId` + runs a payload session → piggyback.
- `/sites` already has its own empty/failed UI in `SitesPageClient` → **EXCLUDE from global guard** (see phase-02 §open-item).

## Architecture (LOCKED: A2 — client guard)
Server `layout.tsx` resolves `hasWebsite` (shared helper, piggybacked on existing session) → passes to
`CMSLayoutClient` → client uses `usePathname()` + exclude-list (prefix match) to render
`<DashboardEmptyState/>` vs `children`. A1 (route-group split) rejected: `/settings/{profile,staff}`
are siblings of guarded settings pages → would fragment `/settings`.

## Phases
| # | Phase | Status | Effort | Depends |
|---|-------|--------|-------:|---------|
| 01 | [Centralize site-state helper + wire into layout](phase-01-site-state-helper.md) | pending | 2.5h | — |
| 02 | [Client guard in CMSLayoutClient + exclude-list](phase-02-client-guard.md) | pending | 2.5h | 01 |
| 03 | [i18n + responsive + a11y polish](phase-03-i18n-a11y.md) | pending | 1h | 02 |
| 04 | [Tests + QA matrix](phase-04-tests-qa.md) | pending | 2h | 01,02,03 |

## Key dependencies
- Phase 02 needs `hasWebsite` prop from Phase 01.
- Phase 04 tests both the helper (01) and guard decision logic (02).
- i18n keys `t.dashboard.empty.*` already exist (EN+BM) → Phase 03 mostly verification.

## File ownership (no overlap)
- P01: `src/lib/dashboard/get-tenant-site-state.ts` (new), `(dashboard)/layout.tsx`, `views/OverviewView.tsx`
- P02: `(dashboard)/_components/CMSLayoutClient.tsx`, `(dashboard)/_components/dashboard-guard-paths.ts` (new)
- P03: `src/i18n/locales/{en,ms}.json`, `DashboardEmptyState.tsx`
- P04: `src/__tests__/unit/dashboard/*` (new) — test files only

## Open items (resolved in phases; confirm with QC)
1. `/sites` guarded? → **NO** (has own empty UI). phase-02.
2. Generation-failed variant in guard? → **NO** at layout (no searchParams); dashboard page keeps its own. phase-01.
3. "Usable site" semantics → frozen as the existing filter; phase-01 dedups it.
4. BM official copy → keys exist; confirm wording w/ localization owner. phase-03.
