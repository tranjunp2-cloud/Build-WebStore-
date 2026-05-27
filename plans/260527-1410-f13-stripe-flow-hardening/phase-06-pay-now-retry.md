# Phase 06 — "Pay Now" on order detail + retry-payment endpoint

**Priority:** P1 · **Sprint:** 2 · **Status:** planned · **Depends:** 01, 05

## Context (verified)

- Order-detail page exists: `src/app/sites/[slug]/orders/[orderNumber]/OrderTrackingClient.tsx` (looked up by `orderNumber`, public).
- **No buyer order-list** (locked: don't build one). Buyers reach detail via email magic link.
- No endpoint recreates a Stripe session for an existing order. BT has `/api/orders/[id]/resume` (proof re-upload) — different purpose.
- Stripe Checkout Sessions expire (~24h) → reuse is unreliable; recreate is simplest.

## Fix

1. **Retry endpoint** `POST /api/orders/[id]/retry-payment`:
   - Guard: order belongs to caller (reuse `ct_` cookie OR `ut` upload-token pattern from `/resume`).
   - Allowed only when `status='pending'` or `status='payment_failed'` (not paid/shipped/cancelled).
   - Re-validate: tenant still `stripeOnboardingComplete` + payment method enabled; **re-check stock** (`buildOrderItems` against stored `order.items`).
   - Create a **new** Stripe Checkout Session (same line items incl. shipping+SST), update `order.stripeSessionId`, reset `status='pending'` if it was `payment_failed`.
   - Return `{ sessionUrl }`. Reuse `createStripeCheckoutSession` (`src/lib/payment/stripe.ts`).

2. **"Pay Now" CTA** in `OrderTrackingClient`:
   - Show button when `status ∈ {pending, payment_failed}` and `paymentMethod ∈ {card, fpx}`.
   - Click → POST retry endpoint → `window.location.href = sessionUrl`.
   - Clear failed/pending messaging; align with Confirm failed-state CTA (Phase 05).

## Files

- Create: `src/app/api/orders/[id]/retry-payment/route.ts`
- Modify: `src/app/sites/[slug]/orders/[orderNumber]/OrderTrackingClient.tsx` (Pay Now button + handler)
- Read: `src/app/api/orders/stripe-checkout/route.ts` (reuse validation/line-item build), `src/app/api/orders/[id]/resume/route.ts` (token pattern)

## Todo

- [ ] Retry endpoint: auth + state guard + stock/tenant re-validation + new session
- [ ] Reuse build-order-items + createStripeCheckoutSession (no logic dup)
- [ ] Pay Now button for pending/payment_failed card/fpx orders
- [ ] Out-of-stock-on-retry ⇒ friendly error, no session
- [ ] Tests: retry happy path, blocked on paid order, stock-gone case (TC-F13.*)

## Success criteria

- Buyer who closed Stripe tab opens order link ⇒ "Pay Now" ⇒ new Stripe session ⇒ completes without re-adding items.
- Cannot retry an already-paid/cancelled order.

## Risks

- Auth on a public detail page — require the signed token; don't let arbitrary orderNumber trigger sessions for someone else's order (low harm, but gate it).
- Multiple retries spawn multiple pending sessions — Phase 07 cron cleans stale ones; always overwrite `stripeSessionId` with the latest.
