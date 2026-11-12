/**
 * /studio/performance/shops/[tenantId] — one shop: limits and last-24h spend, cost per day, by area / task, recent calls, errors.
 */
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import config from '@payload-config'
import { getPayload } from 'payload'
import { ArrowLeft, ChevronRight, List } from 'lucide-react'
import { requireStudioAccess } from '@/lib/admin/auth-guard'
import { getShopLimitView, type ShopLimitView } from '@/lib/admin/ai-caps/shop-overrides'
import { AREA_GROUP_LABELS, PLAN_GROUP_LABELS } from '@/lib/admin/ai-usage/groups'
import { fmtInt, fmtUsd, fmtWhen } from '@/lib/admin/ai-usage/format'
import { getBreakdown } from '@/lib/admin/ai-usage/overview-queries'
import { getLogRows, getLogTotals } from '@/lib/admin/ai-usage/log-queries'
import { bucketLabel, klDay, periodQuery, rangeLabel, resolvePeriod } from '@/lib/admin/ai-usage/period'
import { limitsForCode } from '@/lib/admin/ai-usage/plan-limits-read'
import { loadFeatureRows } from '@/lib/admin/ai-usage/plan-limits-read'
import { getShopAreas, getShopErrors, getShopHeader, getShopRolling24h, getShopSeries } from '@/lib/admin/ai-usage/shop-queries'
import { tenantIdParam, type ReportsDb } from '@/lib/admin/ai-usage/sql-parts'
import '../../ai-usage.css'
import { CardHead, ErrorState, OutcomeBadge, PlanBadge, UnpricedBadge } from '../../_components/au-parts'
import { DailyBars } from '../../_components/daily-bars'
import { PeriodControls } from '../../_components/period-controls'
import { ShopLimitCard } from '../../_components/shop-limit-card'

export const metadata: Metadata = { title: 'AI usage: shop' }

type Props = { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function ShopAiUsagePage({ params, searchParams }: Props) {
    await requireStudioAccess()
    const { tenantId: raw } = await params
    const tenantId = tenantIdParam(raw)
    if (!tenantId) notFound()
    const sp = await searchParams
    const period = resolvePeriod(sp)
    const today = klDay(new Date())
    const query = periodQuery(period).toString()
    const self = `/studio/performance/shops/${tenantId}${query ? `?${query}` : ''}`

    try {
        const payload = await getPayload({ config })
        const db = payload as unknown as ReportsDb
        const shop = await getShopHeader(db, tenantId)
        if (!shop) notFound()
        const filters = { unpriced: false, tenantId }
        const [rolling, series, areas, tasks, recent, totals, errors, features, view] = await Promise.all([
            getShopRolling24h(db, tenantId), getShopSeries(db, tenantId, period), getShopAreas(db, tenantId, period),
            getBreakdown(db, period, 'task', 8, tenantId), getLogRows(db, filters, period, 6), getLogTotals(db, filters, period),
            getShopErrors(db, tenantId, period), loadFeatureRows(payload),
            // the override card loads apart: if it fails the page still shows the plan's limits
            getShopLimitView(tenantId).catch((error: unknown): ShopLimitView | null => { console.error('[ai-usage] shop limit view failed', error); return null }),
        ])
        const planLimits = shop.planCode ? limitsForCode(features, shop.planCode) : null
        // what applies now: the plan's limits with this shop's active override on top
        const limits = view ? { budgetUsd: view.effective.aiBudgetUsd, picturesPerDay: view.effective.picturesPerDay } : planLimits
        const aiOff = view ? !view.effective.enabled : false
        const overridden = Boolean(view?.override && !view.override.expired)
        const planName = PLAN_GROUP_LABELS[shop.plan]
        const areaMax = Math.max(...areas.map((a) => a.cost), 0)
        const logsHref = `/studio/performance/logs?${new URLSearchParams([...new URLSearchParams(query), ['shop', String(tenantId)]]).toString()}`
        const meter = (used: number, cap: number | null) => (cap && cap > 0 ? <div className="au-meter" aria-hidden><div style={{ width: `${Math.min(100, (used / cap) * 100)}%`, background: used >= cap ? 'var(--danger)' : undefined }} /></div> : null)

        return (
            <div className="page au-page">
                <div className="page-head">
                    <div>
                        <Link className="au-link" href={`/studio/performance${query ? `?${query}` : ''}`}><ArrowLeft size={14} />AI usage</Link>
                        <div className="au-title-wrap"><h1 className="page-title">{shop.name}</h1><PlanBadge plan={shop.plan} /></div>
                        <p className="page-sub">Shop #{shop.tenantId}{shop.ownerEmail ? ` · ${shop.ownerEmail}` : ''} · {rangeLabel(period)}</p>
                    </div>
                    <div className="page-actions au-actions"><Link className="btn btn-sm" href={logsHref}><List size={14} />View logs</Link></div>
                    <PeriodControls periodKey={period.key} rangeText={rangeLabel(period)} fromDay={period.fromDay} toDay={period.toDay} todayDay={today} />
                </div>

                <section className="card aiq-card">
                    <CardHead title="Limits and last 24 hours" sub={limits ? `${planName} plan limits${overridden ? ' with this shop\'s override' : ''}${aiOff ? '. AI is off for this shop' : ''}. Spend is rolling, last 24 hours.` : 'This shop has no plan on record yet, so no limits are shown.'} />
                    <div className="au-gen-kpis au-lim">
                        <div><div className="aiq-metric-label">AI budget / day</div><div className="aiq-metric-val">{aiOff ? 'AI off' : limits ? (limits.budgetUsd === null ? 'Unlimited' : `$${limits.budgetUsd}`) : '—'}</div></div>
                        <div><div className="aiq-metric-label">Pictures / day</div><div className="aiq-metric-val">{limits ? (limits.picturesPerDay === null ? 'Unlimited' : fmtInt(limits.picturesPerDay)) : '—'}</div></div>
                        <div><div className="aiq-metric-label">Spent, last 24 h</div><div className="aiq-metric-val">{fmtUsd(rolling.batteryUsd, 2)}</div>
                            {limits && meter(rolling.batteryUsd, limits.budgetUsd)}
                            <span className="au-dim">{limits?.budgetUsd == null ? `No daily budget${limits ? ` on ${planName}` : ''}.` : `${Math.round((rolling.batteryUsd / (limits.budgetUsd || 1)) * 100)}% of the daily budget. ${fmtInt(rolling.pictures)} ${rolling.pictures === 1 ? 'picture' : 'pictures'}.`}</span></div>
                        <div><div className="aiq-metric-label">Cost, {period.key === 'custom' ? 'period' : period.key.replace('d', ' days').replace('24h', '24 hours')}</div><div className="aiq-metric-val">{fmtUsd(totals.cost)}</div><span className="au-dim">{fmtInt(totals.calls)} calls · {fmtInt(totals.errors)} errors</span></div>
                    </div>
                </section>

                <ShopLimitCard tenantId={tenantId} shopName={shop.name} view={view} retryHref={self} />

                <section className="card aiq-card">
                    <CardHead title={period.bucket === 'hour' ? 'Cost per hour' : 'Cost per day'} sub={aiOff ? 'AI is off for this shop, so there is no budget line.' : limits?.budgetUsd == null ? `No budget line${limits ? `: ${overridden ? 'this shop is' : `${planName} is`} Unlimited` : ''}. A line shows here once a daily budget is set.` : 'Dashed line = daily AI budget.'} />
                    <DailyBars bars={series.map((s) => ({ key: s.key, label: bucketLabel(s.key, period.bucket, today), cost: s.cost, partial: s.key === today }))} budgetUsd={aiOff ? null : (limits?.budgetUsd ?? null)} />
                </section>

                <div className="au-two">
                    <section className="card aiq-card">
                        <CardHead title="By area" />
                        <div className="au-card-body">{areas.length === 0 ? <p className="au-dim">No calls in this period.</p> : (
                            <ul className="au-bars">{areas.map((a) => (
                                <li key={a.group}><div className="au-bars__top"><span>{AREA_GROUP_LABELS[a.group]}</span><b>{fmtUsd(a.cost)}</b></div>
                                    <div className="au-bars__track"><div className="au-bars__fill" style={{ width: `${areaMax > 0 ? (a.cost / areaMax) * 100 : 0}%` }} /></div></li>
                            ))}</ul>)}</div>
                    </section>
                    <section className="card aiq-card">
                        <CardHead title="By task" />
                        {tasks.length === 0 ? <p className="au-dim" style={{ padding: 24 }}>No calls in this period.</p> : (
                            <table className="tbl"><thead><tr><th>Task</th><th className="num">Calls</th><th className="num">Cost</th><th /></tr></thead>
                                <tbody>{tasks.map((t) => {
                                    const to = `${logsHref}&task=${encodeURIComponent(t.key)}`
                                    return <tr key={t.key}><td className="au-name"><Link className="au-name__main" href={to}>{t.label}</Link></td><td className="num">{fmtInt(t.calls)}</td><td className="num">{fmtUsd(t.cost)}</td>
                                        <td className="au-go"><Link href={to} aria-label={`Calls for ${t.label}`} className="au-rowlink"><ChevronRight size={14} /></Link></td></tr>
                                })}</tbody></table>)}
                    </section>
                </div>

                <section className="card aiq-card">
                    <CardHead title="Recent calls" action={<Link className="au-link" href={logsHref}>All calls of this shop<ChevronRight size={14} /></Link>} />
                    {recent.length === 0 ? <p className="au-dim" style={{ padding: 24 }}>No calls in this period.</p> : (
                        <table className="tbl"><thead><tr><th>Call</th><th className="num">Time</th><th className="num">Cost</th><th>Outcome</th><th /></tr></thead>
                            <tbody>{recent.map((r) => {
                                const to = `/studio/performance/logs?${new URLSearchParams([...new URLSearchParams(query), ['shop', String(tenantId)], ['log', String(r.id)]]).toString()}`
                                return <tr key={r.id}><td className="au-name"><Link className="au-name__main" href={to}>{r.taskLabel}</Link><span className="au-name__sub">{r.summary ?? '—'}</span></td>
                                    <td className="num">{fmtWhen(r.at)}</td><td className="num">{r.costUsd === null ? <UnpricedBadge /> : fmtUsd(r.costUsd, 4)}</td><td><OutcomeBadge outcome={r.outcome} /></td>
                                    <td className="au-go"><Link href={to} aria-label={`Open ${r.taskLabel}`} className="au-rowlink"><ChevronRight size={14} /></Link></td></tr>
                            })}</tbody></table>)}
                </section>

                <section className="card aiq-card">
                    <CardHead title="Errors" />
                    {errors.length === 0 ? <p className="au-dim" style={{ padding: 24 }}>No errors in this period.</p> : (
                        <table className="tbl"><thead><tr><th>Error</th><th className="num">Count</th><th className="num">Last seen</th></tr></thead>
                            <tbody>{errors.map((e) => (
                                <tr key={e.code}><td className="au-name"><span className="au-name__main au-mono">{e.code}</span>{e.label && <span className="au-name__sub">{e.label}</span>}{e.detail && <span className="au-name__sub au-mono au-errdetail" title={e.detail}>{e.detail}</span>}</td>
                                    <td className="num">{fmtInt(e.count)}</td><td className="num">{fmtWhen(e.lastSeen)}</td></tr>
                            ))}</tbody></table>)}
                </section>
            </div>
        )
    } catch (error) {
        // notFound() throws a control-flow error that Next handles; everything else is a real failure
        if (error && typeof error === 'object' && 'digest' in error && String((error as { digest?: unknown }).digest).startsWith('NEXT_')) throw error
        console.error('[ai-usage] shop failed', error)
        return <div className="page au-page"><ErrorState what="this shop's AI usage" retryHref={self} /></div>
    }
}
