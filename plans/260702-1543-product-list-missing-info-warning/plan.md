---
title: "Product List missing-info soft warning (GH-1457)"
description: "Warning icon + left border + tooltip on Product List rows/cards missing ALT text or category."
status: pending
priority: P1
effort: 2h
branch: staging
tags: [frontend, F09, products, ux, i18n]
created: 2026-07-02
---

# GH-1457 — Product List missing-info soft warning

Soft, read-only warning UI on the Products dashboard for products missing critical info
(image ALT text and/or category). Warning icon next to the product name + thin left border
on the row/card + hover tooltip listing exactly which fields are missing. Complete products
render zero warning UI. Purely visual — no behavior/schema/backend change.

## Scope

- Single file: `src/app/(dashboard)/products/page.tsx` (desktop table + mobile card render paths)
- Add i18n keys: `src/i18n/locales/en.json`, `src/i18n/locales/ms.json`
- No schema/migration/backend change (data already fetched with `depth:1`)

## Missing-field criteria (exactly two)

1. ALT: `!product.images?.length || !product.images[0]?.alt`
2. Category: `!product.category?.length`
(weight + price explicitly excluded)

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 01 | Helper + indicator component + i18n + desktop & mobile wiring | pending | [phase-01](phase-01-missing-info-warning.md) |

Single phase — change is isolated to one component file plus two locale files, DRY-shared
via one helper (`getMissingFields`) and one presentational component (`MissingInfoIndicator`).

## Key dependencies

- `Tooltip`/`TooltipTrigger`/`TooltipContent` from `@/components/ui/tooltip` (TooltipProvider already mounted in dashboard layout)
- `AlertTriangle` from `lucide-react` (NOT yet imported — must add)
- `--warning` design token (`text-warning` / `hsl(var(--warning))`)

## Out of scope

- Any schema/migration change
- Weight/price checks
- Changing click-to-quickview, status toggle, edit/delete behavior
- Badge variant (icon+tooltip+border only)

## Corrections vs original scouting brief

- `AlertTriangle` is NOT already imported (line 8 has `AlertCircle`) → add it.
- Locales are English + **Malay** (`ms.json`), not Vietnamese.
- Desktop `<tr>` inline border unreliable under border-collapse → apply left border to first `TableCell`.

## Validation Summary

**Validated:** 2026-07-02
**Questions asked:** 4

### Confirmed Decisions
- Border strategy: keep phase-01 as written — try inline `borderLeft` on first `TableCell`/card wrapper first, fall back to `boxShadow: inset` only if visually faint (no plan change).
- i18n wording: keep planner's proposed EN/MS strings as-is (no change).

### Action Items (phase file NOT yet updated — apply during /cook)
- [ ] **Extract shared file** instead of keeping `getMissingFields` + `MissingInfoIndicator` local to `page.tsx`. Move to a new file (e.g. `src/lib/products/missing-fields.ts` for the pure `getMissingFields` fn + `MissingField` type, and `src/components/dashboard/MissingInfoIndicator.tsx` for the presentational component), then import into `page.tsx`. Rationale: `SEOView.tsx`/`OverviewView.tsx` already have an adjacent `productMissingAltCount` concept — extracting makes future reuse possible without touching this issue's scope today.
- [ ] **Add keyboard focus support** to `MissingInfoIndicator`'s tooltip trigger — change the trigger wrapper from a plain `<span onClick={stopPropagation}>` to a focusable element (e.g. `<button type="button" aria-label={t.dashboard.products.list.missingInfoTitle} onClick={stopPropagation}>`) so the tooltip is reachable/visible via Tab + focus, not hover-only. Radix `Tooltip` already shows on focus by default once the trigger is focusable — verify this works with `asChild` on a `button`.
