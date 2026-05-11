'use client'

import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { PricingPlan } from '@/blocks/pricing/config'
import { isMatrixVariant } from '@/blocks/pricing/variant-data-mapping'
import type { PageData } from '@/store/editorStore'
import { useI18n } from '@/i18n'
import { decodeHtmlEntities } from '@/lib/utils/rich-text-render'

type FieldBlurEvent = React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>

interface PlanFieldsProps {
    plan: PricingPlan
    onChange: (field: keyof PricingPlan, value: unknown) => void
    variant?: string
    pages?: PageData[]
}

const selectClass = 'w-full h-9 rounded-lg bg-[#0f1923] border border-white/10 text-white text-xs px-2 outline-none focus:border-blue-500/50'
const labelClass = 'text-[12px] font-medium text-[#94a3b8]'

function FieldLabel({ children }: { children: React.ReactNode }) {
    return <p className={labelClass}>{children}</p>
}

export default function PlanFields({ plan, onChange, variant, pages }: PlanFieldsProps) {
    const { t } = useI18n()
    const s = t.editor.settings
    const isMatrix = isMatrixVariant(variant)
    const [ctaOpen, setCtaOpen] = useState(true)
    const [nameError, setNameError] = useState(false)
    const [priceError, setPriceError] = useState(false)
    // Controlled locally so URL placeholder reacts immediately to action type change
    const [actionType, setActionType] = useState<'external' | 'internal'>(plan.ctaActionType ?? 'external')

    const featureText = (plan.features ?? [])
        .map(f => (typeof f === 'string' ? f : f.text))
        .join('\n')

    const ctaLabelText = decodeHtmlEntities((plan.ctaLabel ?? 'Get Started').replace(/<[^>]*>/g, '')).trim() || 'Get Started'

    const handleFeaturesBlur = (e: FieldBlurEvent) => {
        const lines = e.target.value.split('\n').filter(l => l.trim())
        onChange('features', lines.map(text => ({ text, included: true })))
    }

    const handleActionTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value as 'external' | 'internal'
        setActionType(val)
        onChange('ctaActionType', val)
    }

    return (
        <div className="space-y-3">
            <div className="space-y-1.5">
                <FieldLabel>{s.pricingPlanName}</FieldLabel>
                <Input
                    defaultValue={plan.name}
                    placeholder={s.pricingPlanNamePlaceholder}
                    variant="editor"
                    className={cn(nameError && 'border-red-500/60')}
                    onBlur={(e) => {
                        setNameError(!e.target.value.trim())
                        onChange('name', e.target.value)
                    }}
                />
            </div>

            <div className="space-y-1.5">
                <FieldLabel>{s.pricingPriceUnit}</FieldLabel>
                <Input
                    defaultValue={plan.price}
                    placeholder={s.pricingPriceUnitPlaceholder}
                    variant="editor"
                    className={cn(priceError && 'border-red-500/60')}
                    onBlur={(e) => {
                        setPriceError(!e.target.value.trim())
                        onChange('price', e.target.value)
                    }}
                />
            </div>

            {/* Description + Features hidden for matrix variants (managed via Feature Editor modal) */}
            {!isMatrix && (
                <>
                    <div className="space-y-1.5">
                        <FieldLabel>{s.pricingDescription}</FieldLabel>
                        <Textarea
                            defaultValue={plan.description ?? ''}
                            placeholder={s.pricingDescriptionPlaceholder}
                            variant="editor"
                            className="min-h-[60px]"
                            onBlur={(e: FieldBlurEvent) => onChange('description', e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <FieldLabel>{s.pricingFeatures}</FieldLabel>
                        <Textarea
                            defaultValue={featureText}
                            placeholder={s.pricingFeaturesPlaceholder}
                            variant="editor"
                            className="min-h-[80px]"
                            onBlur={handleFeaturesBlur}
                        />
                    </div>
                </>
            )}

            {/* CTA Settings — collapsible */}
            <div className="bg-[#1e293b] border border-[rgba(59,130,246,0.04)] rounded-xl overflow-hidden">
                <button
                    type="button"
                    onClick={() => setCtaOpen(o => !o)}
                    className="w-full flex items-center justify-between px-3 h-11"
                >
                    <span className="text-[14px] font-medium text-white">{s.pricingCtaSettings}</span>
                    <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', ctaOpen && 'rotate-180')} />
                </button>
                {ctaOpen && (
                    <div className="px-3 pb-3 space-y-3">
                        <div className="space-y-1.5">
                            <FieldLabel>{s.pricingLinkText}</FieldLabel>
                            <Input
                                defaultValue={ctaLabelText}
                                placeholder={s.pricingLinkTextPlaceholder}
                                variant="editor"
                                onBlur={(e: FieldBlurEvent) => onChange('ctaLabel', e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <FieldLabel>{s.pricingAction}</FieldLabel>
                            <select value={actionType} onChange={handleActionTypeChange} className={selectClass}>
                                <option value="external">{s.pricingActionExternal}</option>
                                <option value="internal">{s.pricingActionInternal}</option>
                            </select>
                            {actionType === 'internal' ? (
                                <select
                                    value={plan.ctaUrl ?? ''}
                                    onChange={(e) => onChange('ctaUrl', e.target.value)}
                                    className={selectClass}
                                >
                                    <option value="">{s.pricingSelectPage}</option>
                                    {pages?.map(p => {
                                        const slug = p.slug.startsWith('/') ? p.slug : `/${p.slug}`
                                        return <option key={p.slug} value={slug}>{p.title || p.slug}</option>
                                    })}
                                </select>
                            ) : (
                                <div className="relative">
                                    <Input
                                        defaultValue={plan.ctaUrl ?? ''}
                                        placeholder="https://..."
                                        variant="editor"
                                        className="pr-8"
                                        onBlur={(e: FieldBlurEvent) => onChange('ctaUrl', e.target.value)}
                                    />
                                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
