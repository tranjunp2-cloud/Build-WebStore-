'use client'

import type { CustomerStatus } from '../_lib/customer-record'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'

const STATUS_VISUAL: Record<CustomerStatus, { bg: string; border: string; text: string }> = {
    new:        { bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.3)',   text: '#fbbf24' },
    contacted:  { bg: 'rgba(45,212,191,0.1)',   border: 'rgba(45,212,191,0.3)',   text: '#2dd4bf' },
    ignored:    { bg: 'rgba(156,163,175,0.1)',  border: 'rgba(156,163,175,0.3)',  text: '#9ca3af' },
    subscribed: { bg: 'rgba(167,139,250,0.1)',  border: 'rgba(167,139,250,0.3)',  text: '#a78bfa' },
    read:       { bg: 'rgba(129,140,248,0.1)',  border: 'rgba(129,140,248,0.3)',  text: '#818cf8' },
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
    const s = STATUS_VISUAL[status]
    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span
                        className="inline-flex items-center rounded-[24px] px-3 py-[5px] text-[14px] font-medium border cursor-default"
                        style={{ background: s.bg, borderColor: s.border, color: s.text }}
                    >
                        {labelMap[status]}
                    </span>
                </TooltipTrigger>
                <TooltipContent>{tooltipMap[status]}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
