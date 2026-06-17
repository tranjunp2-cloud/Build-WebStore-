'use client'

import type { CustomerStatus } from '../_lib/customer-record'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/i18n'

type BadgeVariant = 'warning' | 'success' | 'secondary' | 'outline' | 'default'

const STATUS_VARIANT: Record<CustomerStatus, BadgeVariant> = {
    new:        'warning',
    contacted:  'success',
    ignored:    'secondary',
    subscribed: 'default',
    read:       'outline',
}

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
    const { t } = useI18n()
    const c = t.dashboard.customers
    const labelMap: Record<CustomerStatus, string> = {
        new: c.statusNew, read: c.statusRead, contacted: c.statusContacted,
        ignored: c.statusIgnored, subscribed: c.statusSubscribed,
    }
    const tooltipMap: Record<CustomerStatus, string> = {
        new: c.tooltipNew, read: c.tooltipRead, contacted: c.tooltipContacted,
        ignored: c.tooltipIgnored, subscribed: c.tooltipSubscribed,
    }
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Badge
                    variant={STATUS_VARIANT[status]}
                    dot
                    className="cursor-default"
                >
                    {labelMap[status]}
                </Badge>
            </TooltipTrigger>
            <TooltipContent className="dash-shell" style={{ backgroundColor: 'var(--dash-secondary-bg)' }}>
                {tooltipMap[status]}
            </TooltipContent>
        </Tooltip>
    )
}
