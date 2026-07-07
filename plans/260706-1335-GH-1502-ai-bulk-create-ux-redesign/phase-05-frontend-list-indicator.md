# Phase 05 — Frontend list: AI-review pulse dot + tooltip + auto-switch to Draft

## Context Links
- Scout §Frontend, §Reusable UI patterns
- `src/app/(dashboard)/products/page.tsx` — `Product` type L58-72, desktop row name L720-735, mobile card name L818-825, modal mount `onSuccess` L941-949, `filterStatus` L109, status Tabs L391-421
- Pattern to copy: `src/components/dashboard/MissingInfoIndicator.tsx` (tooltip + focusable trigger, renders null when N/A)
- Pulse pattern: `EditorToolbar.tsx:318/582` — `<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"/>`
- Tooltip: `src/components/ui/tooltip.tsx`

## Overview
- **Priority:** High
- **Status:** completed
- Show an emerald pulse dot + tooltip next to the name for products with `aiReviewPending`, in BOTH the desktop table row and the mobile card. After a successful bulk generate, auto-switch to the Draft tab without a full-page reload.
- **Blocked by:** Phase 01 (field), Phase 03 (tooltip i18n), Phase 04 (runs after, same file).

## Key Insights
- Two render sites for the name (desktop L724, mobile L822) → extract a tiny `AiReviewIndicator` component (DRY), mirroring `MissingInfoIndicator`. It renders `null` unless `aiReviewPending` truthy.
- `Product` type (L58) must gain `aiReviewPending?: boolean`. `getProductsAction` already returns it (depth:1, no field selection) once the column exists — no action change.
- Optimistic clear: `handleUpdateStatus` (L237-249) already optimistically flips `status`. When toggling to `active`, ALSO optimistically drop the dot: set `aiReviewPending:false` in the optimistic `setProducts` map so the dot disappears immediately (server clears it via Phase 02). On failure rollback, restore prior `aiReviewPending` too.
- Auto-switch tab: modal mount `onSuccess` (L941-949) currently `setAiPrompt(''); loadProducts()`. Add `setFilterStatus('draft')`. `loadProducts()` re-fetches (no reload); Tabs is fully controlled so the view switches. New drafts sort to top under existing `Latest` sort (createdAt desc) — verify default `sortBy==='Latest'`; if user changed sort, that's acceptable (out of scope to force-reset).
- `TooltipProvider`: `MissingInfoIndicator` is already used in these rows without a local provider → a provider exists higher in the tree (dashboard layout). Reuse the same assumption; if tooltip fails to show, wrap the indicator in `TooltipProvider` (check how MissingInfoIndicator's provider is satisfied first).

## Data Flow
```
DB aiReviewPending=true → getProductsAction → Product.aiReviewPending
  → AiReviewIndicator renders emerald pulse dot + tooltip beside name (desktop + mobile)
Toggle Active → optimistic setProducts (status=active, aiReviewPending=false) → dot vanishes
             → updateProductFieldAction clears server-side (Phase 02)
Bulk generate success → onSuccess: setAiPrompt(''); setFilterStatus('draft'); loadProducts()
  → list shows Draft tab, refetched, new flagged drafts on top
```

## Requirements
- Emerald pulse dot + tooltip ("Created by AI — needs review" / MS) beside name of flagged products, desktop + mobile.
- Dot disappears after Save-edit (server-cleared, reflected on next `loadProducts`) OR toggling Active (optimistic + server).
- After generate: switch to Draft tab, no full reload, new drafts on top.
- Accessible: focusable trigger with aria-label; `stopPropagation` so clicking the dot doesn't open quick-view.

## Related Code Files
- **Create** `src/components/dashboard/AiReviewIndicator.tsx` — props `{ pending?: boolean; t }`; returns null when not pending; emerald pulse dot inside Tooltip (copy MissingInfoIndicator structure; use `aiReviewTooltip` + `aiReviewAriaLabel`).
- **Modify** `src/app/(dashboard)/products/page.tsx`:
  - `Product` type L58: add `aiReviewPending?: boolean`.
  - Desktop row (~L723-728): render `<AiReviewIndicator pending={product.aiReviewPending} t={t} />` next to name (beside `MissingInfoIndicator`).
  - Mobile card (~L820-825): same.
  - `handleUpdateStatus` (L237-249): optimistic map also sets `aiReviewPending: newStatus === 'active' ? false : p.aiReviewPending`; rollback restores original.
  - Modal mount `onSuccess` (L941-949): add `setFilterStatus('draft')`.
  - Import `AiReviewIndicator`.

## Implementation Steps
1. Create `AiReviewIndicator.tsx` (emerald `h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400`, wrapped in focusable button + Tooltip; `onClick={e=>e.stopPropagation()}`).
2. Add `aiReviewPending?: boolean` to `Product` type.
3. Insert the indicator in both name blocks (desktop + mobile), adjacent to `MissingInfoIndicator`.
4. Extend `handleUpdateStatus` optimistic + rollback to include `aiReviewPending`.
5. Add `setFilterStatus('draft')` to modal `onSuccess`.
6. `npm run typecheck` + `npm run lint`; manual smoke: generate → Draft tab, dots visible; toggle Active → dot gone, no reload.

## Todo List
- [x] Create `AiReviewIndicator.tsx`
- [x] `Product` type gains `aiReviewPending?`
- [x] Dot+tooltip in desktop row and mobile card
- [x] `handleUpdateStatus` optimistic-clears dot on activate (+ rollback)
- [x] `onSuccess` adds `setFilterStatus('draft')`
- [x] typecheck + lint pass

## Success Criteria
- Flagged drafts show pulsing emerald dot + tooltip in both layouts.
- Activating a product removes its dot instantly (optimistic) and persists.
- Post-generate lands on Draft tab, new items on top, no full-page reload.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Tooltip has no Provider in tree → nothing shows | Med | Med | Confirm MissingInfoIndicator's provider source; wrap in `TooltipProvider` if needed |
| Dot click opens quick-view (row is clickable) | Med | Low | `stopPropagation` on trigger (matches MissingInfoIndicator) |
| Dot persists after manual edit until refetch | Low | Low | Server clears (P2); `loadProducts` on return to list refreshes; acceptable |
| User's non-Latest sort hides new drafts from top | Low | Low | Out of scope; drafts still present in Draft tab |
| Removing `router.refresh` (P2) leaves stale list | Low | Med | `onSuccess`→`loadProducts()` refetches; covered by P6 regression |

## Security Considerations
- Read-only display of a boolean; no user input. Trigger is a non-submitting button.

## Next Steps
- Phase 06 tests the indicator render + lifecycle and the no-reload/tab-switch behavior.
