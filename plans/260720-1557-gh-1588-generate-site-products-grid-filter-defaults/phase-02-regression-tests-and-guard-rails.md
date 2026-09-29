# Phase 02 — Regression Tests And Guard Rails

## Context Links

- Generate-site API tests: [src/__tests__/api/ai.test.ts](<worktree-1>/src/__tests__/api/ai.test.ts:196)
- Existing products-grid tests: [src/__tests__/unit/blocks/products-grid.test.tsx](<worktree-1>/src/__tests__/unit/blocks/products-grid.test.tsx:186)

## Overview

Lock the behavior with API-level tests in `ai.test.ts`. This is the narrowest place that sees full page persistence output, including both page-slug-aware filter defaults and missing `products-grid` content restored during generate-site normalization.

## Key Insights

- The bug is a generation-time defaulting rule, not a runtime rendering bug
- `products-grid` unit tests already cover runtime filter UI; no need to duplicate there
- `ai.test.ts` already asserts created page slugs and page count, so this suite is the right home
- We need one regression that mimics template-first shape, because that is the path currently dropping `headline/subheadline/limit`
- This phase validates persisted output from `generate-site`; it does not try to prove `template-composer` now emits a corrected payload shape upstream

## Requirements

- Mandatory: cover AI multi-page path where homepage and `/products` both contain `products-grid`
- Mandatory: cover template-first `products-grid` shape missing `headline/subheadline/limit`
- Fallback path: cover no-op safety only, because the current fallback `/products` page does not include a `products-grid`
- Assert non-`products-grid` blocks are unchanged

## Related Code Files

- Modify: `src/__tests__/api/ai.test.ts`
- Optional helper extraction only if route gets noisy: `src/app/api/ai/generate-site/route.ts`

## Implementation Steps

1. Add a test where mocked AI returns `result.pages` containing:
   - homepage with `products-grid`
   - `/products` page with `products-grid`
   - at least one `products-grid` block using template-first shape (`variant/count/items`, no `headline/subheadline/limit`)
2. Run generate-site POST
3. Inspect persisted `mockPageDB`
4. Assert homepage grid has `showCategoryFilter !== true`
5. Assert `/products` grid has `showCategoryFilter === true`
6. Assert restored `headline/subheadline/limit` exist on persisted `products-grid`
7. Add a no-op guard case: fallback `/products` page without `products-grid` should not fail or inject anything

## Todo List

- [x] Add multi-page regression for mixed page slugs
- [x] Add regression for template-first `products-grid` payload shape
- [x] Assert `/products` page gets enabled state
- [x] Assert non-`/products` pages stay disabled
- [x] Assert persisted `headline/subheadline/limit` are restored
- [x] Assert fallback `/products` page with no grid remains untouched

## Success Criteria

- Test fails if any non-`/products` grid in the AI multi-page path starts enabled
- Test fails if `/products` grid in the AI multi-page path loses enabled default
- Test fails if template-first `products-grid` persists without `headline/subheadline/limit`
- Fallback path proves no-op safety only until fallback composition actually includes a `products-grid`
- Test remains independent of storefront runtime tests

## Risk Assessment

- Mock shape drift in `ai.test.ts` can make assertions brittle
- Avoid asserting unrelated page content; assert only slug + target block fields
- Keep the test fixture intentionally close to current template-first output so the regression is meaningful

## Security Considerations

- Test-only phase. No new security surface.

## Next Steps

- Phase 03 runs targeted validation and confirms no need for editor/schema changes in this fix
