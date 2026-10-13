---
title: "GH-1587 Category UI Rework Regression Fixes"
description: "Restore distinct L1/L2/L3 badge colors and add the missing contextual guidance to the Add Subcategory modal, with permanent regression coverage for all four reviewed comment cases."
status: completed
priority: P1
effort: 7h
issue: 1587
branch: fix/gh-1587-category-ui-rework
tags: [bugfix, frontend, testing]
blockedBy: []
blocks: []
created: 2026-08-04
---

# GH-1587 Category UI Rework Regression Fixes

## Overview

Fix only the two failures reproduced from issue comment `#issuecomment-5030223972`: dark-mode level badges lose their L1/L2/L3 colors, and the row-level Add Subcategory modal omits the parent/level context banner and locked-parent helper. Preserve the already-passing delete/re-parent and assigned-product hard-block behavior.

## Verified Baseline

| Comment case | Current result | Plan treatment |
|---|---|---|
| L1/L2/L3 badges use distinct colors | Fail in dark mode | Fix |
| Deleting a parent promotes children to top level | Pass | Regression gate only |
| Add Subcategory explains parent/current/new level | Fail | Fix |
| Deleting a category with assigned products shows exact count | Pass | Regression gate only |

Evidence: `./.gstack/qa-reports/qa-report-localhost-2026-08-04.md`.

## Scope Challenge

The backend category integrity work from `plans/260710-1625-f08-category-integrity/` is already present and verified. This rework does not need collection changes, migrations, API changes, or shared design-system behavior changes. The minimum safe patch is category-local presentation/i18n work plus targeted unit and browser regressions.

## Cross-Plan Dependencies

No blocking plan dependency. The completed Phase 05b in `plans/260710-1625-f08-category-integrity/` supplies the existing subcategory mode, parent prefill/lock, depth guard, and initial level-color mapping. Its remaining pending phases concern unrelated storefront/AI work, so neither plan blocks the other.

## Phases

| Phase | Name | Status | Effort | Depends on |
|---|---|---|---:|---|
| 01 | [Fix category badges and subcategory context](./phase-01-fix-category-badges-and-subcategory-context.md) | Completed | 3h | — |
| 02 | [Add regression coverage and QA traceability](./phase-02-add-regression-coverage-and-qa-traceability.md) | Completed | 4h | Phase 01 |

## Architecture Decisions

- Keep `src/components/ui/badge.tsx` unchanged. Fix the override in Category Management only, avoiding visual regressions in every other outline badge.
- Interpret the requested badge color as the existing foreground accent contract (L1 teal, L2 blue, L3 violet); preserve the current outline surface because the issue provides no separate fill/border specification.
- Reuse the existing `isSubcategoryMode`, selected parent, tree depth calculation, and `useI18n().ti` interpolation API.
- Show guidance only for row `+` creation. Toolbar Add Category and Edit Category remain unchanged.
- Do not change `deleteCategoryAction`, `src/collections/Categories.ts`, product relationships, or SQL setup.
- Put the new authenticated browser regression in `tests/*.spec.ts` and register a dedicated Playwright project, matching repository review rules.

## Acceptance Criteria

- L1 teal, L2 blue, and L3 violet text remain distinct in both light and dark mode; no generic outline text color overrides them.
- Row `+` opens Add Subcategory with a visible message naming the parent, its current level, and the new category level.
- The locked Parent field keeps its prefilled value and displays the locked-parent helper.
- Toolbar Add Category and Edit Category do not show subcategory-only guidance.
- Existing max-depth behavior remains: L3 has no add-subcategory action.
- English and Malay translation objects remain type-compatible and contain equivalent guidance keys.
- Deleting a valid parent promotes each direct child to top level after reload; deeper descendants remain attached to that promoted child and are not lost.
- Deleting a category assigned to one product is blocked, keeps the delete confirmation open, and displays exactly: `Cannot delete this category. There are 1 products still assigned to it. Please reassign your products first.`
- No schema, migration, environment variable, or authorization change is introduced.

## Validation Commands

```bash
npm test -- --run src/__tests__/unit/dashboard/category-manager-modal-focus.test.tsx src/__tests__/unit/dashboard/category-manager-depth-guard.test.ts src/__tests__/unit/dashboard/category-delete-integrity.test.ts
npm run typecheck
npx playwright test --project=category-management-regression
git diff --check
```

The pre-existing `e2e/products-crud.spec.ts` remains unchanged by user direction. Its
modal-focus and parent-normalization scenarios still exercise the relevant behavior,
but their legacy TC-13/TC-19 title mismatch is tracked as deferred traceability debt.

## Out of Scope

Category schema/migrations, delete SQL redesign, product form/category assignment redesign, global Badge variants, category list responsive redesign, and unrelated GH-1587 security/storefront/AI phases.
