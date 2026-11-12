/**
 * TC-PERF-078 — hot-path indexes from the N+1 / scale audit are db-setup migrations (idempotent, nothing dropped):
 * analytics (tenant, created_at) INCLUDE event for the dashboard glance + traffic, orders (tenant, created_at DESC)
 * for the orders list, and the latest page versions per site for draft reads.
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const { MIGRATIONS } = createRequire(import.meta.url)(path.join(process.cwd(), 'scripts/db-setup.js')) as {
    MIGRATIONS: Array<{ name: string; sql: string }>
}
const byName = (name: string) => MIGRATIONS.filter((m) => m.name === name)

describe('scale audit indexes [TC-PERF-078]', () => {
    it.each([
        ['analytics.tenant_created_idx', 'CREATE INDEX CONCURRENTLY IF NOT EXISTS analytics_tenant_created_idx ON analytics (tenant_id, created_at) INCLUDE (event);'],
        ['orders.tenant_created_idx', 'CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_tenant_created_idx ON orders (tenant_id, created_at DESC);'],
        ['_pages_v.site_latest_idx', 'CREATE INDEX CONCURRENTLY IF NOT EXISTS _pages_v_site_latest_idx ON _pages_v (version_site_id) WHERE latest = true;'],
    ])('%s is one idempotent CREATE INDEX CONCURRENTLY', (name, sql) => {
        // Act
        const entries = byName(name)

        // Assert
        expect(entries).toHaveLength(1)
        expect(entries[0]!.sql).toBe(sql)
    })

    it('drops nothing on the tables it indexes', () => {
        // Assert
        expect(MIGRATIONS.some((m) => /DROP\s+(TABLE|INDEX)/i.test(m.sql) && /\b(analytics|orders|_pages_v)\b/.test(m.sql))).toBe(false)
    })
})
