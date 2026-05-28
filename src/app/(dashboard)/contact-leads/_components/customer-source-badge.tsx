'use client'

import { useI18n } from '@/i18n'
import type { CustomerSource } from '../_lib/customer-record'

const SOURCE_CLASSES: Record<CustomerSource, string> = {
    'contact-form': 'bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/10 dark:text-blue-400',
    'newsletter':   'bg-violet-50 border-violet-100 text-violet-700 dark:bg-violet-500/10 dark:border-violet-500/10 dark:text-violet-400',
}

export function CustomerSourceBadge({ source }: { source: CustomerSource }) {
    const { t } = useI18n()
    const c = t.dashboard.customers
    const labelMap: Record<CustomerSource, string> = {
        'contact-form': c.sourceBadgeContact,
        'newsletter': c.sourceBadgeNewsletter,
    }
    return (
        <span
            className={`inline-flex items-center rounded-[12px] px-3 py-[5px] text-[12px] font-medium border ${SOURCE_CLASSES[source]}`}
        >
            {labelMap[source]}
        </span>
    )
}
