# Phase 06 — Tests: update existing + add `aiReviewPending` lifecycle

## Context Links
- `docs/qa/F08-product-crud.md` — US-04 test matrix (existing TC-F08-04-01..33). Add new TC-IDs here.
- `.claude/rules/testing.md` / `docs/TEST_CONVENTION.md` — TC-ID required, AAA, `vi.mock()` top-level, import from source.
- Existing suites:
  - `src/__tests__/unit/dashboard/bulk-create-utils.test.ts` — `buildSavePayload` (TC-F08-04-01)
  - `src/__tests__/unit/dashboard/bulk-create-save.test.tsx` — `handleSave` (TC-F08-04-27/28..., asserts `router.refresh`)
  - `src/__tests__/unit/actions/save-product-action.test.ts` — mocks `saveProductAction` + `updateProductFieldAction` (node env, payload mocked)

## Overview
- **Priority:** High (gate before merge)
- **Status:** completed
- Update tests broken by behavior changes; add new tests for the flag lifecycle. Tester owns test files only (reads impl, never edits it).
- **Blocked by:** Phases 01, 02, 04, 05.

## Key Insights
- `buildSavePayload` and the two server actions are the cleanly unit-testable surfaces. UI (dot/pills/textarea) is testable via component render tests following `missing-info-indicator.test.tsx`.
- The `save-product-action.test.ts` harness already mocks `payload.update`/`create` → assert the `data` passed to `payload.update` contains `aiReviewPending:false` for the clear paths, and for activate.
- `bulk-create-save.test.tsx` currently asserts `router.refresh` was called → MUST flip to assert it is NOT called (regression guard for the no-reload requirement).

## Test Matrix
| Layer | What | File | TC-ID (propose; QC to confirm) |
|-------|------|------|-------------------------------|
| Unit (pure) | `buildSavePayload` returns `aiReviewPending:true` | `bulk-create-utils.test.ts` (extend) | TC-F08-04-34 |
| Unit (component) | `handleSave` does NOT call `router.refresh`; still calls `onSuccess`+`onClose` | `bulk-create-save.test.tsx` (update 27/28) | TC-F08-04-27/28 (amend) |
| Unit (action) | `saveProductAction(data, id)` update path sets `aiReviewPending:false` in `payload.update` data | `save-product-action.test.ts` (extend) | TC-F08-04-35 |
| Unit (action) | `saveProductAction(data)` create path passes through `aiReviewPending:true` when provided | same | TC-F08-04-36 |
| Unit (action) | `updateProductFieldAction(id,{status:'active'})` → update data has `aiReviewPending:false` | same | TC-F08-04-37 |
| Unit (action) | `updateProductFieldAction(id,{status:'archived'})` → update data has NO `aiReviewPending` | same | TC-F08-04-38 |
| Unit (action) | `updateProductFieldAction(id,{deletedAt})` → flag untouched | same | TC-F08-04-39 |
| Unit (component) | `AiReviewIndicator` renders dot+tooltip when `pending`; renders null otherwise | NEW `ai-review-indicator.test.tsx` | TC-F08-04-40/41 |

## Requirements
- Every new/changed test references a TC-ID; add the rows to `docs/qa/F08-product-crud.md` (QC co-owns; note IDs in PR).
- No re-implemented logic; import from source.
- All suites green (`npm test`); coverage ≥ 70/70/70 maintained.

## Related Code Files
- **Modify** `src/__tests__/unit/dashboard/bulk-create-utils.test.ts`
- **Modify** `src/__tests__/unit/dashboard/bulk-create-save.test.tsx`
- **Modify** `src/__tests__/unit/actions/save-product-action.test.ts`
- **Create** `src/__tests__/unit/dashboard/ai-review-indicator.test.tsx`
- **Modify** `docs/qa/F08-product-crud.md` (add TC rows) — or hand to docs/QC in review.

## Implementation Steps
1. `bulk-create-utils.test.ts`: extend the existing `buildSavePayload` assertions to check `aiReviewPending === true`.
2. `bulk-create-save.test.tsx`: replace `expect(router.refresh).toHaveBeenCalled()` with `expect(router.refresh).not.toHaveBeenCalled()`; keep `onSuccess`/`onClose` assertions.
3. `save-product-action.test.ts`: add tests capturing `mockUpdate.mock.calls[0][0].data` for update/activate/archive/delete paths; assert `aiReviewPending` presence/absence per matrix.
4. Create `ai-review-indicator.test.tsx` following `missing-info-indicator.test.tsx` (render with pending true/false; assert dot + tooltip content via `aiReviewTooltip`, and null render when not pending).
5. Add TC rows to `docs/qa/F08-product-crud.md`.
6. `npm test` — all green; `npm run test:coverage` if thresholds at risk.

## Todo List
- [x] `buildSavePayload` test asserts flag true
- [x] `handleSave` test asserts NO `router.refresh`
- [x] action tests: clear-on-edit, pass-through-on-create, clear-on-activate, untouched-on-archive/delete
- [x] `AiReviewIndicator` render tests (pending / not-pending)
- [x] TC-IDs added to `docs/qa/F08-product-crud.md`
- [x] full suite green, coverage ≥ 70/70/70

## Success Criteria
- `npm test` passes with the amended + new tests.
- Behavior changes (flag set/clear, no-refresh) are each locked by at least one test.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Existing `router.refresh` test left asserting old behavior → false red | High if missed | Med | Explicit step 2; grep `router.refresh` in tests |
| Action test can't inspect update `data` shape | Low | Med | Harness already exposes `mockUpdate`; assert on call args |
| Tooltip content not queryable (portal) | Med | Low | Follow missing-info-indicator test approach (Radix portal handling) |
| New TC-IDs collide with existing | Low | Low | Use next free numbers after 33; QC confirms in review |

## Security Considerations
- Tests only; no runtime surface. Ensure no real secrets/fixtures leak (use existing mock patterns).

## Next Steps
- On green: code-reviewer → docs-manager (CODEBASE_SUMMARY / CHANGELOG / architecture F08) → git-manager PR to `staging`.
