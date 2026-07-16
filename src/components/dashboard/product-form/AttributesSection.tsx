'use client'

import { useFormContext, useFieldArray } from 'react-hook-form'
import { Trash2, Plus } from 'lucide-react'
import { ProductFormValues } from './schema'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { Input } from '@/components/ui/input'

const MAX_ATTRIBUTES = 20

export function AttributesSection() {
    const { register, control, formState: { errors } } = useFormContext<ProductFormValues>()
    const { t } = useI18n()
    const { fields, append, remove } = useFieldArray({ control, name: 'attributes' })

    const sectionsT = t.dashboard.products.form.sections

    return (
        <div className="rounded-2xl border border-solid border-slate-200 dark:border-white/[0.15] bg-white dark:bg-[hsl(var(--card))] p-[25px] flex flex-col gap-5">
            <div className="flex items-center justify-between">
                <h2 className="text-[18px] font-semibold text-foreground leading-[1.56] font-outfit m-0">
                    {sectionsT?.attributes || 'Extended Information (Attributes)'}
                </h2>
                <span className="text-[13px] text-foreground/50">
                    {fields.length} / {MAX_ATTRIBUTES}
                </span>
            </div>

            {fields.length > 0 && (
                <div className="flex flex-col gap-3">
                    {fields.map((field, idx) => {
                        const rowErrors = (errors.attributes as any)?.[idx]
                        return (
                            <div key={field.id} className="flex gap-3 items-start">
                                <div className="flex-1 flex flex-col gap-1">
                                    <Input
                                        type="text"
                                        placeholder={sectionsT?.attributeKey || 'Attribute name'}
                                        {...register(`attributes.${idx}.key`)}
                                        className={cn(rowErrors?.key && "border-destructive focus-visible:border-destructive")}
                                    />
                                    {rowErrors?.key && (
                                        <span className="text-[12px] text-destructive">{rowErrors.key.message}</span>
                                    )}
                                </div>
                                <div className="flex-1 flex flex-col gap-1">
                                    <Input
                                        type="text"
                                        placeholder={sectionsT?.attributeValue || 'Value'}
                                        {...register(`attributes.${idx}.value`)}
                                        className={cn(rowErrors?.value && "border-destructive focus-visible:border-destructive")}
                                    />
                                    {rowErrors?.value && (
                                        <span className="text-[12px] text-destructive">{rowErrors.value.message}</span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => remove(idx)}
                                    className="mt-3 flex items-center justify-center text-foreground/50 hover:text-destructive transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}

            <button
                type="button"
                onClick={() => append({ key: '', value: '' })}
                disabled={fields.length >= MAX_ATTRIBUTES}
                className="flex items-center gap-2 text-[14px] text-primary hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed w-fit"
            >
                <Plus className="w-4 h-4" />
                {sectionsT?.addAttribute || 'Add information'}
            </button>
        </div>
    )
}
