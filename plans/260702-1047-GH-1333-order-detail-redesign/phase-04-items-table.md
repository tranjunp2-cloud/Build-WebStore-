# Phase 04 — Order Items table (left column)

**Priority:** P1 · **Status:** todo · **Depends:** 02

## Goal
Replace the simple items list with the design's richer table.
Design ref: `f36/screen-c-label.jsx` → `ItemsTable` (`.itab`): head (Item · Qty · Weight · Price),
rows (thumbnail + name + SKU + attrs · qty · weight · price), expandable "Show N more" (cap 3),
summary block (Subtotal · Shipping Fee · Voucher · Total).

## Data reality (survey)
Order `items[]` = `{ product(rel), productName, variant, quantity, unitPrice }`.
**No SKU / weight / image stored** on the line item. Options:
- Resolve product via `depth` (GET `?depth=2` already used) → read product `image`/`sku`/`weight`.
- Thumbnail: product image if present, else monogram tile (initials, color from design palette).
- SKU / weight: show if product provides; otherwise omit that cell gracefully (don't fabricate).

## Component
- `order-items-card.tsx` (`.itab`) < 200 lines.
- Row: thumbnail (`.it-thumb`), name (`.it-name`), SKU (`.it-sku` w/ barcode icon) if available,
  attrs = `variant` (`.it-attrs`), qty `×n`, weight (if available), price = `unitPrice*qty`.
- Expand/collapse when > 3 items.
- Summary: Subtotal (`order.subtotal`), Shipping Fee (`order.shippingFee`),
  Voucher (`order.discountCode` + `-discountAmount/100`) shown only if discount>0, Total (`order.total`).
  Currency formatting per existing convention (`order.currency`).

## Todo
- [ ] `order-items-card.tsx` with thumbnail/SKU/weight (graceful fallback)
- [ ] Expandable rows (cap 3)
- [ ] Summary block matching design (subtotal/shipping/voucher/total)
- [ ] Verify product image/sku/weight fields available at depth; adjust fetch if needed

## Success criteria
- Real order items render with images where available, monogram fallback otherwise.
- Summary numbers match order totals; no fabricated SKU/weight.

## Risks
- Product may not expose `sku`/`weight` — confirm product collection fields; hide cells if absent.
- Image domain must be allowed in `next.config` (product images already used elsewhere — reuse).
