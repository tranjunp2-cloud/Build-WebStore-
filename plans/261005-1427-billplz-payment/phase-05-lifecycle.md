---
phase: 5
title: "Lifecycle — expiry, reconcile cron, status UX"
status: pending
priority: P2
effort: "10h"
dependencies: [3, 4]
story: US-F43-05
branch: feat/F43-05-billplz-lifecycle
---

# Phase 5: Order lifecycle integration

## Overview

Close the loop on pending Billplz orders: expire + delete remote bills, missed-webhook recovery via reconcile cron, confirm-page polling, retry-payment path, cancel semantics.

## Requirements

- Functional: expired Billplz orders cancel locally AND delete the Billplz bill; reconcile cron catches missed webhooks; payment-status endpoint answers for billplz orders; buyer can retry payment (new bill); seller cancel on paid billplz order does NOT auto-refund (no API) → clear UX copy.
- Non-functional: respect Billplz GET rate limit (100 req/5min/IP) in cron batching.

## Architecture

### 0. Shared helper `voidBillplzBill(order)`

```ts
// src/lib/payment/billplz-void.ts — best-effort remote close of a still-`due` bill.
// Call after EVERY successful pending→cancelled CAS on a billplz order.
async function voidBillplzBill(order): Promise<void>
  → if (!order.billplzBillId) return
  → tenant = findByID(orders→tenants, overrideAccess)   // keys are read:false
  → deleteBill(basicAuth(tenant.billplzApiKey), order.billplzBillId)
      .catch(err → warn log only; 404/409 = already paid/deleted, benign)
```

Rationale: Billplz bills live **30 days** (vs order expiry 24h) — any cancel path that skips `deleteBill` leaves a payable link that produces a paid-after-cancel charge (P4's `PAID_AFTER_CANCEL` is the detection net; this is prevention).

### 1. `payment-expiry` (`src/lib/jobs/payment-expiry.ts`)

- `paymentMethod` in-list += `'billplz'`
- After local CAS cancel succeeds → `voidBillplzBill(order)`

### 2. `reconcile-orders` cron (`src/lib/jobs/reconcile-orders.ts`)

New pass alongside stripe/xendit passes:

```
find orders: paymentProvider='billplz' AND paymentStatus='awaiting_payment'
  AND createdAt within [now-30d] AND billplzBillId not null
limit batch (see rate budget below)
per order: tenant re-fetch → getBill(basicAuth(apiKey), billplzBillId)
  bill.paid === true → reconcileOrderPaid(source:'cron',
                        billplzTransactionId: bill.transaction_id)
  bill.state === 'deleted' → leave to expiry cron
```

Orphan note: orders with `billplzBillId=null` are invisible here by design — the webhook `?o=` backfill (P4) is their recovery path; P3's in-try persist keeps the orphan window tiny.

### 3. `POST /api/orders/[id]/payment-status` — add provider branch: `paymentProvider==='billplz'` → `getBill` → map `paid/state` to existing response shape. **Throttle:** cache the remote fetch per order (`lastBillplzPollAt` in-memory map or reuse `bill.updated_at` semantics): skip `getBill` if last poll <30s ago and return last-known state — confirm-page polls every few seconds per buyer and the budget is ~100 GET/5min (research.md rate limits).

### 4. `retry-payment` (`orders/[id]/retry-payment/`)

- `route.ts` method guard (L120) += `paymentProvider !== 'billplz'` — otherwise 409 `NOT_RETRYABLE` before the helper ever runs
- Dispatch: add billplz branch BEFORE the Stripe section (mirror xendit dispatch L148–156 incl. tenant re-fetch `overrideAccess` — `billplzApiKey` is read:false)
- New `retry-payment-billplz.ts`: read `oldBillId = order.billplzBillId` → create fresh bill → persist new `billplzBillId` → **`deleteBill(oldBillId)` best-effort** (old bill stays payable 30d otherwise → double-charge window via its own signed callback)
- `SiteDoc.paymentConfig` type: no change needed (no `billplzEnabled` exists — key-presence gating)

### 5. Cancel route (`orders/[id]/cancel`)

- **Fix the Stripe-by-elimination predicate (L183–188):** add `paymentProvider !== 'billplz'` alongside `'xendit'` — a paid billplz order currently satisfies all conditions and falls into the Stripe CAS+refund branch → `STRIPE_NOT_REFUNDABLE` 422 forever. Do NOT just append a billplz branch after the Stripe block (dead code).
- Insert billplz branch before it: `paymentProvider==='billplz'` → **paid** order: skip auto-refund (no API), allow cancel, copy notes refund is manual via Billplz dashboard (or P6). **Pending** order: generic cancel CAS + `voidBillplzBill`.
- Same for buyer-facing `cancel-payment/route.ts:63-74` — its CAS cancels + restocks but the bill stays payable → add `voidBillplzBill` (the xendit "no remote void needed" comment at L90-91 does NOT hold for Billplz's 30-day bills).
- Regression test: paid billplz order + tenant without Stripe → cancel succeeds.

### 6. Refund route (`orders/[id]/refund`)

- Add `paymentProvider==='billplz'` → **422 `BILLPLZ_MANUAL_REFUND`** guard BEFORE the Stripe fallthrough (L216 xendit branch → L279 Stripe block currently catches billplz → `NO_PAYMENT_INTENT`/`PAYMENT_NOT_CONFIGURED`). Copy points seller to Billplz dashboard manual refund + the generic `PATCH /api/orders/[id]` status:'refunded' path (`orderStatusUpdateSchema` allows it) for bookkeeping.

### 7. Confirm page + reminder email (`order/[orderId]/confirm/`)

- `confirm/page.tsx`: add `paymentProvider` to the order prop object passed to ConfirmClient (L107–118 omits it — without this the client can't branch); **order-waiting reminder gate (L123–128)** provider list += `'billplz'` (abandoned billplz checkouts must get the magic-link reminder email too)
- `ConfirmClient.tsx` L312–316: `isBillplz = paymentProvider==='billplz'` (or `paymentMethod==='billplz'`) → online-payment pending UI + `payment-status` polling; must NOT fall into the `isStripe` catch-all

### 8. `Orders.ts` afterChange notify-owner guard

Only if not landed in P3: skip when `doc.paymentProvider` non-null (NOT `paymentStatus==='awaiting_payment'` — bank_transfer orders are `awaiting_payment` at create and rely on this hook for ORDER_NEW).

### Rate-limit budget (all Billplz GETs share ~100/5min, possibly per-IP across tenants)

| Caller | Cap |
|---|---|
| reconcile cron pass | ≤40 GETs/run, earliest-expiry ordering |
| payment-expiry `deleteBill` (DELETE counts? — assume worst case yes) | ≤40/run, earliest-first |
| payment-status | ≤1 remote GET per order per 30s (throttle above) |

Total live-call budget target ≤80/5min to leave headroom.

## Related Code Files

- Create: `src/lib/payment/billplz-void.ts` (shared void helper)
- Modify: `src/lib/jobs/{payment-expiry.ts,reconcile-orders.ts}`, `src/app/api/orders/[id]/{payment-status/route.ts,cancel/route.ts,cancel-payment/route.ts,refund/route.ts}`, `src/app/api/orders/[id]/retry-payment/` (`route.ts` guard+dispatch + new `retry-payment-billplz.ts`), `src/app/sites/[slug]/order/[orderId]/confirm/{page.tsx,ConfirmClient.tsx}`, `src/collections/Orders.ts` (hook guard if P3 didn't land it)
- Tests: unit for cron selection + `retry-payment-billplz` (incl. old-bill void) + cancel predicate regression; `tests/checkout-billplz-expiry.spec.ts` (E2E — expiry lives in this phase, not P8)

## Implementation Steps

1. `billplz-void.ts` helper + wire into payment-expiry, cancel-payment, seller-cancel pending path
2. Reconcile cron: billplz pass with batch cap + per-tenant key fetch
3. payment-status branch + throttle; retry-payment guard/dispatch + old-bill void
4. Cancel-route predicate fix + billplz branch; refund-route `BILLPLZ_MANUAL_REFUND` guard
5. confirm/page.tsx `paymentProvider` prop + reminder gate; ConfirmClient `isBillplz` branch
6. Unit tests: cron filters, retry guard, cancel predicate regression (paid billplz + no-Stripe tenant → cancel succeeds), refund 422

## Success Criteria

- [ ] Expired order → cancelled + bill deleted remotely (or logged warn on 404/409)
- [ ] Buyer cancel-payment + seller pending-cancel ALSO void the remote bill (all 3 cancel paths covered)
- [ ] Order paid while webhook missed → reconcile cron flips within one run
- [ ] Retry generates NEW bill id AND voids the old bill (no two payable links)
- [ ] Cancel paid billplz order (tenant with and without Stripe) → succeeds, no refund attempt, explicit manual-refund messaging
- [ ] Refund route on billplz order → 422 `BILLPLZ_MANUAL_REFUND` (never reaches Stripe branch)
- [ ] Abandoned billplz checkout → order-waiting reminder email fires (magic-link pay URL)
- [ ] Total Billplz live calls stay ≤80/5min under mixed load (cron + expiry + polling)

## Risk Assessment

- Rate limit exceeded if many pending orders → cap batch + earliest-expiry ordering.
- `deleteBill` on already-paid bill → Billplz rejects (only `due` deletable) → catch + warn only.
- paymentMethod enum `'billplz'` propagation — grep all `in [...]` lists (`payment-expiry`, `reconcile`, dashboards) to keep parity.
