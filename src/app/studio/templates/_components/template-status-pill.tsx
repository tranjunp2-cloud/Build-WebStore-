'use client'
/**
 * Status pill — matches bundle .badge + .b-{status} classes.
 * Five states: live | draft | review | scheduled | archived
 */

type Props = {
    status: string | null | undefined
    className?: string
}

const STATUS_CLASS: Record<string, string> = {
    live:      'b-live',
    draft:     'b-draft',
    review:    'b-review',
    scheduled: 'b-scheduled',
    archived:  'b-archived',
}

const STATUS_LABEL: Record<string, string> = {
    live:      'Live',
    draft:     'Draft',
    review:    'In Review',
    scheduled: 'Scheduled',
    archived:  'Archived',
}

export function TemplateStatusPill({ status, className = '' }: Props) {
    const key = status ?? 'draft'
    const cls = STATUS_CLASS[key] ?? 'b-draft'
    const label = STATUS_LABEL[key] ?? key
    return (
        <span className={`badge ${cls} ${className}`}>
            {label}
        </span>
    )
}
