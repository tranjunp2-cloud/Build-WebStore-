'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useFormContext, useFieldArray, useWatch } from 'react-hook-form'
import type { FieldError } from 'react-hook-form'
import { ProductFormValues } from './schema'
import { Plus, Wand2, Trash2 } from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { SkuMatrixMobile } from './SkuMatrixMobile'
import { computeDuplicateIndicesForOptions, isNonEmptyTier, buildVariantMatrix, cartesianProductOfTiers } from './variant-utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

export function VariantsInventorySection() {
    const { register, setValue, getValues, control, formState, trigger } = useFormContext<ProductFormValues>()
    const { t } = useI18n()
    const [isGenerating, setIsGenerating] = useState(false)
    const [tierToDelete, setTierToDelete] = useState<number | null>(null)

    const errors = formState.errors

    // Tiers setup
    const { fields: tiers, append: appendTier, update: updateTier, remove: removeTier } = useFieldArray({
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

    const derivedMinPrice = useMemo(
        () => variantsLive?.length
            ? Math.min(...variantsLive.map(v => v.price != null ? Number(v.price) : 0))
            : null,
        [variantsLive]
    )
    const derivedMaxCompareAt = useMemo(
        () => variantsLive?.length
            ? Math.max(...variantsLive.map(v => v.compareAtPrice != null ? Number(v.compareAtPrice) : 0)) || null
            : null,
        [variantsLive]
    )

    // Sync baseInventory = sum of all variant stocks whenever variants change
    useEffect(() => {
        if (!hasVariants) return
        const total = (variantsLive || []).reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
        setValue('baseInventory', total, { shouldDirty: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [variantsLive, hasVariants])

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
    // Tracks baseSku used on last generate — used to sync auto-generated variant SKUs on prefix change
    const lastGeneratedBaseSkuRef = useRef<string | null>(null)

    // Rebuilds the variant matrix from the given tiers (or current form tiers if omitted).
    // Pass tiersData pre-delete so regeneration uses the correct state before RHF propagates.
    // prevBasePrice=null preserves all existing customized rows by variantName match.
    const regenerateMatrix = (tiersData?: Array<{ name?: string; options?: string[] }>) => {
        const allTiers = tiersData ?? (getValues('tiers') || [])
        const combinations = cartesianProductOfTiers(allTiers)
        const currentVariants = getValues('variants') || []
        if (combinations.length === 0) {
            if (currentVariants.length > 0) replaceVariants([])
            return
        }
        const basePrice = Number(getValues('basePrice')) || 0
        const compareAtPrice = Number(getValues('compareAtPrice')) || 0
        const baseInventory = Number(getValues('baseInventory')) || 0
        const baseSku = getValues('baseSku') || 'SKU'
        const next = buildVariantMatrix(
            combinations,
            { price: basePrice, compareAtPrice: compareAtPrice || undefined, inventory: baseInventory, sku: baseSku },
            currentVariants,
            null,
            lastGeneratedBaseSkuRef.current ?? undefined,
        )
        replaceVariants(next)
        lastGeneratedBaseSkuRef.current = baseSku
    }

    // Auto-fill basePrice/compareAtPrice from variant matrix (Bug 7)
    // Keeps root DB fields accurate without requiring manual entry
    useEffect(() => {
        if (!hasVariants || !variantsLive?.length) return
        const minPrice = Math.min(...variantsLive.map(v => v.price != null ? Number(v.price) : 0))
        const maxCompare = Math.max(...variantsLive.map(v => v.compareAtPrice != null ? Number(v.compareAtPrice) : 0))
        const curBase = Number(getValues('basePrice')) || 0
        const curCompare = Number(getValues('compareAtPrice')) || 0
        if (minPrice !== curBase)
            setValue('basePrice', minPrice, { shouldDirty: false, shouldValidate: false })
        // Collapses set+clear into one guarded write: undefined when no variant has a sale price
        const newCompare = maxCompare > 0 ? maxCompare : undefined
        if (newCompare !== (curCompare || undefined))
            setValue('compareAtPrice', newCompare, { shouldDirty: false, shouldValidate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [variantsLive, hasVariants])

    const isGenerateDisabled = activeTiers.length === 0 || hasDuplicates || hasDuplicateTierNames || activeTiers.some(
        t => !t.name?.trim() || (t.options || []).filter(o => o?.trim()).length === 0
    )

    const generateSkuTable = async () => {
        if (isGenerating) return
        setIsGenerating(true)
        try {
            const isValid = await trigger(['basePrice', 'compareAtPrice', 'baseSku', 'baseInventory'])
            if (!isValid) return

            const combinations = cartesianProductOfTiers(getValues('tiers') || [])
            if (combinations.length === 0) return

            const basePrice = getValues('basePrice') || 0
            const compareAtPrice = getValues('compareAtPrice') || 0
            const baseInventory = getValues('baseInventory') || 0
            const baseSku = getValues('baseSku') || 'SKU'
            const currentVariants = getValues('variants') || []
            const prevBase = lastGeneratedBasePriceRef.current
            const newVariants = buildVariantMatrix(
                combinations,
                { price: basePrice, compareAtPrice: compareAtPrice || undefined, inventory: baseInventory, sku: baseSku },
                currentVariants,
                prevBase,
                lastGeneratedBaseSkuRef.current ?? undefined,
            )
            lastGeneratedBasePriceRef.current = Number(basePrice)
            lastGeneratedBaseSkuRef.current = String(baseSku)
            replaceVariants(newVariants)
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <div className="rounded-2xl border border-white/[0.08] bg-[#1E293B]/60 p-[25px] flex flex-col gap-6">
            <h2 className="text-[18px] font-semibold text-[#F8FAFC] leading-[1.56] font-outfit m-0">{t.dashboard.products.form.sections?.variants || 'Variants & Inventory'}</h2>
            
            {/* Body */}
            <div className="flex flex-col gap-6">
                
                {/* Variant Toggle Banner */}
                <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#0B1120]/50 p-[17px]">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-[16px] font-medium text-[#F8FAFC] leading-[1.42] m-0">{t.dashboard.products.form.sections?.hasVariants || 'Product has multiple Options/Variants'}</h3>
                        <p className="text-[12px] text-[#F8FAFC]/50 leading-[1.33] m-0">{t.dashboard.products.form.sections?.hasVariantsExample || 'Example: color, size, style'}</p>
                    </div>
                    <button 
                        type="button"
                        onClick={() => {
                            const newVal = !hasVariants
                            setValue('hasVariants', newVal, { shouldDirty: true })
                            if (newVal && tiers.length === 0) {
                                appendTier({ id: crypto.randomUUID(), name: '', options: [] })
                            }
                        }}
                        className={cn(
                            "relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border border-white/[0.12] px-[3px] transition-colors focus-visible:outline-none focus:outline-none focus:ring-0",
                            hasVariants ? "bg-blue-500" : "bg-[#1E293B]"
                        )}
                    >
                        <span 
                            className={cn(
                                "pointer-events-none block h-6 w-6 rounded-full bg-white transition-transform shadow-sm",
                                hasVariants ? "translate-x-[26px]" : "translate-x-0"
                            )}
                        />
                    </button>
                </div>

                {/* Base Information (Always Visible as Master Values) */}
                <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-[14px] font-medium text-[#F8FAFC] leading-[1.43] m-0">
                                {t.dashboard.products.form.sections?.price || 'Price (RM)'} <span className="text-[#F8FAFC]">*</span>
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                {...register('basePrice')}
                                placeholder="0"
                                className={cn(
                                    "w-full rounded-2xl border bg-[#0B1120] px-4 py-3 text-[16px] text-[#F8FAFC] placeholder:text-[#F8FAFC]/40 focus:ring-1 focus:ring-white outline-none transition-colors",
                                    errors.basePrice ? "border-red-500" : "border-white/[0.08] focus:border-white"
                                )}
                            />
                            {errors.basePrice && <p className="text-xs text-red-500">{errors.basePrice.message}</p>}
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[14px] font-medium text-[#F8FAFC] leading-[1.43] m-0">
                                {t.dashboard.products.form.sections?.comparePrice || 'Compare price (RM)'}
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                {...register('compareAtPrice')}
                                placeholder="0"
                                className={cn(
                                    "w-full rounded-2xl border bg-[#0B1120] px-4 py-3 text-[16px] text-[#F8FAFC] placeholder:text-[#F8FAFC]/40 focus:ring-1 focus:ring-white outline-none transition-colors",
                                    errors.compareAtPrice ? "border-red-500" : "border-white/[0.08] focus:border-white"
                                )}
                            />
                            {errors.compareAtPrice && <p className="text-xs text-red-500">{errors.compareAtPrice.message}</p>}
                        </div>
                    </div>
                    {hasVariants && (
                        <p className="text-[12px] text-[#F8FAFC]/40 -mt-2">
                            {t.dashboard.products.form.sections?.autoFilledFromVariants || 'Auto-filled from variants — edit individual variant prices below'}
                        </p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-[14px] font-medium text-[#F8FAFC] leading-[1.43] m-0">
                                {t.dashboard.products.form.sections?.sku || 'SKU code'} <span className="text-[#F8FAFC]">*</span>
                            </label>
                            <input
                                {...register('baseSku', {
                                    onBlur: () => {
                                        const current = getValues('baseSku') || 'SKU'
                                        const hasMatrix = (getValues('variants') || []).length > 0
                                        if (!hasMatrix) return
                                        if (lastGeneratedBaseSkuRef.current === current) return
                                        regenerateMatrix()
                                    }
                                })}
                                placeholder="SKU-001"
                                className={cn(
                                    "w-full rounded-2xl border bg-[#0B1120] px-4 py-3 text-[16px] text-[#F8FAFC] placeholder:text-[#F8FAFC]/40 focus:ring-1 focus:ring-white outline-none transition-colors",
                                    errors.baseSku ? "border-red-500" : "border-white/[0.08] focus:border-white"
                                )}
                            />
                            {errors.baseSku && <p className="text-xs text-red-500">{errors.baseSku.message}</p>}
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[14px] font-medium text-[#F8FAFC] leading-[1.43] m-0">
                                {t.dashboard.products.form.sections?.inventory || 'Inventory'} <span className="text-[#F8FAFC]">*</span>
                            </label>
                            <input
                                type="number"
                                {...register('baseInventory')}
                                placeholder="0"
                                className={cn(
                                    "w-full rounded-2xl border bg-[#0B1120] px-4 py-3 text-[16px] text-[#F8FAFC] placeholder:text-[#F8FAFC]/40 focus:ring-1 focus:ring-white outline-none transition-colors",
                                    errors.baseInventory ? "border-red-500" : "border-white/[0.08] focus:border-white"
                                )}
                            />
                            {errors.baseInventory && <p className="text-xs text-red-500">{errors.baseInventory.message}</p>}
                        </div>
                    </div>
                </div>

                {hasVariants && (
                    /* Multiple Variants UI */
                    <div className="space-y-6 pt-6 border-t border-white/[0.08]">
                        
                        {isAllTiersEmpty && (
                            <p className="text-[13px] text-[#F8FAFC]/60 m-0">
                                {t.dashboard.products.form.sections?.emptyVariantState || 'Add options like Color, Size to create product variants'}
                            </p>
                        )}

                        {/* Tiers List */}
                        <div className="space-y-4" id="tiers">
                            {tiers.map((tier, index) => (
                                <div key={tier.id} className="flex flex-col gap-[10px] relative group">
                                    {/* Tier label — outside card, per Figma */}
                                    <div className="flex items-center justify-between">
                                        <label className="text-[14px] font-medium text-[#F8FAFC] m-0">
                                            {t.dashboard.products.form.sections?.tierFormat
                                                ?.replace('{level}', String(index + 1))
                                                .replace('{example}', index === 0
                                                    ? (t.dashboard.products.form.sections?.color || 'Color')
                                                    : (t.dashboard.products.form.sections?.size || 'Size'))
                                                || `Option ${index + 1} (Example: ${index === 0 ? 'Color' : 'Size'})`}
                                            {index > 0 && (
                                                <span className="text-[12px] font-normal text-[#F8FAFC]/40 ml-1">
                                                    ({t.dashboard.products.form.sections?.optionalLabel || 'Optional'})
                                                </span>
                                            )}
                                        </label>
                                        {tiers.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => setTierToDelete(index)}
                                                aria-label={t.dashboard.products.form.sections?.removeTier || 'Remove option'}
                                                className="flex items-center justify-center h-8 w-8 rounded-lg border border-red-500/20 bg-red-500/10 text-red-500/80 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Card */}
                                    <div className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-[#0B1120]/50 p-[17px]">
                                        {/* Option name sub-label + input */}
                                        <div className="flex flex-col gap-2 w-full">
                                            <span className="text-[14px] font-medium text-[#F8FAFC] m-0">
                                                {t.dashboard.products.form.sections?.optionNameLabel || 'Option name'}
                                                {index === 0 && <span className="text-[#F8FAFC] ml-0.5">*</span>}
                                            </span>
                                            <input
                                                {...register(`tiers.${index}.name`)}
                                                placeholder={index === 0 ? (t.dashboard.products.form.sections?.tierPlaceholderColor || 'e.g. Color') : (t.dashboard.products.form.sections?.tierPlaceholderSize || 'e.g. Size')}
                                                className={cn(
                                                    'w-full rounded-2xl border bg-[#0B1120] px-4 py-3 text-[14px] text-[#F8FAFC] placeholder:text-[#F8FAFC]/40 outline-none focus:ring-1 transition-colors',
                                                    (errors.tiers?.[index]?.name || hasDuplicateTierNames)
                                                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                                                        : 'border-white/[0.08] focus:border-white focus:ring-white'
                                                )}
                                            />
                                            {errors.tiers?.[index]?.name && (
                                                <span className="text-[12px] text-red-500">{errors.tiers[index]?.name?.message}</span>
                                            )}
                                            {!errors.tiers?.[index]?.name && hasDuplicateTierNames && (
                                                <span className="text-[12px] text-red-500">
                                                    {t.dashboard.products.form.errors?.uniqueTiers || 'Option names must be unique'}
                                                </span>
                                            )}
                                        </div>

                                        {/* Values sub-label + inputs */}
                                        <div className="flex flex-col gap-2">
                                            <span className="text-[14px] font-medium text-[#F8FAFC] m-0">
                                                {t.dashboard.products.form.sections?.valuesLabel || 'Values'}
                                                {index === 0 && <span className="text-[#F8FAFC] ml-0.5">*</span>}
                                            </span>
                                            <div className="flex flex-col gap-3">
                                                {tier.options.map((opt, oIdx) => {
                                                    const isDup = duplicateOptionIndices[index]?.has(oIdx)
                                                    const hasZodErr = !!errors.tiers?.[index]?.options?.[oIdx]
                                                    const showRed = isDup || hasZodErr
                                                    return (
                                                        <div key={oIdx} className="flex flex-col gap-1 w-full">
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    {...register(`tiers.${index}.options.${oIdx}` as const)}
                                                                    placeholder={index === 0 ? (t.dashboard.products.form.sections?.optionPlaceholderRed || 'e.g. Red') : (t.dashboard.products.form.sections?.optionPlaceholderSmall || 'e.g. Small')}
                                                                    className={cn(
                                                                        'flex-1 rounded-xl border bg-[#0B1120] px-4 py-[10px] text-[14px] text-[#F8FAFC] outline-none focus:ring-1 transition-colors',
                                                                        showRed ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-white/[0.08] focus:border-white focus:ring-white'
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
                                                                    className="flex h-[44px] w-[38px] shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-500/80 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                            {hasZodErr && (
                                                                <span className="text-[12px] text-red-500">
                                                                    {errors.tiers?.[index]?.options?.[oIdx]?.message as string}
                                                                </span>
                                                            )}
                                                            {!hasZodErr && isDup && (
                                                                <span className="text-[12px] text-red-500">
                                                                    {t.dashboard.products.form.sections?.duplicateValue || 'Duplicate value'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )
                                                })}

                                                {/* Array-root error (e.g. "at least one option required") */}
                                                {(errors.tiers?.[index]?.options as FieldError | undefined)?.message && (
                                                    <span className="text-[12px] text-red-500">
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
                                                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.12] bg-transparent py-3 text-[14px] font-medium text-blue-500 hover:bg-blue-500/5 transition-colors"
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

                        {hasVariants && tiers.length < 2 && (
                            <button
                                type="button"
                                onClick={() => appendTier({ id: crypto.randomUUID(), name: '', options: [] })}
                                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-transparent py-3 text-[14px] font-medium text-[#F8FAFC]/60 hover:bg-white/5 transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                                {t.dashboard.products.form.sections?.addTier || 'Add Option'}
                            </button>
                        )}

                        {hasVariants && (
                            <div className="pt-2 flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={generateSkuTable}
                                    disabled={isGenerateDisabled || isGenerating}
                                    className={cn(
                                        'flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-[14px] font-medium transition-colors',
                                        isGenerateDisabled || isGenerating
                                            ? 'border-white/[0.08] bg-white/[0.04] text-[#F8FAFC]/40 cursor-not-allowed'
                                            : 'border-blue-500/20 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'
                                    )}
                                >
                                    <Wand2 className="h-4 w-4" />
                                    {t.dashboard.products.form.sections?.createSkuTable || 'Generate variants'}
                                </button>
                                {/* RHF types variants errors per-index; superRefine root errors (variantsRequired) land on the array root — cast through FieldError which is the actual runtime shape */}
                                {(errors.variants as unknown as FieldError)?.message && variants.length === 0 && (
                                    <p className="text-[12px] text-red-500">
                                        {(errors.variants as unknown as FieldError).message}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Derived price hint — live-computed from variant rows */}
                        {hasVariants && variants.length > 0 && derivedMinPrice !== null && (
                            <div className="text-[12px] text-[#F8FAFC]/50 leading-relaxed">
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
                            <div className="mt-6 rounded-2xl border border-white/[0.08] bg-[#1E293B]/30 overflow-hidden" id="variants">
                                <div className="px-4 py-3 border-b border-white/[0.08] bg-[#1E293B]/50">
                                    <h3 className="text-[14px] font-medium text-[#F8FAFC]">{t.dashboard.products.form.sections?.skuMatrix || 'SKU Matrix Table'}</h3>
                                </div>
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-left text-sm border-spacing-y-2 border-separate -mt-2">
                                        <thead className="text-[12px] uppercase text-[#F8FAFC]/60 font-medium whitespace-nowrap">
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
                                                    <td className="px-4 py-3 text-[#F8FAFC] text-[14px] font-normal min-w-[120px]">{v.variantName}</td>
                                                    <td className="px-4 py-2">
                                                        <div className="flex flex-col gap-1">
                                                            <input
                                                                {...register(`variants.${i}.skuCode`)}
                                                                className={cn("w-full rounded-xl border bg-[#0B1120] px-3 py-2 text-[14px] text-[#F8FAFC] min-w-[140px] outline-none focus:ring-1 focus:ring-white transition-colors",
                                                                    errors.variants?.[i]?.skuCode ? "border-red-500 focus:border-red-500" : "border-white/[0.08] focus:border-white"
                                                                )}
                                                            />
                                                            {errors.variants?.[i]?.skuCode && <span className="text-[10px] text-red-500">{errors.variants[i]?.skuCode?.message}</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="flex flex-col gap-1">
                                                            <input
                                                                type="number"
                                                                {...register(`variants.${i}.price`)}
                                                                className={cn("w-full rounded-xl border bg-[#0B1120] px-3 py-2 text-[14px] text-[#F8FAFC] min-w-[120px] outline-none focus:ring-1 focus:ring-white transition-colors",
                                                                    errors.variants?.[i]?.price ? "border-red-500 focus:border-red-500" : "border-white/[0.08] focus:border-white"
                                                                )}
                                                            />
                                                            {errors.variants?.[i]?.price && <span className="text-[10px] text-red-500">{errors.variants[i]?.price?.message}</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="flex flex-col gap-1">
                                                            <input
                                                                type="number"
                                                                {...register(`variants.${i}.compareAtPrice`)}
                                                                className={cn("w-full rounded-xl border bg-[#0B1120] px-3 py-2 text-[14px] text-[#F8FAFC] min-w-[120px] outline-none focus:ring-1 focus:ring-white transition-colors",
                                                                    errors.variants?.[i]?.compareAtPrice ? "border-red-500 focus:border-red-500" : "border-white/[0.08] focus:border-white"
                                                                )}
                                                            />
                                                            {errors.variants?.[i]?.compareAtPrice && <span className="text-[10px] text-red-500">{errors.variants[i]?.compareAtPrice?.message}</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="flex flex-col gap-1">
                                                            <input
                                                                type="number"
                                                                {...register(`variants.${i}.stock`)}
                                                                className={cn("w-full rounded-xl border bg-[#0B1120] px-3 py-2 text-[14px] text-[#F8FAFC] min-w-[120px] outline-none focus:ring-1 focus:ring-white transition-colors",
                                                                    errors.variants?.[i]?.stock ? "border-red-500 focus:border-red-500" : "border-white/[0.08] focus:border-white"
                                                                )}
                                                            />
                                                            {errors.variants?.[i]?.stock && <span className="text-[10px] text-red-500">{errors.variants[i]?.stock?.message}</span>}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="md:hidden">
                                    <SkuMatrixMobile variants={variants} variantsLive={variantsLive} />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Tier delete confirmation dialog */}
            <Dialog open={tierToDelete !== null} onOpenChange={(open) => { if (!open) setTierToDelete(null) }}>
                <DialogContent className="max-w-sm bg-[#1E293B] border-white/10 text-[#F8FAFC]">
                    <DialogHeader>
                        <DialogTitle className="text-[16px] font-semibold text-[#F8FAFC]">
                            {t.dashboard.products.form.sections?.removeTierConfirmTitle || 'Remove this option?'}
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-[13px] text-[#F8FAFC]/60">
                        {t.dashboard.products.form.sections?.removeTierConfirmDesc || 'This will also clear the variants matrix.'}
                    </p>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <button
                            type="button"
                            onClick={() => setTierToDelete(null)}
                            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[14px] font-medium text-[#F8FAFC]/70 hover:bg-white/10 transition-colors"
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
                            className="flex-1 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-[14px] font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                            {t.dashboard.products.form.sections?.removeTierConfirmBtn || 'Remove'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
