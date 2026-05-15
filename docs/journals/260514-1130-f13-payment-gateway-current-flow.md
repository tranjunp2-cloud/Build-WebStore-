---
title: "F13 Payment Gateway — Flow & Key Decisions"
date: 2026-05-15
branch: feat/F13-963-fpx-payment-stripe-my
scope: F13 Payment Gateway
status: feature-complete / pre-merge
---

# F13 Payment Gateway — Flow & Key Decisions

**Tính năng:** Card (Visa/MC) + FPX Online Banking cho storefront Malaysia.  
**Mô hình:** Stripe Connect Standard + Direct Charges. Buyer redirect sang `checkout.stripe.com` — app không xử lý số thẻ, PCI-DSS về Stripe.

---

## Flow 1 — Seller Onboarding

```
Seller vào /settings/payments
        │
        ├─ [chưa có stripeAccountId] ─────────────────────────────────────────────┐
        │                                                                          ▼
        │                                                          Hiện nút "Connect Stripe Account"
        │                                                                          │
        │                                                          Click → POST /api/stripe/connect/onboard
        │                                                            ├─ stripe.accounts.create (Standard, MY)
        │                                                            ├─ tenant.stripeAccountId = acct_xxx
        │                                                            └─ stripe.accountLinks.create → URL
        │                                                                          │
        │                                                          window.location.href = onboardingUrl
        │                                                          [Seller sang Stripe KYC]
        │                                                                          │
        │                                                    ┌─────────────────────┴──────────────────┐
        │                                              ?stripe=complete                        ?stripe=refresh
        │                                         (KYC xong, chờ verify)                    (bỏ dở, retry)
        │                                                                                           │
        ├─ [có stripeAccountId, chưa verify] ──────────────────────────────────────────────────────┘
        │                                                                          │
        │                                                          Hiện nút "Verify Connection"
        │                                                                          │
        │                                                          Click → GET /api/stripe/connect/status
        │                                                            ├─ stripe.accounts.retrieve(acct_xxx)
        │                                                            └─ onboardingComplete = charges_enabled && details_submitted
        │                                                                          │
        │                                                 ┌────────────────────────┴──────────────────────┐
        │                                           onboardingComplete=true                    onboardingComplete=false
        │                                    tenant.stripeOnboardingComplete=true         toast "still under review"
        │                                                 │                                    (seller retry bất cứ lúc)
        │                                                 ▼
        └─ [stripeOnboardingComplete=true] ──────────────────────────────────────────────────────────────┐
                                                                                                         ▼
                                                                         StripeConnectedBar + Card/FPX toggles
                                                                         Seller bật toggle → PATCH tenant.payments.payment_card/fpx
                                                                         (beforeChange hook: ép false nếu !stripeOnboardingComplete)
```

**Auto-verify qua webhook:** Khi Stripe push `account.updated` → webhook set `stripeOnboardingComplete` tự động, không cần seller bấm Verify.  
**Deauthorize:** Seller revoke app từ Stripe Dashboard → `account.application.deauthorized` → reset `onboardingComplete=false`, `payment_card/fpx=false`.

---

## Flow 2 — Buyer Checkout

```
Storefront /sites/[slug]/checkout
        │
        ├─ GET /api/storefront/site-by-slug
        │    └─ compute 2-layer config:
        │         Layer 1 (tenant): payment_card === true | payment_fpx === true   ← strict opt-in
        │         Layer 2 (site):   cardEnabled !== false | fpxEnabled !== false   ← permissive opt-out
        │         → cardEnabled = L1_card && L2_card
        │         → fpxEnabled  = L1_fpx  && L2_fpx
        │         → stripeEnabled = onboardingComplete && !!stripeAccountId
        │
        ├─ stripeRowVisible = stripeEnabled && (cardEnabled || fpxEnabled)
        │    Label: Card+FPX → "Pay with Stripe (Card · FPX)"
        │            Card only → "Pay with Card"
        │            FPX only  → "Pay with FPX (Online Banking)"
        │            none      → row ẩn
        │
        Buyer chọn Stripe, điền shipping, click "Place Order"
        │
        ▼
POST /api/orders/stripe-checkout
        │
        ├─ [1] Validate body (Zod): max 50 items, quantity max 100
        ├─ [2] Resolve site → 404 NOT_FOUND
        ├─ [3] Resolve tenant → 404 NOT_FOUND | 403 STORE_UNAVAILABLE (suspended/banned)
        ├─ [4] Stripe readiness → 422 STRIPE_NOT_CONNECTED | STRIPE_NOT_READY
        ├─ [5] buildPaymentMethodTypes(tenant) → 422 NO_PAYMENT_METHODS
        │       + site guard → 422 METHOD_DISABLED
        ├─ [6] buildOrderItems → validate stock, tính subtotal
        │       shippingFee = 10 RM (flat, TODO #962)
        │       tax = subtotal × 6% (SST)
        │       total = subtotal + shippingFee + tax
        │
        ├─ [total <= 0] → order status='paid', paymentMethod='free', return sessionUrl=null
        │
        └─ [total > 0]
                │
                ├─ payload.create order { status: 'pending', paymentMethod: types[0] || 'card' }
                │
                ├─ createStripeCheckoutSession
                │    ├─ line_items: products + Shipping + SST (hiển thị đủ cho buyer)
                │    ├─ applicationFeeAmountCents = 0  ← cross-border unsupported (US platform + MY account)
                │    ├─ stripeAccountId → Direct Charges on seller's account
                │    ├─ successUrl: /sites/[slug]/order/[id]/confirm?session_id=...
                │    └─ cancelUrl:  /sites/[slug]/checkout?stripe_cancelled=1
                │
                ├─ [Stripe error] → payload.delete order (cleanup) → 502 STRIPE_API_ERROR
                │
                └─ payload.update order { stripeSessionId }
                   return { sessionUrl }
                           │
                   window.location.href = sessionUrl
                   [Buyer sang Stripe Checkout]
                           │
               ┌───────────┴───────────┐
          Buyer pays              Buyer cancels
               │                       │
     Stripe → webhook          redirect ?stripe_cancelled=1
  checkout.session.completed   toast + cart giữ nguyên
```

---

## Flow 3 — Webhook Processing

```
POST /api/webhooks/stripe
        │
        ├─ request.text() → rawBody  (KHÔNG parse JSON trước khi verify)
        ├─ detect Connect: JSON.parse(rawBody).account → isConnect boolean
        ├─ verifyStripeWebhook(rawBody, signature, isConnect)
        │    isConnect=false → STRIPE_WEBHOOK_SECRET
        │    isConnect=true  → STRIPE_CONNECT_WEBHOOK_SECRET ?? STRIPE_WEBHOOK_SECRET
        │    sai signature → 400
        ├─ normalizeStripeEvent → null nếu không handle → return 200 (Stripe không retry)
        │
        └─ switch(event.type):

   checkout.session.completed → payment_success
        │
        ├─ Idempotency: find order WHERE stripeSessionId = session.id
        │   (KHÔNG filter status — Stripe có thể retry sau khi order đã 'confirmed')
        │   docs.length > 0 → đã xử lý, return
        │
        ├─ payload.update order {
        │    status: 'new',
        │    stripeSessionId,
        │    stripePaymentIntentId,
        │    stripeChargeId,
        │    paymentMethod: session.payment_method_types[0] === 'fpx' ? 'fpx' : 'card'
        │  }
        ├─ decrementStock (3-retry read-then-write, không atomic — TODO Wave 7)
        ├─ sendEmail xác nhận (try/catch riêng — failure không fail webhook)
        └─ notifyTenantOwners ORDER_NEW (fire-and-forget)

   payment_intent.payment_failed → payment_failed
        │
        ├─ Tìm order: stripePaymentIntentId → fallback metadata.orderId
        ├─ Skip guard: nếu status ∈ {new, confirmed, ready_to_ship, shipped, completed, refunded, payment_failed}
        │   → return (tránh out-of-order event đè lên đơn đã thành công)
        ├─ payload.update order { status: 'payment_failed' }
        └─ notifyTenantOwners SYSTEM_ALERT (fire-and-forget)

   account.updated → account_updated
        ├─ find tenant WHERE stripeAccountId = account.id
        └─ stripeOnboardingComplete = charges_enabled && details_submitted

   account.application.deauthorized → account_deauthorized
        ├─ find tenant WHERE stripeAccountId = accountId
        └─ payload.update { stripeOnboardingComplete: false, payment_card: false, payment_fpx: false }

   Mọi event handler: luôn return 200 dù có error bên trong
   (Stripe retry 5xx → có thể double-process; log để debug, ack để Stripe dừng retry)
   Exception: sai signature → 400 (attack detection)
```

---

## Flow 4 — Refund

```
POST /api/orders/[id]/refund
        │
        ├─ Auth: payload.auth (dashboard session required)
        ├─ IDOR check: order.tenant ∈ user.tenants
        ├─ Status check: refundableStatuses = [new, paid, confirmed, ready_to_ship, shipped, completed]
        │   'pending' / 'payment_failed' → 400 ORDER_NOT_REFUNDABLE (tiền chưa thu)
        ├─ Lấy stripePaymentIntentId từ order
        ├─ Lấy stripeAccountId từ order.tenant (Direct Charges → refund trên connected account)
        ├─ stripe.refunds.create({ payment_intent }, { stripeAccount })
        └─ payload.update order { status: 'refunded' }
```

---

## 2-Layer Config — Quick Reference

| Layer | Field | Default | Condition |
|-------|-------|---------|-----------|
| Tenant master | `tenant.payments.payment_card/fpx` | `false` | `=== true` (strict opt-in) |
| Site guard | `site.paymentConfig.cardEnabled/fpxEnabled` | `undefined` → pass | `!== false` (permissive) |

`buildPaymentMethodTypes(tenant)` đọc cả `tenant.payments.payment_card` (Payload group) và `tenant.payment_card` (flat fallback).

---

## Env Vars

| Variable | Source |
|----------|--------|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → API keys (`sk_test_...` / `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Webhooks → platform endpoint (events: checkout.session.completed, payment_intent.payment_failed, customer.subscription.updated) |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Webhooks → Connect endpoint (events: account.updated, account.application.deauthorized); fallback về `STRIPE_WEBHOOK_SECRET` nếu không set |
| `NEXT_PUBLIC_SERVER_URL` | Deployment domain |

---

## Out of Scope (Wave 6 → deferred)

- Disconnect Stripe backend (UI stub có, Wave 7)
- Touch 'n Go, GrabPay, Boost (Wave 7+)
- `application_fee_amount` (hiện = 0 vì cross-border US platform + MY account không hỗ trợ)
- Atomic stock decrement via raw SQL (Wave 7+)
- Refund UI trong dashboard (Wave 7+)
- Multi-currency USD/SGD (Wave 6 chỉ MYR)
