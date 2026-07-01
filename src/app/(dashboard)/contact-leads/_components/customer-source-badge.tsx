'use client'

import type { CustomerSource } from '../_lib/customer-record'
import { SOURCE_COLORS } from '../_lib/badge-tokens'
import { useI18n } from '@/i18n'

export function CustomerSourceBadge({ source }: { source: CustomerSource }) {
    const { t } = useI18n()
    const c = t.dashboard.customers
    const labelMap: Record<CustomerSource, string> = {
        'contact-form': c.sourceBadgeContact,
        'newsletter':   c.sourceBadgeNewsletter,
    }
    const colors = SOURCE_COLORS[source]
    return (
        <span
            className="inline-flex items-center rounded-[12px] text-xs font-medium border whitespace-nowrap"
            style={{ background: colors.bg, borderColor: colors.border, color: colors.text, paddingTop: '5px', paddingBottom: '5px', paddingLeft: '13px', paddingRight: '13px' }}
        >
            {labelMap[source]}
        </span>
    )
}
