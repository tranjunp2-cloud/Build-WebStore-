'use client'
/**
 * Reusable status pill for template status values.
 * Uses STATUS_META for consistent colour/label across views.
 */
import { getStatusMeta } from '@/lib/admin/template-status-meta'

type Props = {
    status: string | null | undefined
    className?: string
}

export function TemplateStatusPill({ status, className = '' }: Props) {
    const meta = getStatusMeta(status)
    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.className} ${className}`}
        >
            {meta.label}
        </span>
    )
}
