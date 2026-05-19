# Phase 01 — SiteRenderer Global Injection + Commerce Detection

## Context
- Issue: GH-1023
- Depends on: None
- Pattern reference: `SiteRenderer.tsx:79-132` `applyGlobalSystemBlocks()`
- Existing floating handling: `SiteRenderer.tsx:467-482` (`FLOATING_WIDGET_TYPES`)

## Overview
- Priority: P1
- Status: completed
- Inject `site.floatingCartBlock` / `whatsAppBlock` / `socialBlock` into every page's block array, gated by commerce-presence check for the cart only.

## Key Insights
- `applyGlobalSystemBlocks` already mutates the block list before render — extend it, don't fork.
- `FloatingContainerProvider` + `floatingByPos` corner-stacking already correctly handles multiple floating widgets at the same corner. New global widgets reuse this for free.
- Cart suppression rule: if header `navigation` block has a cart button enabled, DO NOT inject global floating cart (UX redundant + clutter).
- Commerce-detection needs the FULL site's pages, not just current page — passed via `pages` prop to SiteRenderer (already available).
- Server component context: SiteRenderer is server-rendered; hook must be a pure function (NOT a React hook) OR run server-side. Choose: pure detector function, not `useXxx` hook. Rename file accordingly.

## Requirements
**Functional**
- Detect commerce presence by scanning all pages' `layout` for any block of types: `products-grid`, `products-featured`, `product-quick-view`.
- If commerce detected AND `site.floatingCartBlock` is set AND header has no cart button → inject floating cart block.
- Always inject `site.whatsAppBlock` if set (commerce-independent).
- Always inject `site.socialBlock` if set (commerce-independent).
- Dedupe: if page already contains the same block type as `variant=floating`, do NOT inject duplicate.

**Non-functional**
- Zero perf cost when site has no global widgets configured (early return).
- Editor preview shows the widget with non-interactive indicator (matches `showIndicators` pattern).

## Architecture
```
SiteRenderer(site, page, pages)
  └─► applyGlobalSystemBlocks(blocks, site, pages)   ← extended
        ├─► header / footer / breadcrumb (existing)
        ├─► detectCommercePresence(pages)            ← NEW
        ├─► hasHeaderCart(site.headerBlock)          ← NEW
        ├─► inject floatingCartBlock if conditions met
        ├─► inject whatsAppBlock if set
        └─► inject socialBlock if set
```

Data flow:
- IN: site (with new fields), pages array
- OUT: blocks array with global widgets appended (variant=floating)
- Floating widgets render via existing `floatingByPos` grouping at lines 467–482

## Related Code Files
**Create**
- `src/lib/site-renderer/detect-commerce-presence.ts` — pure function `detectCommercePresence(pages): boolean`
- `src/lib/site-renderer/has-header-cart.ts` — pure function `hasHeaderCart(headerBlock): boolean`

**Modify**
- `src/components/site-renderer/SiteRenderer.tsx` — extend `applyGlobalSystemBlocks` signature to take `pages`; add 3 injections

**Read for context**
- `src/blocks/cart-widget/config.ts` (default variant shape)
- `src/blocks/navigation/config.ts` (cart-button field name)
- `src/blocks/whatsapp-button/config.ts`, `src/blocks/social-widget/config.ts`

## Implementation Steps
1. Create `src/lib/site-renderer/detect-commerce-presence.ts`:
   ```ts
   const COMMERCE_BLOCK_TYPES = new Set(['products-grid', 'products-featured', 'product-quick-view'])
   export function detectCommercePresence(pages: Array<{ layout?: unknown[] }>): boolean {
     return pages.some(p =>
       Array.isArray(p.layout) &&
       p.layout.some(b => b && typeof b === 'object' && COMMERCE_BLOCK_TYPES.has((b as { blockType?: string }).blockType ?? ''))
     )
   }
   ```
2. Create `src/lib/site-renderer/has-header-cart.ts`:
   ```ts
   export function hasHeaderCart(headerBlock: unknown): boolean {
     if (!headerBlock || typeof headerBlock !== 'object') return false
     const cfg = headerBlock as { showCart?: boolean; cartButton?: { show?: boolean } }
     return cfg.showCart === true || cfg.cartButton?.show === true
   }
   ```
   NOTE: confirm exact field name by reading navigation/config.ts before locking.
3. In `SiteRenderer.tsx`:
   - Extend `applyGlobalSystemBlocks(blocks, site, pages)` — add 3rd param.
   - After existing breadcrumb logic, add the 3 injections (block at end of function before `return`).
   - Cart: `if (site.floatingCartBlock && detectCommercePresence(pages) && !hasHeaderCart(site.headerBlock))` → push to nextBlocks, normalize `{ ...site.floatingCartBlock, blockType: 'cartWidget', variant: 'floating', __editorBlockIndex: -1 }`.
   - WhatsApp: `if (site.whatsAppBlock)` → push with `blockType: 'whatsapp-button'`.
   - Social: `if (site.socialBlock)` → push with `blockType: 'socialWidget'`.
   - Dedupe each: skip injection if `nextBlocks.some(b => b.blockType === target && b.variant === 'floating')`.
4. Update call site `SiteRenderer.tsx:158` to pass `pages` into `applyGlobalSystemBlocks(pageBlocks, site, pages)`.
5. Verify floating-widget grouping logic at lines 467–482 still picks up injected blocks correctly (they have correct blockType + variant).
6. Run `npm run build` → confirm no TS errors.
7. Manual smoke: seed a site with floatingCartBlock set + 1 products-grid page → load any page → cart appears bottom-left.

## Todo List
- [x] Create `detect-commerce-presence.ts`
- [x] Create `has-header-cart.ts` (confirm cart field name)
- [x] Extend `applyGlobalSystemBlocks` signature + body
- [x] Update call site to pass `pages`
- [x] Build passes
- [x] Manual smoke: commerce + no header cart → floating cart visible globally
- [x] Manual smoke: commerce + header cart → NO floating cart
- [x] Manual smoke: no commerce → no floating cart
- [x] Manual smoke: whatsApp & social inject regardless of commerce

## Success Criteria
- Pages without inline cartWidget block still show floating cart when site-level config present + commerce detected
- Header cart presence suppresses floating cart
- Editor preview renders global widgets behind indicators (no live click)
- No duplicate floating widgets when page block + global config both define same widget type

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `pages` prop missing in some callers | Med | High (crash) | Default `pages = []` in `applyGlobalSystemBlocks`; commerce returns false → safe no-op |
| Duplicate cart (page block + global) | Med | Med | Dedupe by `blockType + variant` |
| Header cart field name wrong | Med | High | Grep `cartButton` / `showCart` in nav config before coding |
| Perf: scanning all pages on every render | Low | Low | Pure synchronous O(n*m) on small arrays; memoize if needed |
| Editor click steals focus from underlying canvas | Med | Med | Wrap injected blocks with same indicator pattern; verify `showIndicators` short-circuit |

## Security Considerations
- No new auth surface; injected blocks read-only from site config.
- Same XSS surface as existing per-page cartWidget (no change).
- Owner-only visibility for editor indicators (unchanged).

## Next Steps
- Phase 03 — cart click/route correctness (independent of P2)
- Phase 04 — Component Library scope tags (independent of P2)
