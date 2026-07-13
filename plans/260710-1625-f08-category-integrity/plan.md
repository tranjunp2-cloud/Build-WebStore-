---
title: "F08 Category Management — Data Integrity & Storefront Fixes"
description: "Delete integrity, cycle prevention, tenant-scoped dedup, single-select lock, storefront listing + AI tenant-aware category mapping."
status: pending
priority: P1
effort: ~18h
branch: feat/f08-1587-category-integrity-fixes
tags: [f08, categories, data-integrity, migration, storefront, ai]
created: 2026-07-10
---

# F08 Category Management — Integrity & Integration Fixes

Split into **2 PRs**. PR-1 = backend core + data integrity (merge first). PR-2 = storefront + AI (QA visual after).

## Issue mapping

| Issue | Scope | PR | Phase |
|-------|-------|----|-------|
| #14 | Slug unique per-tenant + name dedup per (parent,tenant) | 1 | 01, 04 |
| #10 | Delete integrity: children→top-level + hard-block if products>0 | 1 | 02 |
| #11 | Cycle prevention (`isDescendant`) backend + client | 1 | 03 |
| #5, #12 | Single-select made official (no behavior change, doc + admin desc) | 1 | 05, 06 |
| Issue1·mục2 | Category modal UX (contextual title, parent auto-fill/disable, dropdown hierarchy + L3 disable) | 1 | 05b |
| #8 | Storefront product listing + 3-level sidebar filter | 2 | 08 |
| #16 | AI bulk-parse tenant-aware real category mapping | 2 | 09 |

## Phases

| # | Phase | PR | Migration? | Status | Depends |
|---|-------|----|-----------|--------|---------|
| 01 | [Migration: slug composite unique per tenant](phase-01-migration-slug-composite-unique.md) | 1 | YES | done | — |
| 02 | [Delete integrity (children→top, hard-block products)](phase-02-delete-integrity.md) | 1 | No | done | — |
| 03 | [Cycle prevention (isDescendant)](phase-03-cycle-prevention.md) | 1 | No | done | — |
| 04 | [Dedup name + slug scope (backend + UI + i18n)](phase-04-dedup-name-slug-scope.md) | 1 | No* | done | 01 |
| 05 | [Single-select cleanup (admin desc, no migration)](phase-05-single-select-cleanup.md) | 1 | No | done | — |
| 05b | [Category modal UX (title/parent/dropdown hierarchy)](phase-05b-category-modal-ux.md) | 1 | No | done | 03 |
| 06 | [Docs update (PRD/stories/QA)](phase-06-docs-update.md) | 1 | No | done | 02,03,04,05,05b |
| 07 | [Tests PR-1](phase-07-tests-pr1.md) | 1 | No | done | 01-05b |
| 08 | [Storefront listing + sidebar filter](phase-08-storefront-listing.md) | 2 | No | pending | PR-1 merged |
| 09 | [AI bulk-parse tenant-aware](phase-09-ai-bulk-parse-tenant-aware.md) | 2 | No | pending | PR-1 merged |
| 10 | [Tests + QA PR-2](phase-10-tests-qa-pr2.md) | 2 | No | pending | 08,09 |

**PR-1 Complete:** All phases 01–07 done. Ready for `git-manager` to open PR to staging with commit message `Relates to #5 #10 #11 #12 #14`.

\* Phase 04 relies on the composite index from Phase 01; the dedup logic itself is app-layer (no new columns).

## Key dependencies

- **01 blocks 04**: name/slug validation assumes the global-unique slug constraint is already dropped and replaced by `(slug, tenant_id)`. Ship 01+04 in same PR-1.
- **PR-1 blocks PR-2**: storefront + AI both rely on integrity fixes landing first (clean category tree, no cycles).
- **06 after code phases**: docs reflect final behavior (hard-block, 1–n relation).

## Critical risks (see per-phase)

- **Data loss on unique swap** (Phase 01): must dedup existing (slug,tenant) rows before creating unique index; verify real constraint name via `psql \d categories` before any DROP.
- **`_page.disabled.tsx` staleness** (Phase 08): file predates schema changes — audit against current Products/Categories before re-enabling.
- **Async name-check race** (Phase 04): client async check is UX-only; backend hook is the source of truth.

## File ownership (no overlap across parallel work)

- Phase 01 owns `scripts/db-setup.js` (append-only) exclusively.
- Phases 02/03/04 all touch `src/collections/Categories.ts` + `actions.ts` → **sequential, single agent** (see orchestration rule: schema+actions atomic).
- Phases 03 + 05b both edit the parent `<Select>` in `CategoryManager.tsx` → **same agent, sequential (03 then 05b), one edit** to avoid churn on the option-render loop.
- Phase 08 owns `src/app/sites/**` + `PlpSidebar`. Phase 09 owns `src/app/api/ai/**` + `BulkCreateModal`. Disjoint → parallelizable.

## Validation Summary

**Validated:** 2026-07-13
**Questions asked:** 4

### Confirmed Decisions
- **Phase 01 dedup safety:** add a dry-run report (read-only SELECT counting affected rows per `(tenant_id, slug)` collision) BEFORE running the real soft-delete UPDATE — surface counts for review, don't ship the destructive UPDATE blind.
- **Phase 01 index verification:** verify the live UNIQUE index name via `psql \d categories` against the **local/dev DB** (docker-compose), not shared staging. Write the DROP migration defensively with `IF EXISTS` covering both likely names (`categories_slug_unique`, `categories_slug_key`) so it's safe on staging regardless.
- **Branch:** create and checkout `feat/f08-1587-category-integrity-fixes` from `staging` now, before starting Phase 01. (Renamed from `feat/f08-category-integrity-fixes` — that name was already taken by a stale remote branch containing only the 2 docs commits already merged via PR #1586.)
- **Execution granularity:** implement Phase 01 (migration) only, then STOP for user review before touching `Categories.ts`/`actions.ts` in Phases 02-04 — migration is the highest-risk step (DROP index + data dedup) and gets reviewed in isolation first.

### Action Items
- [x] Phase 01 implementation must include a dry-run SELECT step (log-only) ahead of the `categories.dedupe_tenant_slug` UPDATE migration entry. (Ran on local dev DB: 0 collisions found, 22 active categories / 10 tenants.)
- [x] Phase 01 DROP migration keeps both `IF EXISTS` name variants since verification runs against local DB only, not staging. (Real name verified as `categories_slug_idx`; kept 2 extra defensive `IF EXISTS` variants.)
- [x] Create branch `feat/f08-1587-category-integrity-fixes` from `staging` before Phase 01 work starts.
- [x] After Phase 01 lands, pause and present results to user before proceeding to Phase 02. (Also found + fixed an out-of-scope regression in `Templates.ts`'s `recomputeComplianceHook` — see below.)

### Unplanned fix (found during Phase 01 code review)
- `src/collections/Templates.ts` `recomputeComplianceHook` did a global, tenant-unscoped `categories.find({where:{slug}})` lookup relying on the now-removed global slug uniqueness. Fixed by scoping to `dna: {exists: true}` (only settable via super-admin route) + `sort: '-updatedAt'` tie-break. Not part of the original 10-phase plan; tracked here since it was directly caused by Phase 01.
