'use client'

import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

type AddSectionPrompt = {
    label: string
    compactLabel: string
    prompt: string
}

interface AddSectionPromptChipsProps {
    compact?: boolean
    desktopMinimal?: boolean
    desktopLabelOverride?: string
    onPromptSelect: (prompt: string) => void
}

export function AddSectionPromptChips({
    compact = false,
    desktopMinimal = false,
    desktopLabelOverride,
    onPromptSelect,
}: AddSectionPromptChipsProps) {
    const { t } = useI18n()
    const as = t.editor.addSection

    const sectionPrompts: AddSectionPrompt[] = [
        { label: as.testimonials, compactLabel: as.testimonialsCompact, prompt: as.testimonialsPrompt },
        { label: as.faq, compactLabel: as.faqCompact, prompt: as.faqPrompt },
        { label: as.gallery, compactLabel: as.galleryCompact, prompt: as.galleryPrompt },
        { label: as.features, compactLabel: as.featuresCompact, prompt: as.featuresPrompt },
        { label: as.team, compactLabel: as.teamCompact, prompt: as.teamPrompt },
        { label: as.newsletter, compactLabel: as.newsletterCompact, prompt: as.newsletterPrompt },
        { label: as.banner, compactLabel: as.bannerCompact, prompt: as.bannerPrompt },
        { label: as.cta, compactLabel: as.ctaCompact, prompt: as.ctaPrompt },
    ]

    const prompts = !compact && desktopMinimal ? [sectionPrompts[0]] : sectionPrompts

    return (
        <div className={cn('flex gap-2', compact ? 'overflow-x-auto pb-1' : desktopMinimal ? 'shrink-0' : 'flex-wrap')}>
            {prompts.map(item => (
                <button
                    key={item.label}
                    type="button"
                    onClick={() => onPromptSelect(item.prompt)}
                    className={cn(
                        'inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-white/10',
                        desktopMinimal && !compact && 'min-w-[122px] justify-center border-[var(--editor-border)] bg-[var(--editor-surface-elevated)] px-[13px] py-[7px] font-medium text-slate-400',
                        compact && 'shrink-0 border-white/[0.04] bg-[var(--editor-surface-elevated)] text-slate-400',
                    )}
                >
                    {compact ? item.compactLabel : desktopMinimal && desktopLabelOverride ? desktopLabelOverride : item.label}
                </button>
            ))}
        </div>
    )
}
