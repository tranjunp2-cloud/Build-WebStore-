# Phase 02 — Backend actions: set + clear `aiReviewPending`

## Context Links
- Scout §Backend — API & Actions
- `src/app/(dashboard)/products/actions.ts` — `saveProductAction` L111-217, `updateProductFieldAction` L224-293
- `src/components/dashboard/BulkCreateModal.tsx` — `buildSavePayload` L77-152, `handleSave` L231-321
- Test harness reference: `src/__tests__/unit/actions/save-product-action.test.ts` (already mocks both actions)

## Overview
- **Priority:** Blocker
- **Status:** completed
- Three edits define the flag lifecycle: (a) SET `true` on bulk create, (b) CLEAR on manual save, (c) CLEAR on activate. Plus remove `router.refresh()`.
- **Blocked by:** Phase 01 (column must exist).

## Key Insights
- `buildSavePayload` is a pure function → the SET is trivial and unit-testable (Phase 06).
- Bulk create calls `saveProductAction(payload)` **without** `id` (create path). Manual edits call it **with** `id` (update path L165-173). So: create path receives `aiReviewPending:true` from payload; update path force-sets `false`. This cleanly separates "born from AI" vs "human touched it".
- `updateProductFieldAction` only handles `{status}` / `{deletedAt}` toggles. Simplest correct clear: when `validated.status === 'active'`, add `aiReviewPending:false` to the update `data`. No zod-union change needed (we set server-side, don't accept it as input → KISS + avoids widening the input contract).
- `updateProductFieldAction` uses `overrideAccess:true` and passes explicit `data` incl. stripped variants → adding one more key is safe.

## Data Flow
```
Bulk create:  BulkCreateModal.buildSavePayload → {..., aiReviewPending:true}
              → saveProductAction(payload)  [no id → create]  → DB row flagged true

Manual edit:  ProductForm → saveProductAction(data, id)  [update path]
              → force data.aiReviewPending=false → DB row cleared

Activate:     list Switch → updateProductFieldAction(id, {status:'active'})
              → data includes aiReviewPending:false → DB row cleared
Archive/draft toggle: status !== 'active' → flag untouched (intentional)
```

## Requirements
- Bulk-created drafts persist `aiReviewPending = true`.
- Any manual save via `saveProductAction(_, id)` clears it.
- Transition to `active` clears it; transitions to `archived`/`draft` do NOT.
- No page reload triggered from the modal save path.

## Related Code Files
- **Modify** `src/components/dashboard/BulkCreateModal.tsx`:
  - `buildSavePayload` return object (~L123-151): add `aiReviewPending: true`.
  - `handleSave` (~L309): remove `router.refresh()`.
  - Remove now-unused `useRouter` import (L8) + `const router = useRouter()` (L155) **only if** no other usage remains (grep first — `router` appears only at L155/L309).
- **Modify** `src/app/(dashboard)/products/actions.ts`:
  - `saveProductAction` update branch (L165-173): before `payload.update`, set `(data as Record<string, unknown>).aiReviewPending = false`.
  - `updateProductFieldAction` (L282-291): in the `data` object, spread `...(validated.status === 'active' ? { aiReviewPending: false } : {})`.

## Implementation Steps
1. `buildSavePayload`: add `aiReviewPending: true,` to returned object.
2. In `handleSave`, delete `router.refresh()`; verify `onSuccess()` then `onClose()` remain.
3. Grep `router` in BulkCreateModal; if only the two removed sites, delete import + declaration.
4. `saveProductAction`: in `if (id)` branch, set `data.aiReviewPending = false` before update (typed via `Record<string,unknown>` cast like existing `tenant` assignment).
5. `updateProductFieldAction`: add conditional `aiReviewPending:false` into the `payload.update` `data` when status is active.
6. `npm run typecheck` + `npm run lint`.

## Todo List
- [x] `buildSavePayload` sets `aiReviewPending:true`
- [x] `router.refresh()` removed from `handleSave` (+ unused import cleaned)
- [x] `saveProductAction` update path clears flag
- [x] `updateProductFieldAction` clears flag on `status==='active'` only
- [x] typecheck + lint pass

## Success Criteria
- Creating via modal writes `ai_review_pending=true` (verify Phase 06 unit + manual DB check).
- Editing then saving a flagged product sets it `false`.
- Toggling Active sets it `false`; toggling to Archived leaves it unchanged.
- No `router.refresh` remains in `BulkCreateModal.tsx`.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Removing `router.refresh` breaks list update | Med | Med | Parent `onSuccess`→`loadProducts()` already re-fetches (Phase 05 adds tab switch); regression test in P6 |
| Clearing flag on every update path unintentionally (e.g. a future non-user update) | Low | Low | Update path is user-initiated save only; acceptable per issue AC |
| `updateProductFieldAction` `deletedAt` path accidentally clears flag | Low | Low | Guard is `status==='active'`; `deletedAt` branch has no `status` → skipped |
| Unused-import lint error after removing refresh | Med | Low | Step 3 grep + remove |

## Security Considerations
- No new input accepted from client for the flag (server sets it) → no injection surface.
- `updateProductFieldAction` retains subscription gate + tenant existence check unchanged.

## Next Steps
- Phase 05 consumes the persisted flag on the list. Phase 06 tests all three transitions + no-refresh.
