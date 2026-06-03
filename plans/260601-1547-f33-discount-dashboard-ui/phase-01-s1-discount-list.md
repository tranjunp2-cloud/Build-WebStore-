# Phase 1 — S1 Discount List Page

## Context Links

- Parent plan: `plans/260601-1547-f33-discount-dashboard-ui/plan.md`
- Design ref: `docs/design/f33/list-view.jsx`, `docs/design/F33-discount-cms-design.md` §6 S1
- Existing pattern: `src/app/(dashboard)/orders/` (RSC shell + `_components/` client layout)
- Existing pattern: `src/app/(dashboard)/customers/_components/customers-client-layout.tsx`
- Sidebar nav: `src/components/dashboard/Sidebar.tsx`
- API: `GET /api/v1/discounts`, `DELETE /api/v1/discounts/[id]`, `GET /api/v1/discounts/export`

## Overview

- **Priority:** P0
- **Status:** complete
- List page at `/discounts` with search, status/type filters, sortable table, Export CSV button, inline delete. Sidebar nav item added.

## Key Insights

- RSC shell (`page.tsx`) + `'use client'` layout component — exact same split as orders page.
- API returns `{ docs: Discount[], totalDocs, totalPages, page }` (standard Payload pagination shape).
- `value` is **sen** for fixed type, percent integer for percentage type — `fmtValue(type, value)` helper needed.
- Export button: `window.location.assign('/api/v1/discounts/export')` — browser navigation carries session cookie, no auth header needed.
- Delete: trash icon in ACTIONS column → confirm → `DELETE /api/v1/discounts/[id]`, toast on error.
- Edit: pencil icon in ACTIONS column → navigate to `/discounts/[id]`.
- Sidebar: use `permissionId: 'orders'` (discounts are commerce-adjacent; same role gate).
- `Percent` icon (lucide) for Discounts nav item.

## Visual Design (from screenshots)

**Code column:** Monospace chip (e.g. `MERDEKA`) + description text below in muted color.

**Type badge:**
- Fixed → teal/cyan badge with box icon: `Fixed`
- Percentage → purple badge with % icon: `Percentage`

**Usage column:**
- `count / limit` text + thin progress bar below
- Bar color: green < 80%, amber ≥ 80%, red = 100% + "AT LIMIT" chip
- No limit: `count / ∞ UNLIMITED` (no bar)

**Status badge:** `• Active` (green dot + text) / `• Inactive` (grey dot)

**Actions column:** pencil icon (edit) + trash icon (delete) — icon buttons, no text.

**Buttons top right:** "↓ Export CSV" (secondary) + "+ Create discount" (primary teal).

**Theme:** Dark dashboard (`bg-dash-bg`, `bg-dash-surface`) — matches existing dashboard pages.

## Requirements

**Functional**
- List shows: code (monospace chip), type badge, value, usage meter, expiresAt, status badge, delete action.
- Search by code/description (debounced 400ms).
- Filter by status (all / active / inactive) and type (all / percentage / fixed).
- Sort by code, type, value, usage, expiresAt — toggle asc/desc.
- Export CSV button above table → downloads via existing export endpoint.
- "New Discount" button → navigates to `/discounts/new`.
- Empty first-time state + no-results state.
- Pagination (20/page default).

**Non-functional**
- Each file < 200 lines; Tailwind + lucide-react; no new deps.
- `force-dynamic` on page (per-request auth).

## Architecture

```
(dashboard)/discounts/
├── page.tsx                         ← RSC shell, force-dynamic, Suspense wrapper
└── _components/
    ├── discounts-client-layout.tsx  ← 'use client', state + fetch + orchestration
    ├── discounts-toolbar.tsx        ← search input + filter chips + Export/New buttons
    ├── discounts-table.tsx          ← table + sort headers + row actions
    ├── discount-status-badge.tsx    ← green/slate badge (pure, RSC-safe)
    └── discount-usage-meter.tsx     ← count/limit text + progress bar

src/lib/discounts/format.ts          ← fmtRM, fmtValue, fmtDate (shared, no 'use client')
src/components/dashboard/Sidebar.tsx ← add Discounts nav item
```

## Related Code Files

**Create**
- `src/app/(dashboard)/discounts/page.tsx`
- `src/app/(dashboard)/discounts/_components/discounts-client-layout.tsx`
- `src/app/(dashboard)/discounts/_components/discounts-toolbar.tsx`
- `src/app/(dashboard)/discounts/_components/discounts-table.tsx`
- `src/app/(dashboard)/discounts/_components/discount-status-badge.tsx`
- `src/app/(dashboard)/discounts/_components/discount-usage-meter.tsx`
- `src/lib/discounts/format.ts`

**Modify**
- `src/components/dashboard/Sidebar.tsx` — add Discounts nav item with children after Orders
- `src/components/editor/EditorMenuDrawer.tsx` — same nav item in editor menu drawer

## Implementation Steps

1. **`src/lib/discounts/format.ts`** — pure helpers:
   ```ts
   export const fmtRM = (sen: number) => `RM ${(sen / 100).toFixed(2)}`
   export const fmtValue = (type: string, value: number) =>
     type === 'percentage' ? `${value}%` : fmtRM(value)
   export const fmtDate = (iso?: string | null) => {
     if (!iso) return '—'
     return new Date(iso).toLocaleDateString('en-MY', {
       year: '2-digit', month: 'short', day: '2-digit', timeZone: 'Asia/Kuala_Lumpur',
     })
   }
   ```

2. **`discount-status-badge.tsx`** — green/slate pill: `active` → `bg-green-100 text-green-700`, `inactive` → `bg-slate-100 text-slate-600`.

3. **`discount-usage-meter.tsx`** — `count / limit` text + thin progress bar; amber ≥80%, red at 100%; "∞ unlimited" when `limit == null`.

4. **`discounts-table.tsx`** — renders `<table>` with sortable `<th>` (matches `SortableTh` in design ref). Columns: code chip, type badge, value, usage meter, expiresAt, status badge, delete button. Row click → navigate to `/discounts/[id]`.

5. **`discounts-toolbar.tsx`** — search `<input>` + status filter chip + type filter chip + "Export CSV" button + "New Discount" button (navigates to `/discounts/new`).

6. **`discounts-client-layout.tsx`** — `'use client'`. State: search, statusFilter, typeFilter, sortBy, sortDir, page, discounts[], total, loading. Fetches `GET /api/v1/discounts` with query params on mount + filter change. Handles delete (optimistic remove + API call). Renders toolbar + table + pagination.

7. **`page.tsx`**:
   ```tsx
   export const dynamic = 'force-dynamic'
   export default function DiscountsPage() {
     return (
       <Suspense>
         <DiscountsClientLayout />
       </Suspense>
     )
   }
   ```

8. **`Sidebar.tsx`** — insert after the Orders item with children (matches screenshot: "Discount codes" + "Usage history"):
   ```ts
   {
     label: { en: 'Discounts', ms: 'Diskaun' },
     icon: Percent,
     href: '/discounts',
     permissionId: 'orders',
     children: [
       { label: { en: 'Discount codes', ms: 'Kod diskaun' }, href: '/discounts' },
       { label: { en: 'Usage history', ms: 'Sejarah penggunaan' }, href: '/discounts/usage-history' },
     ],
   },
   ```
   Add `Percent` to the lucide-react import.

9. **`EditorMenuDrawer.tsx`** — same nav item inserted after the Orders item in the `navItems` array (editor hamburger menu mirrors dashboard sidebar). Same children structure. Add `Percent` to lucide-react import.

10. **Compile check:** `npx tsc --noEmit` — fix any type errors.

## Todo List

- [x] Create `src/lib/discounts/format.ts`
- [x] Create `discount-status-badge.tsx`
- [x] Create `discount-usage-meter.tsx`
- [x] Create `discounts-table.tsx`
- [x] Create `discounts-toolbar.tsx`
- [x] Create `discounts-client-layout.tsx`
- [x] Create `(dashboard)/discounts/page.tsx`
- [x] Edit `Sidebar.tsx` — add Discounts nav item with children + Percent icon import
- [x] Edit `EditorMenuDrawer.tsx` — same nav item
- [x] Typecheck passes

## Success Criteria

- `/discounts` renders list with all columns.
- Search, filter, sort work client-side (API filtered).
- Export CSV button triggers download.
- "New Discount" button navigates to `/discounts/new` (page will 404 until Phase 2 — OK).
- Dashboard sidebar shows "Discounts" (expandable) with "Discount codes" + "Usage history" children between Orders and Customers.
- Editor menu drawer (`EditorMenuDrawer`) shows same "Discounts" item.
- No compile errors.

## Risk Assessment

| Risk | L×I | Mitigation |
|------|-----|-----------|
| Sidebar `permissionId: 'orders'` hides Discounts from viewers | L×M | Acceptable for now; can add separate `discounts` permission in follow-up |
| API pagination shape differs | L×L | Check `result.docs` / `result.totalDocs` vs actual response |

## Next Steps

- Phase 2 adds `/discounts/new` and `/discounts/[id]` (form + usage history).
