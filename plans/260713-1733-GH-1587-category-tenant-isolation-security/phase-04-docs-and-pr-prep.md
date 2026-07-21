# Phase 04 — Docs: QA TC-IDs, Journal, PR Description Prep

**PR:** this branch · **Migration:** No · **Priority:** P1 · **Status:** pending (being handled by docs-manager agent in parallel)

## Context

- Doc map: `CLAUDE.md` canonical docs table. QA docs live in `docs/qa/F*.md`.
- Bug 0 precedent already landed: TC-F08-05-13 row in `docs/qa/F08-product-crud.md` + journal `docs/journals/260713-gh1587-category-list-cross-tenant-disclosure.md`.
- Depends on Phase 03 (TC-IDs must match shipped tests).

## Overview

Register 5 new TC-IDs in their owning feature QA docs, add one security journal entry, and draft the PR description. No code.

## Key Insights

- **TC-ID must live in the OWNING feature's QA doc**, not all forced into F08:
  - Categories bugs → F08 US-05 (where TC-F08-05-13 already sits).
  - Products collection → F09 (`docs/qa/F09-products-crud.md`).
  - Blogs + BlogCategories → F17 (`docs/qa/F17-blog-management.md`).
- F08 uses `TC-F08-05-NN` for US-05 (Categories). F09/F17 have no existing `-SEC-` group → introduce `TC-F09-SEC-01`, `TC-F17-SEC-01/02` (clear, discoverable security bucket). Keep table columns consistent with each doc's existing format.

## Requirements

- Each TC-ID row: id, source ref (`GH-1587/Sec`), type `Sec`, steps (curl/auth repro), expected (denied/tenant-scoped), severity `Blocker`, status `[ ]` (checked `[x]` only after tests pass).
- Journal entry: what leaked, blast radius, fix, verification.
- PR description draft saved for git-manager (do not open PR here).

## Related Code Files

**Modify (docs only — this phase owns docs, never edits `src/` or tests):**
- `docs/qa/F08-product-crud.md` — add TC-F08-05-14 (Bug A parent IDOR) + TC-F08-05-15 (Categories anon read) in US-05 table.
- `docs/qa/F09-products-crud.md` — add TC-F09-SEC-01 (Products anon read).
- `docs/qa/F17-blog-management.md` — add TC-F17-SEC-01 (Blogs anon read) + TC-F17-SEC-02 (BlogCategories anon read).
- `docs/journals/260713-gh1587-cross-tenant-idor-and-rest-leak.md` — NEW journal (Bug A + Bug B).
- `docs/CHANGELOG.md` — one security line under current unreleased section (delegate to docs-manager per workflow, or inline).

**Read for context:** existing TC-F08-05-13 row (format); Bug 0 journal.

## Implementation Steps

1. F08 US-05: add two rows mirroring TC-F08-05-13's column layout:
   - TC-F08-05-14 — parent cross-tenant IDOR: steps = login Tenant A, `payload.update` own category with parent = Tenant B category id; expected = rejected "Danh mục cha phải thuộc cùng thương hiệu"; same-tenant parent succeeds.
   - TC-F08-05-15 — Categories anonymous REST read blocked: steps = `curl /api/categories` no auth; expected = 403/empty.
2. F09: add `## Security` sub-section if absent; TC-F09-SEC-01 — `curl /api/products` no auth → denied (was leaking active products/pricing/SKU cross-tenant).
3. F17: TC-F17-SEC-01 (`/api/blogs` no auth → denied) + TC-F17-SEC-02 (`/api/blog_categories` no auth → denied; note this was the worst — `return true`, all tenants).
4. Journal `260713-gh1587-cross-tenant-idor-and-rest-leak.md`: sections — Summary, Blast radius (4 collections + parent IDOR), Root cause (`findByID` bypass + unscoped anon branch), Fix (tenant-scoped `find` + Option A), Verification (5 TC-IDs), Follow-up (GH-1588 scoped public category route).
5. Draft PR description → save to `plans/260713-1733-GH-1587-category-tenant-isolation-security/reports/pr-description-draft.md`: title `security(F08): cross-tenant isolation — parent IDOR + anonymous REST leak`; body = bugs, fix approach, `Relates to #<issue>` (NOT Closes), test list, PR-base note (PR #1605 vs staging), zero-regression rationale.
6. Mark all TC-ID `[x]` only after Phase 03 confirmed green.

## Todo

- [ ] TC-F08-05-14 + TC-F08-05-15 rows in F08 US-05
- [ ] TC-F09-SEC-01 in F09
- [ ] TC-F17-SEC-01 + TC-F17-SEC-02 in F17
- [ ] Security journal entry
- [ ] CHANGELOG security line
- [ ] PR description draft in reports/
- [ ] Flip TC statuses to `[x]` after tests green

## Success Criteria

- All 5 TC-IDs present in owning QA docs, matching Phase 03 test titles 1:1.
- Journal + CHANGELOG updated; PR draft ready for git-manager.
- No `src/` edits in this phase.

## Risk Assessment

| Risk | L×I | Mitigation |
|------|-----|-----------|
| TC-ID mismatch between QA doc and test titles | Med×Med | Cross-check against Phase 03 titles before flipping `[x]` |
| Wrong QA doc for a collection | Low×Med | Mapping table locked in plan.md; Products→F09, Blogs/BlogCat→F17 |
| PR opened with `Closes #N` | Low×High | Draft explicitly uses `Relates to #N` per git-flow rule |

## Security Considerations

- QA rows double as the permanent repro + regression record for auditors.

## Next Steps

- Hand PR draft to `git-manager`; resolve PR-base (PR #1605 vs staging) at open time.
- Track GH-1588 as the follow-up that re-adds scoped public category reads via `/api/storefront/categories`.
