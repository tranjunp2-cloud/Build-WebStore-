'use client'

import { useFormContext, useFieldArray } from 'react-hook-form'
import { ProductFormValues } from './schema'
import { Plus, X, Wand2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { useI18n } from '@/i18n'

export function VariantsInventorySection() {
    const { register, watch, setValue, getValues, control, formState } = useFormContext<ProductFormValues>()
    const { t } = useI18n()
    
    const hasVariants = watch('hasVariants')
    const errors = formState.errors
    
    // Tiers setup
    const { fields: tiers, append: appendTier, remove: removeTier, update: updateTier } = useFieldArray({
        control,
        name: 'tiers'
    })
    
    // Matrix setup
    const { fields: variants, replace: replaceVariants } = useFieldArray({
        control,
        name: 'variants'
    })

    const [newOptionInputs, setNewOptionInputs] = useState<Record<number, string>>({})

    const generateSkuTable = () => {
        // Cartesian Product to generate variants Matrix
        const liveTiers = getValues('tiers') || []
        if (!liveTiers || liveTiers.length === 0) return

        const validTiers = liveTiers
            .map(t => ({ ...t, options: t.options.filter(o => o.trim() !== '') }))
            .filter(t => t.options.length > 0)

        if (validTiers.length === 0) return

        let combinations: string[][] = [[]];

        for (const tier of validTiers) {
            const newCombinations: string[][] = []
            for (const combo of combinations) {
                for (const option of tier.options) {
                    newCombinations.push([...combo, option])
                }
            }
            combinations = newCombinations
        }

        const newVariants = combinations.map((combo) => {
            const variantName = combo.join(' - ')
            
            // Preserve existing data for UX robustness (using live form values, not stale fields)
            const currentVariants = getValues('variants') || []
            const existing = currentVariants.find(v => v.variantName === variantName)
            if (existing) return existing

            const skuCode = `SKU-${combo.map(c => c.substring(0,2).toUpperCase()).join('-')}`
            return {
                id: crypto.randomUUID(),
                variantName,
                skuCode,
                price: 0,
                stock: 0,
                discount: 0,
            }
        })

        replaceVariants(newVariants)
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
                                appendTier([
                                    { id: crypto.randomUUID(), name: '', options: [] },
                                    { id: crypto.randomUUID(), name: '', options: [] }
                                ])
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

                {!hasVariants ? (
                    /* Base Information (No Variants) */
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-medium text-[#F8FAFC] leading-[1.43] m-0">{t.dashboard.products.form.sections?.price || 'Price (RM)'}</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    {...register('basePrice')}
                                    placeholder="0.00"
                                    className={cn(
                                        "w-full rounded-2xl border bg-[#0B1120] px-4 py-3 text-[16px] text-[#F8FAFC] placeholder:text-[#F8FAFC]/40 focus:ring-1 focus:ring-white outline-none transition-colors",
                                        errors.basePrice ? "border-red-500" : "border-white/[0.08] focus:border-white"
                                    )}
                                />
                                {errors.basePrice && <p className="text-xs text-red-500">{errors.basePrice.message}</p>}
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-medium text-[#F8FAFC] leading-[1.43] m-0">{t.dashboard.products.form.sections?.comparePrice || 'Compare at Price (RM)'}</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    {...register('compareAtPrice')}
                                    placeholder="0.00"
                                    className={cn(
                                        "w-full rounded-2xl border bg-[#0B1120] px-4 py-3 text-[16px] text-[#F8FAFC] placeholder:text-[#F8FAFC]/40 focus:ring-1 focus:ring-white outline-none transition-colors",
                                        errors.compareAtPrice ? "border-red-500" : "border-white/[0.08] focus:border-white"
                                    )}
                                />
                                {errors.compareAtPrice && <p className="text-xs text-red-500">{errors.compareAtPrice.message}</p>}
                                <p className="text-[11px] text-[#F8FAFC]/40 m-0">{t.dashboard.products.form.sections?.comparePriceHelp || 'Original price before discount (optional)'}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-medium text-[#F8FAFC] leading-[1.43] m-0">{t.dashboard.products.form.sections?.inventory || 'Inventory'}</label>
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
                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-medium text-[#F8FAFC] leading-[1.43] m-0">{t.dashboard.products.form.sections?.sku || 'SKU Code'}</label>
                                <input
                                    {...register('baseSku')}
                                    placeholder="SKU-001"
                                    className={cn(
                                        "w-full rounded-2xl border bg-[#0B1120] px-4 py-3 text-[16px] text-[#F8FAFC] placeholder:text-[#F8FAFC]/40 focus:ring-1 focus:ring-white outline-none transition-colors",
                                        errors.baseSku ? "border-red-500" : "border-white/[0.08] focus:border-white"
                                    )}
                                />
                                {errors.baseSku && <p className="text-xs text-red-500">{errors.baseSku.message}</p>}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Multiple Variants UI */
                    <div className="space-y-6">
                        
                        {/* Tiers List */}
                        <div className="space-y-4" id="tiers">
                            {tiers.map((tier, index) => (
                                <div key={tier.id} className="flex flex-col gap-4 relative group">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[14px] font-medium text-[#F8FAFC] m-0">
                                            {t.dashboard.products.form.sections?.tierFormat?.replace('{level}', String(index + 1)).replace('{example}', index === 0 ? (t.dashboard.products.form.sections?.color || 'Color') : (t.dashboard.products.form.sections?.size || 'Size')) || `Tier ${index + 1} (Example: ${index === 0 ? 'Color' : 'Size'})`}
                                        </label>
                                    </div>
                                    <div className="flex flex-col gap-1 w-full">
                                        <input
                                            {...register(`tiers.${index}.name`)}
                                            placeholder={index === 0 ? (t.dashboard.products.form.sections?.tierPlaceholderColor || "e.g. Color") : (t.dashboard.products.form.sections?.tierPlaceholderSize || "e.g. Size")}
                                            className={cn("w-full rounded-2xl border bg-[#0B1120] px-4 py-3 text-[14px] text-[#F8FAFC] placeholder:text-[#F8FAFC]/40 outline-none focus:ring-1 focus:ring-white transition-colors",
                                                errors.tiers?.[index]?.name ? "border-red-500 focus:border-red-500" : "border-white/[0.08] focus:border-white"
                                            )}
                                        />
                                        {errors.tiers?.[index]?.name && <span className="text-[12px] text-red-500">{errors.tiers[index]?.name?.message}</span>}
                                    </div>
                                    
                                    <div className="flex flex-col gap-3">
                                        {tier.options.map((opt, oIdx) => (
                                            <div key={oIdx} className="flex flex-col gap-1 w-full">
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        {...register(`tiers.${index}.options.${oIdx}` as const)}
                                                        placeholder={index === 0 ? (t.dashboard.products.form.sections?.optionPlaceholderRed || "e.g. Red") : (t.dashboard.products.form.sections?.optionPlaceholderSmall || "e.g. Small")}
                                                        className={cn("w-full rounded-xl border bg-[#0B1120] px-4 py-3 text-[14px] text-[#F8FAFC] outline-none focus:ring-1 focus:ring-white transition-colors",
                                                            errors.tiers?.[index]?.options?.[oIdx] ? "border-red-500 focus:border-red-500" : "border-white/[0.08] focus:border-white"
                                                        )}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const liveTier = getValues(`tiers.${index}`) || tier
                                                            const newOptions = [...(liveTier.options || [])]
                                                            newOptions.splice(oIdx, 1)
                                                            updateTier(index, { ...liveTier, options: newOptions })
                                                        }}
                                                        className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl border border-red-500/10 bg-red-500/10 text-red-500/80 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                {errors.tiers?.[index]?.options?.[oIdx] && <span className="text-[12px] text-red-500">{errors.tiers[index]?.options?.[oIdx]?.message as string}</span>}
                                            </div>
                                        ))}

                                        <button
                                            type="button"
                                            onClick={() => {
                                                const liveTier = getValues(`tiers.${index}`) || tier
                                                const newOptions = [...(liveTier.options || []), '']
                                                updateTier(index, { ...liveTier, options: newOptions })
                                            }}
                                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-transparent py-3 text-[14px] font-medium text-[#F8FAFC]/60 hover:bg-white/5 transition-colors"
                                        >
                                            <Plus className="h-4 w-4" />
                                            {t.dashboard.products.form.sections?.addOption || 'Add option'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>



                        {hasVariants && (
                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={generateSkuTable}
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-[14px] font-medium text-blue-500 hover:bg-blue-500/20 transition-colors"
                                >
                                    <Wand2 className="h-4 w-4" />
                                    {t.dashboard.products.form.sections?.createSkuTable || 'Create SKU Table'}
                                </button>
                            </div>
                        )}

                        {/* SKU Matrix Table */}
                        {variants.length > 0 && (
                            <div className="mt-6 rounded-2xl border border-white/[0.08] bg-[#1E293B]/30 overflow-hidden" id="variants">
                                <div className="px-4 py-3 border-b border-white/[0.08] bg-[#1E293B]/50">
                                    <h3 className="text-[14px] font-medium text-[#F8FAFC]">{t.dashboard.products.form.sections?.skuMatrix || 'SKU Matrix Table'}</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm border-spacing-y-2 border-separate -mt-2">
                                        <thead className="text-[12px] uppercase text-[#F8FAFC]/60 font-medium whitespace-nowrap">
                                            <tr>
                                                <th className="px-4 py-3 font-medium">{t.dashboard.products.form.sections?.colVariant || 'Variant'}</th>
                                                <th className="px-4 py-3 font-medium">{t.dashboard.products.form.sections?.colSku || 'SKU Code'}</th>
                                                <th className="px-4 py-3 font-medium">{t.dashboard.products.form.sections?.colPrice || 'Price'}</th>
                                                <th className="px-4 py-3 font-medium">{t.dashboard.products.form.sections?.colDiscount || 'Discount'}</th>
                                                <th className="px-4 py-3 font-medium">{t.dashboard.products.form.sections?.colStock || 'Stock'}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {variants.map((v, i) => (
                                                <tr key={v.id} className="group">
                                                    <td className="px-4 py-2 text-[#F8FAFC] text-[14px] font-normal min-w-[120px]">{v.variantName}</td>
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
                                                        <input 
                                                            type="number" 
                                                            {...register(`variants.${i}.discount`)} 
                                                            className="w-full rounded-xl border border-white/[0.08] bg-[#0B1120] px-3 py-2 text-[14px] text-[#F8FAFC] min-w-[120px] outline-none focus:border-white focus:ring-1 focus:ring-white transition-colors" 
                                                        />
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
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
