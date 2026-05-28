# Brainstorm Report: Zero Payment Methods Edge Case
**Date:** 2026-05-28
**Issue:** GH-1100 (checkout UX when seller has 0 active payment methods)
**Branch:** fix/1070-checkout-order-bugs

---

## Problem Statement

When a seller disables all payment methods (Stripe Card/FPX, COD, Bank Transfer/QR), buyers land on `/checkout` with an empty payment section. Two bugs compound the issue:

1. **UI bug:** Payment section renders blank — no methods visible, no error, no explanation.
2. **Silent logic bug:** `paymentMethod` state defaults to `'cod'` (hardcoded, line 92 CheckoutClient.tsx). If COD is disabled, buyer may submit an order with `paymentMethod: 'cod'` as an invalid value — server may accept or reject silently.

**Files involved:**
- `src/app/sites/[slug]/checkout/CheckoutClient.tsx` — hardcoded default + no empty-state handling
- `src/app/(dashboard)/settings/payments/PaymentsFormClient.tsx` — no warning when 0 methods active

---

## Core Assumptions Challenged

| Assumption | Reality |
|-----------|---------|
| "Edge case" | Silent failure mode, currently shippable as broken |
| "Fix checkout-side only" | Dashboard has zero seller feedback — root cause unaddressed |
| "0 methods = store closed" | No "Pause Store" feature exists; seller using payment toggle as workaround |
| "Buyer just sees empty section" | Buyer can potentially submit order with invalid paymentMethod value |

---

## Options Evaluated

### Dashboard (Prevention)
| Option | Impact | Effort | Decision |
|--------|--------|--------|----------|
| 1A. Inline warning banner when 0 methods | High | Low | Recommend — ship |
| 1B. Hard block save | Medium | Low | Reject — blocks legit mid-migration state |
| 1C. Confirm modal on last method toggle | High | Low | Recommend — phase 2 |

### Checkout (Detection/Buyer UX)
| Option | Impact | Effort | Decision |
|--------|--------|--------|----------|
| 2A. Block checkout entirely (inline empty state) | High | Very Low | Acceptable fallback |
| 2B. Banner + disable Place Order button | High | Very Low | Acceptable fallback |
| 2C. "Request Quote" fallback | Medium | Medium | Reject — scope creep, needs order state design |
| 2D. Server-side redirect (page.tsx) → store homepage | High | Low | Recommended — cleanest |

### Semantic (Business Logic)
- "Pause Store" toggle on Site collection: separate concern, unblocks semantic intent, P2 scope

---

## Recommended Solution

### Phase 1 (ship with current PR or follow-up fix PR)

1. **`page.tsx` (server):** Compute `hasAnyPaymentMethod` from site data. If false → redirect to `/${slug}?notice=checkout_unavailable`. No new API, no schema change.
2. **`CheckoutClient.tsx`:** Replace hardcoded `paymentMethod = 'cod'` default with dynamic resolution — pick first available method after site data loads, or `null` if none. Disable Place Order if `paymentMethod === null`.
3. **`PaymentsFormClient.tsx`:** Add inline warning banner when all 4 toggles are off. Non-blocking (don't prevent save).

### Phase 2 (separate issue/PR)

4. Confirm modal when toggling off the last active method.
5. "Pause Store" toggle on Site settings — proper semantic for temporary closure.

### Backend Gate (independent of UI)

6. API order submission must validate that `paymentMethod` matches an enabled method for the site. Currently this gate may not exist — creates exploitable path regardless of UI fix.

---

## Second-Order Effects

- **Race condition:** Seller disables method while buyer is mid-checkout. Server-side gate (#6) is the only reliable fix; UI gate only covers page-load state.
- **SEO:** Server redirect from checkout is fine — checkout should not be indexed.
- **Store homepage:** If using redirect approach, homepage needs to consume `?notice=checkout_unavailable` and display toast/banner.
- **"Request Quote" temptation:** Attractive UX but requires undefined order state (no payment method). Do not implement without order state machine design.

---

## Success Criteria

- Buyer never sees a blank payment section with no explanation
- Buyer cannot submit an order with an invalid/disabled payment method
- Seller sees a clear warning in dashboard when 0 methods are active
- No schema changes required for Phase 1

---

## Unresolved Questions

1. Does the order submission API currently validate `paymentMethod` against enabled methods server-side? (Backend gate — needs investigation)
2. Is there an existing `isPaused` or similar field on the Site/Tenant collection? (Check before implementing "Pause Store")
3. Should storefront homepage handle the `?notice=` param, or is a dedicated "store unavailable" route cleaner?
