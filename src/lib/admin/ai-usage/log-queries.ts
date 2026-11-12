/** Row-level queries for the Logs screen, the log drawer, the shop screen's recent calls and the CSV export. */
import { sql } from 'drizzle-orm'
import { areaGroupOf, planGroupOf, type AreaGroup, type PlanGroup } from './groups'
import { num, numOrNull } from './format'
import { buildLogWhere, type LogFilters, type Outcome } from './log-filters'
import type { Period } from './period'
import { inWindow, isErrorSql, rowsOf, type ReportsDb } from './sql-parts'

type Row = Record<string, unknown>

export interface LogRow {
    id: number
    at: string
    tenantId: number | null
    shop: string | null
    userEmail: string | null
    plan: PlanGroup
    planCode: string | null
    areaGroup: AreaGroup
    area: string | null
    task: string | null
    taskLabel: string
    summary: string | null
    pageTitle: string | null
    pagePath: string | null
    provider: string | null
    model: string
    tokensIn: number
    cachedTokensIn: number | null
    tokensOut: number
    cacheHitPercent: number | null
    /** null = the model has no price on file */
    costUsd: number | null
    batteryCostUsd: number | null
    durationMs: number
    outcome: Outcome
    errorCode: string | null
    errorLabel: string | null
    /** status + the provider's message */
    errorDetail: string | null
    runId: string | null
    threadId: string | null
}

const COLUMNS = sql`id, created_at, tenant_id, user_id, task, task_label, summary, page_title, page_path, area, feature, plan, provider, model,
    tokens_in, cached_tokens_in, tokens_out, cache_hit_percent, cost_usd, battery_cost_usd, duration_ms, outcome, success,
    error_code, error_label, error_detail, run_id, thread_id`

const JOINED = sql`l.*, t.name AS shop, u.email AS user_email
    FROM l LEFT JOIN tenants t ON t.id = l.tenant_id LEFT JOIN users u ON u.id = l.user_id`

export function mapLogRow(r: Row): LogRow {
    const outcome: Outcome = r.outcome === 'error' || r.outcome === 'refused' ? r.outcome : r.outcome === 'ok' ? 'ok' : r.success === false ? 'error' : 'ok'
    const text = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v))
    return {
        id: num(r.id), at: new Date(String(r.created_at)).toISOString(),
        tenantId: r.tenant_id === null || r.tenant_id === undefined ? null : num(r.tenant_id),
        shop: text(r.shop), userEmail: text(r.user_email),
        plan: planGroupOf(text(r.plan)), planCode: text(r.plan),
        areaGroup: areaGroupOf({ area: text(r.area), feature: text(r.feature) }), area: text(r.area),
        task: text(r.task), taskLabel: text(r.task_label) ?? text(r.task) ?? 'AI call', summary: text(r.summary),
        pageTitle: text(r.page_title), pagePath: text(r.page_path), provider: text(r.provider), model: text(r.model) ?? 'unknown',
        tokensIn: num(r.tokens_in), cachedTokensIn: numOrNull(r.cached_tokens_in), tokensOut: num(r.tokens_out),
        cacheHitPercent: numOrNull(r.cache_hit_percent), costUsd: numOrNull(r.cost_usd), batteryCostUsd: numOrNull(r.battery_cost_usd),
        durationMs: num(r.duration_ms), outcome, errorCode: text(r.error_code), errorLabel: text(r.error_label), errorDetail: text(r.error_detail),
        runId: text(r.run_id), threadId: text(r.thread_id),
    }
}

export async function getLogRows(db: ReportsDb, filters: LogFilters, period: Period, limit: number): Promise<LogRow[]> {
    const rows = await rowsOf<Row>(db, sql`
        WITH l AS (SELECT ${COLUMNS} FROM ai_usage_logs WHERE ${buildLogWhere(filters, period)} ORDER BY created_at DESC, id DESC LIMIT ${limit})
        SELECT ${JOINED} ORDER BY l.created_at DESC, l.id DESC`)
    return rows.map(mapLogRow)
}

export interface LogTotals { calls: number; cost: number; errors: number; unpriced: number }

/** Totals of the whole filtered set (not just the rows on screen). */
export async function getLogTotals(db: ReportsDb, filters: LogFilters, period: Period): Promise<LogTotals> {
    const [r] = await rowsOf<Row>(db, sql`
        SELECT COUNT(*) AS calls, COALESCE(SUM(cost_usd), 0) AS cost, COUNT(*) FILTER (WHERE ${isErrorSql()}) AS errors,
               COUNT(*) FILTER (WHERE cost_usd IS NULL) AS unpriced
        FROM ai_usage_logs WHERE ${buildLogWhere(filters, period)}`)
    return { calls: num(r?.calls), cost: num(r?.cost), errors: num(r?.errors), unpriced: num(r?.unpriced) }
}

export async function getLogById(db: ReportsDb, id: number): Promise<LogRow | null> {
    if (!Number.isSafeInteger(id) || id <= 0) return null
    const rows = await rowsOf<Row>(db, sql`
        WITH l AS (SELECT ${COLUMNS} FROM ai_usage_logs WHERE id = ${id}) SELECT ${JOINED}`)
    return rows[0] ? mapLogRow(rows[0]) : null
}

/** The other calls of the same assistant reply (same run_id), oldest first. */
export async function getRunSiblings(db: ReportsDb, runId: string, exceptId: number, limit = 20): Promise<LogRow[]> {
    const rows = await rowsOf<Row>(db, sql`
        WITH l AS (SELECT ${COLUMNS} FROM ai_usage_logs WHERE run_id = ${runId} AND id <> ${exceptId} ORDER BY created_at ASC, id ASC LIMIT ${limit})
        SELECT ${JOINED} ORDER BY l.created_at ASC, l.id ASC`)
    return rows.map(mapLogRow)
}

export interface FilterOptions { tasks: Array<{ value: string; label: string }>; models: string[] }

/** Task / model choices for the filter menus: what actually ran in the period, busiest first. */
export async function getFilterOptions(db: ReportsDb, period: Period): Promise<FilterOptions> {
    const [tasks, models] = await Promise.all([
        rowsOf<Row>(db, sql`SELECT task, COALESCE(MAX(task_label), task) AS label FROM ai_usage_logs WHERE ${inWindow(period.start, period.end)} AND task IS NOT NULL GROUP BY task ORDER BY COUNT(*) DESC LIMIT 40`),
        rowsOf<Row>(db, sql`SELECT model FROM ai_usage_logs WHERE ${inWindow(period.start, period.end)} GROUP BY model ORDER BY COUNT(*) DESC LIMIT 40`),
    ])
    return { tasks: tasks.map((t) => ({ value: String(t.task), label: String(t.label) })), models: models.map((m) => String(m.model)) }
}
