---
phase: 3
title: "Checkout flow — create Bill + hosted redirect"
status: pending
priority: P1
effort: "12h"
dependencies: [1]
story: US-F43-03
branch: feat/F43-03-billplz-checkout
---

# Phase 3: Checkout flow

## Overview

Buyer picks "Billplz" → `POST /api/orders/billplz-checkout` creates pending order + Billplz Bill → returns bill URL → client redirects. Mirrors `xendit-checkout` but adopts the fuller `stripe-checkout` correctness patterns (plan gate, aggregate stock CAS, method gates).

## Requirements

- Functional: zod-validated body (`billplzCheckoutSchema` = `xenditCheckoutSchema` shape **+ `discountCode` + optional `orderId` resume**), pending order with `paymentProvider:'billplz'`, `paymentExpiresAt:+24h`, bill created with tenant keys, `{type:'redirect', sessionUrl}` response + `ct_` cookie, buyer/seller fire-and-forget emails.
- Non-functional: rollback bill on downstream failure where possible, `maxDuration ≤ 60`, amounts converted RM→sen exactly once, discount honored (never charge more than displayed).

## Architecture

### `POST /api/orders/billplz-checkout` (`src/app/api/orders/billplz-checkout/route.ts`)

Pipeline (from stripe-checkout/xendit-checkout, deltas marked):

1. `request.json()` → 400 `INVALID_BODY`; `billplzCheckoutSchema.safeParse` (`src/lib/validations/orders.ts` — `xenditCheckoutSchema` shape + `discountCode` (optional, validated same as stripe's L11) + `orderId` (optional resume token, see idempotency below)). No `bankCode` — bypass removed from scope.
2. Site → tenant resolution; `status==='suspended'` → 403
3. **Plan gate** `canUse('allowing_buyer_making_order')` (stripe does this; xendit doesn't — adopt it)
4. **Provider-ready gate**: `!tenant.billplzApiKey || !tenant.billplzCollectionId || !tenant.billplzXSignatureKey` → 422 `BILLPLZ_NOT_READY`. (No toggle checks — connection = key presence, plan.md §8)
5. **Idempotent resume:** if body `orderId` present → load order; require `siteId` + `paymentProvider==='billplz'` + `status==='pending'` + `paymentStatus==='awaiting_payment'` match → if `billplzBillId` set → `getBill` and return its `url` (skip create entirely). Otherwise continue to bill creation for that existing order. *Rationale: every plain POST creates a new order (xendit-checkout L153–181 precedent) — a guard that reads `order.billplzBillId` on a just-created order is dead code.*
6. `buildOrderItems` → `getRates` (EP-aware identical to xendit-checkout L96–124) → **discount**: port `applyDiscount` + `computeOrderTotal` helpers from `stripe-checkout` so a valid `discountCode` reduces the bill amount; invalid code → 422 `INVALID_DISCOUNT` (same contract as stripe). Never silently charge undiscounted total — displayed price must equal charged price. **Billplz `amount = Math.round(totalAfterDiscountRM * 100)` sen**
7. Pending order create: `paymentProvider:'billplz'`, `paymentMethod:'billplz'`, `status:'pending'`, `paymentStatus:'awaiting_payment'`, `paymentExpiresAt:+24h`, `magicLinkSecret` (+ discount fields same as stripe order create)
8. Stock decrement: **use stripe-checkout's dual path** (variant `decrementVariantStock` + aggregate SQL CAS) — not xendit's variant-only path; fail → restock + delete → 422
9. `createBill(basicAuth(tenant.billplzApiKey), { collection_id: tenant.billplzCollectionId, email, name, amount: totalSen, mobile: normalizeMobile(customer.phone), description: \`Order ${orderNumber} from ${shopName}\` (≤200 chars), callback_url: \`${billplzWebhookBase}/api/webhooks/billplz?o=${order.id}\`, redirect_url: buildStorefrontUrl(siteSlug, \`/order/${order.id}/confirm\`), reference_2_label:'Order ID', reference_2:String(order.id) })`
   - `billplzWebhookBase = (BILLPLZ_WEBHOOK_URL ?? NEXT_PUBLIC_SERVER_URL).replace(/\/$/,'')`
   - `reference_1` never sent (reserved for out-of-scope bank bypass)
   - **Persist `billplzBillId` INSIDE the createBill try-block immediately on success** (xendit persists the invoice id inside createInvoice's try — xendit-checkout L205). A persist step after the block leaves an orphan window: bill live at Billplz while `order.billplzBillId=null` → invisible to expiry deleteBill AND reconcile cron filters.
   - Fail → restock + delete order → 502 `BILLPLZ_API_ERROR`
10. Emails (buyer `orderConfirmationEmail` `paymentMethod:'billplz'`, seller `newOrderSellerEmail` — same fire-and-forget). Note: email template union + `paymentMethodLabel` + prepaid checks must learn `'billplz'` — see consumer list below.
11. `{success:true, data:{type:'redirect', sessionUrl: bill.url, orderId, orderNumber}}` + `ct_${orderId}` cookie

### Storefront gating + UI

- **No `Sites.paymentConfig.billplzEnabled`** — dead toggle (no write path in app code). Site gate = same as xendit: key presence.
- `checkout/page.tsx`: `initialSiteData.billplzConnected = !!(tenant.billplzApiKey && tenant.billplzCollectionId && tenant.billplzXSignatureKey)`; **extend `hasPaymentMethods` OR-list (L141–148) with `billplzConnected`** — a Billplz-only seller must not hit the "no payment methods" dead-end.
- `site-by-slug/route.ts` — add `billplzConnected` AND extend its `hasPaymentMethods` (L113–117); while there, add the missing `xenditConnected` term too (pre-existing same-class bug, one-line fix).
- `CheckoutClient.tsx`: `paymentMethod` union += `'billplz'`; option card next to xendit (L929–943); **auto-select fallback chain (L106–112) += billplz** — a billplz-only store must not default to a hidden `'cod'`; `pw_billplz_pending` sessionStorage back-button handling (L184 pattern) **+ add key to `stripe-back-redirect.tsx:17` shared list and `ConfirmClient.tsx:182-183` clear-list**; submit dispatch → `/api/orders/billplz-checkout` (send `discountCode` like the stripe branch L522, plus `orderId` on retries) → `window.location.href = sessionUrl`; `canPlaceOrder` += `'billplz'`

### `paymentMethod:'billplz'` consumer enumeration (all in THIS phase)

The enum value is a provider name in a channel-typed field — every elimination-based or label-map consumer must learn it:

- `src/lib/email/templates/shared/email-utils.ts:87-91` — `paymentMethodLabel` += `'billplz'` → "Online Banking / E-Wallet (Billplz)" (else falls through to "Card / FPX")
- Email template unions + prepaid checks: `order-confirmation.ts:46,123,318`, `order-shipped.ts:106`, `order-completed.ts:102` — without this, paid billplz orders render `prepaid=RM0` + a type error
- `src/i18n/locales/{en,ms}.json` `paymentMethods.billplz` — else dashboard shows raw "billplz" (`OrdersTable.tsx:174,263`, `payment-card.tsx:46`, `OrderDetailPanel.tsx:513`)
- `OrdersActionBar.tsx:9-17` — `PAYMENT_METHOD_VALUES` += `'billplz'` + filter label (else filter unreachable)
- `OrderTrackingClient.tsx:138` — label map += billplz (else "Pending")
- `ConfirmClient` handling is P5's job (needs `paymentProvider` prop — confirm/page.tsx currently omits it from the order payload)
- `OrderTrackingClient.tsx` `pw_billplz_pending` handling alongside `pw_xendit_pending` (`:546,628`)

## Related Code Files

- Create: `src/app/api/orders/billplz-checkout/route.ts`, `src/__tests__/api/billplz-checkout.test.ts` (clone xendit-checkout.test.ts), `tests/checkout-billplz.spec.ts` (E2E — required for new route)
- Modify: `src/lib/validations/orders.ts`, `src/app/sites/[slug]/checkout/{page.tsx,CheckoutClient.tsx}`, `src/app/api/storefront/site-by-slug/route.ts`, `src/components/storefront/stripe-back-redirect.tsx` (key list), `src/lib/email/templates/shared/email-utils.ts`, `order-confirmation.ts`, `order-shipped.ts`, `order-completed.ts`, `src/app/(dashboard)/orders/_components/OrdersActionBar.tsx`, `src/app/sites/[slug]/orders/[orderNumber]/OrderTrackingClient.tsx`, `src/collections/Orders.ts` (notify-owner guard), i18n files

## Implementation Steps

1. `billplzCheckoutSchema` (+ `discountCode`, + `orderId`) — no `Sites` change, no migration in this phase
2. Route implementation (resume → items → discount → order → stock → bill+persist → emails → respond)
3. CheckoutClient + page.tsx + site-by-slug gating + auto-select + i18n + label-map consumers
4. `Orders.ts` afterChange notify-owner guard: skip when `doc.paymentProvider` non-null — NOT `paymentStatus==='awaiting_payment'` (bank_transfer orders are also `awaiting_payment` at create — checkout/route.ts:395 — and rely on this hook for ORDER_NEW; the provider check suppresses exactly xendit+billplz)
5. Unit test clone (`billplz-checkout.test.ts`) + discount-path case; E2E spec asserting redirect to bill URL (sandbox keys via fixture or stubbed client — decide in PR)
6. Verify `bill.url` redirect, `ct_` cookie set, stock rollback on bill failure

## Success Criteria

- [ ] Checkout creates order `awaiting_payment` + bill URL returned; stock decremented atomically
- [ ] Retry POST with `orderId` of a bill-bearing pending order returns the same bill URL (no second bill)
- [ ] Valid `discountCode` reduces bill amount to match displayed total; invalid → 422
- [ ] Bill failure → order deleted + stock restored + 502
- [ ] Billplz-only store (no Stripe/COD/QR): option visible AND selected by default (hasPaymentMethods + auto-select)
- [ ] `sen` conversion correct: RM12.34 → `amount=1234`
- [ ] New BT order still emits `ORDER_NEW` owner notification (guard regression check)

## Risk Assessment

- **Amount units** (RM vs sen) is the #1 regression risk — single conversion point + unit test `1234` assertion.
- Duplicate submits without `orderId` still create duplicate orders (same as xendit today) — client `acquireSubmitLock` + `orderId` resume mitigate; residual risk documented, not fully solved (Billplz has no idempotency key).
- Order created but response lost → bill exists with reference_2 → reconcile cron (P5) + webhook `?o=` backfill (P4) recover.
- `paymentMethod:'billplz'` in an elimination-based consumer missed here → shows as Stripe/Card-·-FPX — mitigate by grepping `paymentMethod` consumers before merge.
