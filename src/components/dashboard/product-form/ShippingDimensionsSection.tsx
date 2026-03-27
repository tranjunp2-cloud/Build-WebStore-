'use client'

import { useFormContext } from 'react-hook-form'
import { ProductFormValues } from './schema'

export function ShippingDimensionsSection() {
    const { register } = useFormContext<ProductFormValues>()

    return (
        <div className="rounded-2xl border border-white/[0.08] bg-[#1E293B]/60 p-[25px] flex flex-col gap-5">
            <h2 className="text-[18px] font-semibold text-[#F8FAFC] leading-[1.56] font-outfit m-0">Shipping information</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                {/* Weight */}
                <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-[#F8FAFC] leading-[1.43] m-0">
                        Weight
                    </label>
                    <div className="relative flex items-center">
                        <input
                            type="number"
                            step="0.01"
                            {...register('shippingWeight')}
                            className="w-full rounded-2xl border border-white/[0.08] bg-[#0B1120] pl-4 pr-12 py-3 text-[16px] text-[#F8FAFC] focus:border-white focus:ring-1 focus:ring-white outline-none transition-colors"
                        />
                        <span className="absolute right-4 text-[16px] text-[#F8FAFC]/40 pointer-events-none">
                            kg
                        </span>
                    </div>
                </div>

                {/* Length */}
                <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-[#F8FAFC] leading-[1.43] m-0">
                        Length
                    </label>
                    <div className="relative flex items-center">
                        <input
                            type="number"
                            step="0.01"
                            {...register('shippingLength')}
                            className="w-full rounded-2xl border border-white/[0.08] bg-[#0B1120] pl-4 pr-12 py-3 text-[16px] text-[#F8FAFC] focus:border-white focus:ring-1 focus:ring-white outline-none transition-colors"
                        />
                        <span className="absolute right-4 text-[16px] text-[#F8FAFC]/40 pointer-events-none">
                            cm
                        </span>
                    </div>
                </div>

                {/* Height */}
                <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-[#F8FAFC] leading-[1.43] m-0">
                        Height
                    </label>
                    <div className="relative flex items-center">
                        <input
                            type="number"
                            step="0.01"
                            {...register('shippingHeight')}
                            className="w-full rounded-2xl border border-white/[0.08] bg-[#0B1120] pl-4 pr-12 py-3 text-[16px] text-[#F8FAFC] focus:border-white focus:ring-1 focus:ring-white outline-none transition-colors"
                        />
                        <span className="absolute right-4 text-[16px] text-[#F8FAFC]/40 pointer-events-none">
                            cm
                        </span>
                    </div>
                </div>

                {/* Width */}
                <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-[#F8FAFC] leading-[1.43] m-0">
                        Width
                    </label>
                    <div className="relative flex items-center">
                        <input
                            type="number"
                            step="0.01"
                            {...register('shippingWidth')}
                            className="w-full rounded-2xl border border-white/[0.08] bg-[#0B1120] pl-4 pr-12 py-3 text-[16px] text-[#F8FAFC] focus:border-white focus:ring-1 focus:ring-white outline-none transition-colors"
                        />
                        <span className="absolute right-4 text-[16px] text-[#F8FAFC]/40 pointer-events-none">
                            cm
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
