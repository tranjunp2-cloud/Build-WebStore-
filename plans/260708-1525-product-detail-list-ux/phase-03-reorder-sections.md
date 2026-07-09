# Phase 03 — Reorder: variant-options renders AFTER master fields (issue 3)

**Context:** [plan.md](plan.md) · GH-1525 issue 3 (ordering half) · depends on **P01**
Owns: `src/components/dashboard/product-form/ProductForm.tsx`

## Overview
- **Priority:** P1 · **Status:** pending
- With the split done (P01), place `MasterFieldsSection` above `VariantOptionsSection` in the form so buyers/merchants see the master price/SKU/inventory fields first, then the variant matrix below.

## Key Insights
- After P01, `ProductForm.tsx` (L210-216) renders the two new components in the old single slot. This phase sets the final order and adds the render-gate for `VariantOptionsSection`.
- `VariantOptionsSection` should render only when `hasVariants` is true (per split spec). Two clean options: (a) gate inside the component with `if(!hasVariants) return null` after all hooks; (b) gate in `ProductForm` via `useWatch`. **Prefer (a)** — keeps `ProductForm` dumb and avoids adding a watch subscription at the form root. If (a), `ProductForm` renders both unconditionally in order and the component self-hides.
- Final desired order (per plan): `GeneralInfoSection → MasterFieldsSection → VariantOptionsSection → ShippingDimensionsSection → DescriptionSeoSection → AttributesSection`.

## Requirements
- **Functional:** master fields section visually precedes the variant-options (tiers/matrix) section. Toggle-on reveals variant UI below master fields; toggle-off hides it. No change to other sections' order.
- **Non-functional:** no extra re-renders introduced at form root; strict TS.

## Architecture / render order
```
<GeneralInfoSection/>
<MasterFieldsSection/>      (Switch banner + master price/sku/inventory)
<VariantOptionsSection/>    (self-hides when !hasVariants)
<ShippingDimensionsSection/>
<DescriptionSeoSection/>
<AttributesSection/>
```

## Related Code Files
- **Modify:** `ProductForm.tsx` — final import list + JSX order (L15-19 imports, L210-216 render).
- **Possibly modify:** `VariantOptionsSection.tsx` — ensure `if(!hasVariants) return null` guard (after hooks) if not already added in P01.

## Implementation Steps
1. Ensure imports for `MasterFieldsSection` + `VariantOptionsSection` (remove old `VariantsInventorySection` import if any residue).
2. Order JSX per architecture block above.
3. Confirm `VariantOptionsSection` self-hides when `!hasVariants` (hooks remain unconditional above the guard).
4. Build + manual smoke: create product, toggle variants on/off, verify visual order + no layout break on desktop + < 820px.

## Todo List
- [x] Imports finalized in ProductForm.tsx — satisfied by P01 (same-slot swap already placed Master before VariantOptions)
- [x] JSX order: General → Master → VariantOptions → Shipping → Desc/SEO → Attributes — verified in ProductForm.tsx:212-217, matches exactly
- [x] VariantOptionsSection self-hides on !hasVariants (hooks unconditional) — verified: `if (!hasVariants) return null` after all hooks
- [ ] Build + responsive smoke — tsc clean confirmed; manual responsive/visual smoke deferred to P05 QA matrix

## Note (2026-07-08)
No code changes were needed for this phase — P01's split already produced the desired final order as a side effect (the two new components were placed in master→variant order in the same slot). Verified directly (no agent spawned) by re-reading ProductForm.tsx and VariantOptionsSection.tsx. The old single-card divider (`pt-6 border-t`) from the pre-split file is gone but not missed — each section is now its own bordered card.

## Success Criteria
- Variant-options section always renders below master fields; toggling variants shows/hides the matrix in the correct position; no regression to surrounding sections or the save-bar dirty state.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Conditional hook order if guard placed above hooks | Low×High | Guard is a JSX/`return null` AFTER all hooks; lint `react-hooks/rules-of-hooks` will catch |
| Spacing/border regression (old `pt-6 border-t` divider between master + variant lived inside one file) | Med×Low | Reproduce the divider between the two components; visual check both breakpoints |

## Security Considerations
- None. Pure presentational ordering.

## Next Steps
- Completes issue 3. Feeds P05 (order + toggle render tests via component test).
