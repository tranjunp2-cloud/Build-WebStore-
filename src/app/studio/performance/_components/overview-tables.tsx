/** Plan, top-shops and error tables of the Overview (server components, no client state). */
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { KNOWN_PLAN_GROUPS, PLAN_GROUP_LABELS, type PlanGroup } from '@/lib/admin/ai-usage/groups'
import { fmtInt, fmtUsd, fmtWhen } from '@/lib/admin/ai-usage/format'
import type { DailyLimits } from '@/lib/admin/ai-usage/plan-limits-read'
import { TOP_SHOP_SORTS, type ErrorRow, type PlanRow, type TopShop, type TopShopSort } from '@/lib/admin/ai-usage/overview-types'
import { CardHead, GoLink, PlanBadge } from './au-parts'

const budgetText = (l?: DailyLimits) => (!l ? '—' : `${l.budgetUsd === null ? 'Unlimited' : `$${l.budgetUsd.toFixed(2)}`}${l.varies ? ' (varies)' : ''}`)

export function PlanTable({ rows, limits }: { rows: PlanRow[]; limits: Partial<Record<PlanGroup, DailyLimits>> }) {
    const byPlan = new Map(rows.map((r) => [r.plan, r]))
    const shown = [...KNOWN_PLAN_GROUPS, ...(byPlan.has('unknown') ? (['unknown'] as PlanGroup[]) : [])]
    return (
        <section className="card aiq-card">
            <CardHead title="Cost per shop per day, by plan" sub="Cost of one shop on one active day. Percentiles are across all shop-days of the plan." action={<GoLink href="/studio/settings/ai">Edit limits</GoLink>} />
            <div className="au-tbl-scroll"><table className="tbl">
                <thead><tr><th>Plan</th><th className="num">Shops</th><th className="num">Cost</th><th className="num">P50 / shop / day</th><th className="num">P90 / shop / day</th><th className="num">Max / shop / day</th><th className="num">Daily AI budget</th></tr></thead>
                <tbody>{shown.map((plan) => {
                    const r = byPlan.get(plan)
                    return (
                        <tr key={plan}>
                            <td><strong>{PLAN_GROUP_LABELS[plan]}</strong></td>
                            <td className="num">{r ? fmtInt(r.shops) : 0}</td><td className="num">{fmtUsd(r?.cost ?? 0)}</td>
                            <td className="num">{r?.p50 == null ? '—' : fmtUsd(r.p50, 3)}</td><td className="num">{r?.p90 == null ? '—' : fmtUsd(r.p90, 3)}</td><td className="num">{r?.max == null ? '—' : fmtUsd(r.max, 3)}</td>
                            <td className="num">{plan === 'unknown' ? '—' : budgetText(limits[plan])}</td>
                        </tr>
                    )
                })}</tbody>
            </table></div>
            <div className="au-foot"><span>Plan codes are grouped: STARTER_TM_USER and STARTER_NON_TM_USER count as Starter, and so on. Older calls without a plan show as Unknown.</span></div>
        </section>
    )
}

const SORT_LABEL: Record<TopShopSort, string> = { cost: 'Cost', calls: 'Calls', avg: 'Avg / day', max: 'Max day', errors: 'Errors' }

export function TopShopsTable({ shops, total, sort, query }: { shops: TopShop[]; total: number; sort: TopShopSort; query: URLSearchParams }) {
    const href = (s: TopShopSort) => { const q = new URLSearchParams(query); q.set('sort', s); return `?${q.toString()}` }
    const logs = `/studio/performance/logs${query.toString() ? `?${query.toString()}` : ''}`
    return (
        <section className="card aiq-card">
            <CardHead title="Top shops by cost" sub="Click a shop to see its spend, limits and calls." />
            {shops.length === 0 ? <p className="au-dim" style={{ padding: 24 }}>No shop used AI in this period.</p> : (
                <div className="au-tbl-scroll"><table className="tbl">
                    <thead><tr><th>Shop</th><th>Plan</th>{TOP_SHOP_SORTS.map((s) => (
                        <th key={s} className="num" aria-sort={s === sort ? 'descending' : undefined}><Link href={href(s)} aria-current={s === sort} scroll={false}>{SORT_LABEL[s]}{s === sort ? ' ↓' : ''}</Link></th>
                    ))}<th /></tr></thead>
                    <tbody>{shops.map((s) => {
                        const to = `/studio/performance/shops/${s.tenantId}${query.toString() ? `?${query.toString()}` : ''}`
                        return (
                            <tr key={s.tenantId}>
                                <td className="au-name"><Link className="au-name__main" href={to}>{s.name}</Link></td>
                                <td><PlanBadge plan={s.plan} /></td>
                                <td className="num">{fmtUsd(s.cost)}</td><td className="num">{fmtInt(s.calls)}</td>
                                <td className="num">{fmtUsd(s.avgPerDay, 3)}</td>
                                <td className="num">{fmtUsd(s.maxDay)} <span className="au-dim">{s.maxDayKey ? s.maxDayKey.slice(8, 10) + '/' + s.maxDayKey.slice(5, 7) : ''}</span></td>
                                <td className="num">{s.errors > 0 ? <span className="au-warn">{fmtInt(s.errors)}</span> : 0}</td>
                                <td className="au-go"><Link href={to} aria-label={`Open ${s.name}`} className="au-rowlink"><ChevronRight size={14} /></Link></td>
                            </tr>
                        )
                    })}</tbody>
                </table></div>
            )}
            <div className="au-foot"><span>Top {fmtInt(shops.length)} of {fmtInt(total)} shops with AI calls</span><GoLink href={logs}>Open all calls in Logs</GoLink></div>
        </section>
    )
}

export function ErrorsTable({ rows, errors, refused, calls, logsQuery }: { rows: ErrorRow[]; errors: number; refused: number; calls: number; logsQuery: string }) {
    return (
        <section className="card aiq-card">
            <CardHead title="Errors by code and model" sub={`${fmtInt(errors)} errors, ${calls > 0 ? ((errors / calls) * 100).toFixed(1) : '0.0'}% of calls.${refused > 0 ? ` ${fmtInt(refused)} more calls returned no result (not counted).` : ''}`} />
            {rows.length === 0 ? <p className="au-dim" style={{ padding: 24 }}>No errors in this period.</p> : (
                <div className="au-tbl-scroll"><table className="tbl">
                    <thead><tr><th>Error</th><th>Model</th><th className="num">Count</th><th className="num">Last seen</th><th /></tr></thead>
                    <tbody>{rows.map((r) => {
                        const q = new URLSearchParams(logsQuery); q.set('outcome', 'error'); q.set('model', r.model.includes(':') ? r.model.split(':').slice(1).join(':') : r.model)
                        const to = `/studio/performance/logs?${q.toString()}`
                        return (
                            <tr key={`${r.code}|${r.model}`}>
                                <td className="au-name"><Link className="au-name__main au-mono" href={to}>{r.code}</Link>{r.label && <span className="au-name__sub">{r.label}</span>}</td>
                                <td className="au-mono">{r.model}</td><td className="num">{fmtInt(r.count)}</td><td className="num">{fmtWhen(r.lastSeen)}</td>
                                <td className="au-go"><Link href={to} aria-label={`Calls with ${r.code}`} className="au-rowlink"><ChevronRight size={14} /></Link></td>
                            </tr>
                        )
                    })}</tbody>
                </table></div>
            )}
        </section>
    )
}
