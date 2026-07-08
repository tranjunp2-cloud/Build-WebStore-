# Phase 03 — AC-3: "Pay Now" CTA + retry-payment endpoint

## Context

- AC-3: On order detail (tracking) page, when order is awaiting payment / payment_failed, show a "Pay Now" CTA → `POST /api/orders/[id]/retry-payment` → re-validate stock → create NEW Stripe session → redirect buyer to it.
- New endpoint + a CTA in `OrderTrackingClient.tsx`.

## Priority / status

P2 · pending · ~2.5h

## Key insights

- No retry endpoint exists. `[id]/resume` = bank-transfer proof flow (different). Must create `[id]/retry-payment`.
- The endpoint re-runs the SAME Stripe-checkout core: resolve site→tenant, stripe-ready checks, `buildPaymentMethodTypes`, site-level guard, `buildOrderItems` (RE-VALIDATES STOCK — the key AC-3 requirement), `createStripeCheckoutSession`. DRY: reuse those helpers, do not reimplement Stripe logic.
- Difference vs stripe-checkout: order ALREADY exists. Retry must:
  - guard: only `status='pending'` OR `paymentStatus in (awaiting_payment, payment_failed)` are retryable; reject paid/new/cancelled/refunded (409).
  - re-validate stock against current order items via `buildOrderItems` using the order's stored items (productId+quantity). If stock now insufficient → 422 with clear message (do NOT silently change qty).
  - create a fresh Stripe session (new sessionId), update `order.stripeSessionId`, optionally reset `status='pending'` / `paymentStatus='awaiting_payment'` if it was `payment_failed`.
  - set/refresh `ct_${id}` confirm cookie so the success redirect lands on the confirm page (same as stripe-checkout does).
  - success/cancel URLs identical to stripe-checkout (`/order/[id]/confirm?session_id=…` and `/checkout?stripe_cancelled=1` — or back to tracking; pick confirm for success, tracking for cancel so buyer returns to order).
- Auth for the endpoint: order tracking page is reachable via magic link / orderNumber. Retry mutates payment + reads customer email. Require proof of order ownership. Options:
  - (A) `ct_${id}` confirm cookie (set by confirm-redirect / stripe-checkout) — strongest, but buyer arriving fresh on tracking page may not have it.
  - (B) magic-link token (`verifyOrderToken` against `order.magicLinkSecret`) passed by the CTA.
  - DECISION: accept EITHER a valid `ct_${id}` cookie OR a magic-link `token` query param (mirror `confirm-redirect`). The tracking page is server-rendered with the order; pass whichever credential it already trusts. Reject if neither valid (401). RESOLVE during impl which credential the tracking page server component currently has — see Unresolved Q.

## Data flow

```
Tracking page (status pending|payment_failed) → render "Pay Now"  [AC-3 CTA]
  → onClick: POST /api/orders/[id]/retry-payment { credential }
     server:
       1. load order; guard retryable status            (else 409)
       2. auth: ct_ cookie OR magic-link token           (else 401)
       3. resolve site→tenant; stripe-ready checks       (else 422)
       4. buildPaymentMethodTypes + site guard           (else 422)
       5. buildOrderItems(order.items) → RE-VALIDATE STOCK(else 422 OUT_OF_STOCK)
       6. createStripeCheckoutSession (new session)
       7. update order.stripeSessionId; reset to pending/awaiting if was failed
       8. set ct_ cookie; return { sessionUrl }
  → client: window.location.href = sessionUrl  → Stripe
  → on success → confirm page (phase-02 verifying → paid)
  → on cancel  → tracking page (cart untouched; can retry again)
```

## Requirements

Functional:
1. New `POST /api/orders/[id]/retry-payment` per data flow. Returns `{ success, data: { sessionUrl } }` or typed error `{ code, message }`.
2. Stock re-validation via `buildOrderItems` using stored order items; on shortfall return 422 `OUT_OF_STOCK` with item-level message.
3. Status guard: retryable = `status==='pending'` or `paymentStatus∈{awaiting_payment,payment_failed}`; else 409 `NOT_RETRYABLE`.
4. Refresh `ct_${id}` cookie; success URL → confirm page; cancel URL → tracking page.
5. `OrderTrackingClient`: show "Pay Now" button when `paymentStatus∈{awaiting_payment,payment_failed}` (and not paid/cancelled-non-failed). On click POST then redirect; show loading + error toast on failure. i18n `payNow` + `retryError`.

Non-functional:
- Endpoint < 200 lines; extract any shared block if it pushes over (reuse existing helpers first).
- Idempotency: overwriting `stripeSessionId` is fine (old session abandoned). Do not create duplicate orders.

## Related code files

Create:
- `src/app/api/orders/[id]/retry-payment/route.ts`

Modify:
- `src/app/sites/[slug]/orders/[orderNumber]/OrderTrackingClient.tsx` — add "Pay Now" CTA + handler (reads `liveOrder.id`, `liveOrder.paymentStatus`)

Read for context:
- `src/app/api/orders/stripe-checkout/route.ts` (the 6-step chain + cookie + URLs to mirror)
- `src/app/api/orders/stripe-checkout/build-order-items.ts` (`buildOrderItems` signature)
- `src/lib/payment/stripe.ts` (`createStripeCheckoutSession`)
- `src/lib/payment/method-builder.ts` (`buildPaymentMethodTypes`)
- `src/app/api/orders/[id]/confirm-redirect/route.ts` (magic-link verify pattern, cookie TTL)
- `src/lib/orders/upload-token.ts` (`generateConfirmToken`)

## Implementation steps

1. Scaffold `retry-payment/route.ts` POST handler with `params: Promise<{ id }>`.
2. Load order (overrideAccess, depth 0). 404 if missing.
3. Auth: read `ct_${id}` cookie → `verifyConfirmToken`; else read `token` from body/query → `verifyOrderToken(order.magicLinkSecret)`. 401 if neither.
4. Status guard → 409 NOT_RETRYABLE if not retryable.
5. Resolve site + tenant; run stripe-ready + method-type + site-guard checks (copy chain from stripe-checkout). Map failures to existing codes.
6. `buildOrderItems(payload, order.items.map(productId,quantity), tenantId)`. If `errorResponse` → return it (covers OUT_OF_STOCK). Confirm helper surfaces stock errors; if not, add explicit check.
7. `createStripeCheckoutSession({ orderId, items, successUrl: confirm, cancelUrl: tracking, stripeAccountId, paymentMethodTypes, ... })`.
8. `payload.update` order: `stripeSessionId`, and if `paymentStatus==='payment_failed'` reset `status='pending'`, `paymentStatus='awaiting_payment'`.
9. Set `ct_${id}` cookie (mirror stripe-checkout maxAge). Return `{ success, data:{ sessionUrl } }`.
10. OrderTrackingClient: add CTA + async handler; redirect on success, toast on error.
11. Compile.

## Todo

- [ ] Create retry-payment endpoint (auth + status guard + stock re-validate + new session)
- [ ] Reuse buildOrderItems / createStripeCheckoutSession / buildPaymentMethodTypes (DRY)
- [ ] Refresh ct_ cookie; confirm success URL, tracking cancel URL
- [ ] Reset payment_failed → pending/awaiting on retry
- [ ] "Pay Now" CTA in OrderTrackingClient (gated by paymentStatus)
- [ ] Loading + error toast; i18n payNow/retryError
- [ ] Compile clean

## Success criteria (measurable)

- Pending Stripe order on tracking page shows "Pay Now"; click → redirected to a fresh Stripe Checkout URL.
- Stock reduced to 0 since order placed → retry returns 422 OUT_OF_STOCK, no Stripe session created, order unchanged.
- Paid/cancelled/refunded order → no "Pay Now" button; direct POST returns 409.
- After successful retry payment, confirm page (phase-02) flips to paid and clears cart.
- Unauthorized POST (no cookie, no valid token) → 401, no session.

## Risk assessment

| Risk | L×I | Mitigation |
|------|-----|-----------|
| Code duplication of 6-step Stripe chain → drift from stripe-checkout | M×M | Reuse helpers; if chain copied, add comment linking both files; consider extracting `assertStripeReady(payload, siteId)` only if it stays <200 lines (YAGNI otherwise) |
| Stock changed between place + retry → overselling | M×H | `buildOrderItems` re-validates at retry time; reject on shortfall (hard gate) |
| Auth model wrong (buyer can't retry / attacker can) | M×H | Dual-credential (ct_ cookie OR magic-link); reject if neither. Verify tracking page credential availability before finalizing |
| Reset status masks a real failure | L×M | Only reset when prior was payment_failed/pending; never touch new/paid |
| Stale old Stripe session still payable | L×L | Acceptable: webhook is idempotent on session_id; latest session wins; old one expires |

## Rollback

- Delete `retry-payment/route.ts` (new file, no migration).
- Revert OrderTrackingClient CTA diff.
- No DB schema change (reuses existing order fields). Zero cascade.

## Security

- Dual-credential auth (confirm cookie or magic-link token), both HMAC-verified.
- `overrideAccess: true` only after ownership proven.
- Reuses tenant suspension + stripe-ready guards (no payment to unready/suspended sellers).
- No new env vars.

## Unresolved

- Q1: Which credential does the tracking page server component (`orders/[orderNumber]/page.tsx`) already hold — does it set/have `ct_` cookie, or only orderNumber+slug? Determines whether CTA must pass a magic-link token. RESOLVE by reading that page.tsx before coding the auth branch.
- Q2: Does `buildOrderItems` itself return an OUT_OF_STOCK `errorResponse`, or only validate existence? If latter, add explicit stock check. RESOLVE by reading `build-order-items.ts`.
