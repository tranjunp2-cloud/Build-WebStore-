'use client'

import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { FEEDBACK_AREAS, type FeedbackArea } from './types'

type Props = {
    value: readonly FeedbackArea[]
    onChange: (next: FeedbackArea[]) => void
    labelledBy?: string
    /** Row size: compact for the desktop popover, roomier for the mobile sheet. */
    size?: 'sm' | 'md'
}

/** "Select all" + one checkbox row per feature (Figma 07 / 13). Shared by the desktop popover and the mobile sheet. */
export function FeedbackAreaOptionsList({ value, onChange, labelledBy, size = 'sm' }: Props) {
    const { t } = useI18n()
    const f = t.dashboard.feedback.fields

    // Keep the canonical option order regardless of click order.
    const toggle = (area: FeedbackArea, checked: boolean) =>
        onChange(FEEDBACK_AREAS.filter((a) => (a === area ? checked : value.includes(a))))
    const allState = value.length === 0 ? false : value.length === FEEDBACK_AREAS.length ? true : 'indeterminate'

    const rowClass = cn(
        'flex cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm text-[var(--dash-text)] hover:bg-muted',
        size === 'md' ? 'py-2.5' : 'py-1.5',
    )

    return (
        <div role="group" aria-labelledby={labelledBy} className="flex flex-col gap-0.5">
            <label className={cn(rowClass, 'font-medium')}>
                <Checkbox
                    checked={allState}
                    // Partial or none → select all; all → clear.
                    onCheckedChange={() => onChange(allState === true ? [] : [...FEEDBACK_AREAS])}
                />
                {f.areaSelectAll}
            </label>
            <div role="separator" className="my-0.5 [border-top:1px_solid_var(--dash-border)]" />
            {FEEDBACK_AREAS.map((area) => {
                const checked = value.includes(area)
                return (
                    <label key={area} className={cn(rowClass, checked && 'bg-muted')}>
                        <Checkbox checked={checked} onCheckedChange={(c) => toggle(area, c === true)} />
                        {f.areaOptions[area]}
                    </label>
                )
            })}
        </div>
    )
}
