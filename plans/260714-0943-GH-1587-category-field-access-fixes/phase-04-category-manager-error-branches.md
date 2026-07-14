# Phase 04 — CategoryManager Error Branches (Group F item 1, frontend)

## Context links
- Plan: [plan.md](./plan.md)
- Target: `src/app/(dashboard)/products/categories/components/CategoryManager.tsx` ~L308-318
- Depends on: Phase 01 (emits `CATEGORY_CYCLE_ERROR` / `CATEGORY_MAX_DEPTH_ERROR` sentinels)
- i18n keys ALREADY EXIST: `dashboard.products.categories.toast.cycleError` +
  `.maxDepthError` in `src/i18n/locales/en.json:2055-2056` and `ms.json:2055-2056`

## Overview
- **Priority:** P3 (i18n leak). **Status:** completed. Depends on Phase 01.
- Fixes raw Vietnamese hook error strings leaking untranslated to EN/MS users via the
  fallthrough `else { toast.error(message) }`.

## Key insights
- Frontend catch block already maps `CATEGORY_NAME_DUPLICATE` / `CATEGORY_SLUG_DUPLICATE`
  (L310-315). Just add two more `else if` branches for the new sentinels.
- NO new translation strings needed — `toast.cycleError` and `toast.maxDepthError` already exist
  in both locales. This is pure wiring.

## Requirements
1. In the `saveCategoryAction` catch block (~L308-318), add:
   - `else if (message === 'CATEGORY_CYCLE_ERROR')` → `toast.error(t.dashboard.products.categories.toast.cycleError)`
   - `else if (message === 'CATEGORY_MAX_DEPTH_ERROR')` → `toast.error(t.dashboard.products.categories.toast.maxDepthError)`
2. Preserve existing `nameDuplicate`/`slugDuplicate` branches and the final generic fallback.

## Related code files
- Modify: `src/app/(dashboard)/products/categories/components/CategoryManager.tsx`
- Read-only: `src/i18n/locales/en.json`, `ms.json` (confirm key paths)

## Implementation steps
1. Confirm Phase 01 landed (sentinels emitted).
2. Add the two `else if` branches before the generic `else`.
3. Compile / typecheck (`t` path must resolve).

## Todo list
- [x] cycleError branch added (CATEGORY_CYCLE_ERROR → t.dashboard.products.categories.toast.cycleError)
- [x] maxDepthError branch added (CATEGORY_MAX_DEPTH_ERROR → t.dashboard.products.categories.toast.maxDepthError)
- [x] existing branches intact (nameDuplicate/slugDuplicate/parentTenantMismatch + fallback preserved)
- [x] typecheck clean (npx tsc --noEmit passes)

## Success criteria
- Triggering a cycle/depth error shows the localized toast in EN/MS, not the raw VN string.
- No regression to name/slug duplicate handling.

## Risk assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Sentinel string mismatch with Phase 01 | Low×Med | copy exact constant from Phase 01 diff |
| i18n key path typo | Low×Low | typecheck against `t` type |

## Security considerations
- None (client-side UX/i18n).

## Next steps
- Feeds Phase 05 (frontend behavior) and Phase 06 review.
