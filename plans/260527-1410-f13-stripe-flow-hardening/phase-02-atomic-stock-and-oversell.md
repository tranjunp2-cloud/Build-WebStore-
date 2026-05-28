# Phase 02 — Atomic stock decrement + oversell-review flag

**Priority:** P0 · **Sprint:** 1 · **Status:** planned · **Depends:** 01

## Problem (verified)

`decrementStock` does read-then-write, non-atomic (`src/app/api/webhooks/stripe/route.ts:491-532`). Concurrent webhook retries / concurrent paid orders can under-decrement or oversell. Stock is only *checked* (not reserved) at checkout creation (`build-order-items.ts:84`), so two buyers can both pass and both pay.

## Decision (locked)

Oversell after payment = **manual seller handling**, not auto-refund. Detect at decrement time → flag order → notify seller. Refund button (existing API) wired in Phase 07.

## Fix

1. **Atomic decrement** in `reconcile-order.ts` (replaces `decrementStock`):
   ```sql
   UPDATE products SET inventory = inventory - ${qty}
   WHERE id = ${id} AND inventory >= ${qty} RETURNING id
   ```
   - Row returned → decremented safely.
   - No row → insufficient stock at capture time = **oversell**.

2. **Oversell handling** (recommended field, pending plan.md confirm): add boolean `oversellReview` to Orders (default false). On oversell:
   - Set `oversellReview = true` (order stays `status='new'`, `paymentStatus='paid'` — money was captured).
   - Fire `SYSTEM_ALERT` notification to tenant owners: "Order #X paid but out of stock — review/refund".
   - Continue processing remaining items (flag once).

3. **Hook bypass check** — atomic SQL skips product hooks. Verify no low-stock/inventory afterChange hook is required; if so, replicate its effect or trigger separately.

## Schema

- New field `oversellReview` (boolean) on `orders` → DB column `oversell_review`.
- Add `ALTER TABLE orders ADD COLUMN IF NOT EXISTS oversell_review boolean DEFAULT false` to `scripts/db-setup.js` MIGRATIONS.
- Run `node scripts/check-migrations.js origin/staging`.

## Files

- Modify: `src/lib/payment/reconcile-order.ts` (atomic decrement + oversell branch)
- Modify: `src/collections/Orders.ts` (add `oversellReview` field + admin display)
- Modify: `scripts/db-setup.js` (migration)
- Read: `src/collections/Products.ts` (check inventory hooks)

## Todo

- [ ] Atomic `UPDATE products ... WHERE inventory >= qty RETURNING id`
- [ ] `oversellReview` field + migration + check-migrations pass
- [ ] Oversell → set flag + SYSTEM_ALERT to seller
- [ ] Verify no product inventory hook lost to SQL bypass
- [ ] Tests: concurrent decrement never goes negative; oversell sets flag + notifies (TC-F13.*)

## Success criteria

- N concurrent paid orders on stock=M never drive inventory below 0.
- The (M+1)th gets `oversellReview=true` + seller notified; order remains paid/new.

## Risks

- If product has inventory-dependent hooks, SQL bypass loses them — must verify (Products.ts).
- Decision note: using a flag vs `status='Oversell_Review'` — confirm per plan.md open note before coding.
