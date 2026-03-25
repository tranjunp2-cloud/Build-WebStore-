'use client'

import { cn } from '@/lib/utils'

type AddSectionPrompt = {
    label: string
    compactLabel: string
    prompt: string
}

const sectionPrompts: AddSectionPrompt[] = [
    {
        label: 'Add testimonials',
        compactLabel: '💬 Add testimonials',
        prompt: 'Add a testimonials section with 3 customer reviews',
    },
    {
        label: 'Add FAQ',
        compactLabel: '❓ Add FAQ',
        prompt: 'Add an FAQ section with 3 common customer questions',
    },
    {
        label: 'Add gallery',
        compactLabel: '🖼️ Add gallery',
        prompt: 'Add a gallery section with 6 placeholder images',
    },
    {
        label: 'Add features',
        compactLabel: '✨ Add features',
        prompt: 'Add a features section with 3 key service highlights',
    },
    {
        label: 'Add team',
        compactLabel: '👥 Add team',
        prompt: 'Add a team section with 3 team members',
    },
    {
        label: 'Add newsletter',
        compactLabel: '✉️ Add newsletter',
        prompt: 'Add a newsletter signup section',
    },
    {
        label: 'Add banner',
        compactLabel: '📣 Add banner',
        prompt: 'Add a banner section for a promotion campaign',
    },
    {
        label: 'Add CTA',
        compactLabel: '🚀 Add CTA',
        prompt: 'Add a call to action section with a strong offer',
    },
]

interface AddSectionPromptChipsProps {
    compact?: boolean
    onPromptSelect: (prompt: string) => void
}

export function AddSectionPromptChips({
    compact = false,
    onPromptSelect,
}: AddSectionPromptChipsProps) {
    return (
        <div className={cn('flex gap-2', compact ? 'overflow-x-auto pb-1' : 'flex-wrap')}>
            {sectionPrompts.map(item => (
                <button
                    key={item.label}
                    type="button"
                    onClick={() => onPromptSelect(item.prompt)}
                    className={cn(
                        'rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-white/10',
                        compact && 'shrink-0 border-white/[0.04] bg-[#1E293B] text-slate-400',
                    )}
                >
                    {compact ? item.compactLabel : item.label}
                </button>
            ))}
        </div>
    )
}
