'use client'
/** Cost per bucket stacked by area group. Hover (or focus) a bar and the legend switches to that bucket's split. */
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AREA_GROUPS, AREA_GROUP_LABELS, type AreaGroup } from '@/lib/admin/ai-usage/groups'
import { fmtUsdShort } from '@/lib/admin/ai-usage/format'

export interface ChartBucket { key: string; label: string; total: number; byArea: Record<AreaGroup, number>; partial?: boolean }

// Legend order = stack order of the design: biggest-by-nature first
const COLOR: Record<AreaGroup, string> = {
    'website-setup': 'var(--a1)', pictures: 'var(--a2)', assistant: 'var(--a3)', writing: 'var(--a4)', migration: 'var(--a5)', background: 'var(--a6)',
}

export function CostChart({ data }: { data: ChartBucket[] }) {
    const [active, setActive] = useState<string | null>(null)
    const shown = data.find((d) => d.key === active)
    const totals = AREA_GROUPS.map((g) => ({ g, v: shown ? shown.byArea[g] : data.reduce((s, d) => s + d.byArea[g], 0) }))
    const sum = totals.reduce((s, t) => s + t.v, 0)
    const rows = data.map((d) => ({ key: d.key, label: d.label, ...d.byArea, total: d.total }))
    const hasData = sum > 0 || data.some((d) => d.total > 0)

    return (
        <div className="au-card-body">
            <ul className="au-legend" aria-label="Cost by area">
                <li className="au-legend__when">{shown ? `${shown.label}: ${fmtUsdShort(shown.total)}` : 'Whole period. Hover a bar to see its split.'}</li>
                {totals.map(({ g, v }) => (
                    <li key={g}><i style={{ background: COLOR[g] }} />{AREA_GROUP_LABELS[g]} <b>{fmtUsdShort(v)}</b> <span className="au-dim">{sum > 0 ? `${((v / sum) * 100).toFixed(1)}%` : '0%'}</span></li>
                ))}
            </ul>
            <div className="au-chart au-chart-wrap" role="img" aria-label="Cost per day by area">
                {hasData ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={rows} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} onMouseMove={(s) => setActive(s?.activeIndex !== undefined && s.activeIndex !== null ? (rows[Number(s.activeIndex)]?.key ?? null) : null)} onMouseLeave={() => setActive(null)}>
                            <CartesianGrid vertical={false} stroke="var(--border)" />
                            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--border-strong)' }} tick={{ fontSize: 11, fill: 'var(--text-3)' }} interval="preserveStartEnd" />
                            <YAxis tickLine={false} axisLine={false} width={48} tick={{ fontSize: 11, fill: 'var(--text-3)' }} tickFormatter={(v: number) => `$${v}`} />
                            <Tooltip cursor={{ fill: 'var(--bg-hover)' }} content={<ChartTip />} />
                            {AREA_GROUPS.map((g) => <Bar key={g} dataKey={g} stackId="cost" fill={COLOR[g]} maxBarSize={44} isAnimationActive={false} />)}
                        </BarChart>
                    </ResponsiveContainer>
                ) : <p className="au-dim" style={{ padding: 24 }}>No priced cost in this period.</p>}
            </div>
        </div>
    )
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: { total: number } }>; label?: string }) {
    if (!active || !payload?.length) return null
    return <div className="au-tip"><b>{label}</b> {fmtUsdShort(payload[0].payload.total)}</div>
}
