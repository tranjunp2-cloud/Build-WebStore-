'use client'

import { useI18n } from '@/i18n'
import type { CustomerSource } from '../_lib/customer-record'

const SOURCE_STYLES: Record<CustomerSource, { bg: string; border: string; text: string }> = {
    'contact-form': { bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.1)',  text: '#3b82f6' },
    'newsletter':   { bg: 'rgba(138,129,245,0.1)', border: 'rgba(138,129,245,0.1)', text: '#8a81f5' },
}

export function CustomerSourceBadge({ source }: { source: CustomerSource }) {
    const { t } = useI18n()
    const c = t.dashboard.customers
    const labelMap: Record<CustomerSource, string> = {
        'contact-form': c.sourceBadgeContact,
        'newsletter': c.sourceBadgeNewsletter,
    }
    const s = SOURCE_STYLES[source]
    return (
        <span
            className="inline-flex items-center rounded-[12px] px-3 py-[5px] text-[12px] font-medium border"
            style={{ background: s.bg, borderColor: s.border, color: s.text }}
        >
            {labelMap[source]}
        </span>
    )
}
