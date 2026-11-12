/**
 * Small SQL fragments shared by the AI usage queries. Everything user-controlled goes through drizzle
 * parameters; the only `sql.raw` values are the constants below.
 */
import { type SQL, sql } from 'drizzle-orm'
import { rowsOf, type ReportsDb } from '@/lib/reports/report-db'
import { TIME_ZONE, type Period } from './period'

export { rowsOf, type ReportsDb }

const TZ = sql.raw(`'${TIME_ZONE}'`)

/** `created_at` inside [start, end). Unqualified column: use on `ai_usage_logs` only (no joins). */
export const inWindow = (start: Date, end: Date): SQL =>
    sql`created_at >= ${start.toISOString()}::timestamptz AND created_at < ${end.toISOString()}::timestamptz`

/** The Malaysia-time bucket key of a row, as text (`2026-10-29` or `2026-10-29 14:00`). Group by ordinal, not by this. */
export const bucketSql = (bucket: Period['bucket']): SQL =>
    bucket === 'hour'
        ? sql`to_char(date_trunc('hour', created_at AT TIME ZONE ${TZ}), 'YYYY-MM-DD HH24:00')`
        : sql`to_char(date_trunc('day', created_at AT TIME ZONE ${TZ}), 'YYYY-MM-DD')`

export const daySql = (): SQL => sql`to_char(date_trunc('day', created_at AT TIME ZONE ${TZ}), 'YYYY-MM-DD')`

/** A call that failed. Rows without an outcome (legacy) fall back to `success = false`. */
export const isErrorSql = (): SQL => sql`(outcome = 'error' OR (outcome IS NULL AND success = false))`

export function tenantIdParam(value: string | number): number | null {
    const id = Number(value)
    return Number.isSafeInteger(id) && id > 0 ? id : null
}

/** ` AND tenant_id = N` for one shop, nothing for all shops. */
export const tenantScope = (tenantId?: number): SQL => (tenantId ? sql` AND tenant_id = ${tenantId}` : sql``)
