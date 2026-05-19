'use client'

import type { CustomerStatus } from '../_lib/customer-record'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'

const STATUS_CLASSES: Record<CustomerStatus, string> = {
    new:        'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400',
    contacted:  'bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-500/10 dark:border-teal-500/30 dark:text-teal-400',
    ignored:    'bg-zinc-100 border-zinc-200 text-zinc-600 dark:bg-zinc-500/10 dark:border-zinc-500/30 dark:text-zinc-400',
    subscribed: 'bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-500/10 dark:border-violet-500/30 dark:text-violet-400',
    read:       'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/10 dark:border-indigo-500/30 dark:text-indigo-400',
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
                <span
                    className={`inline-flex items-center rounded-[24px] px-3 py-[5px] text-[14px] font-medium border cursor-default transition-all duration-150 hover:brightness-110 hover:scale-[1.03] ${STATUS_CLASSES[status]}`}
                >
                    {labelMap[status]}
                </span>
            </TooltipTrigger>
            <TooltipContent>{tooltipMap[status]}</TooltipContent>
        </Tooltip>
    )
}
