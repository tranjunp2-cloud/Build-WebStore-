# User Stories: Payment Gateway (F13)

> **Feature:** F13 — Payment Gateway (Malaysia)
> **Wave:** 6 | **Priority:** P1 | **Ref PRD:** [F13-payment-gateway.md](../prd/F13-payment-gateway.md)

---

## US-F13-01: Buy with FPX (Online Banking)

**Wave 6** | **P0** | **L** | **Status:** Draft

### Story

```
As a   Malaysian buyer
I want pay sử dụng FPX (online banking)
So that tôi thanh toán trực tiếp từ bank mà không cần credit card
```

### Acceptance Criteria

#### AC-1: FPX Payment Happy Path (Stripe Checkout Session HOSTED)
```gherkin
GIVEN buyer at checkout selects "Pay with Stripe" và click "Place Order"
WHEN  client POST /api/orders/create
THEN  backend tạo Stripe Checkout Session (Direct Charge on tenant's connected account)
  AND backend trả `{ url: 'https://checkout.stripe.com/...' }`
  AND client redirect tới Stripe Checkout page (FR-01)

GIVEN buyer ở Stripe Checkout page
WHEN  buyer chọn FPX → chọn bank → submit
THEN  Stripe redirect to bank's login page (3D Secure)
  AND after bank approval → Stripe redirect to success_url
  AND buyer land /sites/[slug]/orders/[id]/confirmation
  AND webhook checkout.session.completed → update order status 'pending → new'
```

#### AC-2: Payment Failed
```gherkin
GIVEN payment fails (bank declined, timeout)
WHEN  buyer redirected back
THEN  error: "Pembayaran gagal. Sila cuba lagi."
  AND cart items preserved — buyer can retry
  AND order status stays 'pending'
```

### Definition of Done
- [ ] Tích hợp Stripe Payment Element cho MYR.
- [ ] Webhook xử lý đúng luồng thanh toán thành công/thất bại.

---

## US-F13-02: Seller Payment Settings

**Wave 6** | **P0** | **M** | **Status:** Draft

### Story

```
As a   SME Owner
I want bật/tắt các phương thức thanh toán (Card, FPX)
So that tôi kiểm soát được cổng thanh toán theo nhu cầu kinh doanh
```

### Acceptance Criteria

#### AC-1: Toggle Payment Methods (Dynamic `payment_method_types`)
```gherkin
GIVEN seller đang ở Dashboard > Settings > Payments
  AND tenant.stripeOnboardingComplete = true
WHEN  seller bật/tắt toggle Card hoặc FPX
THEN  persist `tenant.payment_card` / `tenant.payment_fpx` vào DB
  AND toast "Payment methods updated"
  AND checkout API tự động pass dynamic `payment_method_types` array
      vào Stripe Checkout Session (chỉ enabled methods render trên Stripe page)

GIVEN tenant cả Card OFF + FPX OFF
WHEN  buyer load checkout page
THEN  Stripe row HIDDEN (FR-13) — chỉ render COD + QR options

GIVEN tenant chỉ Card ON
WHEN  buyer load checkout page
THEN  Stripe row label = "Pay with Card" (FR-13 §8.7)

GIVEN tenant cả Card ON + FPX ON
WHEN  buyer load checkout page
THEN  Stripe row label = "Pay with Stripe (Card · FPX)"
```

#### AC-2: Disabled+Lock+Tooltip khi not onboarded
```gherkin
GIVEN tenant.stripeOnboardingComplete = false
WHEN  seller load Settings > Payments
THEN  Card + FPX toggles render disabled + lock icon overlay
  AND hover toggle → tooltip "Connect Stripe to enable"
  AND destructive Alert banner top: "Connect Stripe to accept Card & FPX"
  AND CTA button "Connect Stripe →" visible
```

#### AC-3: Backend Defense-in-depth Validation (FR-15)
```gherkin
GIVEN tenant.payment_card = false AND tenant.payment_fpx = false
  AND client somehow bypass UI hide rule (FR-13)
WHEN  POST /api/orders/create với buyer chọn Stripe
THEN  backend buildPaymentMethodTypes(tenant) returns []
  AND API reject với HTTP 422
  AND error response { code: 'NO_PAYMENT_METHODS', message: 'Seller has not enabled Card or FPX' }
  AND KHÔNG gọi Stripe API (zero waste)
```

### Definition of Done
- [ ] UI Settings cập nhật real-time phía cổng thanh toán (Checkout).
- [ ] Dynamic `payment_method_types` verified qua Stripe sandbox.
- [ ] Disabled+Lock+Tooltip UX verified screen-reader compatible.
- [ ] Backend 422 `NO_PAYMENT_METHODS` test cover both-OFF edge case (FR-15).

---

## US-F13-03: Mobile Web UX — Seamless Mobile Payment Flow

**Wave 6** | **P1** | **M** | **Status:** Ready

### Story

```
As a   mobile shopper
I want the payment selection and banking interfaces to be optimized for my phone
So that I can easily tap and select my bank without zooming in
```

### Acceptance Criteria

#### AC-1: Tap-Friendly Payment Methods

```gherkin
GIVEN a mobile shopper is at the payment method selection stage
WHEN  they view the options (Card, FPX)
THEN  each option is rendered as a large, tappable Card or Row with ample padding (≥ 54px height)
  AND the active state is clearly highlighted
```

#### AC-2: Native Bank Selection

```gherkin
GIVEN a mobile shopper selects FPX
WHEN  they are prompted to choose their bank
THEN  the bank selection dropdown triggers the OS-native select picker (iOS/Android) or a touch-friendly Bottom Sheet, rather than a cramped custom web dropdown
```

### Definition of Done
- [ ] 9-Point Checklist pass.

---

## US-F13-04: Connect Stripe Onboarding Flow

**Wave 6** | **P0** | **M** | **Status:** Draft

### Story

```
As a   SME Owner
I want to connect my Stripe account directly from Dashboard > Settings > Payments
So that I can accept Card and FPX payments via Stripe Checkout
```

### Acceptance Criteria

#### AC-1: Connect CTA — Happy Path
```gherkin
GIVEN tenant chưa có stripeAccountId (lần đầu connect)
  AND seller đang ở Dashboard > Settings > Payments
WHEN  seller click "Connect Stripe →" button
THEN  backend POST /api/stripe/connect/onboard
  AND tạo Stripe Connect Standard account với country='MY'
  AND save tenant.stripeAccountId + stripeOnboardingComplete=false
  AND return onboardingUrl (Stripe-hosted KYC page)
  AND client redirect window.location.href = onboardingUrl

GIVEN tenant đã có stripeAccountId nhưng chưa complete KYC
WHEN  seller click "Connect Stripe →" button (retry)
THEN  backend tạo new account_link cho existing account
  AND return onboardingUrl mới
  AND client redirect
```

#### AC-2: Return từ Stripe — Success
```gherkin
GIVEN seller hoàn thành Stripe KYC trên Stripe-hosted page
WHEN  Stripe redirect back về /dashboard/settings/payments?stripe=complete
THEN  client useEffect parse `?stripe=complete` (FR-11)
  AND call GET /api/stripe/connect/status?tenantId=
  AND IF chargesEnabled=true:
    AND toast success "Stripe connected successfully!"
    AND Card + FPX toggles unlock (Disabled+Lock state remove)
    AND destructive Alert banner ẩn
  AND IF chargesEnabled=false (KYC pending):
    AND toast warning "Stripe account created but KYC verification is pending"
  AND router.replace strip query param khỏi URL
```

#### AC-3: Return từ Stripe — Refresh/Abandoned
```gherkin
GIVEN seller abort hoặc cần retry KYC trên Stripe page
WHEN  Stripe redirect back về /dashboard/settings/payments?stripe=refresh
THEN  client useEffect parse `?stripe=refresh` (FR-12)
  AND toast warning "Stripe onboarding incomplete. Click Connect again to continue."
  AND Card + FPX toggles vẫn Disabled+Lock
  AND Connect CTA vẫn visible cho seller retry
  AND router.replace strip query param
```

#### AC-4: Backend return URL coordination
```gherkin
GIVEN backend /api/stripe/connect/onboard cần set return URLs
WHEN  tạo accountLink
THEN  success_url = `${baseUrl}/dashboard/settings/payments?stripe=complete`
  AND refresh_url = `${baseUrl}/dashboard/settings/payments?stripe=refresh`
  AND KHÔNG dùng `/settings?stripe=...` (out-of-scope path)
```

### Definition of Done
- [ ] Full Stripe sandbox cycle test: Connect → KYC → return complete → toggles unlock
- [ ] Abandoned KYC cycle test: Connect → close Stripe tab → return refresh → retry CTA visible
- [ ] Backend return URLs updated `/dashboard/settings/payments` (Phase 02c)
- [ ] i18n strings (en + ms) cho 4 messages: connectStripeSuccess, stripeKycPending, stripeOnboardingIncomplete, connecting
- [ ] Manual QA: tenant ownership verify (user không thuộc tenant → 403)

