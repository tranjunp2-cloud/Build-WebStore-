# Phase 01 — Split VariantsInventorySection → MasterFieldsSection + VariantOptionsSection

**Context:** [plan.md](plan.md) · Issue GH-1525 (issue 3, structural half) · Feature F09
Source: `src/components/dashboard/product-form/VariantsInventorySection.tsx` (567 lines)

## Overview
- **Priority:** P1 · **Status:** pending
- Behavior-preserving refactor. Split the one 567-line file into two focused components so a later phase can reorder them and add disable logic on a smaller surface. No visible behavior change in THIS phase (issues 1+2 land in P02, reorder in P03).
- Honors 200-line file cap (rule `development-rules.md`); current file is 2.8× over.

## Key Insights
- **Split boundary (per user):** Component A = master fields + `hasVariants` Switch banner. Component B = tiers/options/generate/SKU-matrix (renders only when `hasVariants`).
- Both components stay under one `FormProvider` (`ProductForm.tsx`), so RHF `getValues`/`useWatch`/`setValue`/`useFieldArray` reads stay shared automatically — no prop drilling for form values.
- **Critical coupling:** `baseSku` input (Component A) currently has an `onBlur` → `regenerateMatrix()` (VariantsInventorySection L229-236). `regenerateMatrix` uses `replaceVariants` (useFieldArray) + `lastGeneratedBaseSkuRef`/`lastGeneratedBasePriceRef`. These live in Component B after the split. A cross-component callback would require a shared context.
  - **Decision:** move SKU-regen reaction INTO Component B. `baseSku` in Component A becomes a plain `register('baseSku')` (no onBlur). Component B adds `const baseSku = useWatch({name:'baseSku'})` + a debounced `useEffect` (reuse `src/hooks/use-debounce`) that calls `regenerateMatrix()` when `baseSku` changed AND a matrix exists AND `lastGeneratedBaseSkuRef.current !== baseSku`. Same guards as today; blur→debounced-watch is the only behavior delta (call out in PR + test).
- **Mobile verification (risk #2):** `ProductDetailsMobile.tsx` is a **read-only product viewer** used by the products LIST page (`page.tsx:1078`); it does NOT import `VariantsInventorySection` and is unaffected. `SkuMatrixMobile.tsx` IS rendered inside the variant matrix (L521) → it moves with Component B, keeps its `variants`/`variantsLive` props. `variant-utils.ts` is a pure util imported by both the old file and `ProductForm` — unchanged.

## Requirements
- **Functional:** After split, create/edit product (variant + non-variant), generate matrix, edit variant rows, delete tier/option, delete last tier→matrix clears, change SKU prefix→variant SKUs update, mobile SKU accordion — all behave exactly as before.
- **Non-functional:** Each new file < 200 lines where feasible; no `any` added; strict TS passes; `npm run build` compiles.

## Architecture — component responsibilities after split
```
ProductForm (FormProvider)
├── MasterFieldsSection.tsx        (NEW — Component A)
│   ├── hasVariants Switch banner  (from L169-185; appendTier on enable)
│   ├── basePrice / compareAtPrice inputs   (L189-215)
│   ├── auto-filled note            (L217-221)
│   └── baseSku (plain) / baseInventory inputs (L223-255)
└── VariantOptionsSection.tsx      (NEW — Component B; render-gated hasVariants)
    ├── useFieldArray tiers + variants; refs; regenerateMatrix; generateSkuTable
    ├── variant→master sync effects (L56-61, L112-125)  ← move here (guarded by hasVariants)
    ├── NEW debounced baseSku-watch effect → regenerateMatrix (replaces onBlur)
    ├── derived hints (L42-53, L442-453)
    ├── tiers list + add/remove option + generate button (L258-440)
    ├── SKU matrix desktop table + <SkuMatrixMobile/> (L455-524)
    └── tier-delete confirm Dialog (L529-564)
```
Data flow: master field values live in shared RHF state; Component B reads them via `getValues`/`useWatch` and writes derived base values back via `setValue(..., {shouldDirty:false})` (unchanged effects). The `hasVariants` Switch (Component A) drives whether Component B renders (via `useWatch('hasVariants')` in `ProductForm` — see P03) and appends the first tier on enable.

## Related Code Files
- **Create:** `src/components/dashboard/product-form/MasterFieldsSection.tsx`
- **Create:** `src/components/dashboard/product-form/VariantOptionsSection.tsx`
- **Delete:** `src/components/dashboard/product-form/VariantsInventorySection.tsx` (fully replaced)
- **Modify:** `src/components/dashboard/product-form/ProductForm.tsx` (swap import — full render-order change deferred to P03; here just replace `<VariantsInventorySection/>` with `<MasterFieldsSection/>` + `<VariantOptionsSection/>` in the SAME slot to keep P01 behavior-identical)
- **Read for context:** `SkuMatrixMobile.tsx`, `variant-utils.ts`, `schema.ts`, `src/hooks/use-debounce.ts`
- **Do NOT touch:** `ProductDetailsMobile.tsx` (unrelated viewer)

## Implementation Steps
1. Create branch `fix/GH-1525-product-detail-list-ux-fixes` off `staging`.
2. Create `MasterFieldsSection.tsx`: move Switch banner + 4 master inputs. `baseSku` → plain `register('baseSku')`, drop the onBlur. Keep i18n keys, classNames, error rendering identical.
3. Create `VariantOptionsSection.tsx`: move all variant logic (field arrays, refs, `regenerateMatrix`, `generateSkuTable`, both sync effects, derived memos, tiers UI, matrix table, `SkuMatrixMobile`, delete Dialog). Wrap top-level in `{hasVariants && (…)}` OR early-return `if(!hasVariants) return null` (keep effects above the guard so hooks order is stable — prefer render-gate at JSX, hooks unconditional).
4. Add debounced baseSku-regen effect in Component B (replaces onBlur). Same guards.
5. In `ProductForm.tsx`: replace single import/usage with the two new components in the identical position.
6. `npm run build` (or `tsc --noEmit`) → 0 errors. Manual smoke on desktop + mobile widths.

## Todo List
- [ ] Branch created off staging
- [ ] `MasterFieldsSection.tsx` created (< 200 lines)
- [ ] `VariantOptionsSection.tsx` created
- [ ] baseSku onBlur → debounced watch effect in Component B
- [ ] Old file deleted, `ProductForm.tsx` imports updated (same slot)
- [ ] Build compiles; manual smoke (create/edit, variant + non-variant, mobile accordion)
- [ ] Confirm `ProductDetailsMobile` viewer unaffected

## Success Criteria
- Build + typecheck pass, zero behavior change vs. `staging` for all product-form flows (variant/non-variant create+edit, matrix gen, tier/option delete, SKU-prefix change, mobile accordion).
- No file in the split exceeds ~200 lines by a wide margin; logic not duplicated (DRY).

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| baseSku onBlur→regen lost across split | High×High | Debounced `useWatch('baseSku')` effect in Component B (step 4); regression test in P05 |
| Hooks-order violation if effects placed under `hasVariants` guard | Med×High | Keep all hooks unconditional; gate only JSX/return |
| `SkuMatrixMobile` double-registration / ref loss | Med×Med | It uses `setValue` not `register` (desktop owns refs) — keep both matrix renders in Component B together |
| `ProductDetailsMobile` regression | Low×High | VERIFIED independent; do not edit; confirm in smoke |
| Debounced regen clobbers in-progress variant SKU edits | Med×Med | Preserve existing guards (`lastGeneratedBaseSkuRef`, variantName-match preserve in `buildVariantMatrix`); debounce ≥300ms |

## Security Considerations
- None. Pure client-side form refactor; no auth/data-boundary change; no new inputs accepting untrusted data.

## Next Steps
- Unblocks P02 (disable/enable on MasterFieldsSection) and P03 (reorder). P04 independent.
