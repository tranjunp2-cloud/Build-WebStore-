# Phase 02 — Delete Integrity (#10)

**PR:** 1 · **Migration:** No · **Priority:** P1 · **Status:** pending

## Context

- Current `deleteCategoryAction` — `src/app/(dashboard)/products/categories/actions.ts:106-124` — ONLY sets `deletedAt`. It does NOT touch children or products. The delete modal (`CategoryManager.tsx:638-673`) *claims* "children will be unlinked" but no code does it.
- Product↔category link lives in `products_rels` (path `category`), counted via SQL in `getCategoriesAction` (`actions.ts:33-49`).

## Overview

On delete: (a) re-parent all **direct** children to top-level (`parent = null`); (b) **hard-block** deletion if the category has products assigned **directly** to it (count > 0) with a user-facing error the UI shows in the delete modal.

## Key Insights

- "Directly assigned" chosen over recursive: the current `getCategoriesAction` productCount is **recursive** (includes descendants). For the hard-block we need a **direct-only** count — because after re-parenting children to top-level, descendant products are no longer under this node. Compute direct count fresh in the action (do not reuse the recursive UI count). **Decision: block on directly-assigned products only. [CONFIRMED by user 2026-07-10 — direct-only, NOT recursive.]**
- Re-parent must happen only when we're NOT blocking (i.e. re-parent children, then check own products, then soft-delete). Order matters: children first, then block-check on self, then soft-delete self. If blocked, children already re-parented — acceptable (they'd be re-parented on a later successful delete anyway) BUT to avoid surprise, do block-check FIRST, then re-parent, then soft-delete.
- Only DIRECT children re-parent to top-level (grandchildren stay under the re-parented children — tree depth shrinks by one for that subtree; still ≤3 levels since we removed a level).

## Requirements

- Functional:
  - If direct product count > 0 → throw error, no mutation.
  - Else → set each direct child's `parent = null`, then soft-delete the category.
- i18n: new error key EN + MS shown in delete modal.

## Architecture / Data Flow

```
deleteCategoryAction(id):
  user auth
  directCount = COUNT(DISTINCT parent_id) FROM products_rels r
                JOIN products p ON p.id=r.parent_id
                WHERE r.path='category' AND r.categories_id=id AND p.deleted_at IS NULL
  if directCount > 0: throw Error('CATEGORY_HAS_PRODUCTS:' + directCount)   // structured for UI
  update all children where parent=id -> parent=null
  update self -> deletedAt=now()
```

## Related Code Files

**Modify:**
- `src/app/(dashboard)/products/categories/actions.ts` — rewrite `deleteCategoryAction` (add direct-count SQL + children re-parent). Keep ≤200 lines; extract count helper if needed.
- `src/app/(dashboard)/products/categories/components/CategoryManager.tsx` — `handleDelete` (lines 255-270): parse thrown error, show blocking message with product count in modal instead of generic toast; update delete-modal copy (lines 657-664) to reflect "children move to top level" (not "unlinked from tree").
- `src/i18n/locales/en.json` — add key under `dashboard.products.categories.deleteModal` (near line 2018-2035): `hasProductsError` = "Cannot delete this category. There are {count} products still assigned to it. Please reassign your products first."
- `src/i18n/locales/ms.json` — same key, MS translation.

**Read for context:** `actions.ts:33-49` (count SQL pattern), `CategoryManager.tsx:638-673` (delete modal).

**No migration, no delete.**

## Implementation Steps

1. In `deleteCategoryAction`, after auth + `getPayload`, run direct-count Drizzle SQL (reuse `import { sql }` pattern from `getCategoriesAction`), tenant-safe (join products, `p.deleted_at IS NULL`, `r.categories_id = id`, `r.path='category'`).
2. If count > 0 → `throw new Error(\`CATEGORY_HAS_PRODUCTS:${count}\`)`.
3. Re-parent children: `payload.update` each, or a single Drizzle `UPDATE categories SET parent_id=NULL WHERE parent_id=$id AND deleted_at IS NULL`. Prefer payload API for hook consistency (breadcrumbs regen); if perf matters use raw SQL + note breadcrumbs will be stale until next edit — **decision: use payload.update per child** so breadcrumbs regenerate (child count is small, ≤ a handful).
4. Soft-delete self (existing update).
5. UI `handleDelete`: catch error, if `message.startsWith('CATEGORY_HAS_PRODUCTS:')` extract count → `toast.error(t...hasProductsError.replace('{count}', count))` and keep modal open; else generic deleteError.
6. Update modal warning copy + i18n `subCategoryWarning` → "child categories will be moved to the top level".

## Todo

- [ ] Direct-count SQL in `deleteCategoryAction`
- [ ] Hard-block throw with structured message
- [ ] Re-parent direct children via payload.update (breadcrumbs regen)
- [ ] Soft-delete self after checks
- [ ] UI parse error + count-aware toast, keep modal open
- [ ] i18n `hasProductsError` EN + MS; update `subCategoryWarning` copy EN + MS

## Success Criteria

- Deleting a category with ≥1 directly-assigned product → no DB change, modal shows count message.
- Deleting a category with children but 0 direct products → children become top-level (parent null, breadcrumbs = own name), category soft-deleted.
- Grandchildren remain attached to their (now top-level) parent.

## Risk Assessment

| Risk | L×I | Mitigation |
|------|-----|-----------|
| Recursive vs direct count ambiguity | Med×Med | Explicit decision: block on DIRECT only; documented + tested |
| Partial mutation if error between re-parent and soft-delete | Low×Med | Block-check BEFORE any mutation; re-parent + soft-delete both payload calls, wrap in try and surface failure |
| Breadcrumb staleness if raw SQL used | Low×Low | Use payload.update per child to trigger `beforeChange` breadcrumb regen |

## Security

- `overrideAccess: false` retained → tenant access rules enforced. Count SQL must scope to the category's tenant (join already ties products→category tenant contextually; category id is tenant-owned via access layer).

## Next Steps

- Docs Phase 06 updates QA TC-05-06 (reassign) to reflect hard-block behavior.
