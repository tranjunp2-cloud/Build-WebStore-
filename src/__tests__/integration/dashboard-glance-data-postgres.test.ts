// @vitest-environment node
/**
 * PostgreSQL regression coverage for the production At-a-glance SQL.
 *
 * The unit test mocks Drizzle and cannot detect PostgreSQL placeholder
 * identity/type errors. This test calls getGlanceData with a real Drizzle
 * connection and session-local TEMP tables, so it exercises the exact SQL
 * without reading or mutating application data.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

const mocks = vi.hoisted(() => ({
    count: vi.fn(),
    tenantIdForQuery: vi.fn(),
}))

let testDatabase: ReturnType<typeof drizzle> | null = null

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => {
        if (!testDatabase) throw new Error('PostgreSQL test database was not initialized')
        return {
            count: mocks.count,
            db: { drizzle: testDatabase },
        }
    }),
}))

vi.mock('@/lib/auth', () => ({
    tenantIdForQuery: mocks.tenantIdForQuery,
}))

import { getGlanceData } from '@/lib/dashboard/glance-data'

const connectionString = process.env.DATABASE_URI
const RUN_TEST = Boolean(connectionString)
const authorizedUser = {
    roles: [],
    tenants: [{
        tenant: 65,
        status: 'active',
        role: 'owner',
        permissions: [],
    }],
}

describe.skipIf(!RUN_TEST)('[TC-F03.05 / TC-F03.77] At-a-glance PostgreSQL query regression', () => {
    let pool: Pool

    beforeAll(async () => {
        pool = new Pool({
            connectionString,
            ssl: false,
            max: 1,
        })
        testDatabase = drizzle(pool)

        await pool.query(`
            CREATE TYPE pg_temp.enum_analytics_event AS ENUM (
                'pageview',
                'click',
                'add_to_cart',
                'checkout',
                'purchase',
                'local_business_data_saved'
            );

            CREATE TYPE pg_temp.enum_orders_currency AS ENUM (
                'MYR',
                'USD',
                'SGD'
            );

            CREATE TYPE pg_temp.enum_orders_status AS ENUM (
                'pending',
                'confirmed',
                'ready_to_ship',
                'shipped',
                'completed',
                'cancelled',
                'refunded',
                'paid',
                'payment_failed',
                'processing',
                'new'
            );

            CREATE TEMP TABLE analytics (
                tenant_id integer NOT NULL,
                event pg_temp.enum_analytics_event NOT NULL,
                created_at timestamptz NOT NULL
            );

            CREATE TEMP TABLE orders (
                tenant_id integer NOT NULL,
                status pg_temp.enum_orders_status NOT NULL,
                currency pg_temp.enum_orders_currency,
                total numeric NOT NULL,
                payment_method text,
                payment_status text,
                created_at timestamptz NOT NULL
            );
        `)
    }, 15_000)

    afterAll(async () => {
        testDatabase = null
        await pool?.end()
        vi.useRealTimers()
    })

    beforeEach(async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-07-27T12:00:00.000Z'))
        vi.clearAllMocks()
        mocks.tenantIdForQuery.mockReturnValue(65)
        mocks.count.mockResolvedValue({ totalDocs: 0 })

        await pool.query('TRUNCATE analytics, orders')
    })

    it('mirrors production enum types in the temporary query schema', async () => {
        // Arrange — TEMP enum schema is created in beforeAll

        // Act
        const result = await pool.query<{
            table_name: string
            column_name: string
            data_type: string
            udt_name: string
        }>(`
            SELECT table_name, column_name, data_type, udt_name
            FROM information_schema.columns
            WHERE table_schema LIKE 'pg_temp_%'
              AND (
                  (table_name = 'analytics' AND column_name = 'event')
                  OR
                  (table_name = 'orders' AND column_name IN ('status', 'currency'))
              )
            ORDER BY table_name, column_name
        `)

        // Assert
        expect(result.rows).toEqual([
            {
                table_name: 'analytics',
                column_name: 'event',
                data_type: 'USER-DEFINED',
                udt_name: 'enum_analytics_event',
            },
            {
                table_name: 'orders',
                column_name: 'currency',
                data_type: 'USER-DEFINED',
                udt_name: 'enum_orders_currency',
            },
            {
                table_name: 'orders',
                column_name: 'status',
                data_type: 'USER-DEFINED',
                udt_name: 'enum_orders_status',
            },
        ])
    })

    it('executes every production aggregate and applies completed MYR UTC Revenue rules', async () => {
        // Arrange
        await pool.query(`
            INSERT INTO orders
                (tenant_id, status, currency, total, payment_method, payment_status, created_at)
            VALUES
                (65, 'completed', 'MYR', 100.10, 'cod', 'refunded', '2026-07-21T00:00:00.000Z'),
                (65, 'completed', NULL, 50.15, 'card', 'paid', '2026-07-27T23:59:59.999Z'),
                (65, 'completed', 'MYR', 25.25, 'cod', 'paid', '2026-07-19T12:00:00.000Z'),
                (65, 'completed', 'USD', 999.00, 'card', 'paid', '2026-07-22T12:00:00.000Z'),
                (65, 'paid', 'MYR', 888.00, 'card', 'paid', '2026-07-23T12:00:00.000Z'),
                (66, 'completed', 'MYR', 777.00, 'cod', 'refunded', '2026-07-24T12:00:00.000Z'),
                (65, 'completed', 'MYR', 666.00, 'card', 'paid', '2026-07-28T00:00:00.000Z');
        `)

        // Act
        const result = await getGlanceData('7d', { user: authorizedUser })

        // Assert
        expect(result.stats.revenue.value).toBeCloseTo(150.25)
        expect(result.stats.revenue.delta).toBeCloseTo(((150.25 - 25.25) / 25.25) * 100)
        expect(result.sparks.revenue).toEqual([100.1, 0, 0, 0, 0, 0, 50.15])
        expect(result.sparks.views).toEqual([0, 0, 0, 0, 0, 0, 0])
        expect(result.sparks.leads).toEqual([0, 0, 0, 0, 0, 0, 0])
        expect(result.sparks.engage).toEqual([0, 0, 0, 0, 0, 0, 0])
    })

    it('does not expose Revenue when the real Orders permission gate denies access', async () => {
        // Arrange
        const unauthorizedUser = {
            roles: [],
            tenants: [{
                tenant: 65,
                status: 'active',
                role: 'custom',
                permissions: [],
            }],
        }
        await pool.query(`
            INSERT INTO orders
                (tenant_id, status, currency, total, payment_method, payment_status, created_at)
            VALUES
                (65, 'completed', 'MYR', 123.45, 'card', 'paid', '2026-07-27T12:00:00.000Z');
        `)

        // Act
        const result = await getGlanceData('7d', { user: unauthorizedUser })

        // Assert
        expect(result.stats.revenue).toEqual({ value: 0, delta: 0, currency: true })
        expect(result.sparks.revenue).toEqual([0, 0, 0, 0, 0, 0, 0])
    })

    it('[TC-PERF-057] one analytics statement gives both windows\' totals and the current daily series', async () => {
        // Arrange — 7d window: current 21–27 Jul, previous 14–20 Jul (UTC); other tenant / event / range ignored
        await pool.query(`
            INSERT INTO analytics (tenant_id, event, created_at) VALUES
                (65, 'pageview', '2026-07-21T00:00:00.000Z'),
                (65, 'pageview', '2026-07-21T23:59:59.999Z'),
                (65, 'pageview', '2026-07-27T08:00:00.000Z'),
                (65, 'click', '2026-07-22T10:00:00.000Z'),
                (65, 'add_to_cart', '2026-07-23T10:00:00.000Z'),
                (65, 'checkout', '2026-07-23T11:00:00.000Z'),
                (65, 'pageview', '2026-07-14T00:00:00.000Z'),
                (65, 'click', '2026-07-20T23:59:59.999Z'),
                (65, 'purchase', '2026-07-22T10:00:00.000Z'),
                (65, 'pageview', '2026-07-13T23:59:59.999Z'),
                (65, 'pageview', '2026-07-28T00:00:00.000Z'),
                (66, 'pageview', '2026-07-22T10:00:00.000Z');
        `)

        // Act
        const result = await getGlanceData('7d', { user: authorizedUser })

        // Assert
        expect(mocks.count).not.toHaveBeenCalled()
        expect(result.stats.views).toEqual({ value: 3, delta: 200 })
        expect(result.stats.leads).toEqual({ value: 1, delta: 0 })
        expect(result.stats.engage).toEqual({ value: 2, delta: 100 })
        expect(result.sparks.views).toEqual([2, 0, 0, 0, 0, 0, 1])
        expect(result.sparks.leads).toEqual([0, 1, 0, 0, 0, 0, 0])
        expect(result.sparks.engage).toEqual([0, 0, 2, 0, 0, 0, 0])
    })
})
