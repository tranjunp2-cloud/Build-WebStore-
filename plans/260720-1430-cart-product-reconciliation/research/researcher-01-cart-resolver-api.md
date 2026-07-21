# Research — Cart resolver API

## Summary

- Cart has no backend representation; introduce an advisory `POST /api/storefront/cart/resolve`.
- Use slug-derived tenant/site and one `products.find` over unique IDs. Explicit filters: site, tenant, active, non-deleted.
- Resolve variants exactly like checkout; selected variant never falls back to base price.
- Whitelist cart fields and emit unavailable reasons. Rate limit and validate bounded payload.

## References

- `src/app/api/storefront/products/route.ts`
- `src/app/api/storefront/discounts/apply/route.ts`
- `src/app/api/orders/stripe-checkout/build-order-items.ts`

## Unresolved questions

- None for MVP.
