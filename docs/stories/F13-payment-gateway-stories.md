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

---

## US-F13-05: Khôi phục thanh toán dở dang (Wave 6.5)

**Wave 6.5** | **P0** | **M** | **Status:** Ready

### Story

```
As a   buyer who didn't finish paying
I want to resume payment from my order link without re-adding items
So that I can complete my purchase even if I cancelled or my session expired
```

### Acceptance Criteria

#### AC-1: Cancel preserves cart + shows toast
```gherkin
GIVEN buyer at Stripe Checkout
WHEN  they click Back or Cancel
THEN  cart items PRESERVED in storefront checkout (not cleared)
  AND BM toast "Pembayaran gagal. Sila cuba lagi."
  AND "Try Again" CTA triggers new Stripe session (existing stripeSessionId may be expired)
```

#### AC-2: Confirm page polling + processing state
```gherkin
GIVEN buyer redirected from Stripe success_url to /sites/[slug]/order/[id]/confirm
  AND order.status='pending' (webhook may be delayed)
WHEN  Confirm page loads
THEN  show skeleton/spinner "Verifying your payment..."
  AND poll `/api/orders/[id]/payment-status` every 2 seconds (auth via ct_ cookie)
  AND auto-flip to success when paymentStatus='paid'
  AND no white screen; no "awaiting payment" ambiguity
```

#### AC-3: Pay Now on order detail (for pending/payment_failed)
```gherkin
GIVEN buyer has order status='pending' or 'payment_failed'
WHEN  buyer access order detail page (via email magic link, no login required)
THEN  "Pay Now" CTA visible
  AND click "Pay Now" → POST `/api/orders/[id]/retry-payment`
  AND re-validate stock (reject if out)
  AND return new Stripe session URL
  AND create NEW stripeSessionId (don't reuse expired one)
  AND buyer redirected to Stripe Checkout (repeat cycle)
```

#### AC-4: Cart cleared ONLY after confirmed success
```gherkin
GIVEN order.paymentStatus='paid' (confirmed via webhook or active reconcile)
WHEN  Confirm page shows success state
THEN  clear cart from session/localStorage exactly once
  AND NOT before Stripe redirect (BR-04)
  AND NOT on cancel (cart preserved)
  AND only after confirmed success at Confirm page
```

### Definition of Done
- [ ] Cancel keeps cart + BM toast tested E2E
- [ ] Confirm page polling works with delayed webhook (mock 5s+)
- [ ] Pay Now endpoint re-validates stock and rejects out-of-stock
- [ ] Cart cleared only on final success, not before
- [ ] i18n strings (en + ms) for "Verifying...", "Payment declined", "Pay Now"

---

## US-F13-06: Xác nhận thanh toán đáng tin cậy (Wave 6.5)

**Wave 6.5** | **P0** | **L** | **Status:** Ready

### Story

```
As a   buyer
I want successful payment to reliably show as paid even if the webhook is delayed
And the system to never oversell or mis-record my payment method
So that I trust my order was processed correctly
```

### Acceptance Criteria

#### AC-1: Webhook success sets status + paymentStatus atomically
```gherkin
GIVEN Stripe webhook `checkout.session.completed` arrives for order
WHEN  backend processes webhook
THEN  UPDATE orders SET status='new', payment_status='paid'
       WHERE id=? AND status='pending' (atomic, single-winner)
  AND ONLY the first webhook invocation wins (concurrent retries skip)
  AND stock decrements exactly once (guarded by atomic transition)
  AND buyer/seller emails sent once
  AND ORDER_NEW notification fired once
```

#### AC-2: Atomic stock decrement UPFRONT (Prevent-Upfront, GH-1099)
```gherkin
GIVEN buyer place order for product with inventory=M at checkout
WHEN  POST /api/orders/stripe-checkout executes
THEN  UPDATE products SET inventory = GREATEST(0, inventory - qty)
      WHERE id=? AND inventory >= qty (atomic CAS at checkout, not webhook)
  AND IF inventory >= qty: order created, Stripe session returned → buyer pays
  AND IF inventory < qty: order creation fails → HTTP 422 OUT_OF_STOCK, buyer sees error, cart preserved
  AND Oversell is prevented upfront — NOT detected after capture
```

#### AC-3: **[SUPERSEDED GH-1099, PR #1160]** Oversell after capture (OBSOLETE — No Longer Applicable)
```gherkin
PREVIOUS APPROACH (Wave 6 initial): Oversell after capture → manual seller refund
  ↓
CURRENT APPROACH (GH-1099): Stock decremented UPFRONT at checkout (AC-2 CAS)
  → Oversell is impossible due to atomic stock validation
  → `oversellReview` field deprecated; order CANNOT have inventory < qty after payment
  → Manual seller refund scenario eliminated by architecture (prevent-upfront)

RATIONALE:
  - Moving stock decrement from webhook (post-capture) to checkout (pre-redirect)
  - CAS `WHERE inventory >= qty` ensures atomic validation
  - If qty unavailable: order fails at creation, never reaches Stripe
  - If qty available: order guaranteed to succeed without oversell risk
  → No `SYSTEM_ALERT`, no admin refund button, no post-capture oversell handling needed
```

#### AC-4: Accurate payment method detection
```gherkin
GIVEN tenant supports both Card + FPX
WHEN  buyer pays via FPX
THEN  webhook queries Stripe PaymentIntent on connected account
  AND detect payment_method='fpx'
  AND set order.paymentMethod='fpx' (not default 'card' for multi-method tenant)
```

#### AC-5: Active reconcile on Confirm polling
```gherkin
GIVEN order pending, Confirm page querying `/api/orders/[id]/payment-status` every 2s
WHEN  webhook hasn't arrived yet but Stripe session.status='paid'
THEN  active reconcile endpoint:
  └── retrieve Stripe session on connected account
  └── if session.status='paid' AND order.status='pending':
      └── call reconcileOrderPaid() [same as webhook, single source of truth]
      └── order auto-heals to paid immediately
  AND Confirm page shows success within next poll cycle (no manual intervention)
```

#### AC-6: Cron reconciles late/missing webhooks
```gherkin
GIVEN order pending > 15 minutes
  AND webhook never arrived (or was lost)
WHEN  cron job `GET /api/cron/reconcile-orders` runs (every 10 min)
THEN  cron queries Stripe session on connected account
  └── if session.status='paid' → call reconcileOrderPaid()
  └── order heals to paid, emails re-sent (idempotent)
  AND stale pending >24h marked 'expired' (buyer notified separately)
  AND cron rejects request without valid CRON_SECRET header (security)
```

### Definition of Done
- [ ] Atomic `UPDATE WHERE status='pending'` tested (idempotent on retry)
- [ ] **[GH-1099]** Stock decrement moved to checkout; CAS `WHERE inventory >= qty` tested + prevents negative
- [ ] **[GH-1099, OBSOLETE]** ~~Oversell flag (boolean `oversellReview`) tested~~ → Oversell no longer possible; flag deprecated (PR #1160)
- [ ] **[GH-1099, OBSOLETE]** ~~Admin refund button~~ → No longer needed; prevent-upfront ensures no post-capture oversell
- [ ] PaymentIntent read from connected account; fpx method recorded correctly
- [ ] Confirm polling + active reconcile tested with delayed webhook (5+ min)
- [ ] Cron reconcile tested; stale orders expired; CRON_SECRET auth verified
- [ ] Schema migration: `oversell_review` column kept (NEVER-DROP per `.claude/rules/database-schema.md`) but unused
- [ ] i18n (en + ms) for cron message + confirmation state; ~~oversell alert~~ removed

