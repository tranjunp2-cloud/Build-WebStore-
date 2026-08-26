'use client'

import { Percent, Banknote } from 'lucide-react'
import { useI18n } from '@/i18n'

interface DiscountTypeBadgeProps {
    type: 'percentage' | 'fixed'
}

export function DiscountTypeBadge({ type }: DiscountTypeBadgeProps) {
    const { t } = useI18n()
    const d = t.dashboard.discounts

    if (type === 'percentage') {
        return (
            <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold"
                style={{ background: 'hsl(var(--info)/0.15)', color: 'hsl(var(--info))' }}
            >
                <Percent className="h-2.5 w-2.5" />
                {d.badges.percentage}
            </span>
        )
    }
    return (
        <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold"
            style={{ background: 'hsl(var(--primary)/0.15)', color: 'hsl(var(--primary))' }}
        >
            <Banknote className="h-2.5 w-2.5" />
            {d.badges.fixed}
        </span>
    )
}
