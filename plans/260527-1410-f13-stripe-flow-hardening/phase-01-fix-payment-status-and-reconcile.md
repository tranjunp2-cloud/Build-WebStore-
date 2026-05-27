# Phase 01 — Fix `paymentStatus=paid` + extract `reconcileOrderPaid()`

**Priority:** P0 (blocker) · **Sprint:** 1 · **Status:** planned

## Problem (verified)

Stripe payment succeeds + webhook runs correctly, but `paymentStatus` never becomes `'paid'`:
- Webhook transitions status via **raw SQL** `UPDATE orders SET status='new'` → bypasses Payload hooks (`src/app/api/webhooks/stripe/route.ts:161-165`).
- Follow-up `payload.update` writes only `{ stripeSessionId, stripePaymentIntentId, paymentMethod }` — no `paymentStatus` (`route.ts:188-199`).
- Hook `updatePaymentStatus` only sets `paid` for COD-completed / `cancelled` (`src/collections/orders-hooks/update-payment-status.ts:15-31`).
- Confirm UI keys success off `order.paymentStatus === 'paid'` (`ConfirmClient.tsx:93,146`).

➡️ Confirm page can never show Stripe success. Root cause of the display problem.

## Fix

1. **Atomic transition sets both columns** — change the SQL to:
   ```sql
   UPDATE orders SET status='new', payment_status='paid'
   WHERE id = ${orderId} AND status='pending' RETURNING id
   ```
   Keeps single-winner idempotency; avoids the hook-bypass gap entirely (DB column is `payment_status`).

2. **Extract `reconcileOrderPaid(payload, orderId, session)`** into new module `src/lib/payment/reconcile-order.ts`:
   - Runs the atomic transition (returns early if no row = already processed/late delivery).
   - Records `stripeSessionId`, `stripePaymentIntentId` (method detection → Phase 03).
   - Decrements stock (Phase 02 swaps in atomic version).
   - Sends buyer confirmation email + seller email + `ORDER_NEW` notification.
   - Returns a small result `{ processed: boolean, oversell: boolean }`.
   - Idempotent + safe to call from webhook (now), confirm endpoint (Phase 05), cron (Phase 07).

3. **Webhook becomes a thin caller** — `handleCheckoutCompleted` just verifies/normalizes then calls `reconcileOrderPaid`. Keep handler ≤200 lines.

## Files

- Modify: `src/app/api/webhooks/stripe/route.ts` (slim `handleCheckoutCompleted`; move logic out)
- Create: `src/lib/payment/reconcile-order.ts` (shared logic, <200 lines)
- Read for context: `src/collections/Orders.ts` (status/paymentStatus enums), `src/lib/payment/types.ts`

## Implementation steps

1. Create `reconcile-order.ts`; move email/notify/stock helpers (or import them) so webhook + future callers share one path.
2. Update atomic SQL to set `payment_status='paid'` alongside `status='new'`.
3. Replace webhook body with `reconcileOrderPaid` call.
4. Manually verify against Stripe CLI test event → order shows `paymentStatus='paid'`, Confirm renders success.

## Todo

- [ ] Create `reconcile-order.ts` with idempotent `reconcileOrderPaid`
- [ ] SQL sets `status='new'` + `payment_status='paid'` atomically
- [ ] Webhook delegates to shared fn
- [ ] Buyer/seller emails + ORDER_NEW preserved (no double-send)
- [ ] Tests: TC-F13 webhook success → paymentStatus=paid; concurrent delivery → single process

## Success criteria

- Successful Stripe payment ⇒ order `status='new'` AND `paymentStatus='paid'`.
- Concurrent/duplicate webhook deliveries process exactly once.
- Confirm page (unchanged this phase) now resolves to the success branch.

## Risks

- Moving logic risks duplicate emails/notifications — keep them inside the single-winner block.
- Raw SQL still bypasses hooks for `paymentStatus`; acceptable since we set it explicitly. Audit no other hook must fire on paid transition.
