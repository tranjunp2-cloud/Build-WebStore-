---
title: "US-F13-05: Resume Interrupted Payment"
description: "Preserve cart on Stripe cancel, poll payment status on confirm, retry payment from order detail, clear cart only on confirmed success."
status: pending
priority: P2
effort: 6h
branch: feat/1098-F13-05-resume-payment
tags: [f13, payments, stripe, checkout, cart]
created: 2026-06-01
---

# US-F13-05 — Khôi phục thanh toán dở dang (Resume Interrupted Payment)

GH #1098. Relates to #1098 (NEVER Closes — issue closes after QA).

## Goal

Buyer who abandons / cancels a Stripe payment can recover without losing their cart, and
can retry payment from the order tracking page. Cart is cleared ONLY on confirmed success.

## Acceptance Criteria → Phase map

| AC | Summary | Phase |
|----|---------|-------|
| AC-1 | Cancel Stripe → cart preserved + BM toast + "Try Again" CTA re-triggers Stripe | phase-01 |
| AC-4 | clearCart ONLY at confirm-page success — NOT before redirect, NOT on cancel | phase-01 (shared w/ AC-1) + phase-02 |
| AC-2 | Confirm page detects pending → "Verifying…" skeleton → auto-flips to success | phase-02 |
| AC-3 | "Pay Now" CTA on order detail (pending/payment_failed) → new Stripe session | phase-03 |

Phase-04 = i18n strings (shared by 01/02/03) + tests.

## Phases

| # | File | Status | Owner glob | Depends on |
|---|------|--------|-----------|-----------|
| 01 | [phase-01-cancel-preserve-cart.md](phase-01-cancel-preserve-cart.md) | pending | `checkout/CheckoutClient.tsx` | phase-04 i18n keys |
| 02 | [phase-02-confirm-poll-status.md](phase-02-confirm-poll-status.md) | pending | `order/[orderId]/confirm/ConfirmClient.tsx` | phase-04 i18n keys |
| 03 | [phase-03-retry-payment.md](phase-03-retry-payment.md) | pending | `api/orders/[id]/retry-payment/*`, `orders/[orderNumber]/OrderTrackingClient.tsx` | phase-04 i18n keys |
| 04 | [phase-04-i18n-and-tests.md](phase-04-i18n-and-tests.md) | pending | `i18n/locales/*.json`, `__tests__/**` | 01,02,03 land first for tests |

## Critical scout corrections (vs original task brief)

These changed the architecture — read before implementing:

1. **`use-checkout-state.ts` is DEAD CODE.** Nothing imports `useCheckoutState`. The wired
   component is `CheckoutClient.tsx`, which inlines its own `handlePlaceOrder` (line 318+).
   → AC-1/AC-4 edits touch ONLY `CheckoutClient.tsx`. Do NOT edit the unused hook (YAGNI).

2. **No new `payment-status` polling endpoint needed (DRY).** An SSE stream already exists:
   `/api/orders/stream/[orderNumber]` pushes `{status, paymentStatus, terminal}` on change with
   reconnect logic, and `OrderTrackingClient` already consumes it. Confirm page (AC-2) REUSES
   this stream — it has `orderNumber` + `slug`. No 2s-poll endpoint created.

3. **Cart preservation on cancel is automatic.** `cartStore` persists to localStorage and
   rehydrates on load. Removing the premature `clearCart()` is sufficient — cart survives the
   Stripe round-trip with zero extra work (AC-1 + AC-4).

4. **`retry-payment` endpoint IS new.** `[id]/resume` is for bank-transfer proof upload, not
   Stripe retry. New endpoint reuses `buildOrderItems` + `createStripeCheckoutSession` helpers.

## Status field semantics (from Orders collection)

- `order.status`: `pending` → `new` (Stripe webhook success) → … ; `payment_failed` is terminal
- `order.paymentStatus`: `awaiting_payment` | `paid` | `payment_failed` | `pending_verification`
- Confirm page success keys on `paymentStatus === 'paid'` (existing `isPaid` logic)
- Terminal set (shared): `completed, cancelled, refunded, payment_failed`

## Key dependencies

- Existing helpers: `buildOrderItems`, `createStripeCheckoutSession`, `buildPaymentMethodTypes`,
  `generateConfirmToken` / `verifyConfirmToken`, `verifyOrderToken` (magic link)
- Existing SSE: `/api/orders/stream/[orderNumber]` (reused by AC-2)
- `cartStore` localStorage persistence (AC-1/AC-4 rely on it)

## Out of scope (YAGNI)

- Refactoring oversized client files (CheckoutClient 996 lines, ConfirmClient 656) — pre-existing
- Deleting dead `use-checkout-state.ts` — flag only, separate cleanup PR
- COD / bank-transfer retry (this US is Stripe resume only)

## Test convention

Each test → TC-ID from `docs/qa/F13-*.md`. Import from source, no mocks-to-pass. See phase-04.
