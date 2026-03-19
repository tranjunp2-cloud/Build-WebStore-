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
> F13 chưa có Story file riêng (sử dụng US-F13-02 từ F10 Orders).
> **Action required:** Tạo `F11-payment-stories.md` với stories cho FPX, e-wallet, seller settings.


---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F13-02 | Customer Checkout with Stripe | [F10-orders-stories.md](../stories/F10-orders-stories.md) | Draft |
| *(Pending)* | FPX Payment | *(F11-payment-stories.md chưa có)* | Needs Story |
| *(Pending)* | Seller Payment Settings | *(F11-payment-stories.md chưa có)* | Needs Story |

> ⚠️ FPX + e-wallet + Seller Settings stories chưa tạo. Tạo trước khi bắt đầu development.

---

## 1. Problem Statement

PrimeWeb chỉ hỗ trợ card payments via Stripe. Ở Malaysia, **FPX online banking** là phương thức thanh toán phổ biến nhất. Không có FPX → checkout conversion thấp đáng kể.

---

## 2. Target User

- **Buyer:** Persona C — prefer FPX hoặc e-wallet hơn credit card
- **SME Owner:** Persona A — muốn maximum payment options để không mất sale

---

## 3. Solution Overview

Thêm FPX via Stripe Malaysia (Wave 6 P0). E-wallets (TnG, GrabPay) via Stripe (Wave 7 P1). Seller payment settings để enable/disable methods. Stripe Connect cho merchant payout.

---

## 4. Scope

### In Scope (Wave 6 P0)
- FPX via Stripe Payment Element (US-F13-02 extended)
- Card payment (existing — refactor to use Payment Element)
- Seller payment settings: enable/disable Card, FPX

### Out of Scope (Wave 7+)
- Touch 'n Go, GrabPay, Boost (via Stripe/Ipay88)
- Cash on Delivery (COD)
- Stripe Connect for merchant payout

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
| FR-01 | FPX payment via Stripe Payment Element | US-F13-01 | P0 | Wave 6 |
| FR-02 | Bank dropdown cho FPX: Maybank, CIMB, etc. | US-F13-01 | P0 | |
| FR-03 | Redirect to bank → approval → back to confirmation | US-F13-01 | P0 | 3D Secure flow |
| FR-04 | Payment fail: error message BM "Pembayaran gagal. Sila cuba lagi." | US-F13-01 | P0 | |
| FR-05 | Cart preserved nếu payment fail | US-F13-01 | P0 | |
| FR-06 | Seller payment settings: enable/disable Card, FPX | US-F13-02 | P0 | |
| FR-07 | Webhook: payment_intent.succeeded → order status update | US-F13-01 | P0 | |
| FR-08 | **[Mobile]** Layout chọn phương thức thanh toán kiểu Cột đứng (Stacked), các hitbox thanh toán rộng (>= 54px). | US-F13-03 | P1 | Chống chạm nhầm |
| FR-09 | **[Mobile]** Sử dụng giao diện chọn Ngân hàng thân thiện chạm (Native OS dropdown hoặc Bottom Sheet). | US-F13-03 | P1 | Tốc độ thanh toán |

---

## 8. Business Rules

- **BR-01:** Currency phải là MYR để FPX available (Stripe auto-detect)
- **BR-02:** Payment method hiện theo seller settings (không hardcode)
- **BR-03:** Order status stays 'pending' nếu payment fail (không xóa)

---

## 9. User Flow

```
Checkout → "Choose payment method"
  ├── FPX → bank dropdown → "Pay Now"
  │     → redirect to bank (3D Secure) → return
  │     ├── Success: Stripe webhook → order 'new' → confirmation
  │     └── Fail: "Pembayaran gagal" toast, cart preserved
  └── Card → Stripe Card Element → submit
        → same webhook flow
```

---

## 10. Screen Layout

> **[Global CMS Constraint]** Tính năng Payment Method hiển thị tại bước cuối cùng của Checkout Flow ở Storefront. Cấu hình Payment Settings nằm trong Dashboard CMS F18 Layout.

> **[BẮT BUỘC]** Liệt kê chi tiết các màn hình (screens) và các state quan trọng (ví dụ: Empty, Loading, Error, Success). Mỗi màn hình cần mô tả UI component chính và luồng hiển thị.

### 10.1. Màn hình Checkout Payment Selection (Storefront)
- **Mô tả:** Màn hình thanh toán bên phí khách hàng (Buyer).
- **Components chính:**
  - Khối Phương thức thanh toán (Radio group): "FPX (Online Banking)", "Credit/Debit Card", "E-wallet".
  - Khi chọn FPX: Hiển thị Bank Selection Dropdown.
  - Khối Order Summary (Bên phải/Dưới): Phân rã Total (Subtotal, Shipping, SST). Bấm [Pay Now].
- **Wireframe:**
```text
┌─ Payment Method ──────────────────────┐
│  ⦿ 🏦 FPX (Online Banking)           │
│     Select your bank: [Maybank ▼]     │
│  ○ 💳 Credit/Debit Card              │
│  ○ 📱 E-wallet (Wave 7)              │
│                                        │
│  Subtotal: RM 189.00                  │
│  Shipping: RM 8.00                    │
│  SST (6%): RM 11.82                  │
│  Total:    RM 208.82                  │
│                                        │
│  [Pay Now — RM 208.82]                │
└────────────────────────────────────────┘
```

### 10.2. Màn hình Seller Payment Settings (CMS Dashboard)
- **Mô tả:** Nơi chủ shop bật tắt phương thức thanh toán cho Storefront.
- **Wireframe:**
```text
┌─ Payment Settings ──────────────────────────┐
│  Configure how you receive money:           │
│                                             │
│  [✓] 💳 Credit/Debit Card (Stripe)         │
│      Allow Visa, Mastercard.                │
│                                             │
│  [✓] 🏦 Online Banking (FPX)               │
│      Allow Maybank, CIMB, RHB, etc.         │
│                                             │
│  [ ] 💵 Cash on Delivery (COD)             │
│      Pay when item arrives.                 │
│                                             │
│  [ Save Settings ]                          │
└─────────────────────────────────────────────┘
```

### 10.3. Mobile View (Checkout Payment & Config)
- **Mô tả:** Màn hình Checkout Payment cho khách mua hàng trên giao diện dọc điện thoại, và trang Settings bật/tắt Payment cho chủ shop.
- **Wireframe (Storefront Mobile):**
```text
┌─ Mobile Checkout: Payment ──────────────────┐
│ [←] Back         [🔒 Secure]                │
│ ─────────────────────────────────────────── │
│ Phương thức thanh toán:                     │
│ ┌────────────────────────────────────────┐  │
│ │ ⦿ 🏦 FPX (Online Banking)              │  │
│ │   [ Chọn Ngân hàng ▼ ]                   │  │
│ ├────────────────────────────────────────┤  │
│ │ ○ 💳 Thẻ Tín dụng/Ghi nợ               │  │
│ ├────────────────────────────────────────┤  │
│ │ ○ 📱 E-wallet (Wave 7)                 │  │
│ └────────────────────────────────────────┘  │
│                                             │
│ ─────────────────────────────────────────── │
│ Tổng thanh toán: RM 208.82                  │
│ [ THÀNH TOÁN NGAY ]                         │
└─────────────────────────────────────────────┘
```

### 10.4. Các trạng thái UI (UI States) & Modals
- **Loading State:** Nút "Pay Now" hiển thị Spinner và text "Processing...". Khi submit thành công có thể hiện một màng mờ overlay toàn trang "Redirecting to your bank...".
- **Error State / Edge Cases:** Toast đỏ: "Pembayaran gagal. Sila cuba lagi." Bị từ chối thẻ hoặc API timeout.
- **Success State:** Redirect tự động về Order Confirmation Page.

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

```typescript
// Stripe Payment Element — enables FPX for MY
const paymentIntent = await stripe.paymentIntents.create({
  amount: 20882,            // RM 208.82 in cents
  currency: 'myr',
  payment_method_types: ['card', 'fpx'], // ← add 'fpx'
})
// Stripe Payment Element auto-shows FPX for MYR
```

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| F09 Storefront | ✅ | — |
| F10 Orders | ✅ | — |
| Stripe Malaysia account | ✅ | Enable FPX in dashboard |

---

## 17. 9-Point Done Checklist

- [ ] Loading State — Payment button spinner khi processing
- [ ] Empty State — N/A
- [ ] Error State — "Pembayaran gagal" + retry button
- [ ] Form Validation — Bank selection required for FPX
- [ ] Button States — "Pay Now" disabled during processing
- [ ] Toast Feedback — N/A (uses redirect flow)
- [ ] Auth Redirect — N/A (checkout public)
- [ ] Mobile 375px — Payment methods stack vertically, ≥ 44px
- [ ] TypeScript Clean

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
