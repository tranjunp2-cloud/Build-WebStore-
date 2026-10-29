import { fmtInt, fmtUsd } from '@/lib/admin/ai-usage/format'
import type { KpiTotals, SeriesPoint } from '@/lib/admin/ai-usage/overview-types'
import { Delta, Metric } from './au-parts'
import { Sparkline } from './sparkline'

const errorRate = (k: Pick<KpiTotals, 'errors' | 'calls'>) => (k.calls > 0 ? (k.errors / k.calls) * 100 : 0)
const cacheHit = (k: Pick<KpiTotals, 'cachedTokensIn' | 'tokensIn'>) => (k.tokensIn > 0 ? (k.cachedTokensIn / k.tokensIn) * 100 : 0)

type Props = { current: KpiTotals; previous: KpiTotals; series: SeriesPoint[]; compare: boolean }

export function KpiRow({ current, previous, series, compare }: Props) {
    const spark = (values: number[]) => <Sparkline data={values} width={160} height={28} />
    const d = (node: React.ReactNode) => (compare ? node : undefined)
    return (
        <>
            <section className="aiq-metrics" aria-label="Key figures">
                <Metric label="Total cost" value={fmtUsd(current.cost)} delta={d(<Delta current={current.cost} previous={previous.cost} upIsGood={false} />)} spark={spark(series.map((s) => s.cost))} />
                <Metric label="AI calls" value={fmtInt(current.calls)} delta={d(<Delta current={current.calls} previous={previous.calls} upIsGood />)} spark={spark(series.map((s) => s.calls))} />
                <Metric label="Active shops" value={fmtInt(current.shops)} delta={d(<Delta current={current.shops} previous={previous.shops} upIsGood />)} spark={spark(series.map((s) => s.shops))} />
                <Metric label="Error rate" value={errorRate(current).toFixed(1)} unit="%" delta={d(<Delta kind="pts" current={errorRate(current)} previous={errorRate(previous)} upIsGood={false} />)} spark={spark(series.map((s) => (s.calls ? (s.errors / s.calls) * 100 : 0)))} />
                <Metric label="Cache hit" value={cacheHit(current).toFixed(0)} unit="%" delta={d(<Delta kind="pts" current={cacheHit(current)} previous={cacheHit(previous)} upIsGood />)} spark={spark(series.map((s) => (s.tokensIn ? (s.cachedTokensIn / s.tokensIn) * 100 : 0)))} />
            </section>
            {current.unpriced > 0 && <p className="au-note">Cost leaves out {fmtInt(current.unpriced)} unpriced {current.unpriced === 1 ? 'call' : 'calls'} (model not in the price table).</p>}
        </>
    )
}
