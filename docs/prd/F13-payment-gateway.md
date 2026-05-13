# PRD: Payment Gateway — Malaysia (F13)
> **Version:** 1.1 | **Updated:** 2026-03-16 | **Agent:** `project-planner`
> **Priority:** P1 | **Sprint:** Wave 6 | **Size:** L
> **Depends on:** F09 Storefront Commerce ✅, Stripe account ✅
> **MY Ref:** [malaysia-market-context.md](../malaysia-market-context.md) — §4 Payment Landscape

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được xây dựng từ các User Stories đã approve.
> Mọi FR phải có Story Ref. AC được copy từ story file.

> [!NOTE]
> Stories file: [`docs/stories/F13-payment-gateway-stories.md`](../stories/F13-payment-gateway-stories.md) — 4 stories đầy đủ.
> **Synced:** 2026-05-13.

---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F13-01 | Buy with FPX (Online Banking) | [F13-payment-gateway-stories.md](../stories/F13-payment-gateway-stories.md) | Draft |
| US-F13-02 | Seller Payment Settings | [F13-payment-gateway-stories.md](../stories/F13-payment-gateway-stories.md) | Draft |
| US-F13-03 | Mobile Web UX — Seamless Mobile Payment Flow | [F13-payment-gateway-stories.md](../stories/F13-payment-gateway-stories.md) | Ready |
| US-F13-04 | Connect Stripe Onboarding Flow | [F13-payment-gateway-stories.md](../stories/F13-payment-gateway-stories.md) | Draft |

---

## 1. Problem Statement

PrimeWeb chỉ hỗ trợ card payments via Stripe. Ở Malaysia, **FPX online banking** là phương thức thanh toán phổ biến nhất. Không có FPX → checkout conversion thấp đáng kể.

---

## 2. Target User

- **Buyer:** Persona C — prefer FPX hoặc e-wallet hơn credit card
- **SME Owner:** Persona A — muốn maximum payment options để không mất sale

---

## 3. Solution Overview

Thêm Card + FPX via **Stripe Checkout Session HOSTED** (Wave 6 P0). Dùng **Stripe Connect Standard accounts + Direct Charges** — payment vào account merchant đã onboard, PrimeWeb thu **3% application_fee_amount**. E-wallets (TnG, GrabPay) via Stripe (Wave 7 P1). Seller payment settings để enable/disable Card + FPX riêng (backend pass dynamic `payment_method_types` vào Checkout Session).

> **Decision §8.6 (design doc):** Wave 6 dùng Stripe Checkout Session hosted (redirect → `checkout.stripe.com`) thay vì Payment Element inline. Lý do: code đã implement Checkout Session + Connect Direct Charges; KISS — Stripe handle Card form + FPX bank picker + 3D Secure + receipt.

---

## 4. Scope

### In Scope (Wave 6 P0)
- Card + FPX via **Stripe Checkout Session HOSTED** (US-F13-01)
- **Stripe Connect Standard + Direct Charges** + 3% application fee (already implemented, F13 wires Settings UI)
- Seller payment settings: enable/disable Card, FPX riêng (US-F13-02)
- Connect Stripe onboarding flow + return handler (US-F13-04)
- Mobile UX optimization 54px hitbox (US-F13-03)

### Out of Scope (Wave 7+)
- Touch 'n Go, GrabPay, Boost (via Stripe/Ipay88)
- Cash on Delivery (COD) — handled by F19 Manual Methods
- Stripe Payment Element inline (defer; Wave 6 dùng Checkout Session hosted)
- Stripe Connect **Express/Custom** accounts (Wave 6 chỉ Standard)
- Saved cards / tokenized re-purchase
- Refund UI trong order detail

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Checkout conversion | > 50% (vs ~30% card-only) | Analytics |
| FPX adoption | > 40% of transactions | Stripe dashboard |
| Payment failure rate | < 5% | Stripe |

---

## 6. User Story Summary

```
AS A   Malaysian buyer
I WANT pay sử dụng FPX (online banking)
SO THAT tôi thanh toán trực tiếp từ bank mà không cần credit card
```

> Source: [US-F13-01](../stories/F13-payment-gateway-stories.md)

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | Card + FPX payment via **Stripe Checkout Session HOSTED** (redirect ra `checkout.stripe.com`) | US-F13-01 | P0 | Wave 6 |
| FR-02 | Bank dropdown cho FPX rendered **bởi Stripe Checkout page** (KHÔNG build inline) | US-F13-01 | P0 | Stripe handle 18 MY banks |
| FR-03 | Redirect Stripe → bank (FPX) → return `success_url`/`cancel_url` | US-F13-01 | P0 | 3D Secure flow |
| FR-04 | Payment fail: BM toast "Pembayaran gagal. Sila cuba lagi." | US-F13-01 | P0 | |
| FR-05 | Cart preserved nếu payment fail | US-F13-01 | P0 | |
| FR-06 | Seller payment settings: enable/disable Card + FPX riêng | US-F13-02 | P0 | Backend pass dynamic `payment_method_types` |
| FR-07 | Webhook `checkout.session.completed` → order status update | US-F13-01 | P0 | |
| FR-08 | **[Mobile]** Method picker stack vertical, hitbox ≥ 54px | US-F13-03 | P1 | Anti-mis-tap |
| FR-09 | **[Mobile]** Native bank picker / Bottom Sheet | US-F13-03 | P1 | Satisfied tự động bởi Stripe Checkout hosted page |
| FR-10 | Connect Stripe CTA → POST `/api/stripe/connect/onboard` → redirect Stripe-hosted KYC | US-F13-04 | P0 | Pre-condition cho FR-06 |
| FR-11 | Return handler `?stripe=complete` → toast success + refetch status | US-F13-04 | P0 | |
| FR-12 | Return handler `?stripe=refresh` → toast warning + retry CTA | US-F13-04 | P0 | |
| FR-13 | Stripe row label dynamic theo settings (Card·FPX / Card / FPX); hidden khi cả 2 OFF | US-F13-02 | P0 | Design §8.7 |
| FR-14 | Toggles Card+FPX Disabled+Lock+Tooltip khi `stripeOnboardingComplete = false` | US-F13-02 | P0 | Design §8.5 / D-03 |

---

## 8. Business Rules

- **BR-01:** Currency phải là MYR để FPX available (Stripe auto-detect)
- **BR-02:** Payment method hiện theo seller settings (không hardcode)
- **BR-03:** Order status stays 'pending' nếu payment fail (không xóa)

---

## 9. User Flow

### 9.1. Checkout flow (Buyer)

```
Checkout → "Choose payment method" (RadioGroup: Stripe / COD / QR)
  └── Select "Pay with Stripe" → click "Place Order"
        → Server tạo Stripe Checkout Session (Direct Charge on connected account)
        → Client redirect tới `checkout.stripe.com/...`
        → Stripe page render Card form + FPX bank picker (theo seller settings)
        → Buyer chọn method + complete payment
        ├── FPX: redirect to bank (3D Secure) → return
        └── Card: submit inline → return
              ├── Success: Stripe redirect success_url → confirmation page
              │   AND webhook `checkout.session.completed` → order 'new'
              └── Cancel: Stripe redirect cancel_url
                  AND BM toast "Pembayaran gagal. Sila cuba lagi."
                  AND cart preserved
```

### 9.2. Seller onboarding flow (one-time)

```
Settings > Payments → Card + FPX toggles Locked (Stripe chưa connect)
  → Click "Connect Stripe" CTA
  → POST /api/stripe/connect/onboard → return onboardingUrl
  → Client redirect tới Stripe-hosted KYC page
  → Seller complete KYC
  ├── Success: Stripe redirect `/dashboard/settings/payments?stripe=complete`
  │     AND toast success + refetch status
  │     AND IF chargesEnabled = true → toggles unlock
  └── Abandoned/refresh: redirect `/dashboard/settings/payments?stripe=refresh`
        AND toast warning + Connect CTA retry
```

---

## 10. Screen Layout

> **[Global CMS Constraint]** Tính năng Payment Method hiển thị tại bước cuối cùng của Checkout Flow ở Storefront. Cấu hình Payment Settings nằm trong Dashboard CMS F18 Layout.

> **[BẮT BUỘC]** Liệt kê chi tiết các màn hình (screens) và các state quan trọng (ví dụ: Empty, Loading, Error, Success). Mỗi màn hình cần mô tả UI component chính và luồng hiển thị.

> **[Wireframe & Design Rule]** Không cần dùng ASCII để minh hoạ. Dẫn nguồn trực tiếp từ wireframe ở thư mục design nếu có.
> **[Quy tắc Cập nhật]** Mỗi khi 1 design/wireframe mới được thêm, BẮT BUỘC phải bổ sung ở Screen Layout đường dẫn tới file đó.

### 10.1. Màn hình Checkout Payment Selection (Storefront)
- **Mô tả:** Màn hình thanh toán bên phí khách hàng (Buyer).
- **Components chính:**
  - Khối Phương thức thanh toán (Radio group): "FPX (Online Banking)", "Credit/Debit Card", "E-wallet".
  - Khi chọn FPX: Hiển thị Bank Selection Dropdown.
  - Khối Order Summary (Bên phải/Dưới): Phân rã Total (Subtotal, Shipping, SST). Bấm [Pay Now].
- **Design / Wireframe:**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 10.2. Màn hình Seller Payment Settings (CMS Dashboard)
- **Mô tả:** Nơi chủ shop bật tắt phương thức thanh toán cho Storefront.
- **Design / Wireframe:**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 10.3. Mobile View (Checkout Payment & Config)
- **Mô tả:** Màn hình Checkout Payment cho khách mua hàng trên giao diện dọc điện thoại, và trang Settings bật/tắt Payment cho chủ shop.
- **Design / Wireframe (Storefront Mobile):**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 10.4. Các trạng thái UI (UI States) & Modals
- **Loading State:** Nút "Place Order" hiển thị Spinner + text "Processing...". Sau click → full-page Dialog overlay "Redirecting to Stripe Checkout. Please don't close this window." (chống user đóng tab). FPX flow: sau khi vào Stripe page, Stripe tự handle redirect to bank.
- **Error State / Edge Cases:** Toast đỏ BM: "Pembayaran gagal. Sila cuba lagi." khi return cancel_url. Cart preserved (FR-05). "Try Again" CTA → re-submit Stripe Checkout Session.
- **Success State:** Stripe redirect success_url → Order Confirmation Page (F10 scope). Order status `pending → new` qua webhook.
- **Settings — Loading:** Skeleton 2 method rows khi fetch initial settings.
- **Settings — Not onboarded:** Destructive Alert + Connect Stripe CTA + toggles Disabled+Lock+Tooltip.
- **Settings — Return-from-Stripe:** Toast success/warning + refetch status (FR-11, FR-12).

---


## 11. Acceptance Criteria

> AC được lấy từ `F13-payment-gateway-stories.md`.

### AC-1: FPX Payment Happy Path
> 📌 Source: [US-F13-01](../stories/F13-payment-gateway-stories.md) — AC-1

```gherkin
GIVEN buyer at checkout selects FPX
WHEN  they choose bank và click "Pay Now"
THEN  redirect to bank's login page (3D Secure)
  AND after bank approval → redirect to confirmation page
  AND order status = 'new'
  AND webhook: payment_intent.succeeded → update order
```

### AC-2: Payment Failed
> 📌 Source: [US-F13-01](../stories/F13-payment-gateway-stories.md) — AC-2

```gherkin
GIVEN payment fails (bank declined, timeout)
WHEN  buyer redirected back
THEN  error: "Pembayaran gagal. Sila cuba lagi."
  AND cart items preserved — buyer can retry
  AND order status stays 'pending'
```

---

## 13. Technical Architecture

**Approach:** Stripe Checkout Session HOSTED + Stripe Connect Standard accounts + Direct Charges. Buyer redirect ra `checkout.stripe.com/...`; Stripe-hosted page render Card form + FPX bank picker. PrimeWeb thu 3% application_fee_amount.

```typescript
// Stripe Checkout Session — Direct Charges on connected account
// Reference: src/lib/payment/stripe.ts (createStripeCheckoutSession)
const session = await stripe.checkout.sessions.create(
  {
    mode: 'payment',
    currency: 'myr',
    payment_method_types: paymentMethodTypes, // dynamic ['card'] | ['fpx'] | ['card','fpx']
    line_items: items.map(...),
    client_reference_id: orderId,
    customer_email: customer.email,
    success_url: `${baseUrl}/sites/[slug]/orders/[id]/confirmation`,
    cancel_url: `${baseUrl}/sites/[slug]/checkout?stripe_cancelled=1`,
    payment_intent_data: {
      application_fee_amount: Math.round(totalAmount * 0.03), // 3% platform fee
      metadata: { orderId },
    },
  },
  {
    stripeAccount: tenant.stripeAccountId, // Direct Charge on connected account
  },
)
// Client: window.location.href = session.url
```

**Dynamic `payment_method_types` builder (Phase 03):**

```typescript
function buildPaymentMethodTypes(tenant): StripePaymentMethod[] {
  const methods: StripePaymentMethod[] = []
  if (tenant.payment_card) methods.push('card')
  if (tenant.payment_fpx) methods.push('fpx')
  return methods  // [] → reject 422 NO_PAYMENT_METHODS
}
```

**Webhook handler** verifies signature + handles `checkout.session.completed` → order status `pending → new`. Reference: `src/app/api/webhooks/stripe/route.ts`.

> **Decision §8.6 (design doc):** Wave 6 dùng Checkout Session hosted (Stripe Connect Standard) thay vì Payment Element inline. Payment Element + Custom/Express accounts defer Wave 7+.

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| F09 Storefront | ✅ | — |
| F10 Orders | ✅ | — |
| Stripe Malaysia account | ✅ | Enable FPX in dashboard |

---

## 17. 9-Point Done Checklist

- [ ] Loading State — "Place Order" spinner + full-page Dialog "Redirecting to Stripe..."
- [ ] Empty State — Settings: Stripe-not-connected → destructive Alert + Connect CTA; Checkout: Stripe row hidden khi cả Card+FPX OFF
- [ ] Error State — Toast BM "Pembayaran gagal. Sila cuba lagi." khi return cancel_url + cart preserved
- [ ] Form Validation — Backend reject 422 `NO_PAYMENT_METHODS` nếu cả Card+FPX OFF; Settings soft warn "At least one required"
- [ ] Button States — "Place Order" disabled khi no method selected; "Save" Settings disabled until dirty
- [ ] Toast Feedback — Settings: "Payment methods updated", "Stripe connected successfully"; Checkout: BM error toast
- [ ] Auth Redirect — Settings yêu cầu seller login; Checkout public (guest allowed)
- [ ] Mobile 375px — Method rows ≥ 54px hitbox (FR-08); FPX bank picker tự động native bởi Stripe (FR-09)
- [ ] TypeScript Clean — `tsc --noEmit` pass
- [ ] **NEW:** Stripe sandbox happy path tested (Card 4242 + FPX test bank) end-to-end
- [ ] **NEW:** Return handler `?stripe=complete`/`?stripe=refresh` works (FR-11, FR-12)
- [ ] **NEW:** Backfill migration verified — existing onboarded tenants có `payment_card = true` (D-02, 0 disruption)

---

## 18. Definition of Ready

- [ ] User Stories F13 approved
- [ ] Stripe Malaysia enabled
- [ ] F09, F10 done

---

## 19. Definition of Done

- [ ] FPX flow end-to-end tested
- [ ] Card + FPX both working
- [ ] Webhook: order status updates correctly
