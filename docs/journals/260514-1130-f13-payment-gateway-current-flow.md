---
title: "F13 Payment Gateway Current Flow"
date: 2026-05-14
branch: feat/F13-963-fpx-payment-stripe-my
scope: F13 Payment Gateway
status: analysis
---

# F13 Payment Gateway Current Flow

## Context

This journal records the current F13 implementation state on branch `feat/F13-963-fpx-payment-stripe-my`.

User direction:

- COD and Bank Transfer / DuitNow QR UI are not finalized yet. UI will be provided later.
- Credit / Debit Card and FPX Online Banking belong to F13.
- Card and FPX should only open when the seller has connected Stripe and the Stripe account is ready.
- Stripe-hosted Checkout owns card input, FPX bank picker, 3D Secure, and bank redirect. The app should not build those sensitive payment UIs.

Related planning file:

- `plans/260514-1130-f13-payment-gateway-readiness/plan.md`

## High-Level Feature State

F13 is partially implemented.

The branch already adds:

- Seller payment settings for Card and FPX using `sites.paymentConfig.cardEnabled` and `sites.paymentConfig.fpxEnabled`.
- Storefront checkout options for `card` and `fpx`.
- Public API route `POST /api/orders/stripe-checkout`.
- Stripe Checkout Session creation through existing Stripe helper.
- Order fields for Stripe session, payment intent, and charge IDs.
- Webhook logic to mark paid orders, reduce stock, send customer email, and notify merchant.
- API tests around Stripe checkout, webhook, refund, and site payment config.

The implementation is useful but not final. The largest remaining gap is the Stripe Connect gate:

- Settings UI does not yet lock Card/FPX when Stripe is not connected.
- Connect CTA/return handling is not wired on the payments settings screen.
- `/api/stripe/connect/onboard` still returns to `/settings?stripe=...`, not `/dashboard/settings/payments?stripe=...`.
- `createStripeCheckoutSession()` still hardcodes `payment_method_types: ['card', 'fpx']`, so selecting Card can still create a session that also offers FPX, and selecting FPX can still offer Card.

## Current Data Model

### Tenant

File: `src/collections/Tenants.ts`

Tenant already has Stripe Connect fields:

- `stripeAccountId`
- `stripeOnboardingComplete`

Tenant also has manual payment settings under `payments`:

- `payments.payment_cod`
- `payments.payment_qr`
- `payments.qr_image`

Current code does not store F13 Card/FPX flags on tenant — this is a **gap that must be fixed**. Architecture §4 requires `tenant.payment_card` and `tenant.payment_fpx` as master toggle fields.

**Decision (2026-05-14):** Two-layer config architecture:
- **Tenant level** (`payment_card`, `payment_fpx`): master toggle — controls which methods the tenant has enabled. Used by `buildPaymentMethodTypes()` to populate `payment_method_types` for Stripe session. Must be added to `Tenants.ts` + migration.
- **Site level** (`paymentConfig.cardEnabled/fpxEnabled`): per-site override — defense-in-depth guard on stripe-checkout API (TC-F13.38-39). Already implemented.

### Site

File: `src/collections/Sites.ts`

Site has:

- `paymentConfig.cardEnabled`
- `paymentConfig.fpxEnabled`

Migration entries already exist in `scripts/db-setup.js`:

- `sites.payment_config_card_enabled`
- `sites.payment_config_fpx_enabled`

These stay as-is for site-level validation (TC-F13.38-39). Tenant-level fields are separate and must be added.

### Orders

File: `src/collections/Orders.ts`

Orders now support:

- `paymentMethod` values `card` and `fpx`
- `stripeSessionId`
- `stripePaymentIntentId`
- `stripeChargeId`
- status values including `paid`, `payment_failed`, `processing`, and `refunded`

Current webhook code marks successful Stripe checkout as `paid`. **Decision (2026-05-14):** Correct status is `pending → new` per architecture §2.1 and design §2.2. Code and QA tests using `paid` must be updated to `new`.

## Current Seller Settings Flow

Files:

- `src/app/(dashboard)/settings/payments/page.tsx`
- `src/app/(dashboard)/settings/payments/PaymentsFormClient.tsx`
- `src/app/(dashboard)/settings/payments/actions.ts`

Current flow:

1. Server page gets current tenant ID.
2. It finds the first site for that tenant.
3. It reads `site.paymentConfig`.
4. It passes `initialCardEnabled` and `initialFpxEnabled` into `PaymentsFormClient`.
5. Client renders four settings cards:
   - Credit / Debit Card
   - FPX Online Banking
   - COD
   - QR Banking / Bank Transfer
6. Card toggle calls `updateSitePaymentConfig({ cardEnabled })`.
7. FPX toggle calls `updateSitePaymentConfig({ fpxEnabled })`.
8. COD and QR still use tenant `payments` through `updatePaymentSettings()`.

What works:

- Card and FPX can be toggled in settings.
- Values persist to `Sites.paymentConfig`.
- Toggle failure reverts UI state.
- Existing COD/QR upload flow remains present.

What is missing:

- No `stripeAccountId` or `stripeOnboardingComplete` state is passed into `PaymentsFormClient`.
- Card/FPX toggles are not disabled when Stripe is not connected.
- No lock icon/tooltip state for "Connect Stripe to enable".
- No Connect Stripe CTA in this screen.
- No `?stripe=complete` or `?stripe=refresh` return handler.
- No soft warning when both Card and FPX are OFF.
- The FPX card currently reuses `pt.bankTransferSubtitle`, which may confuse FPX with manual bank transfer.

Required final behavior:

```
Seller opens Settings > Payments
  if Stripe not ready:
    show Connect Stripe alert
    show Connect Stripe CTA
    lock Card and FPX toggles
    keep COD and DuitNow QR independent
  if Stripe ready:
    allow Card and FPX toggles
    save to tenant.payment_card / tenant.payment_fpx (architecture §4)
```

## Current Stripe Connect Flow

Files:

- `src/app/api/stripe/connect/onboard/route.ts`
- `src/app/api/stripe/connect/status/route.ts`
- `src/lib/payment/stripe.ts`
- `src/app/api/webhooks/stripe/route.ts`

Current onboard flow:

1. Authenticated seller calls `POST /api/stripe/connect/onboard` with `tenantId`.
2. Endpoint verifies the user belongs to that tenant.
3. If tenant already has `stripeAccountId`, endpoint creates a new Stripe account link for retry.
4. If tenant has no account, endpoint creates a Standard connected account with country `MY`.
5. Endpoint saves:
   - `stripeAccountId`
   - `stripeOnboardingComplete: false`
6. Endpoint returns onboarding URL.

Current status flow:

1. Authenticated seller calls `GET /api/stripe/connect/status?tenantId=...`.
2. Endpoint verifies tenant ownership.
3. If no `stripeAccountId`, returns disconnected status.
4. If account exists, retrieves account from Stripe.
5. Returns:
   - `connected`
   - `chargesEnabled`
   - `payoutsEnabled`
   - `detailsSubmitted`
   - `onboardingComplete`

Current webhook sync:

1. Stripe sends `account.updated`.
2. Webhook finds tenant by `stripeAccountId`.
3. It sets `stripeOnboardingComplete` to true only when:
   - `charges_enabled`
   - `payouts_enabled`
   - `details_submitted`

What works:

- Backend primitives for Connect exist.
- Tenant ownership check exists.
- Retry uses existing connected account instead of always creating a new account.
- Webhook can sync onboarding completion.

What is missing:

- Onboard route uses wrong return URLs:
  - current: `/settings?stripe=refresh`
  - current: `/settings?stripe=complete`
  - required: `/dashboard/settings/payments?stripe=refresh`
  - required: `/dashboard/settings/payments?stripe=complete`
- Payments settings UI does not call onboard route yet.
- Payments settings UI does not call status route after return.
- Settings does not unlock Card/FPX after `chargesEnabled` becomes true.

## Current Storefront Checkout Flow

File:

- `src/app/sites/[slug]/checkout/page.tsx`

Current flow:

1. Checkout page loads `slug`.
2. It calls `/api/storefront/site-by-slug?slug=...`.
3. Response provides:
   - `siteId`
   - `tenantId`
   - `cardEnabled`
   - `fpxEnabled`
   - `stripeEnabled`
4. Checkout state stores:
   - `cardEnabled`
   - `fpxEnabled`
   - `stripeEnabled`
5. Payment method type currently allows:
   - `cod`
   - `qr_banking`
   - `fpx`
   - `card`
6. UI renders:
   - COD row
   - QR Banking row
   - FPX row if `stripeEnabled && fpxEnabled`
   - Card row if `stripeEnabled && cardEnabled`
7. If user selects Card or FPX and clicks pay, client calls `handleStripePay(method)`.
8. `handleStripePay` POSTs to `/api/orders/stripe-checkout`.
9. If success, browser redirects to returned Stripe session URL.
10. If failure, error banner displays and cart stays intact.

**Decision (2026-05-14):** Current separate Card/FPX rows are incorrect per design doc §2.2.1. Required behavior: **ONE "Pay with Stripe" row** with dynamic label based on tenant settings:
- `payment_card=true && payment_fpx=true` → "Pay with Stripe (Card · FPX)" + `payment_method_types: ['card','fpx']`
- `payment_card=true && payment_fpx=false` → "Pay with Card" + `payment_method_types: ['card']`
- `payment_card=false && payment_fpx=true` → "Pay with FPX (Online Banking)" + `payment_method_types: ['fpx']`
- Both false → row hidden (TC-F13.34)
Stripe Checkout page handles the actual Card/FPX selection UI internally.

What works:

- Buyer cannot see Stripe row when `stripeEnabled` is false.
- Stripe checkout POST is separate from COD/QR manual order POST.
- Cart clear only happens after manual COD/QR success, not before Stripe redirect.

What is missing:

- There is no explicit return handler for Stripe cancel or failed redirects.
- `cancelUrl` currently sends buyer back to `/sites/{slug}/checkout` without a query marker, so the checkout page cannot show the required BM error copy reliably.
- There is no full-page "Redirecting to Stripe" overlay.
- The storefront still has placeholder/manual QR display details, which are expected to change after the new COD/DuitNow QR UI is provided.

Required final behavior:

```
Buyer checkout
  show COD and DuitNow QR according to manual-method design
  show Card only if seller Stripe ready AND cardEnabled
  show FPX only if seller Stripe ready AND fpxEnabled
  selecting Card/FPX redirects to Stripe hosted Checkout
  cancel/failure returns with cart preserved and clear error
```

## Current Public Site Resolver

File:

- `src/app/api/storefront/site-by-slug/route.ts`

Current behavior:

1. Resolve tenant by slug.
2. Load tenant fields with `stripeOnboardingComplete`.
3. Find first site for tenant.
4. Return site and payment availability:
   - `cardEnabled: paymentConfig.cardEnabled !== false`
   - `fpxEnabled: paymentConfig.fpxEnabled !== false`
   - `stripeEnabled: Boolean(tenant.stripeOnboardingComplete)`

This is a simple gate. It does not call Stripe live status. It relies on webhook or prior code to keep `tenant.stripeOnboardingComplete` accurate.

Risk:

- If the webhook has not synced yet, buyer may not see Card/FPX even after Stripe KYC completes.
- If Stripe later disables charges, buyer may still see Card/FPX until the webhook updates the tenant.

Mitigation:

- Settings return handler should refetch Stripe status.
- Webhook `account.updated` must be configured and tested.
- Consider storing more explicit `stripeChargesEnabled` in the future if product needs sharper state than `stripeOnboardingComplete`.

## Current Stripe Checkout API Flow

Files:

- `src/app/api/orders/stripe-checkout/route.ts`
- `src/app/api/orders/stripe-checkout/build-order-items.ts`
- `src/lib/payment/stripe.ts`
- `src/lib/payment/types.ts`

Current request:

```json
{
  "siteId": "1",
  "items": [{ "productId": "1", "quantity": 1 }],
  "customer": {
    "name": "...",
    "email": "...",
    "phone": "...",
    "address": {}
  },
  "paymentMethod": "card"
}
```

Current backend behavior:

1. Validate body with `stripeCheckoutSchema`.
2. Resolve site.
3. Read `site.paymentConfig`.
4. Reject if selected method is disabled:
   - FPX disabled -> 422 `METHOD_DISABLED`
   - Card disabled -> 422 `METHOD_DISABLED`
5. Resolve tenant from site.
6. Reject if no `stripeAccountId` or no `stripeOnboardingComplete`.
7. Validate product rows and stock.
8. Build order rows and Stripe line items.
9. Create order in `pending` status.
10. Call `createStripeCheckoutSession()`.
11. Save `stripeSessionId` back onto order.
12. Return:
   - `orderId`
   - `orderNumber`
   - `sessionUrl`

What works:

- Selected method is checked against site config before creating the order.
- Store must have Stripe account and onboarding completion before Stripe API call.
- Product validation happens before order creation.
- Stock is not decremented here.
- Order keeps Stripe session ID for webhook idempotency checks.

Critical gap:

`createStripeCheckoutSession()` ignores selected method and hardcodes:

```ts
payment_method_types: ['card', 'fpx']
```

Effect:

- Buyer choosing Card may still see FPX on Stripe Checkout.
- Buyer choosing FPX may still see Card on Stripe Checkout.
- Tests can pass route guardrails while real Stripe session still violates seller method settings.

Required fix:

- Add `paymentMethodTypes` to `CheckoutParams`.
- Pass `['card']` for card checkout.
- Pass `['fpx']` for FPX checkout.
- Reject empty method arrays before calling Stripe.

## Current Webhook Flow

File:

- `src/app/api/webhooks/stripe/route.ts`

Webhook verifies signature with:

- `STRIPE_WEBHOOK_SECRET` for main events
- `STRIPE_CONNECT_WEBHOOK_SECRET` for Connect events

Current supported normalized events:

- `checkout.session.completed` -> `payment_success`
- `payment_intent.payment_failed` -> `payment_failed`
- `customer.subscription.updated` -> `subscription_updated`
- `account.updated` -> `account_updated`

Payment success flow:

1. Use `client_reference_id` as `orderId`.
2. Check whether an order with same `stripeSessionId` is already `paid`.
3. If already paid, skip.
4. Update order:
   - `status: 'paid'`
   - `stripeSessionId`
   - `stripePaymentIntentId`
   - `stripeChargeId`
   - `paymentMethod`
5. Find order and decrement product stock.
6. Send order confirmation email.
7. Fire merchant notification.

Payment failed flow:

1. Find order by `stripePaymentIntentId`.
2. Fallback to `paymentIntent.metadata.orderId`.
3. Update order to `payment_failed`.
4. Notify merchant.

What works:

- Signature verification exists.
- Success and failure paths update orders.
- Duplicate completed-session events are mostly safe because paid orders are skipped.
- Account update can sync tenant Stripe readiness.

Remaining concerns:

- Idempotency is status-based, not atomic database-level locking.
- Email send is awaited inside webhook; project rules prefer `sendEmail().catch()` fire-and-forget for non-blocking email.
- Success status is `paid`, while some docs still say `new`.

## Current Refund State

File:

- `src/app/api/orders/[id]/refund/route.ts`

Current state:

- Auth required.
- User must belong to order tenant.
- Only `paid` orders can be refunded.
- Already refunded orders are rejected.
- Missing Stripe payment intent is rejected.
- Refund runs against merchant connected account.
- Order status updates to `refunded` after Stripe refund succeeds.

This API exists, but refund UI is out of scope for Wave 6 per F13 docs. Treat it as guarded backend capability, not a buyer/seller UI deliverable for this pass.

## Current Tests

Relevant tests exist under `src/__tests__/api/`:

- `stripe-checkout.test.ts`
- `stripe-refund.test.ts`
- `stripe-webhook.test.ts`
- `stripe-connect.test.ts`
- `storefront-site-by-slug.test.ts`

Coverage currently includes:

- Checkout session creation path.
- Card/FPX disabled guardrails.
- Stripe onboarding incomplete rejection.
- Refund guardrails.
- Webhook signature and status handling.
- Site resolver payment config.

Gap:

- Browser E2E coverage in `tests/*.spec.ts` is not yet added for F13. Repo review rules require E2E when adding new routes/pages.
- Tests should assert actual `payment_method_types` passed to Stripe after the hardcoded method bug is fixed.

## Feature Flow as It Should Be Explained to the Team

### Seller-side flow

```
Settings > Payments
  |
  |-- Manual methods
  |     |-- Cash on Delivery
  |     |-- Bank Transfer / DuitNow QR
  |     `-- UI pending from design input
  |
  `-- Online Stripe methods
        |-- Credit / Debit Card
        |-- FPX Online Banking
        |
        |-- locked until Stripe Connect is ready
        |-- Connect Stripe CTA sends seller to Stripe KYC
        |-- return complete refreshes account status
        `-- once charges enabled, seller can enable/disable Card and FPX
```

### Buyer-side flow

```
Storefront checkout
  |
  |-- Load site payment availability
  |
  |-- Show manual methods based on COD/DuitNow QR config
  |
  |-- Show Credit / Debit Card only if:
  |     seller Stripe ready AND cardEnabled
  |
  |-- Show FPX only if:
  |     seller Stripe ready AND fpxEnabled
  |
  |-- Buyer selects Card or FPX
  |
  |-- POST /api/orders/stripe-checkout
  |
  |-- Backend validates selected method and Stripe readiness
  |
  |-- Backend creates pending order and Stripe Checkout Session
  |
  |-- Browser redirects to checkout.stripe.com
  |
  |-- Stripe handles payment UI
  |
  |-- Webhook marks order paid
  |
  `-- Buyer lands on confirmation page
```

## Next Implementation Priorities

1. Fix Stripe Connect return URLs to `/dashboard/settings/payments`.
2. Add settings locked state, Connect CTA, and return handler.
3. Pass selected method into Stripe Checkout Session instead of hardcoding `['card', 'fpx']`.
4. Add cancel/failure return marker so checkout can show the required error while preserving cart.
5. Keep COD and DuitNow QR UI work separate until design is provided.
6. Add E2E coverage for F13 buyer and seller flows.

## Security Notes

- Do not commit local machine config or env files.
- No card PAN/CVC should ever enter app code or database.
- Stripe secrets must stay in Vercel/environment configuration only.
- Webhook signature verification must remain mandatory.
- Seller tenant ownership checks must remain on Connect and refund endpoints.
