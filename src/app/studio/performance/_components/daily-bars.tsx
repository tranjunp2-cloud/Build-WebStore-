/** Cost per day for one shop as plain bars, with the plan's daily AI budget as a dashed line when it has one. */
import { fmtUsdShort } from '@/lib/admin/ai-usage/format'

export interface DailyBar { key: string; label: string; cost: number; partial?: boolean }

function niceMax(value: number): number {
    if (value <= 0) return 1
    const pow = 10 ** Math.floor(Math.log10(value))
    const n = value / pow
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow
}

export function DailyBars({ bars, budgetUsd }: { bars: DailyBar[]; budgetUsd: number | null }) {
    // at most ~10 labels: 30 / 90 day ranges would otherwise run past the card edge
    const labelStep = Math.max(1, Math.ceil(bars.length / 10))
    const max = niceMax(Math.max(...bars.map((b) => b.cost), budgetUsd ?? 0))
    const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`
    return (
        <div className="au-card-body" role="img" aria-label="Cost per day">
            <div className="au-mini-chart">
                {[0.25, 0.5, 0.75, 1].map((f) => <div key={f} className="au-gl" style={{ bottom: `${f * 100}%` }}><span>{fmtUsdShort(max * f)}</span></div>)}
                {budgetUsd !== null && budgetUsd > 0 && <div className="au-budget" style={{ bottom: pct(budgetUsd) }}><span>Budget {fmtUsdShort(budgetUsd)} / day</span></div>}
                <div className="au-cols">
                    {bars.map((b) => (
                        <div key={b.key} className="au-colw">
                            <span className="au-colv">{b.cost > 0 ? fmtUsdShort(b.cost) : ''}</span>
                            <div className={`au-colb${b.partial ? ' au-part' : ''}${budgetUsd !== null && b.cost > budgetUsd ? ' au-over' : ''}`} style={{ height: pct(b.cost), minHeight: b.cost > 0 ? 2 : 0 }} />
                        </div>
                    ))}
                </div>
                <div className="au-colx">{bars.map((b, i) => <span key={b.key}>{i % labelStep === 0 || i === bars.length - 1 ? b.label : ''}</span>)}</div>
            </div>
        </div>
    )
}
