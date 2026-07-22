---
title: "Storefront cart product reconciliation"
description: "Refresh persisted cart lines from current Product data before cart and checkout display."
status: completed
priority: P1
effort: 2d
branch: fix/categories-image-id-column
tags: [storefront, cart, checkout, products, f09]
created: 2026-07-20
---

# Storefront cart product reconciliation

## Goal

Make an unpaid guest cart display current product/variant name, image, price, compare-at price and stock before cart/checkout. Checkout remains the final authority.

## Scope and decisions

- Add a public, rate-limited batch resolver; no cart DB table or migration.
- Persist cart intent (`productId`, selected variant, quantity) but reconcile denormalized display fields from the resolver.
- Refresh when opening the drawer and when entering checkout. No polling; tab-focus refresh is deferred.
- Show a durable change notice; checkout may place an order only after the current cart signature resolves successfully, and remains blocked for unavailable lines or resolver failure until retry succeeds.
- Scope persisted cart to its storefront site. One-time clear the unscoped legacy key rather than guessing its tenant; new keys use `primeweb-cart:{siteId}`.
- Retain server-side checkout re-pricing as the final anti-tampering guard.
- Extract one pure base/variant resolution helper shared by resolver and checkout; data fetching remains flow-specific.

## Data flow

```text
open drawer / enter checkout
            │
            ▼
site-scoped cart identity + snapshot + refresh generation
            │
            ▼
POST /api/storefront/cart/resolve
  siteId + request Host/local slug fallback + lines
            │
            ▼
server resolves current tenant/site, batch-fetches Products, uses shared line helper
            │
            ▼
response matches active generation + composite line key?
       ├── no → discard stale response
       └── yes → persist canonical fields; show changed/unavailable state; recalculate totals
```

## Phases

| Phase | Status | Outcome |
| --- | --- | --- |
| [01 API resolver](phase-01-cart-resolve-api.md) | completed | Secure batched canonical product/variant response; 15 focused Vitest tests and independent review complete |
| [02 Store reconciliation](phase-02-cart-store-reconciliation.md) | completed | Site-scoped persisted cart, race-safe canonical merge and change state |
| [03 Storefront UX](phase-03-cart-checkout-ux.md) | completed | Refresh triggers, change/unavailable UI, checkout guard |
| [04 Verification](phase-04-tests-qa.md) | completed with follow-ups | 58 focused Vitest tests; E2E declined and CheckoutClient focused fixture remain follow-ups |

## Dependencies

- Existing Product data and checkout APIs; no new dependency, migration or environment variable.
- [F09 commerce QA cases](../../docs/qa/F09-storefront-commerce.md), especially TC-F09.57.

## Success criteria

- A seller price/name/image/stock update is reflected after customer opens cart or lands on checkout.
- A changed price is disclosed before payment; a removed/inactive product or variant cannot proceed.
- Checkout never submits a cart whose current signature has not resolved successfully, including after a resolver network failure.
- One resolver request handles all cart lines without per-product queries or cross-tenant data disclosure.
- Existing checkout server re-pricing and variant validation remain unchanged and passing.

## Unresolved questions

- Product description is not currently stored or rendered in cart, so it is intentionally out of scope.
- E2E for the new public resolver is intentionally deferred by user direction. Phase 04 retains it as an unchecked follow-up; it is not a completed verification item.

## Completion record

- Completed 2026-07-20: all four implementation phases are delivered and independently reviewed. The cart is now site-scoped, reconciles canonical product data at cart/checkout decision points, and blocks checkout until the active cart signature resolves successfully.
- Verification: 58/58 focused Vitest tests passed. Repository typecheck remains blocked only by two pre-existing missing packages (`country-flag-icons/react/3x2` and `@aws-sdk/s3-presigned-post`), outside this work.
- Explicit follow-ups: Playwright E2E for TC-F09.57 was declined by user direction; add it with isolated seller/site/product fixtures when E2E is authorized. Add a reusable focused `CheckoutClient` fixture to cover its strict CTA guard directly.
