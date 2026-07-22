---
date: 2026-07-20
session: cart-product-reconciliation-issue-1660
---

# Journal: 2026-07-20 — Cart Product Reconciliation

## Context

Issue #1660: a storefront cart kept a product snapshot after the seller changed its price or details. The cart could therefore display stale information until checkout re-read the product.

## What Happened

- Added a server-side cart resolver that validates the active tenant/site and returns canonical product, variant, price, image, inventory, and permitted quantity data.
- Centralized product-line resolution and reused it in checkout paths, preventing cart and checkout rules from drifting.
- Isolated browser cart storage by site and added refresh, stale-response protection, unavailable-product handling, and checkout/shipping re-quote guards.
- Focused validation completed with 58 passing tests.
- E2E coverage was intentionally not added at the user's direction.

## Reflection

The original issue was primarily a client snapshot problem, not a payment-price integrity bug: checkout already re-read current products. Making the resolver the canonical boundary improves consistency without trusting browser cart values. Per-site storage was necessary to avoid carrying a cart across storefronts.

## Decisions Made

| Decision | Rationale | Impact |
|---|---|---|
| Resolve cart lines on the server | Product facts are mutable and browser storage is only a snapshot | UI receives current allowed values before checkout |
| Scope cart storage to a site | A shared localStorage key could leak cart lines between storefronts | Cart state is isolated by active site |
| Reuse a shared product-line resolver in checkout | Variant, price, and stock rules must stay aligned | One canonical validation path for cart and checkout |
| Skip E2E for this change | User explicitly declined E2E implementation | Follow-up remains for browser-level regression coverage |

## Next Steps

- Add Playwright coverage for TC-F09.57 when seller/site/product fixtures are available.
- Create a focused `CheckoutClient` fixture to cover refresh and checkout guards without brittle broad mocks.
- Re-run full CI once the two baseline missing dependencies are restored.

## Code Review Follow-up

The review findings were resolved by deriving the reconciliation signature after quantity clamping, keeping `requiresConfirmation` durable until the customer explicitly acknowledges the update, and merging changes across multiple cart lines. Unavailable lines now have an explicit state, refresh promises are guarded by request ownership, and checkout navigation is disabled while the cart is unresolved, unavailable, or failed to refresh.

Verification completed with 49/49 focused tests passing, and the follow-up code review approved the changes.
