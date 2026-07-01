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
// Whitespace is responsive (set on the Badge below), not baked in here.
const SOURCE_SOLID: Record<CustomerSource, string> = {
    'contact-form': '!bg-blue-500/10 !border-blue-500/30 !text-blue-500 !rounded-full',
    'newsletter':   '!bg-[rgba(167,139,250,0.1)] !border-[rgba(138,129,245,0.3)] !text-[#8a81f5] !rounded-full',
}

export function CustomerSourceBadge({ source }: { source: CustomerSource }) {
    const { t } = useI18n()
    const c = t.dashboard.customers
    const labelMap: Record<CustomerSource, string> = {
        'contact-form': c.sourceBadgeContact,
        'newsletter':   c.sourceBadgeNewsletter,
    }
    return (
        <Badge
            variant={SOURCE_VARIANT[source]}
            // Desktop (>=1280): single line, unchanged. iPad table band: allow the long
            // "Newsletter Subscriptions" label to wrap so it fits a compact column → no overflow/scroll.
            className={cn(SOURCE_SOLID[source], 'whitespace-normal min-[1280px]:whitespace-nowrap')}
        >
            {labelMap[source]}
        </Badge>
    )
}
