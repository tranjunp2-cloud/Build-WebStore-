'use client'

import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { ProductFormValues } from './schema'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

interface SkuMatrixMobileProps {
    variants: { id: string; variantName: string }[]
}

export function SkuMatrixMobile({ variants }: SkuMatrixMobileProps) {
    const { register, formState: { errors } } = useFormContext<ProductFormValues>()
    const { t } = useI18n()
    const [openIdx, setOpenIdx] = useState<number | null>(0)

    if (variants.length === 0) return null

    const s = t.dashboard.products.form.sections

    return (
        <div className="flex flex-col">
            {variants.map((v, i) => (
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

                    {/* Body — hidden class (not conditional render) keeps RHF registrations stable */}
                    <div className={cn('px-4 pb-4 flex flex-col gap-3', openIdx !== i && 'hidden')}>
                        <div className="flex flex-col gap-1">
                            <label className="text-[12px] font-medium text-[#F8FAFC]/60 uppercase tracking-wide">
                                {s?.colSku || 'SKU Code'}
                            </label>
                            <input
                                {...register(`variants.${i}.skuCode`)}
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
                                {...register(`variants.${i}.price`)}
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
                                {...register(`variants.${i}.compareAtPrice`)}
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
                                {...register(`variants.${i}.stock`)}
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
            ))}
        </div>
    )
}
