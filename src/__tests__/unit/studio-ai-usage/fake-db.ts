/** Test helper: a Payload-shaped db whose drizzle.execute records the rendered SQL + params and returns queued rows. */
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { vi } from 'vitest'
import type { ReportsDb } from '@/lib/admin/ai-usage/sql-parts'

const dialect = new PgDialect()

export interface Captured { sql: string; params: unknown[] }

export function fakeDb(...responses: Array<Array<Record<string, unknown>>>) {
    const calls: Captured[] = []
    const queue = [...responses]
    const execute = vi.fn(async (query: SQL) => {
        const { sql, params } = dialect.sqlToQuery(query)
        calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params })
        return { rows: queue.shift() ?? [] }
    })
    return { db: { db: { drizzle: { execute } } } as unknown as ReportsDb, calls, execute }
}

export const render = (query: SQL): Captured => {
    const { sql, params } = dialect.sqlToQuery(query)
    return { sql: sql.replace(/\s+/g, ' ').trim(), params }
}

/** Like fakeDb, but picks the rows by what the SQL contains (for code that runs queries concurrently). */
export function fakeDbBy(routes: Array<[string, Array<Record<string, unknown>>]>) {
    const calls: Captured[] = []
    const execute = vi.fn(async (query: SQL) => {
        const { sql, params } = dialect.sqlToQuery(query)
        const flat = sql.replace(/\s+/g, ' ').trim()
        calls.push({ sql: flat, params })
        return { rows: routes.find(([needle]) => flat.includes(needle))?.[1] ?? [] }
    })
    return { db: { db: { drizzle: { execute } } } as unknown as ReportsDb, calls, execute }
}
