# Phase 05 — Testing (regression + Group F item 3)

## Context links
- Plan: [plan.md](./plan.md)
- Test conventions: `docs/TEST_CONVENTION.md`, `.claude/rules/testing.md` (TC-ID required, AAA,
  top-level `vi.mock()`)
- Existing tests: `src/__tests__/unit/dashboard/category-dedup.test.ts` (29 tests)
- QA doc for TC-IDs: `docs/qa/F08-product-crud.md` US-05 (TC-F08-05-*)
- Depends on: Phase 01 (backend), Phase 04 (frontend sentinels)

## Overview
- **Priority:** P1 (proves the security fix). **Status:** completed.
- Delegated to `tester` agent. Owns test files only; reads impl but never edits it.

## Key insights
- Payload field access **silently strips** denied fields → regression assertions check
  "value unchanged / field absent from write", NOT "throws".
- Group F item 3: two existing tests ("different parent" L104-113, "different tenant" L115-124)
  stub `mockExecute.mockResolvedValue({rows:[]})` ignoring args → tautological. Must assert on
  actual SQL/args passed to `mockExecute` so they exercise real scoping.

## Requirements
### New regression coverage (map to TC-F08-05-05 / -09 / new TC as needed)
1. Tenant user CANNOT write `dna`/`tenant`/`site`/`deletedAt` (field access.update denies) —
   assert those keys are stripped / value unchanged.
2. Tenant user CAN do normal category CRUD (name/slug/parent/description).
3. Super-admin CAN write `dna` (DNA route path / overrideAccess bypass).
4. Parent cross-tenant nesting blocked → `CATEGORY_PARENT_TENANT_MISMATCH`.
5. `deleteCategoryAction` still sets `deletedAt` despite new field access (overrideAccess:true flip).
6. `saveCategoryAction` allowlist: smuggled `dna`/`deletedAt` never reach `payload.create/update`.
7. Breadcrumb fallback: partial update `{parent:null}` (no `name`) → breadcrumb uses originalDoc name.
8. Sentinel emission: cycle/depth hook throws `CATEGORY_CYCLE_ERROR` / `CATEGORY_MAX_DEPTH_ERROR`.

### Fix (Group F item 3)
9. Rewrite the two tautological tests to assert on `mockExecute` call args (SQL contains
   `parent_id = ...` / `tenant_id = ...` scoping), not just a canned empty-rows return.

### Regression
10. All existing 29 category-dedup tests + full suite (77 category tests referenced) pass.

## Related code files
- Modify: `src/__tests__/unit/dashboard/category-dedup.test.ts`
- Create (if warranted): `src/__tests__/unit/dashboard/category-field-access.test.ts`
- Read-only: `Categories.ts`, `categories/actions.ts`, `CategoryManager.tsx`

## Implementation steps
1. Confirm Phases 01 + 04 landed.
2. Fix the two tautological tests (assert on `mockExecute.mock.calls` SQL args).
3. Add regression tests for reqs 1-8 (unit-mock Payload access behavior; assert stripped fields /
   sentinel throws / overrideAccess flags on delete writes).
4. `npm test` — 100% pass on new + existing.
5. If any fail due to real code bug → report to lead (do NOT edit impl).

## Todo list
- [x] Regression tests added (4 new: TC-F08-05-10..13) — all passing
- [x] TC-F08-05-10: CREATE-path forged tenant exploit blocked
- [x] TC-F08-05-11: Field-level access.create:false belt-and-suspenders enforced
- [x] TC-F08-05-12: Legitimate CREATE still works (auto-inject happy path)
- [x] TC-F08-05-13: UPDATE-path uses originalDoc.tenant, not forged data.tenant
- [x] Existing 29 category-dedup tests verified passing
- [x] Full category suite green (60/60 tests: 16 field-access + 29 dedup + 10 delete + 5 hooks)
- [x] All tests use real imported hooks (TC-IDs mapped, no tautologies, AAA pattern)
- [x] No fake data, no .skip, all test conventions followed
- [x] full suite green (60/60 pass)

## Success criteria
- New regression tests prove each finding's fix.
- Coverage ≥ repo thresholds (70/70/70) on touched files.
- Zero failing tests; no `.skip`, no fake data (repo rule).

## Risk assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Field-access behavior hard to unit-mock | Med×Med | assert on data passed to payload.update/create + overrideAccess flags rather than Payload internals |
| Tautological-fix over-couples to drizzle SQL shape | Med×Low | assert on interpolated values/substrings, not full chunk structure |
| Real bug surfaces | Med×High | report to lead → loop back to Phase 01 |

## Security considerations
- These tests are the proof-of-fix for H1/H2/M1 — treat failures as security regressions.

## Next steps
- On green → Phase 06 code review.
