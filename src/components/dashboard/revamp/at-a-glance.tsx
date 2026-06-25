/**
 * At-a-glance — 4 stat cards (Views / Leads / Engagement / Revenue).
 * Revenue is locked behind a "Coming Soon" overlay (F10). Ports the design AtAGlance.
 */
import { Eye, MousePointerClick, ShoppingBag, DollarSign, type LucideIcon } from 'lucide-react'
import { Sparkline } from './charts'
import { SectionHead, Delta, ComingSoonBadgeTooltip } from './atoms'
import type { GlanceData, GlanceStat } from '@/lib/dashboard/dashboard-types'

const REVENUE_SOON_TIP = 'Revenue tracking is coming soon. This card will calculate metrics from paid and completed orders.'

const fmtNum = (n: number) => new Intl.NumberFormat('en-MY').format(Math.round(n))
const fmtMYR = (n: number) => 'RM ' + new Intl.NumberFormat('en-MY', { maximumFractionDigits: 0 }).format(Math.round(n))

function statDisplay(stat: GlanceStat): string {
    if (stat.currency) return fmtMYR(stat.value)
    if (stat.unit === '%') return stat.value.toFixed(1) + '%'
    return fmtNum(stat.value)
}

function StatCardInner({ label, icon: Icon, accentVar, bgVar, stat, spark, comingSoon, comingSoonTip }: {
    label: string
    icon: LucideIcon
    accentVar: string
    bgVar: string
    stat: GlanceStat
    spark: number[]
    /** Coming Soon (no real data) — hides the comparison cluster + sparkline, shows a badge instead */
    comingSoon?: boolean
    comingSoonTip?: string
}) {
    return (
        <div className={`stat-card${comingSoon ? ' stat-card-soon' : ''}`}>
            {!comingSoon && <Sparkline data={spark} color={`var(${accentVar})`} />}
            <div className="stat-top">
                <span className="stat-ic" style={{ background: `var(${bgVar})`, color: `var(${accentVar})` }}>
                    <Icon aria-hidden />
                </span>
                <span className="stat-label">{label}</span>
                <div className="stat-change">
                    {comingSoon
                        ? <ComingSoonBadgeTooltip label="Coming Soon" tip={comingSoonTip ?? ''} />
                        : <><Delta value={stat.delta} /><span className="delta-note">{stat.note}</span></>}
                </div>
            </div>
            <div className="stat-val">{statDisplay(stat)}</div>
        </div>
    )
}

export function AtAGlance({ data, showHeader = true }: { data: GlanceData; showHeader?: boolean }) {
    return (
        <div className="section">
            {/* Header is redundant when it leads the page (toolbar already shows the period
                sub-text) — only render it when an Onboarding block sits above. */}
            {showHeader && <SectionHead icon="layout-grid" title="At a glance" sub={data.sub} />}
            <div className="stat-grid">
                <StatCardInner label="Page views" icon={Eye} accentVar="--dr-m-views" bgVar="--dr-m-views-bg" stat={data.stats.views} spark={data.sparks.views} />
                <StatCardInner label="Leads" icon={MousePointerClick} accentVar="--dr-m-leads" bgVar="--dr-m-leads-bg" stat={data.stats.leads} spark={data.sparks.leads} />
                <StatCardInner label="Engagement" icon={ShoppingBag} accentVar="--dr-m-engage" bgVar="--dr-m-engage-bg" stat={data.stats.engage} spark={data.sparks.engage} />
                <StatCardInner label="Revenue" icon={DollarSign} accentVar="--dr-m-rev" bgVar="--dr-m-rev-bg" stat={data.stats.revenue} spark={data.sparks.revenue} comingSoon comingSoonTip={REVENUE_SOON_TIP} />
            </div>
        </div>
    )
}
