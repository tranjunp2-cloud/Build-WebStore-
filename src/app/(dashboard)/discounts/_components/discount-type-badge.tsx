'use client'

import { Percent, Banknote } from 'lucide-react'

interface DiscountTypeBadgeProps {
    type: 'percentage' | 'fixed'
}

export function DiscountTypeBadge({ type }: DiscountTypeBadgeProps) {
    if (type === 'percentage') {
        return (
            <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold"
                style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}
            >
                <Percent className="h-2.5 w-2.5" />
                Percentage
            </span>
        )
    }
    return (
        <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold"
            style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}
        >
            <Banknote className="h-2.5 w-2.5" />
            Fixed
        </span>
    )
}
