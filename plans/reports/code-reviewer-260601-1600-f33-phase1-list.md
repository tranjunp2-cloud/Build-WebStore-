# Code Review — F33 Phase 1: Discount List

**Date:** 2026-06-01  
**Scope:** 9 files (7 new, 2 modified)  
**LOC:** ~700 (format.ts 18, page.tsx 19, layout 211, toolbar 182, table 198, status-badge 24, usage-meter 49, Sidebar/EditorMenuDrawer nav additions)

---

## Overall Assessment

Solid implementation. Stale-fetch guard is correct, optimistic delete rolls back cleanly, debounce is properly implemented, and no PII/secrets are logged. Two issues require fixes before merge: a client-side type filter that corrupts pagination counts, and unvalidated `sort`/`limit` parameters in the API that can produce `NaN` or send arbitrary field names to Drizzle.

---

## Critical Issues

None.

---

## High Priority

### 1. Type filter produces broken pagination (correctness)

**File:** `discounts-client-layout.tsx` lines 55–62

The `typeFilter` is applied client-side after the API returns a full page of 20 docs. When a page happens to contain no items of the selected type, the table shows 0 results while the pagination control still shows `totalPages` from the unfiltered API response. The user sees "Page 1 of 4 · 80 total" but 0 rows — or navigates to page 2 and gets results, leaving page 1 visually empty.

The root cause: `typeFilter` is in the `useCallback` dependency array, so it triggers a re-fetch on change, but the API call does not pass `?type=` — the filter only cuts the already-returned 20 docs. `total` is set from `json.totalDocs` (unfiltered), not from `filtered.length`.

**Fix options (pick one):**
- Add `?type=` support to `GET /api/v1/discounts` (preferred — makes counts accurate server-side). In the route, add `if (typeFilter && typeFilter !== 'all') where.type = { equals: typeFilter }`.
- Or: set `setTotal(filtered.length)` and hide pagination when `typeFilter !== 'all'` (acceptable stopgap, but degrades UX for large datasets).

### 2. Unvalidated `sort` parameter passed to Payload/Drizzle

**File:** `src/app/api/v1/discounts/route.ts` line 22

```ts
const sort = url.searchParams.get('sort') || '-createdAt'
// passed directly to payload.find({ sort })
```

Any string (including `-__proto__`, internal field names, or future sensitive columns) is forwarded to Payload's sort clause. Compare: `src/app/api/storefront/products/route.ts` uses `ALLOWED_SORT = new Set(...)` and falls back to `-createdAt` on unknown values — that pattern should be applied here.

The UI only sends known sort keys, so this is not currently exploitable from the dashboard. However, the API is callable directly by any authenticated tenant user via `curl`.

**Fix:**
```ts
const ALLOWED_SORT = new Set([
    'code', '-code', 'type', '-type', 'value', '-value',
    'usageCount', '-usageCount', 'expiresAt', '-expiresAt',
    'createdAt', '-createdAt',
])
const sortRaw = url.searchParams.get('sort') || '-createdAt'
const sort = ALLOWED_SORT.has(sortRaw) ? sortRaw : '-createdAt'
```

### 3. `parseInt` produces `NaN` for `limit` on malformed input

**File:** `src/app/api/v1/discounts/route.ts` line 24

```ts
const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
```

`parseInt('abc')` returns `NaN`. `Math.min(NaN, 100)` returns `NaN`. Payload receives `limit: NaN`, which may default to 0 or throw depending on the Payload version — either returns no results or a 500. Compare: `storefront/products/route.ts` uses `parseInt(...) || 12` as a fallback.

**Fix:**
```ts
const pageRaw  = parseInt(url.searchParams.get('page')  || '1',  10)
const limitRaw = parseInt(url.searchParams.get('limit') || '20', 10)
const page  = isNaN(pageRaw)  || pageRaw  < 1 ? 1   : pageRaw
const limit = isNaN(limitRaw) || limitRaw < 1 ? 20  : Math.min(limitRaw, 100)
```

---

## Medium Priority

### 4. Optimistic delete restores at head-of-list on rollback

**File:** `discounts-client-layout.tsx` line 109

```ts
setDiscounts(prev => [discount, ...prev])
```

On error, the item is prepended rather than reinserted at its original index. It will appear at the top of the list until the user refreshes. Given this is a rare error path and the toast instructs the user to retry, this is low-impact — but worth noting.

**Fix:** Store the original index before removal and splice it back in at the same position, or simply call `load()` to re-fetch.

### 5. `fmtDate` renders `"Invalid Date"` for malformed strings

**File:** `src/lib/discounts/format.ts` line 12

`new Date('not-a-date')` returns an Invalid Date object. `toLocaleDateString()` returns the string `"Invalid Date"` rather than the em-dash fallback. This only fires if the DB stores a non-ISO string, which is unlikely but possible during data migration.

**Fix:**
```ts
export const fmtDate = (iso?: string | null) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-MY', {
        year: '2-digit', month: 'short', day: '2-digit', timeZone: 'Asia/Kuala_Lumpur',
    })
}
```

### 6. `handleSort` calls `setSortDir` inside `setSortBy` updater

**File:** `discounts-client-layout.tsx` lines 81–88

```ts
setSortBy(prev => {
    if (prev === key) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc')  // nested state call
        return prev
    }
    setSortDir('asc')
    return key
})
```

Calling `setSortDir` inside a `setSortBy` functional updater is a React anti-pattern. In React 18 concurrent mode, the inner `setSortDir` call is not guaranteed to be batched with the outer `setSortBy` in all edge cases (though in practice it works in the current scheduler). The cleaner pattern used elsewhere in the codebase is to derive both updates from the same handler and call each setter independently.

**Fix:**
```ts
const handleSort = useCallback((key: SortKey) => {
    setSortBy(prev => {
        if (prev !== key) setSortDir('asc')
        return key
    })
    setSortDir(prev => sortBy === key ? (prev === 'asc' ? 'desc' : 'asc') : 'asc')
    setPage(1)
}, [sortBy])
```
Or simpler: read `sortBy`/`sortDir` directly (they're in scope) and just call `setSortBy(key)` and `setSortDir(newDir)` unconditionally — `sortBy` is stable within the event handler.

---

## Low Priority

### 7. `discounts-client-layout.tsx` is 211 lines — just over the 200-line limit

The project rule is `< 200 lines`. At 211 it's a minor breach. The header block (lines 117–166) could be extracted to a `DiscountsHeader` component to bring it under limit, but this is cosmetic.

### 8. No delete confirmation before destructive action

The delete button fires `handleDelete` immediately without any confirmation prompt. Other parts of the dashboard (e.g., `CancelOrderModal`) use a confirmation modal for destructive actions. Discount codes may be shared with customers, so accidental deletion has real consequences. The phase spec says "confirm → DELETE" but the confirmation step was not implemented.

Recommend a simple `window.confirm()` or a shadcn `AlertDialog` before calling `handleDelete`.

### 9. `handleExport` uses `window.location.assign` — no loading feedback

If the export endpoint takes time (large tenant), the user sees nothing. This matches the spec intent, but a brief toast ("Preparing CSV…") would improve UX.

### 10. Missing `aria-label` on icon-only action buttons

The Edit and Delete buttons have `title` attributes (good for tooltips) but no `aria-label`. Screen readers announce the button content, which is empty for icon-only buttons. The Orders table includes `aria-label` on its action buttons.

---

## Edge Cases Found During Review

- **Type filter + pagination:** Already covered in High #1. If all 20 items on the current page are the wrong type, the user sees an empty page with pagination controls. Navigating "Next" may or may not show results.
- **`limit=NaN` to API:** `Math.min(NaN, 100) === NaN`. Covered in High #3.
- **Expired discount at `expiresAt` boundary:** `fmtDate` displays the date correctly; the `status` field is the authoritative active/inactive indicator so there's no runtime status inference in the UI. This is correct per spec.
- **Concurrent delete + reload:** If two tabs delete the same discount, the second DELETE returns 404. The error handler restores the item locally but the toast text `Failed to delete "${discount.code}"` is generic enough to not be misleading. Low risk, acceptable.
- **`handleSort` called while a fetch is in-flight:** The `genRef` guard correctly discards the stale response. No race condition.

---

## Positive Observations

- Stale-fetch guard (`genRef`) is correctly implemented — same battle-tested pattern as the customers layout.
- `credentials: 'include'` on every fetch — correct for session-cookie auth.
- Optimistic delete UX is clean: the item disappears immediately, toast shows on success, restores on failure.
- 400ms debounce on search — correct value, applied via cleanup ref pattern.
- Export uses `window.location.assign` which correctly carries session cookies without an XSS vector (no `innerHTML`).
- `overrideAccess: false` on all Payload operations — tenant isolation enforced at the ORM layer.
- `force-dynamic` on the RSC shell — prevents caching of authenticated list pages.
- No PII/secrets in client-side logs: `console.error('[Discounts load]', err)` and `[Discounts delete]` log the Error object (HTTP status), not user data.
- `fmtRM` and `fmtValue` are pure and importable from both RSC and client contexts (no `'use client'` marker) — correct.
- File sizes: all under 200 lines except `discounts-client-layout.tsx` at 211 (minor).

---

## Recommended Actions (Prioritized)

1. **[High]** Add `?type=` support to `GET /api/v1/discounts` — eliminates type-filter pagination corruption.
2. **[High]** Add `ALLOWED_SORT` set to `GET /api/v1/discounts` — follow the products route pattern.
3. **[High]** Fix `parseInt` NaN for `limit` param — add fallback guard.
4. **[Medium]** Guard `fmtDate` against `Invalid Date` — add `isNaN(d.getTime())` check.
5. **[Medium]** Add delete confirmation (at minimum `window.confirm`) before calling `handleDelete`.
6. **[Low]** Refactor `handleSort` to avoid calling `setSortDir` inside `setSortBy` updater.

---

## Score

**7.5 / 10**

Items 1–3 are correctness/security issues that should be fixed before merge. Item 1 in particular produces a visible bug (empty table row with active pagination) that will appear on any tenant with a mix of percentage and fixed discounts. The UI code quality is high; the issues are concentrated in the API layer and one data-flow design decision.

Not AUTO_APPROVE.
