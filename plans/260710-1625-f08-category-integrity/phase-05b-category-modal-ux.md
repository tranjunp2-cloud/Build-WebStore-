# Phase 05b — Category Modal UX (Contextual title, Parent auto-fill/disable, Dropdown hierarchy)

**PR:** 1 · **Migration:** No · **Priority:** P2 · **Status:** pending · **Depends:** Phase 03 (shares the parent `<Select>`)

## Context

- Added per user issue "Issue 1 · mục 2" (2026-07-10) — not in the original 10-phase plan.
- Modal today (`CategoryManager.tsx`):
  - Title only distinguishes New vs Edit — `formData.id ? editTitle : newTitle` (`:518`). No "Add Subcategory" variant.
  - Parent **is** auto-filled when opened from a row's `+` — `handleOpenForm(undefined, node.id)` sets `parent: overrideParentId` (`:188-214`, line 208). But the Parent `<Select>` stays **editable** (not disabled).
  - Parent `<Select>` (`:548-568`) lists options flat as `breadcrumbs || name`, no indentation, no L3 disabling, and (pre-Phase-03) does not exclude self/descendants.
- The row `+` button is already hidden at L3 (`renderNode` gates on `!isLevel3`, `:328`, `:365`) → "add subcategory" only ever originates from an L1/L2 node, so an auto-filled parent is always valid (child becomes L2/L3).

## Decision (2026-07-12): single add-subcategory affordance

Drop the inline **"+ Add subcategory"** row that currently renders under an expanded node in `CategoryManager.tsx` (`renderNode`, ~`:365-382`). Keep ONLY the row-level `+` icon button (title "Add Subcategory", hidden at L3) as the single, consistent affordance. Rationale: the two are redundant (same action); a category with zero children is a normal category (leaf), not a special "empty parent" state needing its own affordance. **Design leads code** — prototype already reflects this; PR-1 removes the inline row from the component.

## Overview

Three UX refinements on the Add/Edit modal, all in `CategoryManager.tsx` (+ i18n):
1. **Contextual title** — toolbar "Add Category" → "Add New Category"; row `+` → "Add Subcategory".
2. **Parent auto-fill + disable** — when opened from a row `+`, prefill Parent with that node AND disable the field (lock the intended flow). Toolbar/edit paths keep it editable.
3. **Dropdown hierarchy** — indent options by level (L1→L2→L3) and **disable any L3 node** as a parent option (its child would be L4 > max depth).

## Key Insights

- Needs a new modal-mode flag. Current `formData` has no notion of "subcategory mode". Add `isSubcategoryMode: boolean` (true only when `handleOpenForm(undefined, overrideParentId)` is called from a row `+`). Drives BOTH the title and the Parent-disabled state. Edit mode (`formData.id` set) keeps Parent editable.
- **Shares the parent `<Select>` with Phase 03** (which filters out self + descendants for cycle prevention). Indentation + L3-disable + descendant-exclusion all touch the same option-render loop → **implement together / land in same PR**, single edit to avoid churn. Sequence: Phase 03 first (self+descendant exclusion), then 05b layers indentation + L3-disable on the same map.
- Level is derivable: reuse the tree/level computation already in `CategoryManager` (`buildTree` assigns `level`) or `getCategoryDepth`. Build a flat `{id, name, level, isLeaf}` list for the Select instead of raw `categories`.
- Indentation for a shadcn `<SelectItem>`: prefix with non-breaking spaces or `paddingLeft` style by `level` (keep accessible — real text label unchanged for screen readers; use `style` padding, not fake spaces, where possible).

## Requirements

- Functional:
  - Title text reflects entry point (toolbar vs row `+`) and Edit.
  - Row `+` → Parent prefilled + disabled + points to that node.
  - Parent dropdown: options visually nested by level; L3 nodes shown but **not selectable** (disabled); self + descendants excluded (Phase 03).
- i18n: `newTitle` (exists), `editTitle` (exists), add `addSubcategoryTitle` EN + MS. (`addSubcategory` action label already exists.)

## Related Code Files

**Modify:**
- `src/app/(dashboard)/products/categories/components/CategoryManager.tsx`
  - `formData` type + `handleOpenForm` (`:112-214`): add `isSubcategoryMode` (set true only in the row-`+` branch, i.e. `!cat && overrideParentId` from a node). Reset false on toolbar/edit.
  - Modal title (`:517-519`): `formData.id ? editTitle : (isSubcategoryMode ? addSubcategoryTitle : newTitle)`.
  - Parent `<Select>` (`:548-568`): add `disabled={isSubcategoryMode}`; build level-annotated option list; indent by level; `disabled` on `<SelectItem>` for L3 nodes; keep Phase-03 self/descendant exclusion.
- `src/i18n/locales/en.json` / `ms.json` — `dashboard.products.categories.form.addSubcategoryTitle` = "Add Subcategory" / MS equivalent.

**Read for context:** `CategoryManager.tsx:70-83` (level/depth helper), `:153-178` (buildTree levels), Phase 03 changes to the same `<Select>`.

**No migration, no delete.**

## Implementation Steps

1. Add `isSubcategoryMode` to `formData` state; set in `handleOpenForm`: `true` only when `!cat && overrideParentId` originated from a row `+` (the two call sites at `:331` and `:373`). Toolbar `handleOpenForm()` and edit `handleOpenForm(cat)` → false.
2. Title expression: New / Edit / Add Subcategory.
3. Parent `<Select>`: `disabled={isSubcategoryMode}`. When disabled, still show the prefilled parent label (SelectValue reads current `formData.parent`).
4. Build option list with `level` + `isLeaf` (reuse existing level logic); render `<SelectItem>` with left padding by level; set `disabled` when `level >= 3`.
5. Merge with Phase 03: exclude `self` + descendants from the list (same filter). Confirm no double-implementation of the Select.
6. i18n `addSubcategoryTitle` EN + MS.

## Todo

- [ ] `isSubcategoryMode` flag in formData + handleOpenForm (row-`+` only)
- [ ] Contextual title (New / Edit / Add Subcategory)
- [ ] Parent field disabled in subcategory mode (prefilled)
- [ ] Parent dropdown: indent by level
- [ ] Parent dropdown: disable L3 options
- [ ] Reconcile with Phase 03 self+descendant exclusion (single Select edit)
- [ ] i18n `addSubcategoryTitle` EN + MS

## Success Criteria

- Toolbar "Add Category" → modal title "Add New Category", Parent editable (default None).
- Row `+` → title "Add Subcategory", Parent = that node, field disabled.
- Edit → title "Edit Category", Parent editable.
- Parent dropdown shows nested indentation; L3 nodes visible but unselectable; self + descendants of the edited node absent.

## Risk Assessment

| Risk | L×I | Mitigation |
|------|-----|-----------|
| Two phases (03 + 05b) edit same `<Select>` → merge conflict / double logic | Med×Med | Same PR, same agent, sequential: Phase 03 then 05b on one edit |
| Disabled Parent hides a legitimate re-parent need | Low×Low | Only disabled in subcategory-create mode; Edit keeps it editable |
| Indentation via fake spaces breaks a11y | Low×Low | Use `style` padding / keep text label intact |

## Security

- None. Pure client UX; backend depth + cycle guards (Phase 03) remain authoritative.

## Next Steps

- Phase 06 docs: capture the modal UX behavior in the F08 UI spec.
- Phase 07 tests: optional RTL test for contextual title + disabled parent.
