# Code Review — F33 Phase 2: Discount Form + Usage History

**Date:** 2026-06-01  
**Scope:** 9 files — discount create/edit form, delete dialog, usage history page + API  
**Score: 8.5 / 10**  
**Verdict: APPROVED WITH REQUIRED FIXES (2 high-priority items before merge)**

---

## Overall Assessment

The implementation is solid. Auth is correctly layered (middleware + withAuth + overrideAccess:false), sen/RM conversion is correct, dirty state is managed properly, and the code stays within the file-size budget. Two issues require fixes before merge: the back-button navigation silently discards dirty state without a confirmation prompt (UX regression against spec), and client-side search only filters the current page which makes the "No redemptions match" empty state misleading for paginated datasets.

---

## Critical Issues

None.

---

## High Priority

### H1 — Back button navigates without checking dirty state

**File:** `discount-form-header.tsx:36`

The `<ArrowLeft>` back button calls `router.push('/discounts')` unconditionally. The spec says "You have unsaved changes. Leave page?" — this is only enforced by the `beforeunload` browser event, which does NOT fire on SPA navigation via `router.push()`. A user clicks back, the form navigates away, and changes are silently lost.

The `dirty` prop is already passed to the header but is only used to render the yellow dirty bar — it is never checked before navigation.

**Fix:**
```tsx
// discount-form-header.tsx
onClick={() => {
    if (dirty && !window.confirm('You have unsaved changes. Leave page?')) return
    router.push('/discounts')
}}
```

Or, if a more polished flow is preferred, lift the dirty guard into `DiscountForm` and pass an `onBack` callback prop instead.

---

### H2 — Client-side search only filters the current page (misleading UX + incorrect count)

**File:** `discounts-usage-history-layout.tsx:49-57, 181`

The `filtered` memo filters only the 50 rows currently loaded. When the user types "SUMMER50", they see matching rows from the current page — but matching records on other pages are invisible. The footer then shows "Showing 2 of 5000 redemptions", which is actively misleading: the 5000 is the total dataset, not the search result count.

The spec says "Search by code or order # (debounced)" without specifying client-side only, but given the API supports neither search param nor the `?search=` param on `/api/v1/discounts/usage-history`, the intent was probably client-side for simplicity. The mismatch between `filtered.length` and `totalDocs` in the footer copy is the concrete bug.

**Fix (minimal):** When `search` is active, replace `totalDocs` in the footer with a note that matches only within the current page:

```tsx
<span>
    {search
        ? <>Showing <strong style={textMain}>{filtered.length}</strong> matches on this page</>
        : <>Showing <strong style={textMain}>{rows.length}</strong> of <strong style={textMain}>{totalDocs}</strong> redemptions</>
    }
</span>
```

**Fix (proper):** Add `?search=` param support to the usage-history API and pass it as a query param with debounce, resetting page to 1 on change. This is the correct solution if merchants accumulate many redemptions.

---

## Medium Priority

### M1 — `usageLimit` float passes client validation but fails silently at API

**File:** `discount-form.tsx:119`, `discount-form-fields.tsx:169`

The client validate() only checks `< 0`, not integer. A user entering `3.7` passes client validation, the API schema rejects it with `VALIDATION_ERROR` (Zod `z.number().int()`), and the form's catch block surfaces a generic "Failed to save" toast with no field highlight.

The `<input type="number" step="1">` already nudges the user toward integers, but a direct API call or copy-paste bypass can trigger this. The fix is either adding `Number.isInteger(Number(draft.usageLimit))` to `validate()`, or handling `VALIDATION_ERROR` in `handleSave` similarly to `DUPLICATE_CODE`.

---

### M2 — Pagination renders all page buttons without windowing

**File:** `discounts-usage-history-layout.tsx:194`

`Array.from({ length: totalPages }, ...)` renders one `<button>` per page. With PAGE_LIMIT=50 and a merchant with 5000 redemptions, this yields 100 buttons in the DOM. Not a crash but visually broken (buttons overflow or wrap unpredictably) and noticeably slow to render.

Apply a simple window: show first page, last page, current ±2, and ellipsis. This is standard and straightforward.

---

### M3 — Silent fetch error in usage history gives no user feedback

**File:** `discounts-usage-history-layout.tsx:45`

`.catch(() => {/* silent — empty state shown */})` means a 500 or 401 renders as "No redemptions yet" — the same empty state shown for a brand-new merchant. A network or auth failure looks identical to having no data.

**Fix:** Add an `error` state; on catch, render a distinguishable "Failed to load history. Retry?" UI element.

---

## Low Priority

### L1 — `toDateInput` applies UTC month/day, not Asia/Kuala_Lumpur

**File:** `discount-form.tsx:29-33`

`new Date(iso).getMonth()` uses the browser/server local date. If an ISO string stores `2026-06-01T00:00:00+08:00`, `new Date()` in UTC gives `2026-05-31`. The discrepancy is one calendar day and only occurs near midnight. The spec says "Normalized to start of day (Asia/Kuala_Lumpur)" — the date picker input likely round-trips cleanly for most cases, but the display on an edit load could be off by one day.

**Fix:** Use `Intl.DateTimeFormat` with `Asia/Kuala_Lumpur` and extract `year`/`month`/`day` parts instead of `d.getFullYear()`.

---

### L2 — `discount-delete-dialog.tsx` uses `<Dialog>` instead of `<AlertDialog>`

**File:** `discount-delete-dialog.tsx:1-11`

The phase spec says "shadcn AlertDialog". Using `Dialog` instead of `AlertDialog` means the ESC key closes it without calling `onCancel` reliably and screen readers don't announce it as an alert. `onOpenChange` handles the close callback, so behavior is mostly correct. Check that `AlertDialog` exists at `src/components/ui/alert-dialog.tsx` — if not present, the current Dialog implementation is an acceptable fallback. If present, prefer `AlertDialog`.

---

### L3 — `any` type cast in `[id]/page.tsx:21`

**File:** `discounts/[id]/page.tsx:21`

`let discount: any` loses type safety on the Payload document. Use the inferred return type from `payload.findByID` or a typed interface. Low risk since it is immediately mapped to `DiscountDoc`, but worth tightening.

---

## Positive Observations

- **sen/RM conversion is correct.** `Math.round(parseFloat(v) * 100)` handles floating-point imprecision correctly for all realistic RM values. Both storage path (form) and preview path (form-fields) use the same formula consistently.
- **Dirty state cleared before `router.push()`** on save and delete — no spurious `beforeunload` prompt on success.
- **`beforeunload` cleanup is correct** — the effect's cleanup function always removes the listener; no leak on unmount.
- **Tenant cannot be overridden by client** — `tenant` and `usageCount` are stripped explicitly in the PUT handler on top of collection-level `access.update: () => false` on `usageCount`.
- **Sort allowlist on list API** — `ALLOWED_SORT_FIELDS` prevents sort injection. Usage-history API uses hardcoded `-usedAt` (no client sort param) — correct.
- **parseInt NaN guard on API** — `parseInt(...) || 1` and `parseInt(...) || 20` correctly fall back for NaN/0 inputs.
- **`overrideAccess: false` everywhere** — consistent throughout all API handlers and the RSC server-side fetch.
- **No client-writable tenant field** — form payload builds only allowed fields; `site` field is not sent from the form (schema allows it server-side but form omits it).
- **File sizes respected** — all files are under 200 lines.
- **`force-dynamic` on all three page shells** — prevents stale caches on the edit/history pages.

---

## Required Actions Before Merge

1. **[H1] Fix back button dirty guard** — add `window.confirm` before `router.push('/discounts')` when `dirty`.
2. **[H2] Fix footer count copy when search is active** — show "X matches on this page" instead of "X of totalDocs".

## Recommended (Non-blocking)

3. [M1] Add integer validation for `usageLimit` in client `validate()`.
4. [M2] Window the page buttons to avoid 100+ DOM nodes.
5. [M3] Add error state in usage history layout instead of silent empty state.
6. [L1] Fix `toDateInput` to use `Asia/Kuala_Lumpur` for display.

---

## Unresolved Questions

- Does `AlertDialog` exist at `src/components/ui/alert-dialog.tsx`? If yes, prefer it over `Dialog` for the delete confirm (L2).
- Is server-side search on the usage-history API planned for a future phase, or is client-side-only search the accepted scope for S4?
