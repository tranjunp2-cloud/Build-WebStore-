---
title: "F09 Product Detail + List UX fixes (GH-1525)"
description: "Disable/re-enable master price fields under variants, reorder variant section, and add stock-range tooltip to product list."
status: pending
priority: P1
effort: 7h
branch: fix/GH-1525-product-detail-list-ux-fixes
tags: [F09, products, product-form, product-list, ux, refactor]
created: 2026-07-08
---

# GH-1525 — Product Detail + List UX fixes

4 UX fixes to Product Detail form + Product List. Single PR (per user decision). Branch off `staging`:
`fix/GH-1525-product-detail-list-ux-fixes` (staging-first, 1 US = 1 branch = 1 PR).

## Issues → phases

| # | Issue | Phase |
|---|-------|-------|
| 3 | Split `VariantsInventorySection.tsx` → `MasterFieldsSection` + `VariantOptionsSection`; verify mobile not broken | P01 |
| 1+2 | Master fields (basePrice/compareAtPrice/baseInventory) disable+tooltip when variants exist; re-enable + keep values when removed | P02 |
| 3 | Render variant-options AFTER master fields in `ProductForm.tsx` | P03 |
| 4 | Product List Stock column: min–max range + per-variant tooltip/popover (desktop hover + mobile tap) | P04 |
| — | Unit tests (TC-IDs) + cross-browser/responsive QA | P05 |

## Phases

| Phase | File | Status | Depends on | Parallel? |
|-------|------|--------|-----------|-----------|
| P01 Split sections (behavior-preserving) + verify mobile | [phase-01](phase-01-split-sections.md) | done | — | — |
| P02 Master fields disable/enable + tooltip (issue 1+2) | [phase-02](phase-02-master-fields-disable.md) | done | P01 | — |
| P03 Reorder sections in ProductForm (issue 3) | [phase-03](phase-03-reorder-sections.md) | done (no-op, satisfied by P01) | P01 | — |
| P04 Product List stock range + tooltip/popover (issue 4) | [phase-04](phase-04-list-stock-range.md) | pending | — | ✅ parallel w/ P01–P03 (disjoint files) |
| P05 Tests + QA | [phase-05](phase-05-tests-qa.md) | pending | P01–P04 | — |

## File ownership (no overlap)

- **P01–P03** own `src/components/dashboard/product-form/**` + `ProductForm.tsx`.
- **P04** owns `src/app/(dashboard)/products/page.tsx` + new `src/lib/products/stock-display.ts` (disjoint → runs parallel to P01–P03).
- **P05** owns `src/__tests__/**` only.

## Key dependencies

- shadcn `tooltip.tsx` + `popover.tsx` both already exist — no shadcn add needed. `TooltipProvider` already app-wide at `(dashboard)/layout.tsx`.
- `use-debounce` hook exists (`src/hooks/`) — reused in P01 for baseSku→matrix regen.
- No DB/schema/API change. No migration. `Products.ts` inventory rollup + `getProductsAction` (depth:1, variants incl.) already supply all data.

## Top risks (see per-phase Risk Assessment)

1. **Split breaks the `baseSku` onBlur → `regenerateMatrix` cross-component call** (High) — mitigated in P01 by relocating SKU-regen into `VariantOptionsSection` via a debounced `useWatch('baseSku')` effect.
2. **`ProductDetailsMobile.tsx` regression** — VERIFIED false: it is a read-only viewer, does NOT import `VariantsInventorySection`. `SkuMatrixMobile` moves with `VariantOptionsSection`. Confirm in P01.
3. **Mobile tooltip hover-only unusable on touch** (Med) — P04 uses Popover (click/tap) for breakdown.

## Validation Summary

**Validated:** 2026-07-08
**Questions asked:** 4

### Confirmed Decisions
- **Master lock timing (P02):** confirmed `lockMaster = hasVariants && variantCount>0` (fields stay editable right after toggle-on until first variant row exists; disable once ≥1 variant, re-enable automatically on delete-all). Matches phase-02's stated default — no change needed.
- **baseSku behavior delta (P01):** confirmed debounced `useWatch('baseSku')` (~300ms) replacing onBlur is acceptable. No change needed; keep P05 regression test for this.
- **Stock badge severity (P04) — REFINED, differs from phase-04 draft:** user wants a variant at 0 stock to show **warning (yellow)**, not destructive (red), as long as the product overall still has stock elsewhere. Red is reserved for "nothing left at all." Updated rule for `computeStockDisplay` (action item below):
  - Range (differing variant stock): `max === 0` → destructive (all variants out); `min === 0 && max > 0` → warning (some variant out, others in stock); `min > 0 && min <= 5` → warning; else success.
  - Single number (no variants / 1 variant / all-equal): unchanged existing logic (`inv===0`→destructive, `inv<=5`→warning, else success).
- **QA doc target (P05):** confirmed `docs/qa/F08-product-crud.md` (not F09-products-crud.md) — this is the established doc; use it for new `TC-F08-1525-*` rows.

### Action Items
- [ ] Update phase-04's severity rule from plain "min-based" to the refined range rule above (max===0→destructive, min===0<max→warning) before/during implementation — not yet written into phase-04.md, apply during P04 execution.
- [ ] Confirm during P05 that TC-IDs are appended to `docs/qa/F08-product-crud.md` (phase-05.md already defaults to this file — no change needed there).

**Recommendation:** Proceed to implementation. No further plan revision required — the one refinement (stock severity) is small enough to apply directly during P04 coding rather than rewriting the phase file.
