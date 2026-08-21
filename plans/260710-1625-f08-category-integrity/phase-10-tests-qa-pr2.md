# Phase 10 — GH-1588 Scope 02 Tests + QA

**PR:** 2 · **Migration:** No · **Priority:** P1 · **Status:** blocked · **Depends:** 09, [GH-1588 semantic guard](../260804-1543-gh-1588-unmatched-category-guard/plan.md)

## Context

- Scope is tenant-aware AI Bulk Create only; storefront filtering remains owned by Phase 08.
- Follow `docs/TEST_CONVENTION.md`: TC-IDs, AAA, and imports from source.
- Latest QA bug 1 shows an allowlisted but unrelated `QA Skincare` ID survives for `4-Person Camping Tent`; closeout waits for the focused fail-closed guard and TC120–TC124 re-test.

## Overview

Unit-test tenant category prompt/mapping, AI review required selection, and the AI-only server validation boundary; retain a focused Playwright browser/save scenario.

## Test Matrix

| Behavior | Level | File | TC |
|----------|-------|------|----|
| bulk-parse injects tenant categories, returns valid id/null | unit (mock openai+payload) | `src/__tests__/api/ai.test.ts` | new F08 TC |
| dummy fallback returns categoryId null | unit | same | new |
| BulkCreateModal preselects valid ID; null/stale blocks Approve until existing category is selected | unit | `bulk-create-save.test.tsx` | TC-F08-04-100..102 |
| selected-ID lookup canonicalizes/deduplicates IDs and rejects malformed input before querying | unit | `category-list-tenant-scope.test.ts` | TC-F08-04-100 |
| raw selected-ID input is bounded before parsing/deduplication/Payload access | unit | `category-list-tenant-scope.test.ts` | TC-F08-04-108 |
| pending/failed/retried partial refresh does not unmount the modal; stale response cannot overwrite final refresh | unit | `products-ai-open.test.tsx`, `bulk-create-save.test.tsx` | TC-F08-04-107 |
| older AI completion preserves a newer prompt | unit | `products-ai-open.test.tsx` | TC-F08-04-104 |
| zero active categories blocks parse and offers Category management | unit | `products-ai-open.test.tsx` | TC-F08-04-106 |

## Related Code Files

**Create:**
- `src/__tests__/api/e2e-ensure-test-user.test.ts` — guarded, idempotent Site-prerequisite provisioning coverage for a fresh CI tenant.

**Modify:**
- `e2e/products.spec.ts` — permanent UI/Server Action category selection, draft persistence, fresh-read and cleanup flow; no direct collection REST or hardcoded IDs.
- `src/__tests__/api/ai.test.ts` — tenant query, prompt, canonical ID/null and bounded list.
- `src/__tests__/unit/dashboard/bulk-create-save.test.tsx` — required selection, selected-ID revalidation and partial stale-category handling.
- `src/__tests__/unit/dashboard/category-list-tenant-scope.test.ts` — dedicated primary-tenant AI list and selected-ID lookup.
- `src/__tests__/unit/dashboard/products-ai-open.test.tsx` — fresh category preparation before modal open.
- `src/__tests__/unit/actions/save-product-action.test.ts` — AI-only category boundary and manual save-action contract.
- `src/app/api/e2e/ensure-test-user/route.ts` — guarded, idempotent Site prerequisite for a fresh CI tenant.
- `.github/workflows/e2e-staging.yml` — permanent fixture allowlist and fresh-tenant prerequisite contract.

**Read for context:** Phase 09 implementation files.

## Manual QA Checklist (Scope 02)

- [ ] Valid AI category is preselected from the current tenant.
- [ ] Null/stale AI category blocks Approve until an existing category is selected.
- [ ] Approving drafts never creates a new category.
- [ ] Every saved AI draft has exactly one existing tenant category.
- [ ] Manual Add/Edit Product still blocks Save without Category.
- [ ] A tenant with no active category cannot start parsing and can navigate to Category management.
- [ ] After a partial save failure, unsaved drafts remain in the open modal even if refresh fails; an older refresh cannot overwrite the final product list.
- [ ] Typing a new prompt while an older request is pending does not lose the newer prompt.

## Implementation Steps

1. Update API, modal, page and action tests for tenant-aware category IDs.
2. Run focused unit tests and Playwright discovery.
3. Execute the Scope 02 manual QA checklist on a seeded tenant.
4. Record dependency/environment blockers without claiming unexecuted coverage.

## Todo

- [x] AI bulk-parse tenant-aware unit tests
- [x] BulkCreateModal id-mapping/required-selection unit tests (no auto-create)
- [x] AI-only forced-draft, active-tenant-category, stale-category, and manual save-action contract regression tests
- [x] Permanent UI/Server Action Playwright fixture included in staging CI allowlist
- [x] Guarded setup idempotently ensures the fresh tenant's single Site prerequisite
- [x] Focused Scope 02 verification green (6 files / 128/128 tests); AI API file remains dependency-blocked
- [x] Browser verification green (2/2); active product/category fixture residue 0/0
- [ ] Manual QA checklist executed + signed off
- [ ] GH-1588 bug 1 semantic guard TC120–TC124 passed and QA evidence attached
- [x] TC-IDs referenced from updated F08 QA doc

## Success Criteria

- Focused new/updated unit tests pass.
- Scope 02 manual QA passes on a seeded tenant.
- No junk category is created during a real bulk import.
- No AI-created product is saved without exactly one existing category; manual ProductForm behavior remains unchanged.
- Permanent E2E creates, verifies and removes fixture data without direct collection REST or hardcoded IDs.

## Risk Assessment

| Risk | L×I | Mitigation |
|------|-----|-----------|
| Category changes between modal preflight and save | Med×Med | AI-only Server Action revalidates active tenant ownership and returns `CATEGORY_INVALID` as a serializable result. |
| AI mock diverges from real API shape | Med×Med | Assert against documented JSON contract; smoke-test with real key in staging |
| Failed/out-of-order partial refresh or stale async completion destroys current UI state | Med×High | Regression tests assert the modal stays mounted, only the latest product response applies, and only the completed session's prompt may be cleared. |

## Security

- Verify category reads and saves are scoped to the actor’s resolved primary tenant and non-deleted categories.

## Next Steps

- On green + QA sign-off → code-reviewer → PR to staging (`Relates to #1588`).
