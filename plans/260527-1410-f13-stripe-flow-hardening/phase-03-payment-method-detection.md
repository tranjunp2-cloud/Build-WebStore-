# Phase 03 — Accurate card/fpx payment-method detection

**Priority:** P1 · **Sprint:** 1 · **Status:** planned · **Depends:** 01

## Problem (verified)

Webhook infers method from `session.payment_method_types` (the *enabled* list, not what the buyer used). Multi-method tenants always record `'card'` (`src/app/api/webhooks/stripe/route.ts:183-185`; order-creation default `route.ts:215`).

## Fix

In `reconcile-order.ts`, read the **actual** method from the PaymentIntent. Because charges are **Direct Charges on the connected account**, all retrieves MUST pass `{ stripeAccount: tenant.stripeAccountId }`.

Approach (minimal API calls):
- From `checkout.session.completed`, take `session.payment_intent`.
- `stripe.paymentIntents.retrieve(piId, { expand: ['latest_charge.payment_method_details'] }, { stripeAccount })`.
- Map `latest_charge.payment_method_details.type` → `'card' | 'fpx'` (fallback to existing inference if absent).
- Persist to `order.paymentMethod`.

Tenant's `stripeAccountId` is resolvable from the order's tenant (already loaded in reconcile for emails).

## Files

- Modify: `src/lib/payment/reconcile-order.ts` (method resolution)
- Possibly add helper in `src/lib/payment/stripe.ts`: `getChargeMethod(piId, stripeAccount): Promise<'card'|'fpx'|null>`
- Read: `src/lib/payment/types.ts`

## Todo

- [ ] Helper to retrieve PI on connected account + extract method type
- [ ] Map Stripe type → order enum (`fpx`, `card`); fallback safe
- [ ] Persist real method; keep single-method fast-path (no extra API call when types.length===1)
- [ ] Tests: card→'card', fpx→'fpx', missing→fallback (TC-F13.*)

## Success criteria

- Buyer paying via FPX on a Card+FPX tenant ⇒ order records `paymentMethod='fpx'`.

## Risks

- Extra Stripe API call per paid order — acceptable; skip when tenant has only one enabled method.
- Connected-account scoping mistakes return 404 — always pass `stripeAccount`.
