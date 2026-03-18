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

> Story pending — xem Section 0 note.

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | FPX payment via Stripe Payment Element | US-F13-02 | P0 | Wave 6 |
| FR-02 | Bank dropdown cho FPX: Maybank, CIMB, etc. | *(Pending)* | P0 | |
| FR-03 | Redirect to bank → approval → back to confirmation | *(Pending)* | P0 | 3D Secure flow |
| FR-04 | Payment fail: error message BM "Pembayaran gagal. Sila cuba lagi." | *(Pending)* | P0 | |
| FR-05 | Cart preserved nếu payment fail | US-F13-02 | P0 | |
| FR-06 | Seller payment settings: enable/disable Card, FPX | *(Pending)* | P0 | |
| FR-07 | Webhook: payment_intent.succeeded → order status update | US-F13-02 | P0 | |

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

```
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

---

## 11. Acceptance Criteria

> AC pending — story file belum ada. AC sementara derived dari F10 scope.

### AC-1: FPX Payment Happy Path
> 📌 Source: US-F13-02 (extended) — derived requirement

```gherkin
GIVEN buyer at checkout selects FPX
WHEN  they choose bank và click "Pay Now"
THEN  redirect to bank's login page (3D Secure)
  AND after bank approval → redirect to confirmation page
  AND order status = 'new'
  AND webhook: payment_intent.succeeded → update order
```

### AC-2: Payment Failed
> 📌 Source: US-F13-02 — AC-2

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

- [ ] ⚠️ Story file `F11-payment-stories.md` created
- [ ] Stripe Malaysia enabled
- [ ] F09, F10 done

---

## 19. Definition of Done

- [ ] FPX flow end-to-end tested
- [ ] Card + FPX both working
- [ ] Webhook: order status updates correctly
