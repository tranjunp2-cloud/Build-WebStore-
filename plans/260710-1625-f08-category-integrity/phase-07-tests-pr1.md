# Phase 07 — Tests (PR-1)

**PR:** 1 · **Migration:** No · **Priority:** P1 · **Status:** pending · **Depends:** 01–05

## Context

- Rule `.claude/rules/testing.md`: every test maps to a TC-ID from `docs/qa/F08-product-crud.md` (updated in Phase 06); AAA; `vi.mock()` top-level; import from source, never re-implement logic.
- Existing category test files to extend/mirror: `src/__tests__/unit/collections/categories-hooks.test.ts` (hook behavior), `src/__tests__/unit/dashboard/category-select.test.tsx` (select UI).
- Tester owns test files only; reads implementation, never edits it.

## Overview

Unit + integration coverage for the four backend integrity behaviors + single-select assertion. Focus on logic, not DB (no live Neon in unit tests) — mock Payload where needed, but for the composite-index behavior add a note for QA/staging verification (can't unit-test a Postgres index).

## Requirements

- Cover: cycle prevention (self + descendant), delete hard-block, delete children→top-level, name dedup per (parent,tenant), slug scope behavior (logic path), single-select onChange replacement.

## Test Matrix

| Behavior | Level | File | TC |
|----------|-------|------|----|
| `isDescendant` true/false | unit | `categories-hooks.test.ts` (or new `category-cycle.test.ts`) | TC-05-09 |
| beforeValidate rejects self-parent & descendant-parent | unit | `categories-hooks.test.ts` | TC-05-09 |
| depth≤3 still enforced (regression) | unit | `categories-hooks.test.ts` | existing |
| deleteCategoryAction blocks when direct products>0 | unit (mock payload+sql) | new `category-delete-integrity.test.ts` | TC-05-06 |
| deleteCategoryAction re-parents children to null | unit | same | new TC |
| name dedup rejects same (name,parent,tenant), allows diff parent/tenant | unit | new `category-dedup.test.ts` | TC-05-05 |
| slug 23505 → friendly CATEGORY_SLUG_DUPLICATE mapping | unit | same | TC-05-12 |
| CategorySelect selectLeaf replaces (single-select) | unit | `category-select.test.tsx` | TC-05-11 |

## Related Code Files

**Create:**
- `src/__tests__/unit/dashboard/category-delete-integrity.test.ts`
- `src/__tests__/unit/dashboard/category-dedup.test.ts`
- (optional) `src/__tests__/unit/collections/category-cycle.test.ts` if `categories-hooks.test.ts` grows >200 lines.

**Modify:**
- `src/__tests__/unit/collections/categories-hooks.test.ts` — add cycle cases.
- `src/__tests__/unit/dashboard/category-select.test.tsx` — add explicit single-select replacement assertion.

**Read for context:** all Phase 01–05 implementation files.

## Implementation Steps

1. Mock `getPayload`/`payload.find/update` and the Drizzle `sql` execute for delete-count and dedup queries (follow the mock style already in `categories-hooks.test.ts`).
2. Import the REAL `deleteCategoryAction`, `saveCategoryAction`, hook, `isDescendant`, `CategorySelect` — never re-implement.
3. AAA structure; assert thrown structured errors (`CATEGORY_HAS_PRODUCTS:n`, `CATEGORY_NAME_DUPLICATE`, `CATEGORY_SLUG_DUPLICATE`, cycle).
4. Run `npm test` — 100% pass on new/changed files. Fix reported failures (delegate back to implementer, not by faking).
5. Note in report: composite unique index (Phase 01) is verified at QA/staging via `psql`, not in unit layer.

## Todo

- [ ] Cycle unit tests (self + descendant + valid)
- [ ] Delete hard-block + children re-parent tests
- [ ] Name dedup + slug 23505 mapping tests
- [ ] Single-select replacement assertion
- [ ] Depth≤3 regression intact
- [ ] `npm test` green; TC-IDs referenced

## Success Criteria

- All new tests pass; no regressions in existing category suites.
- Each test references a valid TC-ID from updated `docs/qa/F08-product-crud.md`.
- No fake data / no logic re-implementation in tests.

## Risk Assessment

| Risk | L×I | Mitigation |
|------|-----|-----------|
| Can't unit-test Postgres unique index | High×Low | Test the app error-mapping path; index verified in staging (documented) |
| Over-mocking hides real bug | Med×Med | Import real functions; mock only IO boundary (payload/sql) |

## Security

- Ensure tests assert `overrideAccess:false` / tenant scoping paths aren't bypassed.

## Next Steps

- On green → code-reviewer → git-manager PR-1 to staging (`Relates to #5 #10 #11 #12 #14`).
