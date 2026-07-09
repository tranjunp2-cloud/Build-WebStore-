'use client'

import { Info } from 'lucide-react'
import { useFormContext, useWatch } from 'react-hook-form'
import { ProductFormValues } from './schema'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { Input } from '@/components/ui/input'

// Component A (GH-1525 split; issue-1 update): master price/SKU/inventory fields.
// Renders inside the shared "Variants & Inventory" card owned by ProductForm.tsx —
// the hasVariants toggle banner now lives in VariantOptionsSection, positioned
// between this component and the tiers/options UI (single card, toggle in the
// middle — not its own separate top-level section).
//
// When locked (hasVariants && >=1 variant), Price/Compare/Inventory are HIDDEN
// entirely (not disabled+tooltip) — replaced by one explanatory line, per updated
// issue-1 requirement. baseSku stays visible/editable in all states (it's the SKU
// prefix used to generate variant rows, not a "master value" the variants override).
// Values are preserved while hidden: react-hook-form's registered field state
// persists across mount/unmount (shouldUnregister defaults to false), so re-showing
// these fields (issue 2 — variants cleared/toggle off) restores prior values as-is.
export function MasterFieldsSection() {
    const { register, control, formState } = useFormContext<ProductFormValues>()
    const { t } = useI18n()
    const errors = formState.errors

    const hasVariants = useWatch({ control, name: 'hasVariants' })
    const variantCount = useWatch({ control, name: 'variants' })?.length ?? 0
    const lockMaster = !!hasVariants && variantCount > 0
    const lockedNoteText = t.dashboard.products.form.sections?.masterLockedTooltip || 'This product has variants — edit stock/price on each variant row below'

    return (
        <div className="flex flex-col gap-6">
            {lockMaster ? (
                <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-background/50 px-4 py-3">
                    <Info className="h-3.5 w-3.5 shrink-0 text-foreground/40" aria-hidden="true" />
                    <p className="text-[13px] text-foreground/60 m-0">{lockedNoteText}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-[14px] font-medium text-foreground leading-[1.43] m-0">
                            {t.dashboard.products.form.sections?.price || 'Price (RM)'} <span className="text-foreground">*</span>
                        </label>
                        <Input
                            type="number"
                            step="0.01"
                            {...register('basePrice')}
                            placeholder="0"
                            className={cn(errors.basePrice && "border-destructive focus-visible:border-destructive")}
                        />
                        {errors.basePrice && <p className="text-xs text-destructive">{errors.basePrice.message}</p>}
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[14px] font-medium text-foreground leading-[1.43] m-0">
                            {t.dashboard.products.form.sections?.comparePrice || 'Compare price (RM)'}
                        </label>
                        <Input
                            type="number"
                            step="0.01"
                            {...register('compareAtPrice')}
                            placeholder="0"
                            className={cn(errors.compareAtPrice && "border-destructive focus-visible:border-destructive")}
                        />
                        {errors.compareAtPrice && <p className="text-xs text-destructive">{errors.compareAtPrice.message}</p>}
                    </div>
                </div>
            )}

            <div className={cn("grid grid-cols-1 gap-4", !lockMaster && "lg:grid-cols-2")}>
                <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-foreground leading-[1.43] m-0">
                        {t.dashboard.products.form.sections?.sku || 'SKU code'} <span className="text-foreground">*</span>
                    </label>
                    <Input
                        {...register('baseSku')}
                        placeholder="SKU-001"
                        className={cn(errors.baseSku && "border-destructive focus-visible:border-destructive")}
                    />
                    {errors.baseSku && <p className="text-xs text-destructive">{errors.baseSku.message}</p>}
                </div>
                {!lockMaster && (
                    <div className="flex flex-col gap-2">
                        <label className="text-[14px] font-medium text-foreground leading-[1.43] m-0">
                            {t.dashboard.products.form.sections?.inventory || 'Inventory'} <span className="text-foreground">*</span>
                        </label>
                        <Input
                            type="number"
                            {...register('baseInventory')}
                            placeholder="0"
                            className={cn(errors.baseInventory && "border-destructive focus-visible:border-destructive")}
                        />
                        {errors.baseInventory && <p className="text-xs text-destructive">{errors.baseInventory.message}</p>}
                    </div>
                )}
            </div>
        </div>
    )
}
