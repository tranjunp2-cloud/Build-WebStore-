'use client'

import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { ProductFormValues } from './schema'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

type VariantLive = {
    skuCode?: string
    price?: number | string
    compareAtPrice?: number | string
    stock?: number | string
}

interface SkuMatrixMobileProps {
    variants: { id: string; variantName: string }[]
    variantsLive?: VariantLive[] | null
}

export function SkuMatrixMobile({ variants, variantsLive }: SkuMatrixMobileProps) {
    // Uses setValue (not register) — desktop table owns all RHF refs to avoid double-registration
    const { setValue, formState: { errors } } = useFormContext<ProductFormValues>()
    const { t } = useI18n()
    const [openIdx, setOpenIdx] = useState<number | null>(0)

    if (variants.length === 0) return null

    const s = t.dashboard.products.form.sections

    const set = (name: string, value: string) =>
        setValue(name as Parameters<typeof setValue>[0], value, { shouldDirty: true, shouldValidate: true })

    return (
        <div className="flex flex-col">
            {variants.map((v, i) => {
                const live = variantsLive?.[i]
                return (
                    <div key={v.id} className="border-b border-white/[0.08] last:border-b-0">
                        {/* Header */}
                        <button
                            type="button"
                            onClick={() => setOpenIdx(openIdx === i ? null : i)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left"
                        >
                            <span className="text-[14px] font-medium text-[#F8FAFC]">{v.variantName}</span>
                            {openIdx === i
                                ? <ChevronUp className="h-4 w-4 text-[#F8FAFC]/60 shrink-0" />
                                : <ChevronDown className="h-4 w-4 text-[#F8FAFC]/60 shrink-0" />
                            }
                        </button>

                        {/* Body — controlled inputs backed by setValue; desktop register() owns the RHF refs */}
                        <div className={cn('px-4 pb-4 flex flex-col gap-3', openIdx !== i && 'hidden')}>
                            <div className="flex flex-col gap-1">
                                <label className="text-[12px] font-medium text-[#F8FAFC]/60 uppercase tracking-wide">
                                    {s?.colSku || 'SKU Code'}
                                </label>
                                <input
                                    value={live?.skuCode ?? ''}
                                    onChange={e => set(`variants.${i}.skuCode`, e.target.value)}
                                    className={cn(
                                        'w-full rounded-xl border bg-[#0B1120] px-3 py-2 text-[14px] text-[#F8FAFC] outline-none focus:ring-1 focus:ring-white transition-colors',
                                        errors.variants?.[i]?.skuCode ? 'border-red-500 focus:border-red-500' : 'border-white/[0.08] focus:border-white'
                                    )}
                                />
                                {errors.variants?.[i]?.skuCode && (
                                    <span className="text-[10px] text-red-500">{errors.variants[i]?.skuCode?.message}</span>
                                )}
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[12px] font-medium text-[#F8FAFC]/60 uppercase tracking-wide">
                                    {s?.colPrice || 'Price'}
                                </label>
                                <input
                                    type="number"
                                    value={live?.price ?? ''}
                                    onChange={e => set(`variants.${i}.price`, e.target.value)}
                                    className={cn(
                                        'w-full rounded-xl border bg-[#0B1120] px-3 py-2 text-[14px] text-[#F8FAFC] outline-none focus:ring-1 focus:ring-white transition-colors',
                                        errors.variants?.[i]?.price ? 'border-red-500 focus:border-red-500' : 'border-white/[0.08] focus:border-white'
                                    )}
                                />
                                {errors.variants?.[i]?.price && (
                                    <span className="text-[10px] text-red-500">{errors.variants[i]?.price?.message}</span>
                                )}
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[12px] font-medium text-[#F8FAFC]/60 uppercase tracking-wide">
                                    {s?.colComparePrice || 'Compare Price'}
                                </label>
                                <input
                                    type="number"
                                    value={live?.compareAtPrice ?? ''}
                                    onChange={e => set(`variants.${i}.compareAtPrice`, e.target.value)}
                                    className={cn(
                                        'w-full rounded-xl border bg-[#0B1120] px-3 py-2 text-[14px] text-[#F8FAFC] outline-none focus:ring-1 focus:ring-white transition-colors',
                                        errors.variants?.[i]?.compareAtPrice ? 'border-red-500 focus:border-red-500' : 'border-white/[0.08] focus:border-white'
                                    )}
                                />
                                {errors.variants?.[i]?.compareAtPrice && (
                                    <span className="text-[10px] text-red-500">{errors.variants[i]?.compareAtPrice?.message}</span>
                                )}
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[12px] font-medium text-[#F8FAFC]/60 uppercase tracking-wide">
                                    {s?.colStock || 'Stock'}
                                </label>
                                <input
                                    type="number"
                                    value={live?.stock ?? ''}
                                    onChange={e => set(`variants.${i}.stock`, e.target.value)}
                                    className={cn(
                                        'w-full rounded-xl border bg-[#0B1120] px-3 py-2 text-[14px] text-[#F8FAFC] outline-none focus:ring-1 focus:ring-white transition-colors',
                                        errors.variants?.[i]?.stock ? 'border-red-500 focus:border-red-500' : 'border-white/[0.08] focus:border-white'
                                    )}
                                />
                                {errors.variants?.[i]?.stock && (
                                    <span className="text-[10px] text-red-500">{errors.variants[i]?.stock?.message}</span>
                                )}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
