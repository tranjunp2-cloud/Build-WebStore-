'use client'

import type { CustomerStatus } from '../_lib/customer-record'
import { STATUS_COLORS } from '../_lib/badge-tokens'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'

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
    const colors = STATUS_COLORS[status]
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    className="inline-flex items-center rounded-full px-3 text-sm font-medium border cursor-default whitespace-nowrap"
                    style={{ background: colors.bg, borderColor: colors.border, color: colors.text, paddingTop: '5px', paddingBottom: '5px' }}
                >
                    {labelMap[status]}
                </span>
            </TooltipTrigger>
            <TooltipContent className="dash-shell" style={{ backgroundColor: 'var(--dash-secondary-bg)' }}>
                {tooltipMap[status]}
            </TooltipContent>
        </Tooltip>
    )
}
