# Phase 01 — Cart resolve API

## Context links

- Parent: [plan.md](plan.md)
- Existing patterns: `src/app/api/storefront/products/route.ts`, `src/app/api/storefront/discounts/apply/route.ts`
- Canonical variant rules: `src/app/api/orders/stripe-checkout/build-order-items.ts`

## Overview

| Field | Value |
| --- | --- |
| Date | 2026-07-20 |
| Description | Resolve cart identities to current, tenant-scoped product snapshots in one query |
| Priority | P1 |
| Implementation status | completed |
| Review status | completed |

## Key insights

- Browser cart snapshot is stale; checkout already re-reads current Product data.
- A resolver must not reuse checkout's per-line `findByID` loop: cart can have many lines.
- The client must not choose tenant/site or price; response needs a strict whitelist.

## Requirements

- `POST /api/storefront/cart/resolve` accepts bounded `{ siteId, items[] }`; each item has product id, variant and quantity plus optional snapshot for change comparison.
- Resolve current tenant from request Host (platform subdomain/custom domain), using body slug only for local/direct storefront fallback, then verify that supplied `siteId` belongs to that tenant. `siteId` is a checked selector, never a trust boundary.
- One batched Product query filters unique IDs, verified site, tenant, `status:active`, and non-deleted rows.
- Return input-order line identities with `available` canonical data or explicit unavailable reason. Variant requests never fall back to base price.
- Rate limit, Zod validation, and no PII/tenant/site document leakage.

## Architecture

`cart identity[] + siteId → resolve tenant from request Host/local fallback slug → verify site ownership → one scoped products.find(id in …) → shared line helper → whitelisted resolved lines`.

## Related code files

- `src/app/api/storefront/products/route.ts`
- `src/app/api/storefront/discounts/apply/route.ts`
- `src/lib/validations/orders.ts` or a new storefront-cart validation module
- `src/app/api/orders/stripe-checkout/build-order-items.ts`
- New pure storefront/product-line resolver helper, colocated with existing product/checkout domain utilities

## Implementation steps

1. Define resolver request/response types and Zod bounds; reuse a single max-cart-items constant where practical.
2. Extract a pure helper that receives an already-loaded Product plus requested variant/quantity and returns canonical fields or unavailable status; refactor checkout builders to use the same rules without changing their authorization/query path.
3. Implement the route with IP rate limiting; resolve tenant from request Host, using slug only on local/direct storefront URLs, then verify `siteId` belongs to that tenant.
4. Query unique requested product IDs once using explicit verified-site/tenant/active/deleted filters and minimal depth needed for image URL.
5. Map each requested line through the helper and return only cart fields and changed-field metadata keyed by product ID plus variant.

## Todo list

- [x] Add validation/types
- [x] Extract shared base/variant resolution helper and regression-test checkout callers
- [x] Implement scoped, batched route
- [x] Add rate-limit/error behavior
- [x] Add API tests

## Success criteria

- No N+1 Product fetch.
- Cross-site/tenant IDs and custom-domain mismatches return unavailable and disclose no product data.
- Variant price/stock match existing checkout rules.

## Risk assessment

- Incorrect site selection or a `slug === 'custom'` request could expose product metadata; resolve tenant from request Host/local fallback slug and bind verified-site/tenant predicates.
- Product array data may require Payload depth tuning; verify first media URL and variants in a route test.

## Security considerations

- Public endpoint is advisory only; checkout continues authoritative re-pricing.
- Enforce request size, numeric IDs, rate limiting, verified site ownership, whitelist response and opaque unavailable results.

## Next steps

Implement the client merge only after this canonical contract is fixed.

## Completion record

- Completed 2026-07-20: implemented the bounded, tenant/site-scoped cart resolver and shared base/variant line resolver; both Stripe and manual checkout callers now use the shared rules.
- Verified with 15 focused Vitest tests covering the resolver and `POST /api/storefront/cart/resolve`, mapped to TC-F09.57. Independent code review completed; the custom-domain tenant-resolution finding was fixed and re-verified.
- Repository typecheck was also run; its two failures are pre-existing missing packages (`country-flag-icons/react/3x2` and `@aws-sdk/s3-presigned-post`) outside this phase.
- E2E is intentionally **not implemented** by user direction. Keep Phase 04's E2E regression unchecked and treat an isolated storefront seed/fixture plus Playwright coverage for TC-F09.57 as a follow-up before any future change that relies on this public route's browser flow.
