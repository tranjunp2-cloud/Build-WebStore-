# GH-1579: Pagination Hide (≤10 rows) + Rows-per-Page Chevron

**Date**: 2026-07-13 10:51  
**Severity**: Medium  
**Component**: Table pagination (dashboard)  
**Status**: Resolved (awaiting visual sign-off)

## What Happened

Implemented pagination hide when total ≤ 10 rows. Added ChevronDown icon to rows-per-page select. Gated 11 dashboard callers with `shouldShowTablePagination()` helper to avoid rendering wrapper divs that stay truthy when child is null. Code review found critical regression (page state stranded on row deletion), fixed with `useTablePageClamp()` hook clamping page index to valid range. Re-review: 9.5/10, 0 critical. All tests pass. Awaiting user browser visual check (light/dark) per project convention.

## The Brutal Truth

Regression felt obvious in hindsight: deleting rows on page 2+ down to total ≤10 meant pagination hid but page state stayed at `page=2` — table rendered zero rows (no data for that page), user saw blank. No visual feedback, no recovery. The code-reviewer caught it immediately; I'd shipped the logic without testing the delete-while-paging flow. This was preventable with proper test coverage before code review.

## Technical Details

**File changes**: `src/components/ui/table-pagination.tsx` + 11 gated callers (products, orders, customers list + detail-orders-tab, contact-leads table + card, discounts list + usage-history, blog, staff, categories) + contact-leads client layout (clamp only)

**Key addition — useTablePageClamp hook**:
```ts
useTablePageClamp(page, total, limit, onPageChange, enabled)
```
Wired into 7 mutation-capable callers. Triggers `onPageChange(lastValidPage)` when `page > Math.max(1, Math.ceil(total / limit))`. Protects against stranded state.

**Guard logic**: `total > 10` (rejected `|| totalPages <= 1`; conflicts with AC at limit=25 & total=20).

**ChevronDown icon**: lucide-react `<ChevronDown />` in rows select wrapper, `pointer-events-none`, `--dash-text-muted` token. Relative positioned, no layout impact.

**Rows options unchanged**: [10,25,50,100] per GH-1290 PM decision.

## What We Tried

1. ✅ Initial implementation: pagination hide + gated wrapper divs (code-review 8.5/10)
   - **Regression found**: page state not clamped on row deletion
2. ✅ Added useTablePageClamp hook to 6 delete-capable callers
   - products, staff, categories (local slice, unguarded)
   - blog, contact-leads, discounts (gated `!loading`)
   - discounts is URL-driven (?page=N), guard prevents clobbering deep links during initial fetch
3. ✅ Re-review: 9.5/10, 0 critical
4. ✅ Tests: TC-DS1222-05-06 updated; 05-07..10 new; 10,098 tests green ×2; typecheck clean

## Root Cause

Pagination component logic (hide at ≤10) was correct in isolation. But we didn't model the delete-while-paging user flow: delete last row on page 2 → total drops to 8 → pagination hides → page state `=== 2` is now invalid (max page is 1). React doesn't signal "this page is no longer valid" to parent. Caller must detect and clamp. We initially skipped that step.

## Lessons Learned

1. **Test stateful user flows end-to-end**: Delete-while-paging should have a test case before code review. Mutation + pagination interaction is a common source of stranded state.
2. **Page state is shared responsibility**: Component can hide itself, but only caller owns page validity. Explicit helper function (`useTablePageClamp`) makes this contract visible.
3. **Guard logic needs a canonical check**: `total > 10` lives in only one place (the hook export); all callers reference it. Easier to update later if threshold changes.

## Next Steps

1. User visual sign-off (light/dark) on chevron icon + hidden pager states
2. Commit + PR to staging
3. QA spot-check delete flows on products, blog, discounts
4. Note for future: consider exposing threshold as configurable if more tables adopt different limits

## Adversarial Review Round (post-PR)

`/code-review #1594` red-team pass found 3 major gaps in the clamp wiring itself: (1) discounts delete never updated `total` → clamp dead on that path; (2) contact-leads mutated `total` before awaiting the DELETE → clamp-triggered refetch could race it and resurrect the deleted row; (3) orders was skipped but bulk status-change + status filter shrinks the dataset the same way. All three fixed: totals now mutate only after server commit, orders got the clamp. Lesson: "no row deletion UI" was the wrong test — any server-confirmed mutation that shrinks the filtered dataset counts.

**Decisions deferred**: Studio bespoke pagers out of scope. Threshold stays at 10 (revisit if support requests spike). Customers-detail-orders-tab shows a single-page bar for totals 11–25 (fixed limit 25, no rows selector) — documented tradeoff, PM call if it should hide.
