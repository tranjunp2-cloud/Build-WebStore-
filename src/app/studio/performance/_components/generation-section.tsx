import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { fmtDuration, fmtInt, fmtUsd, fmtWhen } from '@/lib/admin/ai-usage/format'
import type { GenerationSection as Data } from '@/lib/admin/ai-usage/generation-queries'
import { CardHead, Delta, GoLink } from './au-parts'

function Stat({ label, value, unit, delta, sub }: { label: string; value: string; unit?: string; delta?: React.ReactNode; sub?: string }) {
    return (
        <div>
            <div className="aiq-metric-label">{label}</div>
            <div className="aiq-metric-val">{value}{unit && <span className="aiq-metric-unit">{unit}</span>}</div>
            {delta}{sub && <div className="au-dim au-small">{sub}</div>}
        </div>
    )
}

export function GenerationSection({ data, compare }: { data: Data; compare: boolean }) {
    const { current: c, previous: p, exclusions: x } = data
    const rate = c.successRate, prevRate = p.successRate
    const excluded = [
        x.running > 0 && `${fmtInt(x.running)} still running or stuck`,
        x.rejected > 0 && `${fmtInt(x.rejected)} rejected at the form`,
        x.otherEndpoints > 0 && `${fmtInt(x.otherEndpoints)} SEO meta and other runs`,
    ].filter(Boolean)
    return (
        <section className="card aiq-card">
            <CardHead title="Website generation" sub="Site generations from ai_generation_records. Success rate counts finished runs only." action={<GoLink href="/studio/generations">All failed generations</GoLink>} />
            {c.finished === 0 ? <p className="au-dim" style={{ padding: 24 }}>No finished website generations in this period.</p> : (
                <>
                    <div className="au-gen-kpis">
                        <Stat label="Finished" value={fmtInt(c.finished)} delta={compare ? <Delta current={c.finished} previous={p.finished} upIsGood /> : undefined} />
                        <Stat label="Success rate" value={rate === null ? '—' : rate.toFixed(1)} unit={rate === null ? undefined : '%'} delta={compare && rate !== null && prevRate !== null ? <Delta kind="pts" current={rate} previous={prevRate} upIsGood /> : undefined} />
                        <Stat label="Median time" value={fmtDuration(c.medianMs)} delta={compare && c.medianMs !== null && p.medianMs !== null ? <Delta current={c.medianMs} previous={p.medianMs} upIsGood={false} /> : undefined} />
                        <Stat label="Cost / success" value={c.costPerSuccess === null ? '—' : fmtUsd(c.costPerSuccess)} sub={c.costPerSuccess === null ? 'No cost or no success yet' : `${fmtUsd(c.websiteSetupCost)} ÷ ${fmtInt(c.succeeded)}`} />
                    </div>
                    <div className="au-gen-excl">Not counted: {excluded.length ? excluded.join(', ') : 'nothing'}.</div>
                </>
            )}
            <div className="au-two" style={{ gap: 0 }}>
                <div className="au-fails au-card-body">
                    <h3 className="au-h3">Why {fmtInt(data.failedTotal)} failed</h3>
                    {data.failReasons.length === 0 ? <p className="au-dim au-small">No failed generations.</p> : (
                        <ul className="au-bars" style={{ marginTop: 12 }}>
                            {data.failReasons.map((r) => {
                                const pct = data.failedTotal > 0 ? (r.count / data.failedTotal) * 100 : 0
                                return (
                                    <li key={r.code}>
                                        <div className="au-bars__top"><span className="au-mono">{r.code}</span><b>{fmtInt(r.count)} <span>{Math.round(pct)}%</span></b></div>
                                        <div className="au-bars__track"><div className="au-bars__fill" style={{ width: `${pct}%` }} /></div>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>
                <div>
                    <div className="card-head"><div className="card-title">Recent failed generations</div></div>
                    {data.recentFailed.length === 0 ? <p className="au-dim au-small" style={{ padding: 16 }}>None in this period.</p> : (
                        <table className="tbl"><thead><tr><th>Shop</th><th className="num">When</th><th className="num">Duration</th><th /></tr></thead>
                            <tbody>{data.recentFailed.map((r) => (
                                <tr key={r.id}>
                                    <td className="au-name"><Link className="au-name__main" href={`/studio/generations/${r.id}`}>{r.shop}</Link><span className="au-name__sub au-mono">{r.code}</span></td>
                                    <td className="num">{fmtWhen(r.at)}</td><td className="num">{fmtDuration(r.durationMs)}</td>
                                    <td className="au-go"><Link href={`/studio/generations/${r.id}`} aria-label={`Open generation ${r.id}`} className="au-rowlink"><ChevronRight size={14} /></Link></td>
                                </tr>
                            ))}</tbody></table>
                    )}
                </div>
            </div>
        </section>
    )
}
