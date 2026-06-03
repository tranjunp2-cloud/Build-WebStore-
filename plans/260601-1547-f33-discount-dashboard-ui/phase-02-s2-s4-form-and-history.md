# Phase 2 — S2 Create/Edit Form + S4 Usage History

## Context Links

- Parent plan: `plans/260601-1547-f33-discount-dashboard-ui/plan.md`
- Design ref: `docs/design/f33/form-view.jsx`, `docs/design/f33/usage-history.jsx`
- API: `POST /api/v1/discounts`, `GET/PATCH/DELETE /api/v1/discounts/[id]`, `GET /api/v1/discounts/[id]/usage`
- S4 global usage: use `GET /api/v1/discounts/[id]/usage` per-discount, OR query `discount_usage_history` collection directly via new API endpoint if cross-discount list is needed
- Depends on: Phase 1 (shared `format.ts` already created)

## Overview

- **Priority:** P1
- **Status:** complete
- `/discounts/new` → create form. `/discounts/[id]` → edit form only. `/discounts/usage-history` → standalone S4 page (all usage history across all discounts, tenant-scoped). Delete on edit page.

## Key Insights

- Single `DiscountForm` component handles both create (no `discount` prop) and edit (receives `discount`).
- Client-side validation: code required, value range (percentage 0–100, fixed ≥0), start < expiry. Mirror the `validate()` function from `form-view.jsx`.
- Duplicate code → API returns `{ error: { code: 'DUPLICATE_CODE' } }` → show inline field error.
- Usage history is a read-only tab below the form on the edit page (S4). Not shown on create page.
- `usageCount` field is read-only (no edit). `usageCount > 0` → show a warning before delete ("X orders have used this code").
- Date fields: use `<input type="date">` locally, convert to ISO string for API. Display in `Asia/Kuala_Lumpur`.
- `value` field label + hint changes dynamically based on `type` selection ("Percentage 0–100" vs "Amount in RM, e.g. 25.00 = RM 25").
  - For fixed type: user enters **RM float** (e.g. `25.00`), UI converts `* 100` → sen for storage.
  - For percentage: user enters integer (e.g. `50`).
- Edit page: `force-dynamic` so latest data is always fetched server-side, then passed to client.

## Requirements

**Functional (S2)**
- Code field: auto-uppercased on blur; required.
- Type select: percentage / fixed. Changing type resets value field.
- Value field: number input; hint changes with type; fixed shows live RM preview from `fmtRM`.
- Status toggle: active / inactive (select or toggle).
- Usage limit: optional number (blank = unlimited).
- Starts At / Expires At: date inputs; start < expiry validated client-side.
- Save → POST (create) or PATCH (edit) → on success redirect to `/discounts`.
- Delete button (edit only) → confirm dialog → `DELETE /api/v1/discounts/[id]` → redirect to `/discounts`.
- Unsaved changes warning (dirty state) — "You have unsaved changes. Leave page?" browser confirm.

**Functional (S4 — standalone `/discounts/usage-history` page)**
- Separate page accessible from sidebar nav.
- Check if `GET /api/v1/discounts/usage-history` exists (cross-discount global list) — if not, add it before implementing UI.
- Columns: CODE chip, TYPE (e.g. "50%" or "RM 25.00"), AMOUNT APPLIED (green "-RM X.XX"), ORDER # (chip with ↗ link → `/orders?order=X`), CUSTOMER EMAIL, USED DATE.
- Search by code or order # (debounced).
- Sort by usedAt desc (default, no toggle needed per design).
- "Read-only" badge top right — no edit/delete actions.
- Empty state: "No redemptions yet".

**Visual Design (from screenshots):**
- Header: "Discount Usage History" + subtitle "Every code redemption, newest first. This log is immutable for audit..."
- "Read-only" badge: lock icon + text, top-right corner.
- Code chip: same monospace style as S1.
- Amount applied: green color (`text-green-400` or similar), prefixed with `−`.
- Order # chip: outlined box with `↗` external icon → navigate to `/orders?order={id}`.
- No ACTIONS column — read-only.

**Non-functional**
- Each file < 200 lines; split if needed.
- No new deps beyond lucide-react + shadcn components already in codebase.

## Architecture

```
(dashboard)/discounts/
├── new/
│   └── page.tsx                          ← RSC shell (force-dynamic)
├── [id]/
│   └── page.tsx                          ← RSC shell, fetches discount server-side
└── usage-history/
    └── page.tsx                          ← RSC shell (force-dynamic), S4 standalone page

(dashboard)/discounts/_components/
├── discount-form.tsx                     ← 'use client', create + edit
├── discount-form-header.tsx              ← back button + title + save/delete actions
├── discount-delete-dialog.tsx            ← confirm dialog before delete
└── discounts-usage-history-layout.tsx    ← 'use client', S4 full-page table + search
```

## Related Code Files

**Create**
- `src/app/(dashboard)/discounts/new/page.tsx`
- `src/app/(dashboard)/discounts/[id]/page.tsx`
- `src/app/(dashboard)/discounts/usage-history/page.tsx`
- `src/app/(dashboard)/discounts/_components/discount-form.tsx`
- `src/app/(dashboard)/discounts/_components/discount-form-header.tsx`
- `src/app/(dashboard)/discounts/_components/discount-delete-dialog.tsx`
- `src/app/(dashboard)/discounts/_components/discounts-usage-history-layout.tsx`

**Read only**
- `src/lib/discounts/format.ts` (from Phase 1)

## Implementation Steps

1. **`discount-form-header.tsx`** — back arrow + title ("New Discount" / "Edit {code}") + Save button (spinner on submit) + Delete button (edit only). Props: `isNew`, `code`, `saving`, `onSave`, `onDelete`.

2. **`discount-delete-dialog.tsx`** — shadcn `AlertDialog` confirmation: "Delete discount CODE? This cannot be undone." with usage count warning if `usageCount > 0`. Props: `code`, `usageCount`, `open`, `onConfirm`, `onCancel`.

3. **`discount-form.tsx`** — main form. Props: `discount?: DiscountDoc`. State mirrors `form-view.jsx` draft/errors pattern. Key behaviours:
   - Fixed type: `valueInput` is RM float (`"25.00"`), stored as `Math.round(parseFloat(input) * 100)` sen.
   - Percentage type: `valueInput` is integer string, stored as `parseInt(input)`.
   - Auto-uppercase code on blur.
   - On save: validate → call API → handle `DUPLICATE_CODE` → redirect.
   - Unsaved changes: attach `beforeunload` event when `dirty`.

4. **`discounts-usage-history-layout.tsx`** — `'use client'`. Fetches all usage history (check if `GET /api/v1/discounts/usage-history` exists — if not, need to add it to backend; fallback: query `discount_usage_history` collection via Payload REST). Search by code/order number. Renders table + empty state. Order # links to `/orders?order={orderId}`.

5. **`usage-history/page.tsx`**:
   ```tsx
   export const dynamic = 'force-dynamic'
   export default function UsageHistoryPage() {
     return (
       <Suspense>
         <DiscountsUsageHistoryLayout />
       </Suspense>
     )
   }
   ```

6. **`new/page.tsx`**:
   ```tsx
   export const dynamic = 'force-dynamic'
   export default function NewDiscountPage() {
     return <DiscountForm />
   }
   ```

6. **`[id]/page.tsx`** — RSC that fetches the discount server-side via `payload.findByID`, passes to `<DiscountForm discount={doc} />` and renders `<DiscountUsageHistory discountId={id} />` below as a section. Returns 404 if not found.

7. **Compile check:** `npx tsc --noEmit`.

## Todo List

- [x] Check if `GET /api/v1/discounts/usage-history` (global) exists; add if missing
- [x] Create `discount-form-header.tsx`
- [x] Create `discount-delete-dialog.tsx`
- [x] Create `discount-form.tsx`
- [x] Create `discounts-usage-history-layout.tsx`
- [x] Create `discounts/new/page.tsx`
- [x] Create `discounts/[id]/page.tsx`
- [x] Create `discounts/usage-history/page.tsx`
- [x] Typecheck passes

## Success Criteria

- `/discounts/new` renders blank form; submit creates discount → redirects to list.
- `/discounts/[id]` renders prefilled form; save PATCHes; delete with confirm removes + redirects.
- Duplicate code → inline error on code field.
- Fixed type: entering `25` shows preview "RM 25.00"; stored as 2500 sen.
- `/discounts/usage-history` shows all redemptions tenant-wide (search by code/order, sorted usedAt desc).
- Edit page (`/discounts/[id]`) is form-only — no usage history embedded.
- No compile errors; no DB migration needed.

## Risk Assessment

| Risk | L×I | Mitigation |
|------|-----|-----------|
| `[id]/page.tsx` needs Payload server-side fetch → requires auth | M×M | Use `getCurrentUser` + `payload.findByID` with `user` — same pattern as other RSC detail pages |
| `beforeunload` warning fires on programmatic navigate (save redirect) | L×L | Clear dirty state before calling `router.push()` |
| shadcn `AlertDialog` not in project yet | L×M | Check `src/components/ui/` — if missing, implement inline confirm with `window.confirm` as fallback |

## Security Considerations

- Server-side fetch in `[id]/page.tsx` passes authenticated `user` → Payload enforces tenant scope; no cross-tenant leak.
- Client form posts to `/api/v1/discounts` which uses `withAuth` + tenant extraction — client cannot override tenant.
