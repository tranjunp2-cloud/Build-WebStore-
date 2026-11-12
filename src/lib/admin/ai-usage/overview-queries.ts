/** Aggregate queries behind /studio/performance. All read `ai_usage_logs`; NULL cost = unpriced, never counted as 0 calls. */
import { sql } from 'drizzle-orm'
import { areaGroupSql, AREA_GROUPS, isAreaGroup, isPlanGroup, planGroupSql, type AreaGroup } from './groups'
import { num, numOrNull } from './format'
import type { Period } from './period'
import { bucketSql, daySql, inWindow, isErrorSql, rowsOf, tenantScope, type ReportsDb } from './sql-parts'
import type { BreakdownRow, BucketByArea, ErrorRow, KpiTotals, PlanRow, SeriesPoint, TopShop, TopShopSort } from './overview-types'

type Row = Record<string, unknown>

export async function getKpiTotals(db: ReportsDb, start: Date, end: Date): Promise<KpiTotals> {
    const [row] = await rowsOf<Row>(db, sql`
        SELECT COALESCE(SUM(cost_usd), 0) AS cost, COUNT(*) AS calls, COUNT(DISTINCT tenant_id) AS shops,
               COUNT(*) FILTER (WHERE ${isErrorSql()}) AS errors, COUNT(*) FILTER (WHERE outcome = 'refused') AS refused,
               COALESCE(SUM(tokens_in), 0) AS tokens_in, COALESCE(SUM(cached_tokens_in), 0) AS cached,
               COUNT(*) FILTER (WHERE cost_usd IS NULL) AS unpriced
        FROM ai_usage_logs WHERE ${inWindow(start, end)}`)
    return {
        cost: num(row?.cost), calls: num(row?.calls), shops: num(row?.shops), errors: num(row?.errors),
        refused: num(row?.refused), tokensIn: num(row?.tokens_in), cachedTokensIn: num(row?.cached), unpriced: num(row?.unpriced),
    }
}

/** One point per bucket of the period (zero-filled), for the KPI sparklines. */
export async function getSeries(db: ReportsDb, period: Period): Promise<SeriesPoint[]> {
    const rows = await rowsOf<Row>(db, sql`
        SELECT ${bucketSql(period.bucket)} AS bucket, COALESCE(SUM(cost_usd), 0) AS cost, COUNT(*) AS calls,
               COUNT(DISTINCT tenant_id) AS shops, COUNT(*) FILTER (WHERE ${isErrorSql()}) AS errors,
               COALESCE(SUM(tokens_in), 0) AS tokens_in, COALESCE(SUM(cached_tokens_in), 0) AS cached
        FROM ai_usage_logs WHERE ${inWindow(period.start, period.end)} GROUP BY 1`)
    const byKey = new Map(rows.map((r) => [String(r.bucket), r]))
    return period.buckets.map((key) => {
        const r = byKey.get(key)
        return { key, cost: num(r?.cost), calls: num(r?.calls), shops: num(r?.shops), errors: num(r?.errors), tokensIn: num(r?.tokens_in), cachedTokensIn: num(r?.cached) }
    })
}

const emptyAreas = (): Record<AreaGroup, number> => Object.fromEntries(AREA_GROUPS.map((g) => [g, 0])) as Record<AreaGroup, number>

/** Cost per bucket split by area group, zero-filled. */
export async function getCostByArea(db: ReportsDb, period: Period): Promise<BucketByArea[]> {
    const rows = await rowsOf<Row>(db, sql`
        SELECT ${bucketSql(period.bucket)} AS bucket, ${areaGroupSql()} AS grp, COALESCE(SUM(cost_usd), 0) AS cost
        FROM ai_usage_logs WHERE ${inWindow(period.start, period.end)} GROUP BY 1, 2`)
    const out = new Map<string, BucketByArea>(period.buckets.map((key) => [key, { key, total: 0, byArea: emptyAreas() }]))
    for (const r of rows) {
        const slot = out.get(String(r.bucket))
        if (!slot) continue
        const group = isAreaGroup(r.grp) ? r.grp : 'assistant'
        slot.byArea[group] += num(r.cost)
        slot.total += num(r.cost)
    }
    return [...out.values()]
}

/** Cost of one shop on one day, per plan group: p50 / p90 / max across all active shop-days (percentile_cont). */
export async function getPlanTable(db: ReportsDb, period: Period): Promise<PlanRow[]> {
    const rows = await rowsOf<Row>(db, sql`
        WITH per_day AS (
            SELECT tenant_id, ${planGroupSql()} AS plan_group, ${daySql()} AS day, COALESCE(SUM(cost_usd), 0) AS cost
            FROM ai_usage_logs WHERE ${inWindow(period.start, period.end)} AND tenant_id IS NOT NULL GROUP BY 1, 2, 3)
        SELECT plan_group, COUNT(DISTINCT tenant_id) AS shops, SUM(cost) AS cost,
               percentile_cont(0.5) WITHIN GROUP (ORDER BY cost) AS p50,
               percentile_cont(0.9) WITHIN GROUP (ORDER BY cost) AS p90, MAX(cost) AS max
        FROM per_day GROUP BY plan_group`)
    return rows.map((r) => ({
        plan: isPlanGroup(r.plan_group) ? r.plan_group : 'unknown', shops: num(r.shops), cost: num(r.cost),
        p50: numOrNull(r.p50), p90: numOrNull(r.p90), max: numOrNull(r.max),
    }))
}

const SORT_SQL = {
    cost: sql`cost`, calls: sql`calls`, avg: sql`avg_day`, max: sql`max_day`, errors: sql`errors`,
} as const

export async function getTopShops(db: ReportsDb, period: Period, sort: TopShopSort, limit: number): Promise<{ shops: TopShop[]; totalShops: number }> {
    const rows = await rowsOf<Row>(db, sql`
        WITH per_day AS (
            SELECT tenant_id, ${daySql()} AS day, COALESCE(SUM(cost_usd), 0) AS cost, COUNT(*) AS calls,
                   COUNT(*) FILTER (WHERE ${isErrorSql()}) AS errors,
                   (array_agg(${planGroupSql()} ORDER BY created_at DESC) FILTER (WHERE plan IS NOT NULL))[1] AS plan_group
            FROM ai_usage_logs WHERE ${inWindow(period.start, period.end)} AND tenant_id IS NOT NULL GROUP BY 1, 2),
        agg AS (
            SELECT tenant_id, SUM(cost) AS cost, SUM(calls) AS calls, SUM(errors) AS errors,
                   SUM(cost) / COUNT(*) AS avg_day, MAX(cost) AS max_day,
                   (array_agg(day ORDER BY cost DESC))[1] AS max_day_key,
                   (array_agg(plan_group ORDER BY day DESC) FILTER (WHERE plan_group IS NOT NULL))[1] AS plan_group
            FROM per_day GROUP BY tenant_id)
        SELECT agg.*, t.name, COUNT(*) OVER () AS total
        FROM agg LEFT JOIN tenants t ON t.id = agg.tenant_id
        ORDER BY ${SORT_SQL[sort]} DESC, agg.tenant_id ASC LIMIT ${limit}`)
    return {
        totalShops: num(rows[0]?.total),
        shops: rows.map((r) => ({
            tenantId: num(r.tenant_id), name: r.name ? String(r.name) : `Shop #${num(r.tenant_id)}`,
            plan: isPlanGroup(r.plan_group) ? r.plan_group : 'unknown', cost: num(r.cost), calls: num(r.calls),
            avgPerDay: num(r.avg_day), maxDay: num(r.max_day), maxDayKey: r.max_day_key ? String(r.max_day_key) : null, errors: num(r.errors),
        })),
    }
}

/** By task (grouped on the task id, labelled with its readable name) or by model. */
export async function getBreakdown(db: ReportsDb, period: Period, by: 'task' | 'model', limit = 8, tenantId?: number): Promise<BreakdownRow[]> {
    const key = by === 'task' ? sql`COALESCE(task, 'unknown')` : sql`model`
    const label = by === 'task' ? sql`COALESCE(MAX(task_label), MAX(task), 'Unknown')` : sql`MAX(model)`
    const sub = by === 'task' ? sql`mode() WITHIN GROUP (ORDER BY ${areaGroupSql()})` : sql`MAX(provider)`
    const rows = await rowsOf<Row>(db, sql`
        SELECT ${key} AS k, ${label} AS label, ${sub} AS sub, COUNT(*) AS calls, COUNT(*) FILTER (WHERE cost_usd IS NULL) AS unpriced,
               COALESCE(SUM(cost_usd), 0) AS cost, COUNT(cost_usd) AS priced_calls,
               SUM(cached_tokens_in) AS cached, SUM(tokens_in) AS tokens_in, COUNT(*) FILTER (WHERE ${isErrorSql()}) AS errors
        FROM ai_usage_logs WHERE ${inWindow(period.start, period.end)}${tenantScope(tenantId)} GROUP BY 1 ORDER BY cost DESC, calls DESC LIMIT ${limit}`)
    return rows.map((r) => {
        const calls = num(r.calls), priced = num(r.priced_calls), tokensIn = num(r.tokens_in)
        return {
            key: String(r.k), label: String(r.label), sub: r.sub ? String(r.sub) : null, calls, unpriced: num(r.unpriced),
            avgPerCall: priced > 0 ? num(r.cost) / priced : null, cost: num(r.cost),
            cacheHit: r.cached === null || tokensIn <= 0 ? null : (num(r.cached) / tokensIn) * 100,
            errorRate: calls > 0 ? (num(r.errors) / calls) * 100 : 0,
        }
    })
}

export async function getErrorBreakdown(db: ReportsDb, period: Period, limit = 8): Promise<ErrorRow[]> {
    const rows = await rowsOf<Row>(db, sql`
        SELECT COALESCE(error_code, 'unknown') AS code, model, MAX(provider) AS provider, MAX(error_label) AS label,
               COUNT(*) AS n, MAX(created_at) AS last_seen, (ARRAY_AGG(error_detail ORDER BY created_at DESC) FILTER (WHERE error_detail IS NOT NULL))[1] AS detail
        FROM ai_usage_logs WHERE ${inWindow(period.start, period.end)} AND ${isErrorSql()} GROUP BY 1, 2
        ORDER BY n DESC, last_seen DESC LIMIT ${limit}`)
    return rows.map((r) => ({
        code: String(r.code), label: r.label ? String(r.label) : null,
        model: r.provider ? `${String(r.provider)}:${String(r.model)}` : String(r.model),
        count: num(r.n), lastSeen: new Date(String(r.last_seen)).toISOString(), detail: r.detail ? String(r.detail) : null,
    }))
}
