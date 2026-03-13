# PRD: Payment Gateway — Malaysia (F16)
> **Version:** 1.0 | **Created:** 2026-03-13 | **Agent:** `project-planner`  
> **Priority:** P1 | **Wave:** 6 | **Size:** L  
> **Depends on:** F10 Storefront Commerce ✅, Stripe account ✅  
> **MY Ref:** [malaysia-market-context.md](../malaysia-market-context.md) — §4 Payment Landscape

---

## 1. Problem Statement

PrimeWeb currently only supports card payments via Stripe. In Malaysia, **FPX online banking** is the most trusted payment method and **e-wallets** (Touch 'n Go, GrabPay, Boost) are essential for mobile shoppers. Without local payment methods, checkout conversion will be significantly lower.

## 2. Target User

- **Buyer (Consumer):** Persona C — prefers FPX or e-wallet over credit card
- **SME Owner:** Persona A — wants maximum payment options to avoid lost sales

## 3. Success Metrics

| Metric | Target | How |
|--------|--------|-----|
| Checkout conversion | > 50% (vs ~30% card-only) | Analytics |
| FPX adoption | > 40% of transactions | Stripe dashboard |
| Payment failure rate | < 5% | Stripe webhook events |

## 4. User Stories

### US-16A: Pay with FPX
```
AS A Malaysian buyer
I WANT TO pay using FPX (online banking)
SO THAT I can pay directly from my bank without a credit card
```

### US-16B: Pay with E-wallet
```
AS A mobile shopper
I WANT TO pay using Touch 'n Go or GrabPay
SO THAT I can use my preferred e-wallet
```

### US-16C: Seller Payment Settings
```
AS A site owner
I WANT TO choose which payment methods to accept
SO THAT I can control my checkout experience
```

## 5. Payment Methods — Phased

### Wave 6 (P0)

| Method | Provider | Integration |
|--------|----------|------------|
| **Credit/Debit Card** | Stripe | ✅ Already have |
| **FPX** | Stripe Malaysia | Stripe Payment Element (auto-shows FPX for MY) |

### Wave 7+ (P1)

| Method | Provider | Integration |
|--------|----------|------------|
| **Touch 'n Go** | Stripe / Ipay88 | Stripe if supported, else Ipay88 SDK |
| **GrabPay** | Stripe | Stripe Payment Element |
| **Boost** | Ipay88 / Revenue Monster | 3rd party SDK |
| **COD** | Internal | Manual order status flow |

## 6. Screen Layout

### Checkout — Payment Step
```
┌─ Payment Method ──────────────────────┐
│                                        │
│  Choose payment method:               │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ ⦿ 🏦 FPX (Online Banking)       │ │
│  │   Select your bank: [Maybank ▼]  │ │
│  └──────────────────────────────────┘ │
│  ┌──────────────────────────────────┐ │
│  │ ○ 💳 Credit/Debit Card           │ │
│  └──────────────────────────────────┘ │
│  ┌──────────────────────────────────┐ │
│  │ ○ 📱 E-wallet (TnG/GrabPay)     │ │  ← Wave 7
│  └──────────────────────────────────┘ │
│                                        │
│  ┌─ Order Summary ─────────────────┐ │
│  │ Subtotal:     RM 189.00         │ │
│  │ Shipping:     RM 8.00           │ │
│  │ SST (6%):     RM 11.82          │ │
│  │ ─────────────────────────       │ │
│  │ Total:        RM 208.82         │ │
│  └──────────────────────────────────┘ │
│                                        │
│  [Pay Now — RM 208.82]                │
└────────────────────────────────────────┘
```

## 7. Acceptance Criteria

### AC-1: FPX Payment
```gherkin
GIVEN buyer at checkout selects FPX
WHEN  they choose bank from dropdown (Maybank, CIMB, etc.)
AND   click "Pay Now"
THEN  redirect to bank's login page (3D Secure)
AND   after bank approval → redirect back to confirmation page
AND   order status = 'new' (payment confirmed)
AND   webhook: payment_intent.succeeded → update order
```

### AC-2: Card Payment (existing)
```gherkin
GIVEN buyer selects Credit/Debit Card
WHEN  Stripe Payment Element renders
THEN  card form shows (number, expiry, CVC)
AND   3D Secure handled automatically
AND   same webhook flow as FPX
```

### AC-3: Seller Payment Settings
```gherkin
GIVEN site owner in dashboard settings
WHEN  navigates to Payment Settings
THEN  can enable/disable: Card ✅, FPX ✅
AND   Stripe Connect status shown (connected? pending?)
AND   payout schedule visible (auto weekly to bank account)
```

### AC-4: Payment Failed
```gherkin
GIVEN payment fails (bank declined, timeout)
WHEN  buyer redirected back
THEN  error message: "Pembayaran gagal. Sila cuba lagi."
AND   cart items preserved — buyer can retry
AND   order status stays 'pending'
```

## 8. Technical — Stripe Payment Element

```typescript
// Already using Stripe → add FPX via Payment Element
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

// Create PaymentIntent with FPX enabled
const paymentIntent = await stripe.paymentIntents.create({
  amount: 20882, // RM 208.82 in cents
  currency: 'myr',
  payment_method_types: ['card', 'fpx'], // ← add 'fpx'
})
```

Stripe Payment Element auto-shows FPX for Malaysian buyers (currency = MYR).

## 9. 9-Point Done Checklist

- [ ] Loading State — Payment button shows spinner during processing
- [ ] Empty State — N/A
- [ ] Error State — "Pembayaran gagal" + retry button
- [ ] Form Validation — Bank selection required for FPX
- [ ] Button States — "Pay Now" disabled during processing
- [ ] Toast Feedback — N/A (uses redirect flow)
- [ ] Auth Redirect — N/A (checkout is public)
- [ ] Mobile 375px — Payment methods stack vertically, tap targets ≥ 44px
- [ ] TypeScript Clean
