---
title: "Phase 01 — Fix Category Badges and Subcategory Context"
status: completed
effort: 3h
---

# Phase 01 — Fix Category Badges and Subcategory Context

## Context Links

- Issue: `https://github.com/primeproduction/ech-prime-web-v2/issues/1587#issuecomment-5030223972`
- QA report: `/home/liam/data/ech-prime-web-v2/.gstack/qa-reports/qa-report-localhost-2026-08-04.md`
- Badge screenshot: `/home/liam/data/ech-prime-web-v2/.gstack/qa-reports/screenshots/gh1587-category-badges.png`
- Modal screenshot: `/home/liam/data/ech-prime-web-v2/.gstack/qa-reports/screenshots/gh1587-add-subcategory-modal.png`
- Previous UX phase: `/home/liam/data/ech-prime-web-v2/plans/260710-1625-f08-category-integrity/phase-05b-category-modal-ux.md`

## Overview

Make the existing per-level color mapping authoritative across themes, then complete Add Subcategory guidance using existing modal state and i18n infrastructure. No backend or shared Badge changes.

## Key Insights

- `/home/liam/data/ech-prime-web-v2/src/components/ui/badge.tsx` adds `dark:text-gray-300` for `variant="outline"`. It wins over Category Manager's non-important level text class, making every dark-mode badge gray.
- `/home/liam/data/ech-prime-web-v2/src/app/(dashboard)/products/categories/components/CategoryManager.tsx` already knows whether the modal came from row `+`, preselects the parent, disables Parent, computes hierarchy levels, and hides `+` at L3.
- `/home/liam/data/ech-prime-web-v2/src/i18n/index.tsx` already exposes `ti(template, vars)` for multi-placeholder interpolation. Do not add a duplicate formatter.

## Requirements

### Functional

- L1 uses the existing primary/teal token, L2 uses info/blue, and L3 uses the existing violet palette token.
- The level text class must override both light and dark outline defaults without relying on generated class order.
- Row `+` displays:
  - `Adding a subcategory under {parentName} (L{currentLevel}) → new category will be Level {newLevel}.`
  - `Locked — you are adding under this category.`
- Use the actual parent record and hierarchy depth; do not infer level from row order or hardcode L1/L2.
- Do not render the banner/helper when the parent cannot be resolved. Keep the locked Select behavior unchanged.

### Non-functional

- Preserve accessible text and the existing dialog/Select semantics.
- Use current dashboard tokens and Lucide icon set; add no dependency.
- Keep the solution category-local; do not alter global outline badge behavior.
- Keep English and Malay locale shapes identical.

## Architecture

1. Replace `levelTextColors` with an exported, category-local presentation helper or constant whose classes use Tailwind's important modifier for the level text token.
2. Derive `subcategoryContext` from `formData.parent` plus the current `categories` collection. Return `{ parentName, currentLevel, newLevel }` only for valid L1/L2 parents while `isSubcategoryMode` is true.
3. Interpolate one locale template with `ti`, and render a compact information banner before the first form field.
4. Render the locked-parent helper directly below the disabled Parent Select only in the same valid context.

## Related Code Files

### Modify

- `/home/liam/data/ech-prime-web-v2/src/app/(dashboard)/products/categories/components/CategoryManager.tsx`
  - Consume `ti` from `useI18n`.
  - Make the L1/L2/L3 text classes authoritative in both themes.
  - Derive parent/current/new level context.
  - Add the information banner and locked-parent helper.
- `/home/liam/data/ech-prime-web-v2/src/i18n/locales/en.json`
  - Add `dashboard.products.categories.form.subcategoryContext`.
  - Add `dashboard.products.categories.form.parentLockedHelp`.
- `/home/liam/data/ech-prime-web-v2/src/i18n/locales/ms.json`
  - Add equivalent Malay keys with identical placeholders.

### Must Not Modify

- `/home/liam/data/ech-prime-web-v2/src/components/ui/badge.tsx`
- `/home/liam/data/ech-prime-web-v2/src/app/(dashboard)/products/categories/actions.ts`
- `/home/liam/data/ech-prime-web-v2/src/collections/Categories.ts`
- `/home/liam/data/ech-prime-web-v2/scripts/db-setup.js`

## Implementation Steps

1. Change the component's `useI18n` destructuring from `{ t }` to `{ t, ti }`.
2. Refine the category-level style map:
   - Keep the current semantic color sources.
   - Apply important level text utilities so `Badge`'s `dark:text-gray-300` cannot override them.
   - Preserve the existing outline container, font size, weight, and fallback to L1 for malformed level data.
   - Export the style map/helper only if needed for direct unit coverage; do not expose component state.
3. Derive context with existing hierarchy functions:
   - Normalize `formData.parent` relationship ID.
   - Find the selected parent in `categories`.
   - Calculate the parent's real level from its ancestry.
   - Set `newLevel = currentLevel + 1`.
   - Return no context for edit/toolbar mode, unresolved parents, or an impossible `newLevel > 3`.
4. Add an informational panel at the top of the form, before Category Name:
   - Render only when the derived context exists.
   - Use `ti` with `parentName`, `currentLevel`, and `newLevel`.
   - Keep the category name visually emphasized without duplicating the full sentence into separate translation fragments.
5. Add `parentLockedHelp` below the disabled Parent Select under the same condition.
6. Add EN/MS translations with the same three placeholders in `subcategoryContext`.
7. Verify toolbar Add Category and Edit Category still render no context banner/helper and retain editable Parent.

## Todo

- [x] Make level colors authoritative in light/dark mode.
- [x] Derive context from the actual parent hierarchy.
- [x] Render contextual banner in row-`+` mode.
- [x] Render locked-parent helper in row-`+` mode.
- [x] Add EN/MS translations using `ti`.
- [x] Confirm no global Badge/backend/schema changes.

## Completion Evidence

- Changed `CategoryManager.tsx` to make the category-local L1/L2/L3 text utilities authoritative, derive the real parent-level context, and render the contextual note plus locked-parent helper.
- Added placeholder-compatible `subcategoryContext` and `parentLockedHelp` translations to `en.json` and `ms.json`.
- `npm run typecheck` passed.
- Targeted Vitest coverage passed: 10/10 tests.
- Focused implementation review scored 9.8/10.
- Phase 02 Playwright coverage and QA traceability remain intentionally pending.

## Success Criteria

- Computed badge text colors are distinct for L1/L2/L3 in both themes.
- L1 row `+` says the new category is Level 2; L2 row `+` says Level 3.
- Parent Select remains disabled and visibly displays the selected parent.
- Normal create/edit flows are unchanged.

## Risk Assessment

| Risk | Likelihood × Impact | Mitigation |
|---|---|---|
| Tailwind class order changes reintroduce gray text | Medium × Medium | Use important category-level text utilities and computed-style E2E assertions |
| Stale/missing parent causes misleading copy | Low × Medium | Render guidance only from a resolved category record |
| Shared Badge consumers regress | Low × High | Do not edit the shared component |
| EN/MS locale type mismatch breaks typecheck | Low × Medium | Add identical key/placeholder shape in both files |

## Security and Performance

- Presentation-only work; no auth, tenant, input, or persistence boundary changes.
- Context derivation is over the already-loaded category list and remains linear at current list scale; no request or N+1 query is added.

## Next Steps

Proceed to Phase 02 for documented TC-ID traceability debt, unit coverage, authenticated Playwright coverage, and full regression gates. The existing E2E file was later kept unchanged by user direction.
