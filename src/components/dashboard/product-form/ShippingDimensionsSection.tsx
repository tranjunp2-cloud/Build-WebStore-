'use client'

import { useFormContext } from 'react-hook-form'
import { ProductFormValues } from './schema'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { Input } from '@/components/ui/input'

export function ShippingDimensionsSection() {
    const { register, formState: { errors } } = useFormContext<ProductFormValues>()
    const { t } = useI18n()

    return (
        <div className="rounded-2xl border border-white/[0.08] bg-secondary/60 p-[25px] flex flex-col gap-5">
            <h2 className="text-[18px] font-semibold text-foreground leading-[1.56] font-outfit m-0">{t.dashboard.products.form.sections?.shipping || 'Shipping Configuration'}</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                {/* Weight */}
                <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-foreground leading-[1.43] m-0">
                        {t.dashboard.products.form.sections?.weight || 'Weight (kg)'}
                    </label>
                    <div className="relative flex items-center">
                        <Input
                            type="number"
                            step="0.01"
                            {...register('shippingWeight')}
                            className={cn("pr-12", errors.shippingWeight && "border-destructive focus-visible:border-destructive")}
                        />
                        <span className="absolute right-4 text-[16px] text-foreground/40 pointer-events-none">
                            kg
                        </span>
                    </div>
                    {errors.shippingWeight && <span className="text-[12px] text-destructive">{errors.shippingWeight.message}</span>}
                </div>

                {/* Length */}
                <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-foreground leading-[1.43] m-0">
                        {t.dashboard.products.form.sections?.length || 'Length (cm)'}
                    </label>
                    <div className="relative flex items-center">
                        <Input
                            type="number"
                            step="0.01"
                            {...register('shippingLength')}
                            className={cn("pr-12", errors.shippingLength && "border-destructive focus-visible:border-destructive")}
                        />
                        <span className="absolute right-4 text-[16px] text-foreground/40 pointer-events-none">
                            cm
                        </span>
                    </div>
                    {errors.shippingLength && <span className="text-[12px] text-destructive">{errors.shippingLength.message}</span>}
                </div>

                {/* Height */}
                <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-foreground leading-[1.43] m-0">
                        {t.dashboard.products.form.sections?.height || 'Height (cm)'}
                    </label>
                    <div className="relative flex items-center">
                        <Input
                            type="number"
                            step="0.01"
                            {...register('shippingHeight')}
                            className={cn("pr-12", errors.shippingHeight && "border-destructive focus-visible:border-destructive")}
                        />
                        <span className="absolute right-4 text-[16px] text-foreground/40 pointer-events-none">
                            cm
                        </span>
                    </div>
                    {errors.shippingHeight && <span className="text-[12px] text-destructive">{errors.shippingHeight.message}</span>}
                </div>

                {/* Width */}
                <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-foreground leading-[1.43] m-0">
                        {t.dashboard.products.form.sections?.width || 'Width (cm)'}
                    </label>
                    <div className="relative flex items-center">
                        <Input
                            type="number"
                            step="0.01"
                            {...register('shippingWidth')}
                            className={cn("pr-12", errors.shippingWidth && "border-destructive focus-visible:border-destructive")}
                        />
                        <span className="absolute right-4 text-[16px] text-foreground/40 pointer-events-none">
                            cm
                        </span>
                    </div>
                    {errors.shippingWidth && <span className="text-[12px] text-destructive">{errors.shippingWidth.message}</span>}
                </div>
            </div>
        </div>
    )
}
