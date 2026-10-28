/**
 * Shared bits of the report queries: the database handle they need, the order states that count as
 * sales, and number helpers. Reports read through raw SQL (`payload.db.drizzle`) because they group
 * and sum over thousands of rows; every query is scoped by `tenant_id`.
 */
import { type SQL, sql } from 'drizzle-orm'

/** What the reports need from Payload (`payload.db.drizzle` satisfies it; tests pass a real pg connection). */
export interface ReportsDb {
    db: { drizzle: { execute: (query: SQL) => PromiseLike<unknown> } }
}

/**
 * Orders that count as sales: accepted by the shop and not undone. Excludes `pending` (not confirmed
 * yet), `cancelled`, `payment_failed` and `refunded`. `completed` is the subset the dashboard's
 * At-a-glance revenue card sums (it only counts finished orders).
 */
export const SALES_STATUSES = ['new', 'paid', 'confirmed', 'processing', 'ready_to_ship', 'shipped', 'completed'] as const

export const salesStatusList = (): SQL => sql.join(SALES_STATUSES.map((status) => sql`${status}`), sql`, `)

export async function rowsOf<T extends Record<string, unknown>>(db: ReportsDb, query: SQL): Promise<T[]> {
    const result = (await db.db.drizzle.execute(query)) as { rows?: unknown[] } | null
    return Array.isArray(result?.rows) ? (result.rows as T[]) : []
}

export function tenantParam(tenantId: string | number): number {
    const id = Number(tenantId)
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('A report needs a valid tenant id.')
    return id
}

/** A numeric column (pg returns numeric / bigint as strings) as a finite number. */
export const num = (value: unknown): number => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

/** Ringgit with two decimals. */
export const rm = (value: unknown): number => Math.round(num(value) * 100) / 100

/** Percent change from `previous` to `current`, one decimal; null when there is nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
    if (previous === 0) return null
    return Math.round(((current - previous) / previous) * 1000) / 10
}
