'use client'

import { useI18n } from '@/i18n'

interface DiscountStatusBadgeProps {
    status: string
}

export function DiscountStatusBadge({ status }: DiscountStatusBadgeProps) {
    const { t } = useI18n()
    const d = t.dashboard.discounts
    const isActive = status === 'active'

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium ${
                isActive ? 'text-green-400' : 'text-slate-400'
            }`}
            style={{ background: 'var(--dash-surface-hover)' }}
        >
            <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    isActive ? 'bg-green-400' : 'bg-slate-400'
                }`}
            />
            {isActive ? d.badges.active : d.badges.inactive}
        </span>
    )
}
