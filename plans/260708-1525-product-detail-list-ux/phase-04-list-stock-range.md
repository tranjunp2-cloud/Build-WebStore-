# Phase 04 — Product List Stock: min–max range + per-variant tooltip/popover (issue 4)

**Context:** [plan.md](plan.md) · GH-1525 issue 4 · **independent** (disjoint files → parallel with P01–P03)
Owns: `src/app/(dashboard)/products/page.tsx` + new `src/lib/products/stock-display.ts`

## Overview
- **Priority:** P1 · **Status:** implemented (pending P05 manual/browser QA)
- Stock column currently shows a single rolled-up total (`product.inventory`, summed server-side in `Products.ts:130-133`). For variant products show a **range** (min–max variant stock) plus a hover (desktop) / tap (mobile) breakdown of `variant.name: stock`.

## Key Insights
- Variant data already in the list response: `getProductsAction` (`actions.ts`, `depth:1`) returns `variants: {id?, name, sku?, price, stock, status?}[]` — NO extra query.
- Display rule:
  - `!hasVariants || !variants?.length` → single number = `product.inventory` (current behavior, unchanged).
  - variants present, all equal OR length 1 → single number.
  - variants present with differing stock → `"{min} - {max}"`.
- Stock **badge color** currently keys off a single `inv` (0 → destructive, ≤5 → warning, else success). For a range, base the severity on **min** stock (worst case) so low-stock still flags. Keep the existing badge components; only the label text becomes a range.
- **Reuse existing primitives:** `tooltip.tsx` (desktop hover) and `popover.tsx` (mobile tap) BOTH already exist; `TooltipProvider` app-wide. Follow `MissingInfoIndicator.tsx` trigger pattern (`onClick={e=>e.stopPropagation()}` so the row's quick-view click doesn't fire).
- **DRY / testability:** extract a pure helper `computeStockDisplay(product)` into `src/lib/products/stock-display.ts`, mirroring the existing `getDisplayPrice`/`getMissingFields` pattern (pure fn in `src/lib/products/`, unit-tested). Both desktop table (L840-848) and mobile card (L949-965) consume it — no duplicated math.

## Requirements
- **Functional:**
  1. Variant product w/ differing stock → "min - max" in Stock cell (desktop + mobile).
  2. Single variant / equal stock / no variants → single number (no range).
  3. Breakdown UI listing each `variant.name: stock`:
     - Desktop: Tooltip on hover of the stock cell.
     - Mobile: Popover on tap (touch-friendly; not hover-only) — per user decision #2.
  4. No-variant products unchanged.
  5. Badge severity from min stock.
- **Non-functional:** breakdown virtualization not needed (variants ≤900 but typically <30; cap list height + scroll if long). i18n labels for "Stock"/breakdown already exist (`t.dashboard.products.list.stock`). Strict TS; helper is pure + side-effect-free.

## Architecture / data flow
```
product.variants[] ──> computeStockDisplay(product) ──> {
    label: string,          // "5 - 20" | "12"
    isRange: boolean,
    min: number, max: number,
    severity: 'out'|'low'|'ok',   // from min
    breakdown: {name,stock}[] | null   // null when no variants
}
        │                                   │
   desktop cell (Badge + Tooltip)     mobile card (badge + Popover trigger on tap)
```
- Helper input type: `{ hasVariants?; inventory?; variants?: {name; stock}[] }` (subset — keep loose like `getDisplayPrice`).

## Related Code Files
- **Create:** `src/lib/products/stock-display.ts` — `export function computeStockDisplay(p): StockDisplay`.
- **Modify:** `src/app/(dashboard)/products/page.tsx`
  - import helper; desktop Stock cell L840-848 → use `label` + severity, wrap in `Tooltip` when `breakdown`.
  - mobile Stock L949-965 → use `label` + severity, wrap trigger in `Popover` (tap) when `breakdown`.
  - remove/keep local `inv` where still needed (weight etc. untouched).
- **Read for context:** `MissingInfoIndicator.tsx` (trigger/stopPropagation pattern), `display-price.ts` (helper shape), `ui/tooltip.tsx`, `ui/popover.tsx`, `ui/badge.tsx`.

## Implementation Steps
1. Create `computeStockDisplay` pure helper + `StockDisplay` type. Handle: no-variants (single = inventory), 1 variant, all-equal, differing; compute min/max/severity/breakdown.
2. Desktop cell: replace `inv`-based Badge with `computeStockDisplay(product)`; if `breakdown`, wrap Badge in `<Tooltip><TooltipTrigger asChild><span onClick={stop}>…</span></TooltipTrigger><TooltipContent>` listing name: stock rows.
3. Mobile card: same label/severity; wrap the stock chip in `<Popover>` with `PopoverTrigger` (tap) + `PopoverContent` breakdown (only when `breakdown`). `stopPropagation` so card quick-view doesn't open.
4. Keep single-number rendering identical to today for non-variant products.
5. Build + manual test: hover desktop, tap mobile, range vs single, low-stock color from min.

## Todo List
- [x] `stock-display.ts` pure helper + type created
- [x] Desktop Stock cell → range label + Tooltip breakdown
- [x] Mobile Stock chip → range label + Popover (tap) breakdown
- [x] Badge severity keyed on refined range rule (max===0→destructive, min===0<max→warning, min 1-5→warning, else success — per plan.md Validation Summary, NOT plain min-based)
- [x] Non-variant path unchanged
- [x] Row/card click not triggered by breakdown interaction (stopPropagation)
- [ ] Build + desktop hover / mobile tap manual test (tsc clean; manual browser QA left to P05)

## Success Criteria
- Variant products show correct min–max (or single when equal/1/none); breakdown reachable via hover on desktop and tap on mobile; low-stock coloring reflects the minimum; non-variant products visually unchanged; clicking the breakdown never opens the quick-view.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Radix Tooltip unusable on touch (mobile) | High×Med | Use Popover (click/tap) on mobile, Tooltip only desktop — decision #2 |
| Breakdown click bubbles → opens quick-view modal | Med×Med | `onClick={e=>e.stopPropagation()}` on trigger (MissingInfoIndicator pattern) |
| `variant.stock` string vs number (coerce) | Med×Low | `Number(v.stock)||0` in helper; unit-test mixed types |
| Long variant list overflow in popover | Low×Low | max-height + overflow-y-auto on content |
| `product.inventory` vs sum-of-variants mismatch confuses users | Low×Low | Range is per-variant min/max; total stays as-is elsewhere (mobile detail viewer uses sum) — documented, no change to rollup |

## Security Considerations
- None. Read-only display of already-authorized, tenant-scoped list data. No new fetch.

## Next Steps
- Independent; merge-safe alongside P01–P03. Feeds P05 (`computeStockDisplay` unit tests + list render test).
