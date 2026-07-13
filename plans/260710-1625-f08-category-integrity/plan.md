---
title: "F08 Category Management — Data Integrity & Storefront Fixes"
description: "Delete integrity, cycle prevention, tenant-scoped dedup, single-select lock, storefront listing + AI tenant-aware category mapping."
status: pending
priority: P1
effort: ~18h
branch: feat/f08-category-integrity-fixes
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
| 01 | [Migration: slug composite unique per tenant](phase-01-migration-slug-composite-unique.md) | 1 | YES | pending | — |
| 02 | [Delete integrity (children→top, hard-block products)](phase-02-delete-integrity.md) | 1 | No | pending | — |
| 03 | [Cycle prevention (isDescendant)](phase-03-cycle-prevention.md) | 1 | No | pending | — |
| 04 | [Dedup name + slug scope (backend + UI + i18n)](phase-04-dedup-name-slug-scope.md) | 1 | No* | pending | 01 |
| 05 | [Single-select cleanup (admin desc, no migration)](phase-05-single-select-cleanup.md) | 1 | No | pending | — |
| 05b | [Category modal UX (title/parent/dropdown hierarchy)](phase-05b-category-modal-ux.md) | 1 | No | pending | 03 |
| 06 | [Docs update (PRD/stories/QA)](phase-06-docs-update.md) | 1 | No | pending | 02,03,04,05,05b |
| 07 | [Tests PR-1](phase-07-tests-pr1.md) | 1 | No | pending | 01-05b |
| 08 | [Storefront listing + sidebar filter](phase-08-storefront-listing.md) | 2 | No | pending | PR-1 merged |
| 09 | [AI bulk-parse tenant-aware](phase-09-ai-bulk-parse-tenant-aware.md) | 2 | No | pending | PR-1 merged |
| 10 | [Tests + QA PR-2](phase-10-tests-qa-pr2.md) | 2 | No | pending | 08,09 |

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
