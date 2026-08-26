# Phase 03 — Cycle Prevention (#11)

**PR:** 1 · **Migration:** No · **Priority:** P1 · **Status:** done

## Context

- Current guards are weak: `Categories.ts` field `parent.filterOptions` (`:171-176`) only excludes the node itself (`id not_equals`), NOT descendants. `beforeValidate` hook (`:71-94`) only checks depth, not cycles. Client `getCategoryDepth` (`CategoryManager.tsx:70-83`) would infinite-loop if a cycle already existed.
- Setting a category's parent to one of its own descendants creates a cycle (A→B→A), breaking tree build, breadcrumbs, and productCount recursion.

## Overview

Add `isDescendant(candidateParentId, currentId)` check. Reject on the **backend** (authoritative) when the chosen parent is the node itself or any descendant of it. Keep a client-side guard for instant feedback.

## Key Insights

- Backend check belongs in `saveCategoryAction` (has payload + can walk the tree) OR the `beforeValidate` hook. **Decision: put it in `beforeValidate`** so it protects ALL write paths (admin panel, API, bulk import), not just the dashboard action. The existing depth check is already there — extend the same hook.
- Walk UPWARD from candidate parent is wrong for cycle detection; must walk DOWNWARD from `currentId` collecting descendants, OR walk upward from candidate parent to root checking if `currentId` appears. Walking UP from parent to root is O(depth ≤ 3) and cheaper — if we hit `currentId` on the way up, it's a cycle. Use that.
- Only relevant on `update` when `data.parent` is set and an `id` exists. On `create` there's no existing node so no cycle possible.

## Requirements

- Functional: reject setting `parent` to self or any descendant → throw Validation Error with clear message.
- Keep depth≤3 check intact.
- Client guard prevents obvious self-select and shows toast; backend is source of truth.

## Architecture / Data Flow

```
beforeValidate (update, data.parent set, has id):
  walk candidate = data.parent
  loop (max depth guard e.g. 5 to avoid infinite loop on pre-existing bad data):
    if candidate === self.id  -> throw 'CATEGORY_CYCLE'
    candidate = parent(candidate)
    if !candidate break
```

## Related Code Files

**Modify:**
- `src/collections/Categories.ts` — extend `beforeValidate` hook (`:71-94`): after depth logic, add upward walk cycle check using `operation === 'update'` + the doc `id`. Payload passes `originalDoc`/`id` in hook args — use `originalDoc?.id` or the `id` from args.
- `src/app/(dashboard)/products/categories/components/CategoryManager.tsx` — `handleSave` (`:216-253`): add client `isDescendant` guard before save; also fix the parent `<Select>` (`:560-566`) to exclude descendants of the edited node (not just self), preventing bad selection up-front. Add a small `isDescendant` helper near `getCategoryDepth` (`:70-83`).
- `src/i18n/locales/en.json` / `ms.json` — new `dashboard.products.categories.toast.cycleError` = "Cannot set a category as a child of its own subcategory."

**Read for context:** `Categories.ts:71-94` (existing hook, depth walk pattern), `CategoryManager.tsx:70-83`.

> **Coordinate with Phase 05b:** the parent `<Select>` (`:548-568`) is also edited by 05b (indentation + L3-disable). Do Phase 03's self+descendant exclusion FIRST, then 05b layers on the same option list — one combined edit, same agent, to avoid churn.

**No migration, no delete.**

## Implementation Steps

1. In `beforeValidate`, capture `self.id` from hook args (`originalDoc?.id` on update). If `operation==='update' && data?.parent && selfId`:
   - `if (String(data.parent) === String(selfId)) throw new Error('Không thể đặt danh mục làm cha của chính nó')`.
   - Walk upward from `data.parent`, capped at 5 iterations, `findByID` each parent; if any equals `selfId` → throw cycle error.
2. Reuse the existing `findByID` calls already in the hook where possible to avoid extra queries (the depth walk already loads ancestors — merge the two walks into one loop that checks BOTH depth≥3 AND cycle).
3. Client: add `isDescendant(candidateId, selfId, flatList)` mirroring the tree walk; in `handleSave` if selecting a descendant → `toast.error(cycleError)` return. Filter the parent Select options to exclude self + descendants.
4. i18n key EN + MS.

## Todo

- [x] Merge cycle check into `beforeValidate` upward walk (capped iterations)
- [x] Throw on self-parent and descendant-parent
- [x] Client `isDescendant` helper + guard in `handleSave`
- [x] Filter parent Select to exclude self + descendants
- [x] i18n `cycleError` EN + MS

## Phase 05b Coordination Note

Phase 05b will layer indentation and L3-disable logic onto the parent `<Select>` in `CategoryManager.tsx`. The descendant-exclusion filter added in this phase (`.filter(c => !formData.id || !isDescendant(c.id, formData.id, categories))`) is already in place. When Phase 05b runs, extend that filter rather than replace it to preserve cycle prevention.

## Success Criteria

- Setting parent = self → rejected (backend + client).
- Setting parent = a descendant → rejected with cycleError.
- Setting parent = unrelated category or null → allowed.
- Depth≤3 still enforced; no regression in existing `categories-hooks.test.ts`.

## Risk Assessment

| Risk | L×I | Mitigation |
|------|-----|-----------|
| Pre-existing cyclic data → infinite loop in walk | Low×High | Hard iteration cap (5) in both server + client walks |
| Hook `id` unavailable on update | Low×Med | Read from `originalDoc?.id`; verify Payload 3 hook args signature |
| Extra DB reads per save | Low×Low | Merge cycle + depth walk into single ancestor traversal |

## Security

- No new surface. Enforces structural integrity for all tenants; hook runs under existing access rules.

## Next Steps

- Phase 07 adds unit tests for `isDescendant` + hook cycle rejection.
