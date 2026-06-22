'use client'

import { useI18n } from '@/i18n'

interface DiscountUsageMeterProps {
    count: number
    limit: number | null
}

export function DiscountUsageMeter({ count, limit }: DiscountUsageMeterProps) {
    const { t } = useI18n()
    const d = t.dashboard.discounts
    const unlimited = limit === null || limit === undefined

    if (unlimited) {
        const fill = count > 0 ? Math.min(count * 2.5, 80) : 0
        return (
            <div className="flex flex-col gap-1 min-w-[120px]">
                <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium" style={{ color: 'var(--dash-text)' }}>
                        {count} / ∞
                    </span>
                    <span className="text-[11px] font-semibold tracking-wide" style={{ color: 'hsl(var(--primary))' }}>
                        {d.badges.unlimited}
                    </span>
                </div>
                <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'var(--dash-border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${fill}%`, background: 'hsl(var(--primary))' }} />
                </div>
            </div>
        )
    }

    const pct = limit > 0 ? Math.min((count / limit) * 100, 100) : 0
    const atLimit = count >= limit

    let barColor = 'bg-success'
    if (pct >= 100) barColor = 'bg-destructive'
    else if (pct >= 80) barColor = 'bg-warning'

    return (
        <div className="flex flex-col gap-1 min-w-[80px]">
            <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-medium" style={{ color: 'var(--dash-text)' }}>
                    {count} / {limit}
                </span>
                {atLimit && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold bg-destructive/20 text-destructive tracking-wide">
                        {d.badges.atLimit}
                    </span>
                )}
            </div>
            <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'var(--dash-border)' }}>
                <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    )
}
