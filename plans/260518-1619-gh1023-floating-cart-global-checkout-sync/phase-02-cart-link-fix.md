# Phase 02 — Cart Entry Points + Checkout Routing Fix

## Context
- Issue: GH-1023 Problem 3
- Cart state: Zustand store `src/store/cartStore.ts` (localStorage key `primeweb-cart`)
- Drawer: `src/components/cart/CartDrawer.tsx` (or similar — verify path)
- Checkout route: `/sites/[slug]/checkout`

## Overview
- Priority: P1
- Status: completed
- Audit + fix every cart entry surface so click reliably opens drawer or routes to checkout; eliminate dead `#` hrefs.

## Key Insights
- Cart is a DRAWER (Zustand `openCart()`) — not a separate route. AC3 in issue says drawer pattern is valid.
- Real bugs are likely: (a) header navigation cart button has `href="#"` instead of click handler; (b) "Proceed to checkout" button uses static URL missing siteSlug.
- `cartStore` is browser-only (localStorage) — site context (siteSlug) must be set when adding items, otherwise checkout route can't be built.
- Cart drawer must work identically whether triggered by header button, inline cartWidget, or global floating cartWidget.

## Requirements
**Functional**
- Header navigation cart button: `onClick → openCart()`, no `href="#"`.
- Floating cartWidget (P2 injected): `onClick → openCart()`.
- Inline cartWidget: `onClick → openCart()`.
- "Proceed to checkout" button in CartDrawer: navigates to `/sites/{siteSlug}/checkout`, siteSlug pulled from cart store.
- Cart store retains `siteSlug` across navigations (already via localStorage — verify).
- Empty cart: checkout button disabled or hidden.

**Non-functional**
- No `href="#"` left in cart-related code paths.
- ESLint rule (if exists) for empty href; add inline comment if anchor is intentional.

## Architecture
```
[ HeaderNav cart icon ]  ──┐
[ Inline cartWidget    ]  ──┼─► openCart() ──► CartDrawer (Zustand state)
[ Floating cartWidget  ]  ──┘                       │
                                                    ├─► [Continue Shopping] → closeCart()
                                                    └─► [Proceed to Checkout] → router.push(`/sites/${siteSlug}/checkout`)
```

## Related Code Files
**Modify (verify each via Grep first)**
- `src/blocks/cart-widget/index.tsx` — confirm `onClick={openCart}` not `href="#"`
- `src/blocks/navigation/index.tsx` (or variant subfiles) — cart icon click handler
- `src/components/cart/CartDrawer.tsx` (path to verify) — Proceed-to-Checkout link
- `src/store/cartStore.ts` — verify `siteSlug` field is persisted

**Read for context**
- `src/app/(storefront)/sites/[slug]/checkout/page.tsx` — confirm route exists
- Any `addItem` callers — confirm they pass siteSlug

## Implementation Steps
1. Grep cart-related dead anchors:
   ```bash
   grep -rn 'href="#"' src/blocks/cart-widget src/blocks/navigation src/components/cart
   grep -rn "openCart\|toggleCart" src/blocks src/components/cart
   ```
2. For each dead `href="#"` found in cart paths, replace anchor with `<button type="button" onClick={openCart}>` or add `onClick` and `preventDefault`.
3. Open `src/store/cartStore.ts`; verify `siteSlug: string | null` is in state shape and persisted via Zustand `persist` middleware. If missing, add it; ensure `addItem(item, siteSlug)` writes it.
4. Open CartDrawer "Proceed to Checkout" button. Replace any static `/checkout` with:
   ```tsx
   const { siteSlug } = useCartStore()
   const router = useRouter()
   <Button disabled={!items.length || !siteSlug} onClick={() => router.push(`/sites/${siteSlug}/checkout`)}>
     Proceed to Checkout
   </Button>
   ```
5. Verify the global-injected floating cartWidget (from P2) is wired through the same `openCart` path — should be automatic since CartWidget component is identity-shared.
6. Manual e2e: home page → add product → navigate to about page → cart icon visible → click → drawer opens with items → Proceed to Checkout → lands on `/sites/{slug}/checkout`.
7. Manual e2e regression: empty cart → checkout button disabled.

## Todo List
- [x] Grep + list every dead `href="#"` in cart paths
- [x] Fix each to use `onClick` handler
- [x] Verify `cartStore.siteSlug` persisted
- [x] Patch CartDrawer Proceed-to-Checkout to use dynamic route + disabled state
- [x] Manual e2e: add → navigate → open drawer → checkout
- [x] Manual e2e: empty cart → button disabled
- [x] Regression: existing in-flight checkout sessions unaffected

## Success Criteria
- Zero dead `href="#"` in cart entry points
- Cart drawer opens from header, inline, AND floating cart
- Cart persists across navigation (localStorage works)
- Proceed-to-Checkout routes to `/sites/{slug}/checkout` with correct slug
- Empty-cart safeguard active

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| siteSlug missing on first add (legacy carts) | Med | High (broken checkout) | Migration: on store rehydrate, if siteSlug null + items exist, infer from current URL |
| Anchor→button swap breaks a11y (focus styles) | Med | Low | Reuse existing button component variant or copy anchor's class list |
| Drawer race with router.push (drawer stays open after navigation) | Low | Low | Call `closeCart()` before `router.push` |
| Header cart variant differs across nav variants | Med | Med | Audit ALL nav variants (transparent, floating, sidebar, mega, default, centered) |

## Security Considerations
- siteSlug is non-sensitive; safe to persist in localStorage.
- Checkout route already enforces auth/session checks server-side (unchanged).
- No new XSS surface (no innerHTML on cart data).

## Next Steps
- Phase 04 — Component Library scope tags (parallel-safe; different files)
- Phase 05 — tests cover all cart entry points
