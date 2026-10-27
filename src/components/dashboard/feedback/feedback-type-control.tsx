'use client'

import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { FEEDBACK_TYPES, type FeedbackType } from './types'

type Props = { value: FeedbackType; onChange: (v: FeedbackType) => void; disabled?: boolean; labelledBy: string }

/** Segmented single-choice control (Figma "Feedback type"). Radio semantics, arrow keys move selection. */
export function FeedbackTypeControl({ value, onChange, disabled, labelledBy }: Props) {
    const { t } = useI18n()
    const labels = t.dashboard.feedback.fields.typeOptions

    const onKeyDown = (e: React.KeyboardEvent) => {
        const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
        if (!step) return
        e.preventDefault()
        const next = FEEDBACK_TYPES[(FEEDBACK_TYPES.indexOf(value) + step + FEEDBACK_TYPES.length) % FEEDBACK_TYPES.length]
        onChange(next)
    }

    return (
        <div
            role="radiogroup"
            aria-labelledby={labelledBy}
            onKeyDown={onKeyDown}
            className="grid grid-cols-3 gap-1 rounded-xl bg-[hsl(var(--secondary))] p-1"
        >
            {FEEDBACK_TYPES.map((type) => {
                const selected = type === value
                return (
                    <button
                        key={type}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        tabIndex={selected ? 0 : -1}
                        disabled={disabled}
                        onClick={() => onChange(type)}
                        className={cn(
                            'h-8 rounded-lg px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed',
                            selected
                                ? 'bg-[hsl(var(--card))] font-semibold text-[var(--dash-text)] [border:1px_solid_hsl(var(--border))]'
                                : 'text-[var(--dash-text-muted)] hover:text-[var(--dash-text)]',
                        )}
                    >
                        {labels[type]}
                    </button>
                )
            })}
        </div>
    )
}
