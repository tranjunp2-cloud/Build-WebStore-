/** Everything the Overview screen shows, loaded in parallel. A failing part fails the whole load (the page shows one error state). */
import type { Payload } from 'payload'
import { getGenerationSection, type GenerationSection } from './generation-queries'
import { getBreakdown, getCostByArea, getErrorBreakdown, getKpiTotals, getPlanTable, getSeries, getTopShops } from './overview-queries'
import type { BreakdownRow, BucketByArea, ErrorRow, KpiTotals, PlanRow, SeriesPoint, TopShop, TopShopSort } from './overview-types'
import { getLimitsByGroup, type DailyLimits } from './plan-limits-read'
import type { Period } from './period'
import type { PlanGroup } from './groups'
import type { ReportsDb } from './sql-parts'

export interface OverviewData {
    current: KpiTotals
    previous: KpiTotals
    series: SeriesPoint[]
    costByArea: BucketByArea[]
    plans: PlanRow[]
    limits: Partial<Record<PlanGroup, DailyLimits>>
    shops: TopShop[]
    totalShops: number
    byTask: BreakdownRow[]
    byModel: BreakdownRow[]
    errors: ErrorRow[]
    generation: GenerationSection
}

export async function loadOverview(payload: Payload, period: Period, sort: TopShopSort): Promise<OverviewData> {
    const db = payload as unknown as ReportsDb
    const [current, previous, series, costByArea, plans, limits, top, byTask, byModel, errors, generation] = await Promise.all([
        getKpiTotals(db, period.start, period.end),
        getKpiTotals(db, period.prevStart, period.prevEnd),
        getSeries(db, period),
        getCostByArea(db, period),
        getPlanTable(db, period),
        getLimitsByGroup(payload),
        getTopShops(db, period, sort, 10),
        getBreakdown(db, period, 'task'),
        getBreakdown(db, period, 'model'),
        getErrorBreakdown(db, period),
        getGenerationSection(db, period),
    ])
    return { current, previous, series, costByArea, plans, limits, shops: top.shops, totalShops: top.totalShops, byTask, byModel, errors, generation }
}
