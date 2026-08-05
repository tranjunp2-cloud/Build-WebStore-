---
title: "Phase 02 — Add Regression Coverage and QA Traceability"
status: completed
effort: 4h
---

# Phase 02 — Add Regression Coverage and QA Traceability

## Context Links

- Parent plan: `/home/liam/data/ech-prime-web-v2/plans/260804-1505-gh-1587-category-ui-rework/plan.md`
- Test convention: `/home/liam/data/ech-prime-web-v2/docs/TEST_CONVENTION.md`
- QA matrix: `/home/liam/data/ech-prime-web-v2/docs/qa/F08-product-crud.md`
- Existing component regression: `/home/liam/data/ech-prime-web-v2/src/__tests__/unit/dashboard/category-manager-modal-focus.test.tsx`
- Existing depth regression: `/home/liam/data/ech-prime-web-v2/src/__tests__/unit/dashboard/category-manager-depth-guard.test.ts`
- Existing delete integrity regression: `/home/liam/data/ech-prime-web-v2/src/__tests__/unit/dashboard/category-delete-integrity.test.ts`
- Existing category browser flow: `/home/liam/data/ech-prime-web-v2/e2e/products-crud.spec.ts`
- Playwright config: `/home/liam/data/ech-prime-web-v2/playwright.config.ts`

## Overview

Add durable tests for all four rework cases, reconcile existing category E2E titles with their real QA cases, and keep production changes limited to the two currently failing UI behaviors. Tests import real source, use AAA structure, and clean all created fixtures.

## Key Insights

- JSDOM cannot prove final Tailwind computed colors, but it can verify the rendered category-specific classes. Playwright must verify actual computed style in both themes.
- The existing `e2e/products-crud.spec.ts` has two mislabeled cases:
  - Modal focus is titled `TC-F08-05-13`, while the QA matrix defines focus as `TC-F08-05-17`; TC-13 is tenant IDOR.
  - Parent normalization/re-parent is titled `TC-F08-05-19`, while TC-19 is entitlement resolution. The browser flow actually covers TC-F08-05-18 plus the re-parent part of TC-F08-05-06.
- Assigned-product deletion already has backend contract coverage under TC-F08-05-06 and passed live QA with the exact localized count. It needs a regression gate, not production-code changes.
- TC-F08-05-21 and TC-F08-05-22 are already used by category field-access regressions outside the QA registry. New UI cases must use the next free IDs, TC-F08-05-38 and TC-F08-05-39.

## Requirements

### Automated coverage

- Component test asserts the row `+` modal:
  - has Add Subcategory title;
  - shows parent name, current level, and new level;
  - keeps Parent disabled;
  - shows locked helper;
  - does not show those elements in toolbar Add Category or Edit Category.
- Component/style test asserts rendered L1/L2/L3 badges receive their intended authoritative category-local color classes.
- Component delete test maps `{ success: false, error: 'CATEGORY_HAS_PRODUCTS', count: 1 }` to the exact requested English message, does not emit the generic failure, and leaves the confirmation open.
- Browser test creates an isolated hierarchy with two direct L2 children and an L3 under the first child, validates contextual copy at L1 and L2, and validates the exact primary/info/violet computed-token mapping in light and dark modes.
- The same real hierarchy flow deletes L1, reloads, and proves both direct L2 children are now top-level/L1 while the former L3 remains attached beneath its original parent.
- A separate browser flow creates a unique category and one assigned product, proves deletion is blocked with the exact count message, then removes the product before category cleanup.
- Browser fixture cleanup runs in `finally`, uses unique names, deletes deepest-first, and surfaces cleanup failure when the test itself passed.
- Existing delete/re-parent and assigned-product hard-block suites remain green.

### QA traceability

- Add new QA rows TC-F08-05-38 and TC-F08-05-39 for badge theming and contextual Add Subcategory guidance; mark automated only when the permanent tests exist.
- Correct existing E2E titles to the QA cases they actually exercise. Do not repurpose TC-13 or TC-19.
- Preserve the exact TC-F08-05-06 assigned-product count requirement.

## Related Code Files

### Modify

- `/home/liam/data/ech-prime-web-v2/src/__tests__/unit/dashboard/category-manager-modal-focus.test.tsx`
  - Update the i18n mock to expose `ti` and the new locale keys.
  - Make Select mocks forward `disabled` and accessible state.
  - Make ConfirmModal mock expose its open state and confirmation callback.
  - Add AAA cases for subcategory context and normal create/edit absence.
  - Add class assertions for L1/L2/L3 if the real presentation helper remains in the component.
  - Add the exact assigned-product delete-message mapping and open-modal regression.
- `/home/liam/data/ech-prime-web-v2/e2e/products-crud.spec.ts`
  - Rename the existing focus case to TC-F08-05-17.
  - Map the existing parent normalization/re-parent flow to TC-F08-05-18 and TC-F08-05-06 instead of TC-F08-05-19.
- `/home/liam/data/ech-prime-web-v2/playwright.config.ts`
  - Register `category-management-regression` against the new `tests` file, using saved dashboard auth and depending on `setup`.
- `/home/liam/data/ech-prime-web-v2/docs/qa/F08-product-crud.md`
  - Add TC-F08-05-38 for level badge themes.
  - Add TC-F08-05-39 for contextual Add Subcategory guidance.
  - Reconcile automation notes/mapping for TC-06, TC-17, TC-18, TC-19.

### Create

- `/home/liam/data/ech-prime-web-v2/tests/category-management-rework.spec.ts`
  - Authenticated browser regression for the hierarchy, modal guidance, and light/dark computed colors.

### Read, Do Not Modify Unless a Regression Is Found

- `/home/liam/data/ech-prime-web-v2/src/__tests__/unit/dashboard/category-manager-depth-guard.test.ts`
- `/home/liam/data/ech-prime-web-v2/src/__tests__/unit/dashboard/category-delete-integrity.test.ts`

## Implementation Steps

1. Allocate TC-F08-05-38 and TC-F08-05-39 in the QA matrix before adding their tests; do not reuse 21/22 because source tests already own them.
2. Extend the component test's top-level mocks:
   - `useI18n` returns the real-shape `ti` behavior or imports a real exported formatter; do not reimplement business logic.
   - Select/SelectTrigger forward `disabled` so accessibility assertions reflect the component.
   - Category action mock returns a deterministic L1/L2/L3 fixture when needed.
3. Add AAA unit/component cases:
   - L1 row `+` → parent L1 and new L2 message.
   - L2 row `+` → parent L2 and new L3 message.
   - Toolbar create/edit → no banner/helper.
   - L1/L2/L3 rendered classes carry their distinct important text tokens.
   - Assigned-product delete result with `count: 1` → exact requested toast, confirmation remains open, and no generic `Failed to delete category`.
4. Correct the two mismatched titles in `e2e/products-crud.spec.ts`; do not change the tested behavior while relabeling.
5. Add `tests/category-management-rework.spec.ts`:
   - Use unique timestamp/worker suffixes.
   - Register all fixture names before the first mutation.
   - Create L1 from toolbar, two direct L2 children from the L1 row `+`, and L3 from the first L2 row `+`.
   - Open toolbar Add Category and row Edit Category in the real browser; assert neither shows the subcategory note/helper and Parent remains enabled.
   - Assert both contextual messages and disabled Parent.
   - Expand the hierarchy and locate badges by their rows.
   - Use the accessible ThemeToggle labels to switch light/dark.
   - Read `getComputedStyle(badge).color`; compare L1/L2/L3 with live reference elements resolving `--primary`, `--info`, and `--p-violet-300` in both modes.
   - Assert L3 exposes no Add Subcategory button.
   - Delete the L1 parent and reload; assert both direct children are top-level with L1 badges and the first child's child remains nested with an L2 badge.
   - Add a second test that creates a unique category plus one draft product assigned through the real category relationship, attempts category deletion, and asserts the exact `There are 1 products...` message while the confirmation remains open.
   - Clean the assigned-product fixture in dependency order (product first, then category); clean hierarchy fixtures deepest-first.
   - Preserve the first test failure and report cleanup errors according to the existing helper pattern.
6. Add a dedicated authenticated Playwright project in `playwright.config.ts` with `testDir: './tests'`, exact `testMatch`, saved auth state, and `dependencies: ['setup']`.
7. Run the targeted component/depth/delete tests, typecheck, the new Playwright project, corrected existing category E2E cases, and `git diff --check`.
8. Review the final diff for forbidden scope:
   - No `src/collections/*.ts`.
   - No `scripts/db-setup.js`.
   - No new `process.env`.
   - No secret/credential output.

## Todo

- [x] Add TC-F08-05-38 and TC-F08-05-39.
- [x] Extend modal/style component regressions.
- [x] Add exact assigned-product delete-message component regression.
- [x] Correct existing E2E TC-ID mappings.
- [x] Add authenticated browser regressions for all four rework cases.
- [x] Register the Playwright project.
- [x] Run delete/re-parent and exact-count regression gates.
- [x] Run typecheck and diff checks.

## Validation Status (2026-08-04)

- Targeted Vitest: 3 files, 33/33 tests passed.
- TypeScript: `npm run typecheck` passed.
- Explicit Playwright discovery: 49 tests collected in total, including exactly two category-management regression tests and one setup dependency.
- The shared staging workflow remains unchanged by user direction; run the dedicated project explicitly until CI wiring is approved separately.
- Diff hygiene: `git diff --check` passed.
- Live browser execution passed in a local Ubuntu Playwright container sharing the `primeweb-app` network: authenticated setup plus both GH-1587 scenarios passed 3/3 in 34.6 seconds.

## Success Criteria

- New and existing category tests reference the behavior defined by their TC-ID.
- Browser coverage fails on the currently reproduced gray badges and missing modal guidance, then passes after Phase 01.
- No fixture category or product remains after a pass or failure.
- TC-F08-05-06 proves all-direct-children promotion plus descendant retention after reload and the exact one-product deletion block in the browser.
- Typecheck passes with EN/MS locale parity.

## Risk Assessment

| Risk | Likelihood × Impact | Mitigation |
|---|---|---|
| Browser test leaves tenant data behind | Medium × High | Pre-register unique names; deepest-first `finally` cleanup; reject ambiguous lookup |
| Product/category cleanup order causes a false failure | Medium × High | Record IDs immediately; delete the product before its assigned category |
| Theme transition creates flaky computed-style assertion | Low × Medium | Use Playwright web-first `toHaveCSS` assertions to retry until each semantic color settles |
| Unit test mocks hide Radix disabled behavior | Medium × Medium | Forward disabled/accessibility props and rely on browser test for final behavior |
| TC-ID cleanup obscures security coverage | Low × High | Relabel only the two mismatched browser titles; keep TC-13/19 security unit tests unchanged |

## Security and Performance

- Browser tests use existing authenticated setup and tenant-owned fixtures only.
- Never print credentials, OTPs, cookies, or response bodies containing user data.
- No extra runtime query or production bundle dependency is introduced.

## Next Steps

After all gates pass, request code review and open a scoped bugfix PR with a Conventional Commit title and `Relates to #1587`, never `Closes #1587`.
