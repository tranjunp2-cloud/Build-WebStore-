/**
 * /studio/performance — AI usage overview: cost, calls, errors, plans, top shops, tasks/models and website generation.
 * Everything comes from `ai_usage_logs` (+ `ai_generation_records` for the generation section), in Malaysia time.
 * ?period=24h|7d|30d|90d (default 7d) or ?from&to, ?compare=0, ?sort=cost|calls|avg|max|errors
 */
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import config from '@payload-config'
import { getPayload } from 'payload'
import { requireStudioAccess } from '@/lib/admin/auth-guard'
import { loadCapsStatus, type CapsStatus } from '@/lib/admin/ai-caps/status'
import { bucketLabel, first, klDay, periodQuery, previousRangeLabel, rangeLabel, resolvePeriod } from '@/lib/admin/ai-usage/period'
import { loadOverview } from '@/lib/admin/ai-usage/overview-loader'
import { TOP_SHOP_SORTS, type TopShopSort } from '@/lib/admin/ai-usage/overview-types'
import './ai-usage.css'
import { ErrorState } from './_components/au-parts'
import { CostChart } from './_components/cost-chart'
import { GenerationSection } from './_components/generation-section'
import { KpiRow } from './_components/kpi-row'
import { LimitsPanel } from './_components/limits-panel'
import { PeriodControls } from './_components/period-controls'
import { CardHead } from './_components/au-parts'
import { ErrorsTable, PlanTable, TopShopsTable } from './_components/overview-tables'
import { TaskModelCard } from './_components/task-model-card'

export const metadata: Metadata = { title: 'AI usage' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AiUsagePage({ searchParams }: { searchParams: SearchParams }) {
    await requireStudioAccess()
    const sp = await searchParams
    const period = resolvePeriod(sp)
    const compare = first(sp.compare) !== '0'
    const sortParam = first(sp.sort)
    const sort: TopShopSort = (TOP_SHOP_SORTS as readonly string[]).includes(sortParam ?? '') ? (sortParam as TopShopSort) : 'cost'
    const now = new Date()
    const today = klDay(now)
    const query = periodQuery(period)
    const exportHref = `/api/admin/ai-usage/export${query.toString() ? `?${query.toString()}` : ''}`

    // the limits block and the usage numbers load apart: one failing leaves the other on screen
    const [data, caps] = await Promise.all([
        getPayload({ config }).then((payload) => loadOverview(payload, period, sort)).catch((error: unknown) => {
            console.error('[ai-usage] overview failed', error)
            return null
        }),
        loadCapsStatus().catch((error: unknown): CapsStatus | null => {
            console.error('[ai-usage] caps status failed', error)
            return null
        }),
    ])
    const retryHref = `/studio/performance${query.toString() ? `?${query.toString()}` : ''}`
    const limits = <LimitsPanel status={caps} retryHref={retryHref} />

    return (
        <div className="page au-page">
            <div className="page-head">
                <div><h1 className="page-title">AI usage &amp; quality</h1><p className="page-sub">What AI costs across all shops, where it errors, and how website generation is doing.</p></div>
                <PeriodControls periodKey={period.key} rangeText={rangeLabel(period)} fromDay={period.fromDay} toDay={period.toDay} todayDay={today}
                    compare={{ on: compare, text: previousRangeLabel(period) }} exportHref={exportHref} />
            </div>
            {!data ? <><ErrorState what="AI usage" retryHref={retryHref} />{limits}</> : (
                <>
                    <KpiRow current={data.current} previous={data.previous} series={data.series} compare={compare} />
                    {limits}
                    <section className="card aiq-card">
                        <CardHead title={period.bucket === 'hour' ? 'Cost per hour, by area' : 'Cost per day, by area'} sub="Split by where the AI was used." />
                        <CostChart data={data.costByArea.map((b) => ({ ...b, label: bucketLabel(b.key, period.bucket, today) }))} />
                    </section>
                    <PlanTable rows={data.plans} limits={data.limits} />
                    <TopShopsTable shops={data.shops} total={data.totalShops} sort={sort} query={query} />
                    <TaskModelCard tasks={data.byTask} models={data.byModel} logsQuery={query.toString()} />
                    <ErrorsTable rows={data.errors} errors={data.current.errors} refused={data.current.refused} calls={data.current.calls} logsQuery={query.toString()} />
                    <GenerationSection data={data.generation} compare={compare} />
                </>
            )}
        </div>
    )
}
