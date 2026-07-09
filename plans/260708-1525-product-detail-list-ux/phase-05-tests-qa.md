# Phase 05 — Tests + cross-browser/responsive QA

**Context:** [plan.md](plan.md) · GH-1525 all issues · depends on **P01–P04**
Owns: `src/__tests__/**` only (tester reads impl, never edits it)

## Overview
- **Priority:** P1 · **Status:** pending
- Unit tests per `docs/TEST_CONVENTION.md` (TC-ID required, import from source, AAA, `vi.mock` top-level). Plus manual cross-browser/responsive matrix from the issue AC.

## Key Insights
- QA doc for this area: `docs/qa/F08-product-crud.md` (+ `docs/qa/F09-products-crud.md`). Pull/append TC-IDs there (e.g. `TC-F08-1525-01…`). If not yet defined, add rows (coordinate with docs-engineer/QC) so tests can reference real TC-IDs.
- Pure helper `computeStockDisplay` = highest-value, lowest-cost coverage — mirror gold-standard `products-display-price.test.ts`.
- Component tests: master-fields disable/enable + value-retention, and stock cell render, using RTL. Mock `next/navigation` + `useI18n` + `@payload-config` per existing dashboard test setup.
- Existing tests to keep green (regression): `products-schema-variants.test.ts`, `products-variant-utils.test.ts`, `products-display-price.test.ts`, `products-crud.test.tsx`. The P01 split may change component import paths — update any test importing `VariantsInventorySection` (grep first).

## Test Matrix
| Target | Type | File | TC-IDs (proposed) |
|--------|------|------|-------------------|
| `computeStockDisplay` (range/single/equal/1/none, string coercion, severity) | pure unit | `src/__tests__/unit/products/stock-display.test.ts` | TC-F08-1525-01..08 |
| MasterFields disable when variants, enable+retain on empty (issue 1+2) | component | `src/__tests__/unit/dashboard/master-fields-disable.test.tsx` | TC-F08-1525-10..14 |
| Product list stock cell renders range + breakdown trigger | component | extend `products-crud.test.tsx` OR new `products-stock-cell.test.tsx` | TC-F08-1525-20..23 |
| baseSku change → matrix SKU regen still works post-split | component/util | extend `products-variant-utils.test.ts` or new | TC-F08-1525-30 |
| Section order (Master before VariantOptions) | component | `products-crud.test.tsx` (DOM order assert) | TC-F08-1525-24 |

## Manual QA matrix (from issue AC)
| Scenario | Chrome desktop | Safari desktop | Mobile responsive (<820px) |
|----------|:---:|:---:|:---:|
| Create variant product, generate matrix → master fields disabled + tooltip | ☐ | ☐ | ☐ |
| Delete all tiers → master fields re-enabled, values kept | ☐ | ☐ | ☐ |
| Toggle variants off → master fields re-enabled, values kept | ☐ | ☐ | ☐ |
| Variant section renders below master fields | ☐ | ☐ | ☐ |
| List: variant product shows min–max range | ☐ | ☐ | ☐ |
| List: breakdown via hover (desktop) / tap (mobile) | ☐ (hover) | ☐ (hover) | ☐ (tap) |
| Non-variant product: single number unchanged | ☐ | ☐ | ☐ |
| SKU prefix change updates variant SKUs (post-split) | ☐ | ☐ | ☐ |

## Implementation Steps
1. `grep -rn "VariantsInventorySection" src/__tests__` → update any broken imports from the split.
2. Write `stock-display.test.ts` (pure, AAA, TC-IDs). Cover: no variants→inventory; 1 variant→single; equal→single; differing→range; string stock coercion; severity from min.
3. Write `master-fields-disable.test.tsx`: render form, set variants → assert 3 inputs disabled + tooltip trigger present; empty variants → assert enabled + prior values retained (no reset).
4. Add/extend list stock-cell render test (range label + breakdown element).
5. Add section-order assertion (Master appears before VariantOptions in DOM).
6. `npm test -- --run` all green; `npm run test:coverage` not below thresholds (lines 70 / branches 70 / funcs 70 targets).
7. Execute manual QA matrix; log results in PR description.

## Todo List
- [ ] Broken split imports in tests fixed
- [ ] `stock-display.test.ts` (8 cases) green
- [ ] `master-fields-disable.test.tsx` (disable + retain) green
- [ ] List stock-cell + section-order tests green
- [ ] baseSku-regen regression test green
- [ ] Full suite + coverage pass (no regression)
- [ ] Manual QA matrix completed (Chrome/Safari/mobile)
- [ ] TC-IDs recorded in `docs/qa/F08-product-crud.md`

## Success Criteria
- All new + existing product tests pass; coverage not reduced; every new test maps to a TC-ID; manual matrix fully checked with no P1 regressions on create/edit (variant + non-variant) or list (desktop + mobile).

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Split changes break existing product-form tests | High×Med | grep + update imports first (step 1) before writing new tests |
| RTL can't easily assert Radix Tooltip/Popover content | Med×Low | Assert trigger presence + `aria`/content on open; keep breakdown logic in pure helper for the bulk of assertions |
| TC-IDs not yet defined in QA doc | Med×Low | Add rows to `docs/qa/F08-product-crud.md` (coordinate QC) before referencing |

## Security Considerations
- Tests must use real source imports (no re-implemented logic) per convention — prevents false-positive coverage.

## Next Steps
- On green + QA: hand to code-reviewer → docs-manager (update `CHANGELOG.md` + `docs/architecture/F08-products-crud.md` for the split) → git-manager (PR to `staging`, title e.g. `fix(products): variant-aware master fields and stock range display`).
