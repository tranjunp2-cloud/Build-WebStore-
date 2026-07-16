# Phase 02 — Master fields disable/re-enable + tooltip (issues 1 + 2)

**Context:** [plan.md](plan.md) · GH-1525 issues 1+2 · depends on **P01**
Owns: `src/components/dashboard/product-form/MasterFieldsSection.tsx`

## Overview
- **Priority:** P1 · **Status:** done (updated 2026-07-09)
- When ≥1 variant exists, the 3 master inputs (`basePrice`, `compareAtPrice`, `baseInventory`) are auto-derived from the variant matrix, so manual edits are misleading. Disable them + tooltip explaining why. When variants are removed (last tier deleted) or the variant toggle is turned off, re-enable them and KEEP existing values (user decision #1 — no reset).

### Update (2026-07-09) — hide, not disable
User revised issue 1's approach: instead of `disabled` + hover tooltip, the 3 master
inputs (`basePrice`, `compareAtPrice`, `baseInventory`) are now **hidden entirely**
(conditionally unrendered) when `lockMaster` is true, replaced by a single explanatory
line reusing the `masterLockedTooltip` i18n text. `baseSku` is unaffected — always
visible/editable. Values are preserved across hide/show because react-hook-form keeps
registered field state on unmount (`shouldUnregister` defaults to `false`), so issue
2's "re-show + keep values" requirement is satisfied the same way as before, just via
conditional rendering instead of `disabled`. See `MasterFieldsSection.tsx` and
`src/__tests__/unit/dashboard/master-fields-disable.test.tsx` (TC-F08-1525-10..14,
rewritten for this update).

## Key Insights
- `hasVariants` is the gating boolean, read via `useWatch({name:'hasVariants'})`. Use it directly as `disabled={hasVariants}` — NOT `variants.length`. Rationale: the two auto-fill effects (moved to Component B in P01) already keep base values synced whenever `hasVariants && variants.length`; and when the toggle flips off, `ProductForm` submit-resolver clears variants at submit while the effects stop running — base values are left as last-synced, which is exactly "keep old values."
  - Edge case: toggle ON but matrix not yet generated (`variants.length===0`). With `disabled={hasVariants}` the fields disable immediately on toggle-on even before generating. This is acceptable/desirable (values will be auto-filled on generate) and matches the existing "auto-filled from variants" note at L217-221. Confirm with QA; if product owner wants fields editable until first generate, switch to `disabled={hasVariants && variantCount>0}` (variantCount via `useWatch('variants')?.length`). **Default: `disabled={hasVariants}`.**
- Re-enable path is automatic: deleting the last tier → `regenerateMatrix` calls `replaceVariants([])`; but `hasVariants` stays true until the user toggles off. So "variants removed via delete-all" still shows disabled unless we also key off variant count. **Decision:** disable when `hasVariants && (variantCount>0)` so delete-all re-enables without requiring toggle-off — this satisfies issue 2 literally ("re-enabled when variants removed"). Final rule: `const lockMaster = !!hasVariants && (useWatch('variants')?.length ?? 0) > 0`.
- `baseSku` stays EDITABLE in all modes (it is the SKU prefix for generation) — do NOT disable it.
- Tooltip: reuse existing shadcn `Tooltip` (provider already app-wide). Pattern from `MissingInfoIndicator.tsx`. Wrap each disabled input (or a shared info icon on the section) with `<Tooltip><TooltipTrigger asChild>…</TooltipTrigger><TooltipContent>{explain}</TooltipContent></Tooltip>`. Note: disabled `<input>` swallows pointer events → put the `TooltipTrigger` on a wrapping element, not the disabled input itself.

## Requirements
- **Functional:**
  1. `hasVariants && variants.length>0` → basePrice, compareAtPrice, baseInventory disabled + tooltip.
  2. Variants removed (delete-all → `variants.length===0`) OR toggle off → the 3 fields re-enable, retaining their current values (no reset to 0/empty).
  3. `baseSku` never disabled.
- **Non-functional:** tooltip text via i18n (`t.dashboard.products.form.sections?.*`), en + vi + ms keys; keyboard/AT accessible; strict TS.

## Architecture / data flow
```
useWatch(hasVariants)       -+
useWatch(variants).length   -+-> lockMaster --> disabled={lockMaster} on 3 inputs
                                            \--> Tooltip shown when lockMaster
values: never cleared on lock/unlock (kept in RHF state; Comp B effects write derived values while locked)
```

## Related Code Files
- **Modify:** `MasterFieldsSection.tsx` — add `lockMaster`, `disabled` on 3 inputs, Tooltip wrappers, i18n tooltip string.
- **Modify (i18n):** locale dictionaries under `src/i18n/**` — add tooltip key (e.g. `sections.masterLockedTooltip`) for en/vi/ms.
- **Read for context:** `MissingInfoIndicator.tsx` (tooltip pattern), `schema.ts` (fields still optional/required unchanged).

## Implementation Steps
1. In `MasterFieldsSection.tsx` compute `const variantCount = useWatch({control,name:'variants'})?.length ?? 0; const lockMaster = !!hasVariants && variantCount > 0`.
2. Add `disabled={lockMaster}` to basePrice, compareAtPrice, baseInventory `<Input>`.
3. Add a `Tooltip` on each (wrapper span as trigger) rendered only when `lockMaster`; content = new i18n key explaining "auto-filled from variants — edit variant rows below." Keep existing L217-221 note or fold into tooltip (avoid duplicate message — DRY).
4. Add i18n key to en/vi/ms dictionaries.
5. Verify no value reset: lock→unlock keeps numbers (RHF state untouched; do not call reset/setValue on toggle).
6. Build + manual test all 4 transitions (toggle on, generate, delete-all, toggle off).

## Todo List
- [ ] `lockMaster` derived (hasVariants && variantCount>0)
- [ ] 3 inputs `disabled`; baseSku untouched
- [ ] Tooltip on disabled inputs (wrapper trigger, not the input)
- [ ] i18n key added en/vi/ms
- [ ] Values retained across lock↔unlock (verified)
- [ ] Build + manual 4-transition test

## Success Criteria
- Master price/compare/inventory disabled with explanatory tooltip whenever a variant matrix exists; re-enabled with prior values intact when matrix emptied or toggle off; baseSku always editable. No console errors, i18n resolves in all 3 locales.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Tooltip not triggering on disabled input | Med×Low | Trigger on wrapping span, not the disabled input |
| Values reset on unlock (violates decision #1) | Low×High | Never call setValue/reset on toggle; rely on RHF state persistence; assert in P05 test |
| "disable-on-toggle-before-generate" UX dispute | Med×Low | Rule keyed on variantCount>0 so pre-generate stays editable; documented for QA sign-off |

## Security Considerations
- None. Disable is a client-side UX guard only; server-side publish-guard (`src/lib/products/publish-guard.ts`) remains the source of truth for validity.

## Next Steps
- Independent of P03/P04. Feeds P05 tests (disable/enable + value-retention TCs).
