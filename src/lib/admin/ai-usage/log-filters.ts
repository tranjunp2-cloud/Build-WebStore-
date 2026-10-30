/** Logs filters: search params → typed filters → SQL. Unknown or malformed values are dropped, never passed to SQL. */
import { type SQL, sql } from 'drizzle-orm'
import { areaGroupSql, isAreaGroup, isPlanGroup, planGroupSql, type AreaGroup, type PlanGroup } from './groups'
import { first, periodQuery, type Period } from './period'
import { inWindow, isErrorSql } from './sql-parts'

export const OUTCOMES = ['ok', 'refused', 'error'] as const
export type Outcome = (typeof OUTCOMES)[number]
export const PAGE_SIZE = 25
export const MAX_ROWS = 500
export const EXPORT_MAX_ROWS = 50_000
const MAX_TEXT = 120

export interface LogFilters {
    q?: string
    plan?: PlanGroup
    area?: AreaGroup
    task?: string
    model?: string
    outcome?: Outcome
    unpriced: boolean
    /** One shop (used by the shop screen, never by the Logs URL filters directly). */
    tenantId?: number
}

type Params = Record<string, string | string[] | undefined>

const clean = (value: string | string[] | undefined): string | undefined => {
    const v = first(value)?.trim().slice(0, MAX_TEXT)
    return v ? v : undefined
}

export function parseLogFilters(params: Params): LogFilters {
    const plan = clean(params.plan)
    const area = clean(params.area)
    const outcome = clean(params.outcome)
    const tenant = Number(clean(params.shop))
    return {
        q: clean(params.q),
        plan: isPlanGroup(plan) ? plan : undefined,
        area: isAreaGroup(area) ? area : undefined,
        task: clean(params.task),
        model: clean(params.model),
        outcome: (OUTCOMES as readonly string[]).includes(outcome ?? '') ? (outcome as Outcome) : undefined,
        unpriced: first(params.unpriced) === '1',
        tenantId: Number.isSafeInteger(tenant) && tenant > 0 ? tenant : undefined,
    }
}

/** Number of rows to show: 25, 50, … up to 500 (`?limit=`). */
export function parseLimit(params: Params): number {
    const n = Math.floor(Number(first(params.limit)))
    if (!Number.isFinite(n) || n < PAGE_SIZE) return PAGE_SIZE
    return Math.min(MAX_ROWS, Math.ceil(n / PAGE_SIZE) * PAGE_SIZE)
}

/** Query string for the Logs screen / export: period + filters (+ optional extras). */
export function logsQuery(period: Period, filters: LogFilters, extra: Record<string, string | undefined> = {}): URLSearchParams {
    const q = periodQuery(period)
    const set = (key: string, value: string | number | undefined) => { if (value !== undefined && value !== '') q.set(key, String(value)) }
    set('q', filters.q); set('plan', filters.plan); set('area', filters.area); set('task', filters.task)
    set('model', filters.model); set('outcome', filters.outcome); set('shop', filters.tenantId)
    if (filters.unpriced) q.set('unpriced', '1')
    for (const [k, v] of Object.entries(extra)) set(k, v)
    return q
}

const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (c) => `\\${c}`)

/** WHERE clause (no leading WHERE) on `ai_usage_logs`, unqualified columns. */
export function buildLogWhere(filters: LogFilters, period: Period): SQL {
    const parts: SQL[] = [inWindow(period.start, period.end)]
    if (filters.tenantId) parts.push(sql`tenant_id = ${filters.tenantId}`)
    if (filters.q) {
        const like = `%${escapeLike(filters.q)}%`
        parts.push(sql`(tenant_id IN (SELECT id FROM tenants WHERE name ILIKE ${like}) OR user_id IN (SELECT id FROM users WHERE email ILIKE ${like}))`)
    }
    if (filters.plan) parts.push(sql`${planGroupSql()} = ${filters.plan}`)
    if (filters.area) parts.push(sql`${areaGroupSql()} = ${filters.area}`)
    if (filters.task) parts.push(sql`task = ${filters.task}`)
    if (filters.model) parts.push(sql`model = ${filters.model}`)
    if (filters.outcome === 'error') parts.push(isErrorSql())
    else if (filters.outcome === 'refused') parts.push(sql`outcome = 'refused'`)
    else if (filters.outcome === 'ok') parts.push(sql`(outcome = 'ok' OR (outcome IS NULL AND success = true))`)
    if (filters.unpriced) parts.push(sql`cost_usd IS NULL`)
    return sql.join(parts.map((p) => sql`(${p})`), sql` AND `)
}

export const hasActiveFilters = (f: LogFilters): boolean =>
    Boolean(f.q || f.plan || f.area || f.task || f.model || f.outcome || f.unpriced)
