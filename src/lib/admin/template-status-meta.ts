/**
 * Visual metadata for template status values.
 * Used for pills/badges in list views and drawers.
 */

export type TemplateStatus = 'live' | 'draft' | 'review' | 'scheduled' | 'archived'

export type StatusMeta = {
    label: string
    /** Tailwind class string for the pill */
    className: string
}

export const STATUS_META: Record<TemplateStatus, StatusMeta> = {
    live: {
        label: 'Live',
        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    },
    draft: {
        label: 'Draft',
        className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    },
    review: {
        label: 'Review',
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    },
    scheduled: {
        label: 'Scheduled',
        className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    },
    archived: {
        label: 'Archived',
        className: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
    },
}

export function getStatusMeta(status: string | null | undefined): StatusMeta {
    return STATUS_META[(status as TemplateStatus) ?? 'live'] ?? STATUS_META.live
}
