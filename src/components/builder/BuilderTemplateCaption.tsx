'use client'

import { Check, Sparkles } from 'lucide-react'
import type { BuilderTemplateField } from '@/components/builder/BuilderTemplatePreview'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

export const BUILDER_TEMPLATE_FIELDS: BuilderTemplateField[] = ['businessName', 'industry', 'products', 'shortDescription']

interface BuilderTemplateCaptionProps {
    filled: Record<BuilderTemplateField, boolean>
    missing: Partial<Record<BuilderTemplateField, boolean>>
    focus: BuilderTemplateField | null
}

/** "AI builds this template…" caption with a 4-segment n/4 details counter. */
export function BuilderTemplateCaption({ filled, missing, focus }: BuilderTemplateCaptionProps) {
    const { t, ti } = useI18n()
    const f = t.onboarding.form
    const count = BUILDER_TEMPLATE_FIELDS.filter((k) => filled[k]).length
    const ready = count === BUILDER_TEMPLATE_FIELDS.length

    return (
        <div className="mt-3.5 flex items-center gap-2.5" data-ready={ready ? 'true' : 'false'} data-testid="builder-template-caption">
            <span
                className={cn(
                    'flex size-5 flex-none items-center justify-center rounded-full transition-[background-color,color,box-shadow] duration-300',
                    ready ? 'bg-[#2dd4bf] text-[#0b1222] shadow-[0_0_12px_rgba(45,212,191,.45)]' : 'bg-[rgba(56,189,248,.12)] text-[#38bdf8]',
                )}
            >
                {ready ? <Check aria-hidden className="size-[11px]" strokeWidth={3} /> : <Sparkles aria-hidden className="size-[11px]" strokeWidth={2.25} />}
            </span>
            <div className="min-w-0 flex-1 text-[12.5px] font-medium leading-[18px] text-[#e2e8f0] [text-wrap:pretty]">
                {ready ? f.templateReady : f.templateCaption}
            </div>
            <div aria-label={ti(f.templateCount, { count })} className="flex flex-none items-center gap-2" role="img">
                <div className="flex gap-[3px]">
                    {BUILDER_TEMPLATE_FIELDS.map((k) => (
                        <span
                            className="block h-1 w-3.5 rounded-sm transition-colors duration-200"
                            data-testid="builder-template-segment"
                            key={k}
                            style={{ backgroundColor: missing[k] ? '#f87171' : filled[k] ? '#2dd4bf' : focus === k ? '#38bdf8' : '#2a3446' }}
                        />
                    ))}
                </div>
                <span className="text-xs font-semibold leading-[18px] text-[#38bdf8] [font-variant-numeric:tabular-nums]">{count}/4</span>
            </div>
        </div>
    )
}
