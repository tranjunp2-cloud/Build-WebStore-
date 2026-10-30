/** Queries for /studio/performance/shops/[tenantId]. Every one is scoped to a single `tenant_id` parameter. */
import { sql } from 'drizzle-orm'
import { areaGroupSql, isAreaGroup, planGroupOf, type AreaGroup, type PlanGroup } from './groups'
import { num } from './format'
import type { Period } from './period'
import { bucketSql, inWindow, isErrorSql, rowsOf, type ReportsDb } from './sql-parts'
import type { SeriesPoint } from './overview-types'

type Row = Record<string, unknown>

export interface ShopHeader { tenantId: number; name: string; ownerEmail: string | null; plan: PlanGroup; planCode: string | null }

/** null when the shop does not exist. Plan and contact come from the shop's latest AI call. */
export async function getShopHeader(db: ReportsDb, tenantId: number): Promise<ShopHeader | null> {
    const [tenant] = await rowsOf<Row>(db, sql`SELECT id, name FROM tenants WHERE id = ${tenantId} LIMIT 1`)
    if (!tenant) return null
    const [latest] = await rowsOf<Row>(db, sql`
        SELECT (SELECT plan FROM ai_usage_logs WHERE tenant_id = ${tenantId} AND plan IS NOT NULL ORDER BY created_at DESC LIMIT 1) AS plan,
               (SELECT u.email FROM ai_usage_logs l JOIN users u ON u.id = l.user_id WHERE l.tenant_id = ${tenantId} ORDER BY l.created_at DESC LIMIT 1) AS email`)
    const planCode = latest?.plan ? String(latest.plan) : null
    return { tenantId, name: tenant.name ? String(tenant.name) : `Shop #${tenantId}`, ownerEmail: latest?.email ? String(latest.email) : null, plan: planGroupOf(planCode), planCode }
}

export interface ShopRolling24h { batteryUsd: number; pictures: number }

/** What the shop used from its limits over the last 24 hours: battery USD (pictures count separately) and pictures. */
export async function getShopRolling24h(db: ReportsDb, tenantId: number, now: Date = new Date()): Promise<ShopRolling24h> {
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const [r] = await rowsOf<Row>(db, sql`
        SELECT COALESCE(SUM(battery_cost_usd) FILTER (WHERE feature IS DISTINCT FROM 'pictures'), 0) AS battery,
               COUNT(*) FILTER (WHERE feature = 'pictures' AND ${isErrorSql()} IS NOT TRUE) AS pictures
        FROM ai_usage_logs WHERE tenant_id = ${tenantId} AND ${inWindow(since, now)}`)
    return { batteryUsd: num(r?.battery), pictures: num(r?.pictures) }
}

export async function getShopSeries(db: ReportsDb, tenantId: number, period: Period): Promise<SeriesPoint[]> {
    const rows = await rowsOf<Row>(db, sql`
        SELECT ${bucketSql(period.bucket)} AS bucket, COALESCE(SUM(cost_usd), 0) AS cost, COUNT(*) AS calls
        FROM ai_usage_logs WHERE tenant_id = ${tenantId} AND ${inWindow(period.start, period.end)} GROUP BY 1`)
    const byKey = new Map(rows.map((r) => [String(r.bucket), r]))
    return period.buckets.map((key) => ({ key, cost: num(byKey.get(key)?.cost), calls: num(byKey.get(key)?.calls), shops: 0, errors: 0, tokensIn: 0, cachedTokensIn: 0 }))
}

export async function getShopAreas(db: ReportsDb, tenantId: number, period: Period): Promise<Array<{ group: AreaGroup; cost: number }>> {
    const rows = await rowsOf<Row>(db, sql`
        SELECT ${areaGroupSql()} AS grp, COALESCE(SUM(cost_usd), 0) AS cost FROM ai_usage_logs
        WHERE tenant_id = ${tenantId} AND ${inWindow(period.start, period.end)} GROUP BY 1 ORDER BY cost DESC`)
    return rows.filter((r) => isAreaGroup(r.grp)).map((r) => ({ group: r.grp as AreaGroup, cost: num(r.cost) }))
}

export interface ShopError { code: string; label: string | null; count: number; lastSeen: string }

export async function getShopErrors(db: ReportsDb, tenantId: number, period: Period): Promise<ShopError[]> {
    const rows = await rowsOf<Row>(db, sql`
        SELECT COALESCE(error_code, 'unknown') AS code, MAX(error_label) AS label, COUNT(*) AS n, MAX(created_at) AS last_seen
        FROM ai_usage_logs WHERE tenant_id = ${tenantId} AND ${inWindow(period.start, period.end)} AND ${isErrorSql()}
        GROUP BY 1 ORDER BY n DESC, last_seen DESC LIMIT 10`)
    return rows.map((r) => ({ code: String(r.code), label: r.label ? String(r.label) : null, count: num(r.n), lastSeen: new Date(String(r.last_seen)).toISOString() }))
}
