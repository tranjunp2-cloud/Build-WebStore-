'use client'

import { forwardRef } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FEEDBACK_AREAS, type FeedbackArea } from './types'

/** Tags shown before the rest collapse into "+N". */
const MAX_TAGS = 2

type Props = {
    id: string
    value: readonly FeedbackArea[]
    onChange: (next: FeedbackArea[]) => void
    disabled?: boolean
    describedBy?: string
    className?: string
}

/** Multi-select for the Feature field: a popover of checkboxes, shown like the single Select trigger. */
export const FeedbackAreaSelect = forwardRef<HTMLButtonElement, Props>(function FeedbackAreaSelect(
    { id, value, onChange, disabled, describedBy, className },
    ref,
) {
    const { t, ti } = useI18n()
    const f = t.dashboard.feedback.fields
    // Keep the canonical option order regardless of click order.
    const toggle = (area: FeedbackArea, checked: boolean) =>
        onChange(FEEDBACK_AREAS.filter((a) => (a === area ? checked : value.includes(a))))
    const selected = FEEDBACK_AREAS.filter((a) => value.includes(a))
    const shown = selected.slice(0, MAX_TAGS)
    const extra = selected.length - shown.length

    return (
        <Popover>
            {/* Anchor = the whole input, so the list is as wide as the field and sits below it. */}
            <PopoverAnchor asChild>
            <div
                className={cn(
                    'flex min-h-10 w-full items-center gap-1.5 rounded-lg border border-solid border-[hsl(var(--input-border))] bg-[hsl(var(--card))] pl-2 pr-1 transition-colors focus-within:ring-1 focus-within:ring-ring',
                    disabled && 'cursor-not-allowed opacity-50',
                    className,
                )}
            >
                <div className="flex min-w-0 flex-wrap items-center gap-1 py-1">
                    {shown.map((area) => (
                        <span
                            key={area}
                            className="inline-flex max-w-[160px] items-center gap-1 rounded-md bg-[hsl(var(--primary)/0.1)] py-0.5 pl-2 pr-1 text-xs text-[hsl(var(--primary))]"
                        >
                            <span className="truncate">{f.areaOptions[area]}</span>
                            <button
                                type="button"
                                disabled={disabled}
                                aria-label={ti(f.removeArea, { name: f.areaOptions[area] })}
                                onClick={() => toggle(area, false)}
                                className="rounded p-0.5 hover:bg-[hsl(var(--primary)/0.15)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                <X aria-hidden className="h-3 w-3" />
                            </button>
                        </span>
                    ))}
                    {extra > 0 && <span className="text-xs text-[var(--dash-text-muted)]">{ti(f.areaMore, { count: extra })}</span>}
                </div>
                <PopoverTrigger asChild>
                    <button
                        ref={ref}
                        id={id}
                        type="button"
                        disabled={disabled}
                        aria-describedby={describedBy}
                        className="flex h-9 min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-1 text-left text-sm focus:outline-none disabled:cursor-not-allowed"
                    >
                        <span className={cn('line-clamp-1', selected.length && 'sr-only', !selected.length && 'text-muted-foreground')}>
                            {selected.length ? selected.map((a) => f.areaOptions[a]).join(', ') : f.areaPlaceholder}
                        </span>
                        <ChevronDown aria-hidden className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                    </button>
                </PopoverTrigger>
            </div>
            </PopoverAnchor>
            <PopoverContent align="start" className="w-[var(--radix-popper-anchor-width)] p-1">
                <div role="group" aria-labelledby={id} className="flex flex-col">
                    {FEEDBACK_AREAS.map((area) => (
                        <label
                            key={area}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                        >
                            <Checkbox
                                className="border-solid"
                                checked={value.includes(area)}
                                onCheckedChange={(c) => toggle(area, c === true)}
                            />
                            {f.areaOptions[area]}
                        </label>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    )
})
