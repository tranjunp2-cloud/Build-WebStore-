# Phase 04 — Move `clearCart` to Confirm-success + cancel toast

**Priority:** P1 · **Sprint:** 1 · **Status:** planned · **Depends:** —

## Problem (verified)

Cart is cleared **before** redirecting to Stripe (`CheckoutClient.tsx:299`, inside the `paymentMethod==='stripe'` branch). If the buyer cancels or closes the Stripe tab, they return to an **empty cart** and a `pending` order — they must re-add every item.

Also: cancel returns to `/sites/{slug}/checkout?stripe_cancelled=1` but **no code reads that param** → silent failure, no feedback.

## Fix

1. **Stop clearing cart pre-redirect** — remove `clearCart()` from the Stripe branch in `handlePlaceOrder` (`CheckoutClient.tsx:299`). Cart persists in localStorage (`primeweb-cart`).
2. **Clear on confirmed success only** — in `ConfirmClient.tsx`, on mount, if order resolves to paid (`paymentStatus==='paid'`), call `clearCart()`. (After Phase 05 polling, clear once status flips to paid.)
3. **Cancel toast** — on the checkout page, detect `?stripe_cancelled=1` and show a toast: "Pembayaran dibatalkan / Payment cancelled — your cart is saved, try again." Cart items still render (not cleared), so the existing "Place Order" button re-initiates. Strip the query param after showing (avoid repeat on refresh).

Note: COD/bank_transfer branch already clears on its own success path (`CheckoutClient.tsx:335`) — leave unchanged.

## Files

- Modify: `src/app/sites/[slug]/checkout/CheckoutClient.tsx` (remove pre-redirect clear; add cancel-toast effect)
- Modify: `src/app/sites/[slug]/order/[orderId]/confirm/ConfirmClient.tsx` (clear cart on paid)
- Read: `src/store/cartStore.ts` (`clearCart`, persistence)

## Todo

- [ ] Remove `clearCart()` before Stripe redirect
- [ ] Clear cart on Confirm when paid (idempotent; guard double-clear)
- [ ] Cancel toast reads + strips `?stripe_cancelled=1`; cart intact
- [ ] Manual: pay→confirm clears cart; cancel→checkout keeps cart + toast

## Success criteria

- Cancel at Stripe ⇒ back on checkout with full cart + clear "cancelled, try again" message.
- Successful payment ⇒ cart cleared exactly once on Confirm.

## Risks

- Buyer who pays then never lands on Confirm keeps a stale cart — minor; next purchase or Phase 05 success-redirect clears it.
- i18n: cancel toast must use existing `useI18n()` strings (BM/EN).
