'use client'
/** "By task" / "By model" breakdown: both lists are fetched on the server, the tab only switches which one shows. */
import Link from 'next/link'
import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { AREA_GROUP_LABELS, isAreaGroup } from '@/lib/admin/ai-usage/groups'
import { fmtInt, fmtUsd } from '@/lib/admin/ai-usage/format'
import type { BreakdownRow } from '@/lib/admin/ai-usage/overview-types'

type Props = { tasks: BreakdownRow[]; models: BreakdownRow[]; logsQuery: string }

export function TaskModelCard({ tasks, models, logsQuery }: Props) {
    const [tab, setTab] = useState<'task' | 'model'>('task')
    const rows = tab === 'task' ? tasks : models
    const link = (row: BreakdownRow) => {
        const q = new URLSearchParams(logsQuery)
        q.set(tab, row.key)
        return `/studio/performance/logs?${q.toString()}`
    }
    return (
        <section className="card aiq-card">
            <div className="card-head aiq-card-head" style={{ justifyContent: 'space-between' }}>
                <div>
                    <div className="card-title">{tab === 'task' ? 'By task' : 'By model'}</div>
                    <div className="card-sub">Avg / call counts priced calls only. Cache = cached share of input tokens.</div>
                </div>
                <div className="au-tabs2" role="tablist" aria-label="Group by">
                    {(['task', 'model'] as const).map((t) => (
                        <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>By {t}</button>
                    ))}
                </div>
            </div>
            {rows.length === 0 ? <p className="au-dim" style={{ padding: 24 }}>No calls in this period.</p> : (
                <div className="au-tbl-scroll">
                    <table className="tbl">
                        <thead><tr>
                            <th>{tab === 'task' ? 'Task' : 'Model'}</th><th>{tab === 'task' ? 'Area' : 'Provider'}</th>
                            <th className="num">Calls</th><th className="num">Avg / call</th><th className="num">Total cost</th>
                            <th className="num">Cache</th><th className="num">Error %</th><th />
                        </tr></thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.key}>
                                    <td className="au-name"><Link className="au-name__main" href={link(r)}>{r.label}</Link>{r.unpriced > 0 && <span className="au-name__sub">{fmtInt(r.unpriced)} {r.unpriced === 1 ? 'call' : 'calls'} unpriced</span>}</td>
                                    <td>{tab === 'task' ? (isAreaGroup(r.sub) ? AREA_GROUP_LABELS[r.sub] : '—') : (r.sub ?? '—')}</td>
                                    <td className="num">{fmtInt(r.calls)}</td>
                                    <td className="num">{r.avgPerCall === null ? 'n/a' : fmtUsd(r.avgPerCall, 4)}</td>
                                    <td className="num">{fmtUsd(r.cost)}</td>
                                    <td className="num">{r.cacheHit === null ? 'n/a' : `${Math.round(r.cacheHit)}%`}</td>
                                    <td className="num">{r.errorRate.toFixed(1)}%</td>
                                    <td className="au-go"><Link href={link(r)} aria-label={`Calls for ${r.label}`} className="au-rowlink"><ChevronRight size={14} /></Link></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    )
}
