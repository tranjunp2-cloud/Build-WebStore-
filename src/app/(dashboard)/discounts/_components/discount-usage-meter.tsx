interface DiscountUsageMeterProps {
    count: number
    limit: number | null
}

export function DiscountUsageMeter({ count, limit }: DiscountUsageMeterProps) {
    const unlimited = limit === null || limit === undefined

    if (unlimited) {
        const fill = count > 0 ? Math.min(count * 2.5, 80) : 0
        return (
            <div className="flex flex-col gap-1 min-w-[120px]">
                <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium" style={{ color: 'var(--dash-text)' }}>
                        {count} / ∞
                    </span>
                    <span className="text-[11px] font-semibold tracking-wide" style={{ color: '#38bdf8' }}>
                        UNLIMITED
                    </span>
                </div>
                <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="h-full rounded-full" style={{ width: `${fill}%`, background: '#38bdf8' }} />
                </div>
            </div>
        )
    }

    const pct = limit > 0 ? Math.min((count / limit) * 100, 100) : 0
    const atLimit = count >= limit

    let barColor = 'bg-green-500'
    if (pct >= 100) barColor = 'bg-red-500'
    else if (pct >= 80) barColor = 'bg-amber-400'

    return (
        <div className="flex flex-col gap-1 min-w-[80px]">
            <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-medium" style={{ color: 'var(--dash-text)' }}>
                    {count} / {limit}
                </span>
                {atLimit && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold bg-red-500/20 text-red-400 tracking-wide">
                        AT LIMIT
                    </span>
                )}
            </div>
            <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    )
}
