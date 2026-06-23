'use client'

import { useI18n } from '@/i18n'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CustomerSource } from '../_lib/customer-record'

const SOURCE_VARIANT: Record<CustomerSource, 'default' | 'secondary'> = {
    'contact-form': 'default',
    'newsletter':   'secondary',
}

// GH-1337: tinted pill badges per Figma spec. !rounded-full overrides Badge default rounded-md.
// whitespace-nowrap prevents "Newsletter Subscriptions" from wrapping in narrow table columns.
const SOURCE_SOLID: Record<CustomerSource, string> = {
    'contact-form': '!bg-blue-500/10 !border-blue-500/30 !text-blue-500 !rounded-full whitespace-nowrap',
    'newsletter':   '!bg-[rgba(167,139,250,0.1)] !border-[rgba(138,129,245,0.3)] !text-[#8a81f5] !rounded-full whitespace-nowrap',
}

export function CustomerSourceBadge({ source }: { source: CustomerSource }) {
    const { t } = useI18n()
    const c = t.dashboard.customers
    const labelMap: Record<CustomerSource, string> = {
        'contact-form': c.sourceBadgeContact,
        'newsletter':   c.sourceBadgeNewsletter,
    }
    return (
        <Badge variant={SOURCE_VARIANT[source]} className={cn(SOURCE_SOLID[source])}>
            {labelMap[source]}
        </Badge>
    )
}
