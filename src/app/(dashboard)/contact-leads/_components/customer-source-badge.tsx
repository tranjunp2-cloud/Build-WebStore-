'use client'

import { useI18n } from '@/i18n'
import { Badge } from '@/components/ui/badge'
import type { CustomerSource } from '../_lib/customer-record'

const SOURCE_VARIANT: Record<CustomerSource, 'default' | 'secondary'> = {
    'contact-form': 'default',
    'newsletter':   'secondary',
}

export function CustomerSourceBadge({ source }: { source: CustomerSource }) {
    const { t } = useI18n()
    const c = t.dashboard.customers
    const labelMap: Record<CustomerSource, string> = {
        'contact-form': c.sourceBadgeContact,
        'newsletter':   c.sourceBadgeNewsletter,
    }
    return (
        <Badge variant={SOURCE_VARIANT[source]}>
            {labelMap[source]}
        </Badge>
    )
}
