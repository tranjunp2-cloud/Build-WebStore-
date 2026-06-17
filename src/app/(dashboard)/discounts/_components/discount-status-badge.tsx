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
        // F33 design: full pill with a tinted background (emerald = active, slate =
        // inactive) + leading dot + 11px label.
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[11px] font-semibold ${
                isActive
                    ? 'bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-400/[0.14] text-slate-600 dark:text-slate-400'
            }`}
        >
            <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    isActive ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-slate-500 dark:bg-slate-400'
                }`}
            />
            {isActive ? d.badges.active : d.badges.inactive}
        </span>
    )
}
