# Phase 06 — Docs Update (PRD / Stories / QA)

**PR:** 1 · **Migration:** No · **Priority:** P2 · **Status:** done · **Depends:** 02, 03, 04, 05

## Context

Docs currently describe SP↔Category as many-to-many with a "max 10 categories" rule and "unlink children" delete semantics — all now wrong after Phases 02–05. Owner: docs-manager (owns `docs/**`). Disjoint from src → can run parallel to code but content must reflect FINAL behavior, so schedule after code phases finalize.

## Overview

Update F08 PRD, stories, and QA test plan to reflect: (1) 1–n relation (1 product → 1 category), (2) removal of "max 10 categories", (3) hard-block delete + children→top-level, (4) cycle prevention, (5) per-tenant name/slug dedup.

## Requirements

- Docs consistent with shipped code. QA TC-IDs updated so tester (Phase 07) can map tests to TCs.

## Related Doc Files

**Modify:**
- `docs/prd/F08-products-crud.md` — SP↔Category: n–n → **1–n**; remove "tối đa 10 danh mục"; add delete hard-block rule + children re-parent-to-top; add cycle rule; add per-tenant name/slug uniqueness.
- `docs/stories/F08-products-crud-stories.md` — update acceptance criteria on the category stories (single-select, delete integrity, dedup, cycle).
- `docs/qa/F08-product-crud.md` — TC edits:
  - TC-05-11 (max 10 categories) → remove or rewrite as "product has exactly 1 category".
  - TC-05-06 (reassign before delete) → update to hard-block: "delete blocked while products assigned; message shows count".
  - TC-05-09 → cycle prevention (parent cannot be own descendant).
  - TC-05-05 / TC-05-12 → dedup scoped per tenant (name per parent+tenant, slug per tenant).
  - Add TC for children→top-level on delete if not covered.

**Read for context:** shipped diffs from Phases 02–05; existing F08 docs.

**No code, no migration.**

## Implementation Steps

1. Read current `docs/prd/F08-products-crud.md`, `docs/stories/F08-products-crud-stories.md`, `docs/qa/F08-product-crud.md`.
2. Apply relation + rule changes above; keep TC-IDs stable where possible (edit body, not ID) so traceability holds.
3. Cross-check against CLAUDE.md doc map — F08 detail docs are the right home; do NOT duplicate into CODEBASE_SUMMARY (only note if surface changed).
4. Note the deliberate `hasMany:true` storage trade-off (Phase 05) in the architecture/PRD so future devs don't "fix" it.

## Todo

- [x] PRD: relation 1–n, drop max-10, delete/cycle/dedup rules
- [x] Stories: acceptance criteria updated
- [x] QA: TC-05-11, -06, -09, -05, -12 revised; add children→top TC
- [x] Record hasMany trade-off note
- [x] Verify TC-IDs referenced by Phase 07 tests exist

## Success Criteria

- No doc mentions "max 10 categories" or n–n for product↔category.
- QA TCs match Phase 07 test names/IDs.
- Delete/cycle/dedup behaviors documented matching code.

## Risk Assessment

| Risk | L×I | Mitigation |
|------|-----|-----------|
| Docs drift from final code if written too early | Med×Med | Depends-on 02–05; write after code frozen |
| TC-ID renumber breaks tester mapping | Low×Med | Edit TC bodies, keep IDs stable |

## Security

- None.

## Next Steps

- Phase 07 tests reference these TC-IDs.
