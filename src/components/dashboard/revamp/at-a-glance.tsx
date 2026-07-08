'use client'

/**
 * At-a-glance — 4 stat cards (Views / Leads / Engagement / Revenue).
 * Revenue is locked behind a "Coming Soon" overlay. Ports the design AtAGlance.
 * Labels, notes, and tooltips are all driven by the i18n t.dashboard.revamp.glance tree.
 */
import { Eye, MousePointerClick, ShoppingBag, DollarSign, type LucideIcon } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Sparkline } from './charts'
import { SectionHead, Delta, ComingSoonBadgeTooltip, InfoTooltip } from './atoms'
import type { DashboardPeriodKey, GlanceData, GlanceStat } from '@/lib/dashboard/dashboard-types'

const fmtNum = (n: number) => new Intl.NumberFormat('en-MY').format(Math.round(n))
const fmtMYR = (n: number) => 'RM ' + new Intl.NumberFormat('en-MY', { maximumFractionDigits: 0 }).format(Math.round(n))

function statDisplay(stat: GlanceStat): string {
    if (stat.currency) return fmtMYR(stat.value)
    if (stat.unit === '%') return stat.value.toFixed(1) + '%'
    return fmtNum(stat.value)
}

function StatCardInner({ label, icon: Icon, accentVar, bgVar, stat, spark, note, tip, comingSoon, comingSoonLabel, comingSoonTip }: {
    label: string
    icon: LucideIcon
    accentVar: string
    bgVar: string
    stat: GlanceStat
    spark: number[]
    /** Translated comparison note, e.g. "vs yesterday" */
    note: string
    /** Optional plain-language explainer shown via an info-icon tooltip next to the label */
    tip?: string
    /** Coming Soon (no real data) — hides the comparison cluster + sparkline, shows a badge instead */
    comingSoon?: boolean
    /** Translated "Coming Soon" badge text */
    comingSoonLabel?: string
    comingSoonTip?: string
}) {
    return (
        <div className={`stat-card${comingSoon ? ' stat-card-soon' : ''}`}>
            {!comingSoon && <Sparkline data={spark} color={`var(${accentVar})`} />}
            {/* GH-1516: delta/badge moved UP beside the label (same row, right-aligned) —
                it no longer shares the value row, so the value can't be squeezed/ellipsized
                and the pill sits well clear of the sparkline zone at the card bottom. */}
            <div className="stat-top">
                <div className="stat-top-left">
                    <span className="stat-ic" style={{ background: `var(${bgVar})`, color: `var(${accentVar})` }}>
                        <Icon aria-hidden />
                    </span>
                    {/* Title text + tooltip stay glued together (inline-flex, no justify-between) */}
                    <span className="stat-label">{label}{tip && <InfoTooltip tip={tip} />}</span>
                </div>
                {comingSoon
                    ? <ComingSoonBadgeTooltip label={comingSoonLabel ?? ''} tip={comingSoonTip ?? ''} />
                    : <Delta value={stat.delta} />}
            </div>
            {/* Value (left) + "vs …" note (right) share one baseline row */}
            <div className="stat-bottom">
                <span className="stat-val">{statDisplay(stat)}</span>
                {!comingSoon && <span className="delta-note">{note}</span>}
            </div>
        </div>
    )
}

export function AtAGlance({ data, showHeader = true, period }: {
    data: GlanceData
    showHeader?: boolean
    period: DashboardPeriodKey
}) {
    const { t, ti } = useI18n()
    const r = t.dashboard.revamp

    const sub = ti(
        period === 'today' ? r.periodSub.today : r.periodSub.daily,
        { range: data.rangeLabel }
    )
    const note = period === 'today' ? r.glance.noteToday : period === '30d' ? r.glance.note30d : r.glance.note7d

    return (
        <div className="section">
            {showHeader && <SectionHead icon="layout-grid" title={r.glance.title} sub={sub} />}
            <div className="stat-grid">
                <StatCardInner label={r.glance.views} icon={Eye} accentVar="--dr-m-views" bgVar="--dr-m-views-bg" stat={data.stats.views} spark={data.sparks.views} note={note} tip={r.glance.viewsTip} />
                <StatCardInner label={r.glance.leads} icon={MousePointerClick} accentVar="--dr-m-leads" bgVar="--dr-m-leads-bg" stat={data.stats.leads} spark={data.sparks.leads} note={note} tip={r.glance.leadsTip} />
                <StatCardInner label={r.glance.engagement} icon={ShoppingBag} accentVar="--dr-m-engage" bgVar="--dr-m-engage-bg" stat={data.stats.engage} spark={data.sparks.engage} note={note} tip={r.glance.engagementTip} />
                <StatCardInner label={r.glance.revenue} icon={DollarSign} accentVar="--dr-m-rev" bgVar="--dr-m-rev-bg" stat={data.stats.revenue} spark={data.sparks.revenue} note={note} comingSoon comingSoonLabel={r.comingSoon} comingSoonTip={r.glance.revenueSoonTip} />
            </div>
        </div>
    )
}
