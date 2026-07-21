# Research — Cart client reconciliation

## Summary

- Current store persists a complete snapshot under `primeweb-cart`; no refresh action exists.
- Trigger refresh on cart open and checkout entry; avoid polling.
- Merge canonical fields by composite line identity and protect against stale async responses.
- Persist a site-scoped cart; the global key otherwise mixes storefronts.
- Show persistent change/unavailable messages, not toast-only feedback.

## References

- `src/store/cartStore.ts`
- `src/components/storefront/CartDrawer.tsx`
- `src/app/sites/[slug]/checkout/CheckoutClient.tsx`
- `docs/qa/F09-storefront-commerce.md`

## Unresolved questions

- None for MVP.
