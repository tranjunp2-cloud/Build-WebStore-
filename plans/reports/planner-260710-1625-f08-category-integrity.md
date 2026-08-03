# Planner Report — F08 Category Integrity Fixes

**Date:** 2026-07-10 · **Branch:** feat/f08-category-integrity-fixes
**Plan:** plans/260710-1625-f08-category-integrity/

## Summary

10-phase plan across 2 PRs to fix F08 Category Management. Verified current code state directly (Categories.ts, actions.ts, CategoryManager.tsx, CategorySelect.tsx, Products.ts, product-form schema, AI bulk-parse route, BulkCreateModal, db-setup.js, disabled storefront page).

**PR-1 (backend core + integrity)** — phases 01–07, issues #5 #10 #11 #12 #14:
- 01: migration — swap global-unique slug → per-tenant `(tenant_id, slug)` partial unique index. Owns `db-setup.js`.
- 02: delete integrity — children→top-level + hard-block if directly-assigned products>0.
- 03: cycle prevention — `isDescendant` in `beforeValidate` (capped upward walk) + client guard.
- 04: dedup name per (parent,tenant) + slug scope; removes `unique:true` from field (couples w/ 01).
- 05: single-select made official — only admin-desc fix; KEEP `hasMany:true` (no risky migration).
- 06: docs — PRD/stories/QA to 1–n, drop "max 10", update TCs.
- 07: tests PR-1.

**PR-2 (storefront + AI)** — phases 08–10, issues #8 #16:
- 08: re-enable storefront PLP + 3-level sidebar filter (AUDIT `_page.disabled.tsx` first).
- 09: AI bulk-parse tenant-aware real category id mapping; kill hard-coded English enum + junk auto-create.
- 10: tests + manual QA.

## Key verified facts shaping the plan

- Categories table `slug` has NO unique in `create_table` (db-setup.js:387) — the global unique index is Payload-generated → **real index name must be verified via `psql \d categories` before DROP** (F05 pages precedent at db-setup.js:1494-1509 is the template).
- `CategorySelect.selectLeaf` already does `onChange([cat.id])` → single-select is de-facto reality; only docs/desc lie. No behavior change needed.
- `BulkCreateModal:340-361` already auto-creates categories by name → this is the junk-category source #16 must remove.
- Delete modal copy claims "children unlinked" but `deleteCategoryAction` does nothing to children/products — the core #10 gap.
- Storefront PLP is `_page.disabled.tsx` (351 lines), imports existing `PlpSidebar`; risk of staleness + route collision with `[[...path]]` catch-all.

## Decisions locked (need user confirm on flagged ones)

1. Delete hard-block counts **directly-assigned** products only (not recursive). — CONFIRM.
2. Keep `hasMany:true` for product.category; UI+docs assert single. No migration. — recommended.
3. GH-1588 Scope 02 correction: AI null-category stays unresolved in the review modal; merchant must select an existing category before Approve. Manual ProductForm and publish-guard rules remain unchanged.
4. Name dedup case-insensitive + trimmed. — CONFIRM.

## Unresolved questions

- **Slug unique index real name** — must run `psql \d categories` on staging/local before writing the DROP (Phase 01 step 1). Cannot finalize SQL until verified.
- **#10 recursive vs direct product count** — plan assumes direct-only; confirm intended UX (does blocking also consider products in child categories?).
- **#16 null category vs Zod min(1)** — does `publish-guard.ts` allow saving a draft product with zero categories? Need to verify before implementing pass-through-null.
- **Storefront route ownership** — explicit `products/page.tsx` vs branch in `[[...path]]/page.tsx`; verify Next precedence + no collision (Phase 08 step 2).
- **Name dedup case-sensitivity** — "Áo" vs "áo": recommend case-insensitive; confirm.

**Status:** DONE
**Summary:** Created plan.md + 10 phase files + this report for F08 category integrity fixes (2 PRs); grounded in directly-verified code, migration follows F05 precedent, risks + rollback per phase.
**Concerns/Blockers:** 5 unresolved questions above (esp. live slug index name for the DROP, and publish-guard null-category tolerance) need confirmation/verification before PR-1 phase-01 and PR-2 phase-09 implementation.
