'use client'

import { useI18n } from '@/i18n'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CustomerSource } from '../_lib/customer-record'

const SOURCE_VARIANT: Record<CustomerSource, 'default' | 'secondary'> = {
    'contact-form': 'default',
    'newsletter':   'secondary',
}

// GH-1192: tag source = nền đặc + chữ trắng (filled). `!` override màu variant.
const SOURCE_SOLID: Record<CustomerSource, string> = {
    'contact-form': '!bg-[hsl(var(--info))] !text-white dark:!text-[hsl(var(--background))] !border-transparent',
    'newsletter':   '!bg-[hsl(var(--muted-foreground))] !text-white dark:!text-[hsl(var(--background))] !border-transparent',
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
