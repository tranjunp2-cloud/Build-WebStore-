# Phase 05 — Confirm page: status endpoint + polling + states

**Priority:** P1 · **Sprint:** 2 · **Status:** planned · **Depends:** 01

## Problem (verified)

Confirm page server-renders once, ignores `session_id`, has no loading state, and no `payment_failed` branch (`ConfirmClient.tsx`). Because of webhook latency, a buyer redirected back right after paying may hit the page while order is still `pending` → shows non-success even though payment is processing.

## Fix

1. **Status endpoint** `GET /api/orders/[id]/payment-status`:
   - Auth via existing `ct_{orderId}` HttpOnly cookie (`verifyConfirmToken`, same gate as the page `page.tsx:110`).
   - Returns `{ status, paymentStatus, paymentMethod }`.
   - **Active reconcile**: if still `pending` AND has `stripeSessionId`, retrieve the Stripe session on the connected account; if Stripe says paid, call shared `reconcileOrderPaid` (Phase 01) then return fresh state. Makes the page self-healing without waiting for webhook.

2. **Polling UI** in `ConfirmClient`:
   - If initial state is `pending`/processing: render **skeleton/spinner** + "Verifying your payment…" (i18n BM/EN).
   - Poll the endpoint every ~2.5s, max ~8 attempts (~20s), exponential-ish backoff acceptable.
   - On `paid` → swap to success hero (+ `clearCart()` per Phase 04) without full reload.
   - On `payment_failed` (or timeout) → render **failed state** with retry CTA → links to Pay Now (Phase 06).

3. **Read `session_id`** (optional) for logging/diagnostics only; trust DB state.

## Files

- Create: `src/app/api/orders/[id]/payment-status/route.ts`
- Modify: `src/app/sites/[slug]/order/[orderId]/confirm/ConfirmClient.tsx` (polling + skeleton + failed state)
- Read: `src/lib/orders/upload-token.ts` (token verify), `src/lib/payment/reconcile-order.ts`

## Todo

- [ ] Status endpoint with `ct_` cookie auth + active Stripe reconcile when pending
- [ ] Skeleton/processing state + bounded polling
- [ ] Success transition (clears cart once)
- [ ] Failed/timeout state + retry CTA
- [ ] i18n strings; tests for endpoint (paid/pending/failed) (TC-F13.*)

## Success criteria

- Pay → land on Confirm while pending ⇒ spinner, then auto-flips to success within seconds (no white screen / false error).
- Failed payment ⇒ clear failed state + path to retry.

## Risks

- Polling + active reconcile must stay idempotent (shared fn guarantees single-process).
- Bound attempts to avoid hammering Stripe; after timeout, show "still processing, check email" rather than hard error.
