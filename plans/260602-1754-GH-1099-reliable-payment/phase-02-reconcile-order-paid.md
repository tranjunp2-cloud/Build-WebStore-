# Phase 02 — Extract reconcileOrderPaid() + refactor webhook

**Priority:** P1 | **Status:** pending | **AC:** AC-1 (preserve) | **TC:** TC-F13.143 | **Effort:** 4h
**Depends:** 01

## Overview
Extract the entire "order is now paid" logic from `checkout-completed.ts` into a shared, idempotent
`reconcileOrderPaid()`. Webhook (this phase), endpoint (04), cron (05) all call it. **Zero behavior change**
to the webhook path — AC-1 atomic single-winner stays exactly as-is. This is the keystone DRY refactor.

## Key insight
Source of idempotency = the atomic `UPDATE ... WHERE status='pending' RETURNING id`. If 0 rows → already
processed → return early WITHOUT decrementing stock, emailing, or notifying. This single guard makes
webhook+poll+cron safe to all fire on the same order (TC-143).

## Related code files
- CREATE `src/lib/payment/reconcile-order-paid.ts` (core; may split stock helper if >200 lines)
- CREATE `src/lib/payment/reconcile-order-paid-emails.ts` (IF split needed — email/notify block)
- MODIFY `src/app/api/webhooks/stripe/handlers/checkout-completed.ts` — call reconcile, keep IDOR guard
- MODIFY `src/lib/payment/stripe.ts` — add `retrieveCheckoutSession(sessionId, connectedAccountId)` helper

## Architecture — function contract
```ts
export interface ReconcileContext {
  orderId: number
  session: Record<string, any>      // Stripe checkout.session (full, with payment_method_types)
  connectedAccountId: string
  source: 'webhook' | 'poll' | 'cron'
}
export interface ReconcileResult {
  status: 'reconciled' | 'already_processed' | 'not_found' | 'not_paid_at_stripe'
  oversell?: boolean
}
export async function reconcileOrderPaid(payload, ctx: ReconcileContext): Promise<ReconcileResult>
```

Steps inside (lifted verbatim from current handler lines 97-243):
1. Atomic `UPDATE orders SET status='new', payment_status='paid' WHERE id=? AND status='pending' RETURNING id`.
2. 0 rows → return `{ status:'already_processed' }` (NO side effects).
3. `findByID` guard; record stripeSessionId/PaymentIntentId/paymentMethod (resolveActualPaymentMethod).
4. decrementStock loop (oversell detect added in phase 03 — leave existing GREATEST behavior here).
5. Resolve tenant, send buyer+seller emails (getTemplateConfig gating preserved).
6. Fire ORDER_NEW notification.
7. Return `{ status:'reconciled', oversell }`.

**Move** `resolveActualPaymentMethod` + `decrementStock` into the lib (or shared module). Webhook handler
keeps: connectedAccountId guard, client_reference_id validation, IDOR `verifyConnectedAccountOwnership`,
then calls `reconcileOrderPaid({ source:'webhook' })`.

`retrieveCheckoutSession` helper (mirror refund route lines 190-194):
```ts
stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent'] }, { stripeAccount: connectedAccountId })
```
Used by 04/05 to fetch session for orders where webhook never delivered.

## Data flow
webhook IN: Stripe event → guards → reconcileOrderPaid(session from event) → side effects OUT (DB, emails, notif).

## Todo
- [ ] Create reconcile-order-paid.ts with contract above
- [ ] Move resolveActualPaymentMethod + decrementStock into lib
- [ ] Add retrieveCheckoutSession to stripe.ts
- [ ] Refactor checkout-completed.ts to call reconcile (keep guards)
- [ ] Split into -emails.ts if >200 lines
- [ ] `npx tsc --noEmit` clean

## Success criteria
- Webhook E2E unchanged: paid order → new/paid, stock down, emails sent, ORDER_NEW fired.
- Second webhook delivery → `already_processed`, no duplicate stock/email (TC-143).
- check existing `stripe-webhook.test.ts` still passes (regression gate).

## Risk
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Refactor changes AC-1 behavior | Med×High | Lift logic verbatim; run existing webhook tests before phase done |
| File >200 lines | High×Low | Pre-planned split into reconcile-order-paid-emails.ts |
| Webhook IDOR guard accidentally moved into lib | Low×High | Guard STAYS in handler (connected-account context is webhook-specific); lib trusts caller passes verified ctx |

## Security
IDOR guard remains in webhook handler. Endpoint (04) + cron (05) do their own ownership/auth before calling
reconcile. Lib does NOT re-verify ownership — callers are responsible (documented in contract).

## Rollback
Revert handler + delete lib file. No schema/data change in this phase.

## Next
Unblocks 03/04/05.
