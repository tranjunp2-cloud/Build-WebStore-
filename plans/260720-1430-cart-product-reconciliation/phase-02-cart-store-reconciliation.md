# Phase 02 — Cart store reconciliation

## Context links

- Parent: [plan.md](plan.md)
- API: [phase-01-cart-resolve-api.md](phase-01-cart-resolve-api.md)
- Current store: `src/store/cartStore.ts`

## Overview

| Field | Value |
| --- | --- |
| Date | 2026-07-20 |
| Description | Reconcile persisted cart snapshots safely without losing user intent |
| Priority | P1 |
| Implementation status | completed |
| Review status | completed |

## Key insights

- Existing `addItem` increments an old line without refreshing its fields.
- A global `primeweb-cart` key is unsafe once resolver requests are site-scoped; legacy data cannot be attributed to a site safely.
- Async responses must not resurrect a removed line or overwrite a later add.

## Requirements

- Persist cart per verified site using `primeweb-cart:{siteId}`. On first activation, clear the unscoped legacy key rather than attempting attribution; never resolve another storefront's lines.
- Replace slug-only context with `activateSiteCart(siteId, siteSlug)`, called by add-to-cart, cart widget and checkout mount. It loads the correct site key exactly once per site context.
- Add transient `refreshStatus`, `resolvedSignature`, `cartRevision`, `changes`, unavailable-line state and a reconciliation action. Do not persist transient UI state.
- Maintain a monotonically increasing refresh generation plus a line signature. Merge only a response that matches the current generation/signature and still-present composite keys (`productId + variantName`); replace canonical fields, clamp quantity to current finite stock, and persist result.
- Re-adding an existing line should apply the latest PDP fields locally while an API refresh remains authoritative.

## Architecture

```text
activateSiteCart(siteId, siteSlug) → load primeweb-cart:{siteId}
                                   │
drawer/checkout → increment generation + capture line signature
                     │
                     ▼
                resolver response
                     │
     generation/signature/current keys still match?
          ├── no → discard
          └── yes → merge canonical fields → cartRevision++ → persist + expose changes
```

## Related code files

- `src/store/cartStore.ts`
- `src/components/storefront/AddToCartButton.tsx`
- `src/blocks/cart-widget/index.tsx`

## Implementation steps

1. Replace `setSiteSlug` with `activateSiteCart(siteId, siteSlug)` at AddToCartButton, CartWidgetBlock and CheckoutClient mount. It activates/load the site key exactly once, then clears the unscoped legacy key once with an optional informational notice.
2. Define resolved line/change/unavailable types shared with the API client plus transient `resolvedSignature` and `cartRevision` state.
3. Add `refreshCart` (or a narrow reconciliation hook) with an AbortController, shared in-flight promise, monotonically increasing generation and line-signature guard. A network error must clear no cart data but must not mark the signature resolved.
4. Add merge, unavailable removal/marking and quantity-clamp behavior; increment `cartRevision` for every cart mutation/reconcile and persist only resulting cart lines.
5. Update existing-line `addItem` to refresh supplied snapshot fields rather than preserve stale values.

## Todo list

- [x] Site-context activation at all cart entry points, storage scope and legacy behavior
- [x] Store refresh/reconcile actions, resolved signature and in-flight dedupe
- [x] Race-safe merges, cart revision and quantity clamp
- [x] Unit coverage

## Success criteria

- Refresh updates name/image/prices/stock and subtotal from canonical data, and records the matching resolved signature only on success.
- Deleting a line during refresh cannot re-add it.
- A second storefront never sees/reconciles the first storefront's cart; legacy cart is safely cleared once.

## Risk assessment

- Storage migration deliberately clears a legacy cart once; disclose this briefly rather than guessing its site and risking cross-tenant data mixing.
- Removing unavailable lines automatically can be unexpected; retain an unavailable line visibly until customer removes it unless product identity is invalid.

## Security considerations

- Treat every resolver response as untrusted until it matches requested composite identity and active site.

## Next steps

Wire refresh into drawer and checkout UI.

## Completion record

- Completed 2026-07-20: `primeweb-cart:{siteId}` activation replaced the global cart key; the unscoped legacy key is cleared once rather than attributed to a storefront.
- `refreshCart` now guards response generation/signature, preserves user mutations, merges canonical display fields, clamps finite stock, retains unavailable lines, and records `cartRevision`/change state without persisting transient UI state.
- Focused store coverage passed as part of the 58-test verification suite; Phase 2–3 independent review found and fixed the active-site isolation issue.
