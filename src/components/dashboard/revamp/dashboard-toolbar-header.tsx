'use client'

/**
 * Dashboard toolbar title + period sub-text — client component so it can call useI18n.
 * The page.tsx server component passes the pre-computed rangeLabel (date string only);
 * this component prepends the "Hourly ·" / "Daily ·" prefix via i18n.
 */
import { useI18n } from '@/i18n'
import type { DashboardPeriodKey } from '@/lib/dashboard/dashboard-types'

export function DashboardToolbarHeader({ period, rangeLabel }: {
    period: DashboardPeriodKey
    rangeLabel: string
}) {
    const { t, ti } = useI18n()
    const r = t.dashboard.revamp

    const sub = ti(
        period === 'today' ? r.periodSub.today : r.periodSub.daily,
        { range: rangeLabel }
    )

    return (
        <div className="dt-left">
            <h1 className="dt-title">{r.title}</h1>
            <span className="dt-sub">{sub}</span>
        </div>
    )
}
