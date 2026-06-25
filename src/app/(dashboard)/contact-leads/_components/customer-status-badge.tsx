'use client'

import type { CustomerStatus } from '../_lib/customer-record'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

type BadgeVariant = 'warning' | 'success' | 'secondary' | 'outline' | 'default'

const STATUS_VARIANT: Record<CustomerStatus, BadgeVariant> = {
    new:        'warning',
    contacted:  'success',
    ignored:    'secondary',
    subscribed: 'default',
    read:       'outline',
}

// GH-1337: tinted pill badges per Figma spec. !rounded-full overrides Badge rounded-md.
// subscribed uses hardcoded hex (no exact Tailwind token for #8a81f5).
// whitespace-nowrap: preventive for future locale labels that exceed ~9 chars.
const STATUS_SOLID: Record<CustomerStatus, string> = {
    new:        '!bg-amber-400/10 !border-amber-400/30 !text-amber-400 !rounded-full whitespace-nowrap',
    read:       '!bg-indigo-400/10 !border-indigo-400/30 !text-indigo-400 !rounded-full whitespace-nowrap',
    contacted:  '!bg-teal-400/10 !border-teal-400/30 !text-teal-400 !rounded-full whitespace-nowrap',
    // ! required: .dash-shell remaps plain text-gray-400 → --dash-text-muted (globals.css)
    ignored:    '!bg-gray-400/10 !border-gray-400/30 !text-gray-400 !rounded-full whitespace-nowrap',
    subscribed: '!bg-[rgba(167,139,250,0.1)] !border-[rgba(138,129,245,0.3)] !text-[#8a81f5] !rounded-full whitespace-nowrap',
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
                    className={cn(STATUS_SOLID[status], 'cursor-default')}
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
