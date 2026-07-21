# Phase 03 — Cart and checkout UX

## Context links

- Parent: [plan.md](plan.md)
- Store: [phase-02-cart-store-reconciliation.md](phase-02-cart-store-reconciliation.md)
- UI: `src/components/storefront/CartDrawer.tsx`, `src/app/sites/[slug]/checkout/CheckoutClient.tsx`

## Overview

| Field | Value |
| --- | --- |
| Date | 2026-07-20 |
| Description | Refresh at user decision points and disclose cart changes accessibly |
| Priority | P1 |
| Implementation status | completed |
| Review status | completed |

## Key insights

- Refresh-on-open and refresh-on-checkout meet the requirement without polling; same-signature refreshes share one in-flight request.
- Checkout shipping quote currently depends on stale subtotal; reconciled state must settle before quote/payment actions.

## Requirements

- Drawer starts a refresh on opening, shows a compact updating state, then a durable changed/unavailable alert.
- Checkout activates its site cart, refreshes before its first shipping quote and before order placement, and allows Place Order only when `resolvedSignature === currentCartSignature`; disable actions while refresh is pending, failed, or unavailable lines exist.
- On refresh failure retain the snapshot and show a retryable error, but do not allow checkout to submit until retry succeeds for the current signature.
- Recompute subtotal and shipping after every `cartRevision`, including a quantity clamp whose subtotal is unchanged.
- Add equivalent EN/MS strings. Price change should state old and new amount where available; generic message covers non-price fields.
- Network failure retains cart and shows a retryable blocking checkout warning; final checkout API remains the safety net.

## Architecture

```text
checkout mount → activateSiteCart → refresh current signature
                                      │
                       ┌──────────────┼──────────────┐
                       ▼              ▼              ▼
                    success       unavailable      failure
                       │              │              │
               cartRevision++     CTA blocked    Retry + CTA blocked
                       │
                       ▼
             shipping re-quote → Place Order enabled
```

## Related code files

- `src/components/storefront/CartDrawer.tsx`
- `src/app/sites/[slug]/checkout/CheckoutClient.tsx`
- `src/app/sites/[slug]/checkout/CheckoutOrderSummary.tsx`
- `src/i18n/locales/en.json`
- `src/i18n/locales/ms.json`

## Implementation steps

1. Activate the correct site cart in drawer/widget and checkout entry points; add drawer effect keyed to `isOpen`, verified site and cart identity; render loading, changed and unavailable states.
2. Trigger and await reconciliation in checkout before the initial rate calculation and payment submission; make `canPlaceOrder` require a successful current `resolvedSignature` and no unavailable line.
3. Make shipping calculation depend on `cartRevision`, not only item count/subtotal, so every quantity clamp re-quotes shipment.
4. Keep cart totals from reconciled store; add CTA guards and retry action that repeats resolution for the current signature.
5. Localize all new messages and verify accessible alert semantics.

## Todo list

- [x] Drawer refresh and notices
- [x] Checkout refresh/CTA guards
- [x] Shipping recalculation dependency audit
- [x] EN/MS translations and accessibility checks

## Success criteria

- Customer sees updated price/info before a payment redirect or order creation; resolver failure cannot silently proceed to payment.
- Unavailable product/variant cannot be checked out.
- No flicker or false success when refresh fails.

## Risk assessment

- A transient resolver outage blocks payment but not cart editing/navigation; retry remains visible. This trades short-term checkout availability for the stated no-price-surprise guarantee.
- Do not use toast as the only disclosure; price change must remain visible.

## Security considerations

- Never display server details for products outside current storefront.

## Next steps

Execute automated and browser tests mapped to F09.

## Completion record

- Completed 2026-07-20: drawer/checkout activate the current site cart, refresh at decision points, expose updating/changed/unavailable/retry states, and include EN/MS translations with durable alert semantics.
- Checkout payment/order actions require a successful resolution of the current cart signature and no unavailable items. Shipping re-quotes on every `cartRevision`.
- Review-finding fix: pending line changes survive later no-change refreshes and cart edits, sequential changes are merged by composite line key, and only explicit acknowledgement clears them. When Place Order discovers a new pending snapshot, it stops before any order/payment API and keeps the notice visible; a later click may acknowledge and proceed only if that pending snapshot is unchanged.
- Unavailable lines render a dedicated state and are excluded from subtotal; quantity controls and Drawer checkout CTA remain disabled. Refresh promise cleanup is identity-guarded so an older aborted request cannot clear the active request.
- Drawer-focused coverage passed. A direct focused `CheckoutClient` component test remains deferred because the current component has no reusable minimal fixture and would require extensive brittle mocks; source guard behavior is covered by focused store/flow verification.
