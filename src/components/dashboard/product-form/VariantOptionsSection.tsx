'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useFormContext, useFieldArray, useWatch } from 'react-hook-form'
import type { FieldError } from 'react-hook-form'
import { ProductFormValues } from './schema'
import { Plus, Wand2, Trash2 } from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { useDebounce } from '@/hooks/useDebounce'
import { SkuMatrixMobile } from './SkuMatrixMobile'
import { computeDuplicateIndicesForOptions, isNonEmptyTier, buildVariantMatrix, cartesianProductOfTiers, hasNumericValue } from './variant-utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

// Component B (GH-1525 split; layout follow-up): hasVariants toggle banner + variant
// tiers/options + generated SKU matrix. Always renders (the toggle must stay visible
// even when hasVariants is off, so the user can turn it on) — only the tiers/options
// UI below the toggle is gated on hasVariants. Owns the single useFieldArray('tiers')
// instance for the whole form, so the toggle's "append first tier on enable" goes
// through this component's own `appendTier` — no cross-component sync needed.
export function VariantOptionsSection() {
    const { register, setValue, getValues, control, formState, trigger } = useFormContext<ProductFormValues>()
    const { t } = useI18n()
    const [isGenerating, setIsGenerating] = useState(false)
    const [tierToDelete, setTierToDelete] = useState<number | null>(null)

    const errors = formState.errors

    // Tiers setup
    const { fields: tiers, update: updateTier, remove: removeTier, append: appendTier } = useFieldArray({
        control,
        name: 'tiers'
    })

    // Matrix setup
    const { fields: variants, replace: replaceVariants } = useFieldArray({
        control,
        name: 'variants'
    })

    // useWatch for all live values — avoids render loops and ref conflicts caused by watch()
    const hasVariants = useWatch({ control, name: 'hasVariants' })
    const watchedTiers = useWatch({ control, name: 'tiers' }) || []
    const variantsLive = useWatch({ control, name: 'variants' })
    const currency = useWatch({ control, name: 'currency' }) ?? 'MYR'
    const baseSku = useWatch({ control, name: 'baseSku' })

    // hasNumericValue excludes a row mid-clear ('') from the derived min/max — otherwise
    // a row the user is about to retype a price into drags the displayed hint to 0 (L4-
    // adjacent bug: same '' != null pitfall as buildVariantMatrix, caught by adversarial
    // review while verifying the auto-fill effect below).
    const derivedMinPrice = useMemo(() => {
        const priced = (variantsLive || []).filter(v => hasNumericValue(v.price))
        return priced.length ? Math.min(...priced.map(v => Number(v.price))) : null
    }, [variantsLive])
    const derivedMaxCompareAt = useMemo(() => {
        const compared = (variantsLive || []).filter(v => hasNumericValue(v.compareAtPrice))
        return compared.length ? Math.max(...compared.map(v => Number(v.compareAtPrice))) || null : null
    }, [variantsLive])

    // Sync baseInventory = sum of all variant stocks whenever variants change.
    // Deliberately does NOT reset baseInventory when variants become empty (all tiers/
    // options cleared) — MasterFieldsSection's re-shown Inventory field must retain its
    // prior value verbatim (GH-1525 issue-2 "decision #1", see
    // plans/260708-1525-product-detail-list-ux/phase-02-master-fields-disable.md:
    // "Never call setValue/reset on toggle"). A field-array-cleared value staying stale
    // is fine — the user can see/edit it; what must NOT happen is silently seeding new
    // variant rows FROM that stale sum, which is guarded separately via
    // `hasEverGeneratedRef` below (code-review adversarial finding H1).
    useEffect(() => {
        if (!hasVariants || !variantsLive?.length) return
        const total = variantsLive.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
        setValue('baseInventory', total, { shouldDirty: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [variantsLive, hasVariants])

    // Tracks whether a non-empty variant matrix has EVER been generated this session —
    // separate from `variants.length` (which goes back to 0 when the user clears all
    // options) and separate from `baseInventory` (which per decision #1 above must stay
    // whatever it was). Lazy-inits true when editing an existing product that already
    // has variants on mount, same rationale as lastGeneratedTiersSignatureRef below.
    // buildVariantMatrix uses this to tell "genuinely first-ever generate" (safe to seed
    // new rows from base.inventory) apart from "cleared then regenerated" (base.inventory
    // may be a stale sum — new rows must start at 0 instead; H1).
    const hasEverGeneratedRef = useRef(false)
    if (!hasEverGeneratedRef.current) {
        hasEverGeneratedRef.current = (getValues('variants') || []).length > 0
    }

    const isAllTiersEmpty = watchedTiers.every(
        t => !t.name?.trim() && (t.options || []).every(o => !o?.trim())
    )

    const duplicateOptionIndices: Record<number, Set<number>> = {}
    watchedTiers.forEach((tier, tIdx) => {
        const dups = computeDuplicateIndicesForOptions(tier.options || [])
        if (dups.size) duplicateOptionIndices[tIdx] = dups
    })

    const hasDuplicates = Object.keys(duplicateOptionIndices).length > 0

    const activeTiers = watchedTiers.filter(isNonEmptyTier)
    const activeTierNames = activeTiers.map(t => t.name.trim().toLowerCase()).filter(Boolean)
    const hasDuplicateTierNames = new Set(activeTierNames).size !== activeTierNames.length

    // Tracks basePrice used on last generate — used to detect user-customized variant prices
    const lastGeneratedBasePriceRef = useRef<number | null>(null)
    // Tracks compareAtPrice used on last generate — independent from price, so a row's
    // compareAtPrice customization is never silently overwritten just because that
    // row's price happened to be unchanged (GH-1525 follow-up bug).
    const lastGeneratedCompareAtPriceRef = useRef<number | null>(null)
    // Tracks baseSku used on last generate — used to sync auto-generated variant SKUs on prefix change
    const lastGeneratedBaseSkuRef = useRef<string | null>(null)
    // Tracks the tiers config (name+options) the CURRENT matrix was built from — drives
    // whether "Generate variants" is shown again after a successful generate. Hidden once
    // the matrix matches the tiers; reappears if the user edits an option/value afterward.
    // Starts `undefined` (not `null`) so the lazy-init below can tell "never generated
    // this session" apart from "no matrix" — without it, editing an existing product
    // (variants already loaded from the server, matching tiers) would show the bar on
    // mount for no reason, since a fresh ref has nothing to compare against.
    const lastGeneratedTiersSignatureRef = useRef<string | null | undefined>(undefined)
    const tiersSignature = (tiersArr: Array<{ name?: string; options?: string[] }>) =>
        JSON.stringify((tiersArr || []).map(t => ({
            name: (t.name || '').trim(),
            options: (t.options || []).map(o => (o || '').trim()),
        })))
    // Lazy-init on first render only: if the product already has variants when this
    // component mounts (editing an existing product), seed the ref from the loaded
    // tiers so the bar starts correctly hidden instead of defaulting to "stale".
    if (lastGeneratedTiersSignatureRef.current === undefined) {
        const initialVariants = getValues('variants') || []
        lastGeneratedTiersSignatureRef.current = initialVariants.length > 0
            ? tiersSignature(getValues('tiers') || [])
            : null
    }

    // Rebuilds the variant matrix from the given tiers (or current form tiers if omitted).
    // Pass tiersData pre-delete so regeneration uses the correct state before RHF propagates.
    // prevBasePrice=null preserves all existing customized rows by variantName match.
    const regenerateMatrix = (tiersData?: Array<{ name?: string; options?: string[] }>) => {
        const allTiers = tiersData ?? (getValues('tiers') || [])
        const combinations = cartesianProductOfTiers(allTiers)
        const currentVariants = getValues('variants') || []
        if (combinations.length === 0) {
            if (currentVariants.length > 0) replaceVariants([])
            lastGeneratedTiersSignatureRef.current = null
            return
        }
        const basePrice = Number(getValues('basePrice')) || 0
        const compareAtPrice = Number(getValues('compareAtPrice')) || 0
        const baseInventory = Number(getValues('baseInventory')) || 0
        const baseSkuValue = getValues('baseSku') || 'SKU'
        const next = buildVariantMatrix(
            combinations,
            { price: basePrice, compareAtPrice: compareAtPrice || undefined, inventory: baseInventory, sku: baseSkuValue },
            currentVariants,
            null,
            lastGeneratedBaseSkuRef.current ?? undefined,
            null,
            hasEverGeneratedRef.current,
        )
        replaceVariants(next)
        hasEverGeneratedRef.current = true
        lastGeneratedBaseSkuRef.current = baseSkuValue
        lastGeneratedTiersSignatureRef.current = tiersSignature(allTiers)
    }

    // Auto-fill basePrice/compareAtPrice from variant matrix (Bug 7)
    // Keeps root DB fields accurate without requiring manual entry.
    // Rows mid-clear ('') are excluded from min/max via hasNumericValue, NOT counted as
    // 0 — the old `v.price != null ? Number(v.price) : 0` treated a cleared row's price
    // as a real $0 and force-wrote it into the (hidden, invisible) basePrice field on
    // every keystroke; the next unrelated regenerate then baked that corrupted $0 into
    // base.price for every row via buildVariantMatrix, reaching the submit payload as a
    // literal price:0 — a real sell-for-free risk (adversarial-review finding, caught
    // while verifying the L4 fix). If EVERY row's price is currently mid-clear, skip the
    // basePrice write entirely this render rather than force it to a fabricated 0 —
    // same "never force a master field from incomplete derived data" principle as the
    // baseInventory-sync effect above.
    useEffect(() => {
        if (!hasVariants || !variantsLive?.length) return
        const pricedRows = variantsLive.filter(v => hasNumericValue(v.price))
        const comparedRows = variantsLive.filter(v => hasNumericValue(v.compareAtPrice))
        const curBase = Number(getValues('basePrice')) || 0
        const curCompare = Number(getValues('compareAtPrice')) || 0
        if (pricedRows.length > 0) {
            const minPrice = Math.min(...pricedRows.map(v => Number(v.price)))
            if (minPrice !== curBase) {
                setValue('basePrice', minPrice, { shouldDirty: false, shouldValidate: false })
                // Keep the "last generated" baseline in lockstep with this auto-sync — otherwise
                // editing ONE row's price (which shifts min/max here) leaves lastGeneratedBasePriceRef
                // stale, so a LATER regenerate (e.g. triggered by adding an unrelated tier option)
                // compares OTHER untouched rows against the wrong baseline and silently resets their
                // price (adversarial-review bug: "spooky action at a distance" price reset).
                lastGeneratedBasePriceRef.current = minPrice
            }
        }
        // compareAtPrice uses Math.max, not Math.min — a cleared row's excluded '' can
        // never fabricate a spurious max the way it could a spurious min, so (unlike
        // price above) this branch always runs, preserving the original "no variant has
        // a sale price → undefined" sync behavior exactly.
        const maxCompare = comparedRows.length > 0 ? Math.max(...comparedRows.map(v => Number(v.compareAtPrice))) : 0
        const newCompare = maxCompare > 0 ? maxCompare : undefined
        if (newCompare !== (curCompare || undefined)) {
            setValue('compareAtPrice', newCompare, { shouldDirty: false, shouldValidate: false })
            lastGeneratedCompareAtPriceRef.current = newCompare ?? null
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [variantsLive, hasVariants])

    // Replaces the old baseSku onBlur→regenerateMatrix reaction (moved here from MasterFieldsSection
    // since baseSku now lives in a sibling component). Debounced so rapid typing doesn't thrash the
    // matrix; skips the very first run so loading an edit-product page doesn't regenerate on mount.
    const debouncedBaseSku = useDebounce(baseSku, 300)
    const isFirstBaseSkuRun = useRef(true)
    useEffect(() => {
        if (isFirstBaseSkuRun.current) {
            isFirstBaseSkuRun.current = false
            return
        }
        if (!hasVariants) return
        const current = debouncedBaseSku || 'SKU'
        const hasMatrix = (getValues('variants') || []).length > 0
        if (!hasMatrix) return
        if (lastGeneratedBaseSkuRef.current === current) return
        regenerateMatrix()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedBaseSku])

    const isGenerateDisabled = activeTiers.length === 0 || hasDuplicates || hasDuplicateTierNames || activeTiers.some(
        t => !t.name?.trim() || (t.options || []).filter(o => o?.trim()).length === 0
    )

    // GH-1525 issue-4 follow-up: hide the "Generate variants" bar when there isn't
    // enough info to generate (isGenerateDisabled), and again once a matrix already
    // exists and matches the current tiers. Reappears only when the user edits an
    // option/value after a successful generate (tiers no longer match the matrix).
    const showGenerateBar = !isGenerateDisabled && (
        variants.length === 0 || tiersSignature(watchedTiers) !== lastGeneratedTiersSignatureRef.current
    )

    const generateSkuTable = async () => {
        if (isGenerating) return
        setIsGenerating(true)
        try {
            const isValid = await trigger(['basePrice', 'compareAtPrice', 'baseSku', 'baseInventory'])
            if (!isValid) return

            const currentTiers = getValues('tiers') || []
            const combinations = cartesianProductOfTiers(currentTiers)
            if (combinations.length === 0) return

            const basePrice = getValues('basePrice') || 0
            const compareAtPrice = getValues('compareAtPrice') || 0
            const baseInventory = getValues('baseInventory') || 0
            const baseSkuValue = getValues('baseSku') || 'SKU'
            const currentVariants = getValues('variants') || []
            const prevBase = lastGeneratedBasePriceRef.current
            const prevCompareAtPrice = lastGeneratedCompareAtPriceRef.current
            const newVariants = buildVariantMatrix(
                combinations,
                { price: basePrice, compareAtPrice: compareAtPrice || undefined, inventory: baseInventory, sku: baseSkuValue },
                currentVariants,
                prevBase,
                lastGeneratedBaseSkuRef.current ?? undefined,
                prevCompareAtPrice,
                hasEverGeneratedRef.current,
            )
            lastGeneratedBasePriceRef.current = Number(basePrice)
            lastGeneratedCompareAtPriceRef.current = Number(compareAtPrice) || null
            lastGeneratedTiersSignatureRef.current = tiersSignature(currentTiers)
            lastGeneratedBaseSkuRef.current = String(baseSkuValue)
            replaceVariants(newVariants)
            hasEverGeneratedRef.current = true
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <>
            {/* Variant Toggle Banner — moved here (between master fields and options) per
                user-requested layout: single "Variants & Inventory" card, toggle in the
                middle, not its own separate section. Always visible so hasVariants can be
                turned on; the content below only renders while hasVariants is true. */}
            <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-background/50 p-[17px]">
                <div className="flex flex-col gap-1">
                    <h3 className="text-[16px] font-medium text-foreground leading-[1.42] m-0">{t.dashboard.products.form.sections?.hasVariants || 'Product has multiple Options/Variants'}</h3>
                    <p className="text-[12px] text-foreground/50 leading-[1.33] m-0">{t.dashboard.products.form.sections?.hasVariantsExample || 'Example: color, size, style'}</p>
                </div>
                <Switch
                    checked={!!hasVariants}
                    onCheckedChange={(newVal) => {
                        setValue('hasVariants', newVal, { shouldDirty: true })
                        if (newVal && tiers.length === 0) {
                            appendTier({ id: crypto.randomUUID(), name: '', options: [] })
                        }
                    }}
                    className="shrink-0"
                />
            </div>

            {hasVariants && (
            <div className="space-y-6">

                {isAllTiersEmpty && (
                    <p className="text-[13px] text-foreground/60 m-0">
                        {t.dashboard.products.form.sections?.emptyVariantState || 'Add options like Color, Size to create product variants'}
                    </p>
                )}

                {/* Tiers List */}
                <div className="space-y-4" id="tiers">
                    {tiers.map((tier, index) => (
                        <div key={tier.id} className="flex flex-col gap-[10px] relative group">
                            {/* Tier label — outside card, per Figma */}
                            <div className="flex items-center justify-between">
                                <label className="text-[14px] font-medium text-foreground m-0">
                                    {t.dashboard.products.form.sections?.tierFormat
                                        ?.replace('{level}', String(index + 1))
                                        .replace('{example}', index === 0
                                            ? (t.dashboard.products.form.sections?.color || 'Color')
                                            : (t.dashboard.products.form.sections?.size || 'Size'))
                                        || `Option ${index + 1} (Example: ${index === 0 ? 'Color' : 'Size'})`}
                                    {index > 0 && (
                                        <span className="text-[12px] font-normal text-foreground/40 ml-1">
                                            ({t.dashboard.products.form.sections?.optionalLabel || 'Optional'})
                                        </span>
                                    )}
                                </label>
                                {tiers.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => setTierToDelete(index)}
                                        aria-label={t.dashboard.products.form.sections?.removeTier || 'Remove option'}
                                        className="flex items-center justify-center h-8 w-8 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive/80 hover:bg-destructive/20 hover:text-destructive transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {/* Card */}
                            <div className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-background/50 p-[17px]">
                                {/* Option name sub-label + input */}
                                <div className="flex flex-col gap-2 w-full">
                                    <span className="text-[14px] font-medium text-foreground m-0">
                                        {t.dashboard.products.form.sections?.optionNameLabel || 'Option name'}
                                        {index === 0 && <span className="text-foreground ml-0.5">*</span>}
                                    </span>
                                    <Input
                                        {...register(`tiers.${index}.name`)}
                                        placeholder={index === 0 ? (t.dashboard.products.form.sections?.tierPlaceholderColor || 'e.g. Color') : (t.dashboard.products.form.sections?.tierPlaceholderSize || 'e.g. Size')}
                                        className={cn(
                                            (errors.tiers?.[index]?.name || hasDuplicateTierNames)
                                                ? 'border-destructive focus-visible:border-destructive focus-visible:ring-red-500'
                                                : undefined
                                        )}
                                    />
                                    {errors.tiers?.[index]?.name && (
                                        <span className="text-[12px] text-destructive">{errors.tiers[index]?.name?.message}</span>
                                    )}
                                    {!errors.tiers?.[index]?.name && hasDuplicateTierNames && (
                                        <span className="text-[12px] text-destructive">
                                            {t.dashboard.products.form.errors?.uniqueTiers || 'Option names must be unique'}
                                        </span>
                                    )}
                                </div>

                                {/* Values sub-label + inputs */}
                                <div className="flex flex-col gap-2">
                                    <span className="text-[14px] font-medium text-foreground m-0">
                                        {t.dashboard.products.form.sections?.valuesLabel || 'Values'}
                                        {index === 0 && <span className="text-foreground ml-0.5">*</span>}
                                    </span>
                                    <div className="flex flex-col gap-3">
                                        {tier.options.map((opt, oIdx) => {
                                            const isDup = duplicateOptionIndices[index]?.has(oIdx)
                                            const hasZodErr = !!errors.tiers?.[index]?.options?.[oIdx]
                                            const showRed = isDup || hasZodErr
                                            return (
                                                <div key={oIdx} className="flex flex-col gap-1 w-full">
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            {...register(`tiers.${index}.options.${oIdx}` as const)}
                                                            placeholder={index === 0 ? (t.dashboard.products.form.sections?.optionPlaceholderRed || 'e.g. Red') : (t.dashboard.products.form.sections?.optionPlaceholderSmall || 'e.g. Small')}
                                                            className={cn(
                                                                'flex-1',
                                                                showRed && 'border-destructive focus-visible:border-destructive focus-visible:ring-red-500'
                                                            )}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const liveTier = getValues(`tiers.${index}`) || tier
                                                                const newOptions = [...(liveTier.options || [])]
                                                                newOptions.splice(oIdx, 1)
                                                                updateTier(index, { ...liveTier, options: newOptions })
                                                                if ((getValues('variants') || []).length > 0) {
                                                                    regenerateMatrix((getValues('tiers') || []).map((t, i2) =>
                                                                        i2 === index ? { ...liveTier, options: newOptions } : t
                                                                    ))
                                                                }
                                                            }}
                                                            className="flex h-[44px] w-[38px] shrink-0 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10 text-destructive/80 hover:bg-destructive/20 hover:text-destructive transition-colors"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                    {hasZodErr && (
                                                        <span className="text-[12px] text-destructive">
                                                            {errors.tiers?.[index]?.options?.[oIdx]?.message as string}
                                                        </span>
                                                    )}
                                                    {!hasZodErr && isDup && (
                                                        <span className="text-[12px] text-destructive">
                                                            {t.dashboard.products.form.sections?.duplicateValue || 'Duplicate value'}
                                                        </span>
                                                    )}
                                                </div>
                                            )
                                        })}

                                        {/* Array-root error (e.g. "at least one option required") */}
                                        {(errors.tiers?.[index]?.options as FieldError | undefined)?.message && (
                                            <span className="text-[12px] text-destructive">
                                                {(errors.tiers![index]!.options as FieldError).message}
                                            </span>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => {
                                                const liveTier = getValues(`tiers.${index}`) || tier
                                                const newOptions = [...(liveTier.options || []), '']
                                                updateTier(index, { ...liveTier, options: newOptions })
                                            }}
                                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.12] bg-transparent py-3 text-[14px] font-medium text-primary hover:bg-primary/5 transition-colors"
                                        >
                                            <Plus className="h-4 w-4" />
                                            {t.dashboard.products.form.sections?.addOption || 'Add values'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {tiers.length < 2 && (
                    <button
                        type="button"
                        onClick={() => appendTier({ id: crypto.randomUUID(), name: '', options: [] })}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-transparent py-3 text-[14px] font-medium text-foreground/60 hover:bg-white/5 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        {t.dashboard.products.form.sections?.addTier || 'Add Option'}
                    </button>
                )}

                <div className="pt-2 flex flex-col gap-2">
                    {showGenerateBar && (
                        <button
                            type="button"
                            onClick={generateSkuTable}
                            disabled={isGenerating}
                            className={cn(
                                'flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-[14px] font-medium transition-colors',
                                isGenerating
                                    ? 'border-white/[0.08] bg-white/[0.04] text-foreground/40 cursor-not-allowed'
                                    : 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/20'
                            )}
                        >
                            <Wand2 className="h-4 w-4" />
                            {t.dashboard.products.form.sections?.createSkuTable || 'Generate variants'}
                        </button>
                    )}
                    {/* RHF types variants errors per-index; superRefine root errors (variantsRequired) land on the array root — cast through FieldError which is the actual runtime shape */}
                    {(errors.variants as unknown as FieldError)?.message && variants.length === 0 && (
                        <p className="text-[12px] text-destructive">
                            {(errors.variants as unknown as FieldError).message}
                        </p>
                    )}
                </div>

                {/* Derived price hint — live-computed from variant rows */}
                {variants.length > 0 && derivedMinPrice !== null && (
                    <div className="text-[12px] text-foreground/50 leading-relaxed">
                        {t.dashboard.products.form.sections?.derivedPricesHint || 'Derived from variants'}
                        {': '}
                        {t.dashboard.products.form.sections?.derivedMinLabel || 'min'}{' '}
                        {formatPrice(derivedMinPrice, currency)}
                        {derivedMaxCompareAt !== null && (
                            <>{' '}{t.dashboard.products.form.sections?.derivedMaxCompareLabel || '/ max compare'}{' '}{formatPrice(derivedMaxCompareAt, currency)}</>
                        )}
                    </div>
                )}

                {/* SKU Matrix Table */}
                {variants.length > 0 && (
                    <div className="mt-6 rounded-2xl border border-white/[0.08] bg-secondary/30 overflow-hidden" id="variants">
                        <div className="px-4 py-3 border-b border-white/[0.08] bg-secondary/50">
                            <h3 className="text-[14px] font-medium text-foreground">{t.dashboard.products.form.sections?.skuMatrix || 'SKU Matrix Table'}</h3>
                        </div>
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="w-full text-left text-sm border-spacing-y-2 border-separate -mt-2">
                                <thead className="text-[12px] uppercase text-foreground/60 font-medium whitespace-nowrap">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">{t.dashboard.products.form.sections?.colVariant || 'Variant'}</th>
                                        <th className="px-4 py-3 font-medium">{t.dashboard.products.form.sections?.colSku || 'SKU Code'}</th>
                                        <th className="px-4 py-3 font-medium">{t.dashboard.products.form.sections?.colPrice || 'PRICE'}</th>
                                        <th className="px-4 py-3 font-medium">{t.dashboard.products.form.sections?.colComparePrice || 'COMPARE PRICE'}</th>
                                        <th className="px-4 py-3 font-medium">{t.dashboard.products.form.sections?.colStock || 'STOCK'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {variants.map((v, i) => (
                                        <tr key={v.id} className="group align-top">
                                            <td className="px-4 py-3 text-foreground text-[14px] font-normal min-w-[120px]">{v.variantName}</td>
                                            <td className="px-4 py-2">
                                                <div className="flex flex-col gap-1">
                                                    <Input
                                                        {...register(`variants.${i}.skuCode`)}
                                                        className={cn("h-9 min-w-[140px]", errors.variants?.[i]?.skuCode && "border-destructive focus-visible:border-destructive")}
                                                    />
                                                    {errors.variants?.[i]?.skuCode && <span className="text-[10px] text-destructive">{errors.variants[i]?.skuCode?.message}</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="flex flex-col gap-1">
                                                    <Input
                                                        type="number"
                                                        {...register(`variants.${i}.price`)}
                                                        className={cn("h-9 min-w-[120px]", errors.variants?.[i]?.price && "border-destructive focus-visible:border-destructive")}
                                                    />
                                                    {errors.variants?.[i]?.price && <span className="text-[10px] text-destructive">{errors.variants[i]?.price?.message}</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="flex flex-col gap-1">
                                                    <Input
                                                        type="number"
                                                        {...register(`variants.${i}.compareAtPrice`)}
                                                        className={cn("h-9 min-w-[120px]", errors.variants?.[i]?.compareAtPrice && "border-destructive focus-visible:border-destructive")}
                                                    />
                                                    {errors.variants?.[i]?.compareAtPrice && <span className="text-[10px] text-destructive">{errors.variants[i]?.compareAtPrice?.message}</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="flex flex-col gap-1">
                                                    <Input
                                                        type="number"
                                                        {...register(`variants.${i}.stock`)}
                                                        className={cn("h-9 min-w-[120px]", errors.variants?.[i]?.stock && "border-destructive focus-visible:border-destructive")}
                                                    />
                                                    {errors.variants?.[i]?.stock && <span className="text-[10px] text-destructive">{errors.variants[i]?.stock?.message}</span>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="lg:hidden">
                            <SkuMatrixMobile variants={variants} variantsLive={variantsLive} />
                        </div>
                    </div>
                )}
            </div>
            )}

            {/* Tier delete confirmation dialog */}
            <Dialog open={tierToDelete !== null} onOpenChange={(open) => { if (!open) setTierToDelete(null) }}>
                <DialogContent className="dash-shell max-w-sm border-white/10 text-foreground" style={{ backgroundColor: 'var(--dash-secondary-bg)' }}>
                    <DialogHeader>
                        <DialogTitle className="text-[16px] font-semibold text-foreground">
                            {t.dashboard.products.form.sections?.removeTierConfirmTitle || 'Remove this option?'}
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-[13px] text-foreground/60">
                        {t.dashboard.products.form.sections?.removeTierConfirmDesc || 'This will also clear the variants matrix.'}
                    </p>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <button
                            type="button"
                            onClick={() => setTierToDelete(null)}
                            className="flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-[14px] font-medium text-foreground hover:bg-white/10 transition-colors"
                        >
                            {t.dashboard.products.form.sections?.removeTierCancelBtn || 'Cancel'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (tierToDelete === null) return
                                const remainingTiers = (getValues('tiers') || []).filter((_, i) => i !== tierToDelete)
                                const hasMatrix = (getValues('variants') || []).length > 0
                                removeTier(tierToDelete)
                                setTierToDelete(null)
                                if (hasMatrix) regenerateMatrix(remainingTiers)
                            }}
                            className="flex-1 rounded-xl border border-destructive/40 bg-destructive/15 px-4 py-2 text-[14px] font-medium text-destructive hover:bg-destructive/25 transition-colors"
                        >
                            {t.dashboard.products.form.sections?.removeTierConfirmBtn || 'Remove'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
