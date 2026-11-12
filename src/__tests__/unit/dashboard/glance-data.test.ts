import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    count: vi.fn(),
    execute: vi.fn(),
    getCurrentTenantId: vi.fn(),
    tenantIdForQuery: vi.fn(),
    canReadPendingOrders: vi.fn(),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('drizzle-orm', () => ({
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        count: mocks.count,
        db: { drizzle: { execute: mocks.execute } },
    })),
}))

vi.mock('@/lib/auth', () => ({
    getCurrentTenantId: mocks.getCurrentTenantId,
    tenantIdForQuery: mocks.tenantIdForQuery,
}))

vi.mock('@/lib/dashboard/pending-orders-data', () => ({ canReadPendingOrders: mocks.canReadPendingOrders }))

import { getPayload } from 'payload'
import { emptyGlanceData, getGlanceData } from '@/lib/dashboard/glance-data'

interface CapturedSql {
    strings: TemplateStringsArray
    values: unknown[]
}

const sqlText = (query: CapturedSql) => query.strings.join('?')

const authorizedUser = {
    roles: [],
    tenants: [{
        tenant: 'tenant-a',
        status: 'active',
        role: 'owner',
        permissions: [],
    }],
}

beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-27T12:00:00.000Z'))
    vi.clearAllMocks()
    mocks.canReadPendingOrders.mockReturnValue(true)
    mocks.getCurrentTenantId.mockResolvedValue('tenant-a')
    mocks.tenantIdForQuery.mockReturnValue('tenant-a')
    mocks.count.mockResolvedValue({ totalDocs: 0 })
    mocks.execute.mockResolvedValue({ rows: [] })
})

afterEach(() => {
    vi.useRealTimers()
})

describe('[TC-F03.05] getGlanceData UTC and Revenue contract', () => {
    it('returns empty data before Payload initializes when tenant context is absent', async () => {
        // Arrange
        mocks.getCurrentTenantId.mockResolvedValue(null)
        mocks.tenantIdForQuery.mockReturnValue(null)

        // Act
        const result = await getGlanceData('today', { user: { tenants: [] } })

        // Assert
        expect(result).toEqual(emptyGlanceData())
        expect(getPayload).not.toHaveBeenCalled()
        expect(mocks.count).not.toHaveBeenCalled()
        expect(mocks.execute).not.toHaveBeenCalled()
    })

    it('[TC-PERF-057] reads views, leads and engagement for both windows in one statement with equal UTC bounds', async () => {
        // Arrange — default empty query responses

        // Act
        await getGlanceData('7d', { user: authorizedUser })

        // Assert
        expect(mocks.count).not.toHaveBeenCalled()
        expect(mocks.execute).toHaveBeenCalledTimes(2)
        const analytics = mocks.execute.mock.calls[0][0] as CapturedSql
        const text = sqlText(analytics)
        expect(text).toContain('FROM analytics')
        expect(text).toContain("event IN ('pageview', 'click', 'add_to_cart', 'checkout')")
        expect(text).toContain("COUNT(*) FILTER (WHERE event = 'pageview')")
        expect(text).toContain("COUNT(*) FILTER (WHERE event = 'click')")
        expect(text).toContain("COUNT(*) FILTER (WHERE event IN ('add_to_cart', 'checkout'))")
        expect(text).toContain('created_at AT TIME ZONE ?')
        expect(text).toContain('GROUP BY day, is_current')
        // previous start .. current end, the current-window flag at the current start
        expect(analytics.values).toEqual([
            'UTC',
            '2026-07-21T00:00:00.000Z',
            'tenant-a',
            '2026-07-14T00:00:00.000Z',
            '2026-07-28T00:00:00.000Z',
        ])
    })
    it('uses UTC in every SQL series and enforces completed MYR created-at Revenue', async () => {
        // Arrange — default empty query responses

        // Act
        await getGlanceData('7d', { user: authorizedUser })

        // Assert
        expect(mocks.execute).toHaveBeenCalledTimes(2)
        const queries = mocks.execute.mock.calls.map(call => call[0] as CapturedSql)
        queries.forEach((query) => {
            expect(sqlText(query)).toContain('created_at AT TIME ZONE ?')
            expect(sqlText(query)).toContain('GROUP BY')
            expect(query.values.filter(value => value === "UTC")).toHaveLength(1)
            expect(query.values).toContain('tenant-a')
        })
        const revenueQuery = queries[1]
        const revenueSql = sqlText(revenueQuery)
        expect(revenueSql).toContain("status = 'completed'")
        expect(revenueSql).toContain("COALESCE(currency, 'MYR') = 'MYR'")
        expect(revenueSql).toContain('created_at >= ?')
        expect(revenueSql).not.toContain('completed_at')
        expect(revenueSql).not.toContain("status IN ('paid', 'completed')")
        expect(revenueSql).not.toContain('payment_method')
        expect(revenueSql).not.toContain('payment_status')
        expect(revenueSql).not.toContain('refunded')
        expect(revenueQuery.values).toContain('2026-07-14T00:00:00.000Z')
        expect(revenueQuery.values).toContain('2026-07-28T00:00:00.000Z')
    })

    it('does not query or serialize Revenue for users without Orders permission', async () => {
        // Arrange
        const unauthorizedUser = {
            roles: [],
            tenants: [{ tenant: 'tenant-a', status: 'active', role: 'custom', permissions: [] }],
        }
        mocks.canReadPendingOrders.mockReturnValue(false)

        // Act
        const result = await getGlanceData('today', { user: unauthorizedUser })

        // Assert
        expect(mocks.execute).toHaveBeenCalledTimes(1)
        expect(mocks.execute.mock.calls.map(call => sqlText(call[0] as CapturedSql)).join(' ')).not.toContain('FROM orders')
        expect(result.stats.revenue).toEqual({ value: 0, delta: 0, currency: true })
        expect(result.sparks.revenue).toEqual([0])
    })
    it('derives current total, comparison, and zero-filled series from one Revenue aggregate', async () => {
        // Arrange — analytics rows per (day, window); revenue per day across both windows
        mocks.execute
            .mockResolvedValueOnce({
                rows: [
                    { date_str: '2026-07-21', is_current: true, views: '3', leads: '0', engage: '0' },
                    { date_str: '2026-07-22', is_current: true, views: '7', leads: '4', engage: '0' },
                    { date_str: '2026-07-23', is_current: true, views: '0', leads: '16', engage: '0' },
                    { date_str: '2026-07-15', is_current: false, views: '5', leads: '10', engage: '0' },
                ],
            })
            .mockResolvedValueOnce({
                rows: [
                    { date_str: '2026-07-19', count: '25.25' },
                    { date_str: '2026-07-21', count: '100.10' },
                    { date_str: '2026-07-24', count: 'not-a-number' },
                    { date_str: '2026-07-27', count: 50.15 },
                ],
            })

        // Act
        const result = await getGlanceData('7d', { user: authorizedUser })

        // Assert
        expect(result.rangeLabel).toBe('21 – 27 Jul 2026')
        expect(result.stats.views).toEqual({ value: 10, delta: 100 })
        expect(result.stats.leads).toEqual({ value: 20, delta: 100 })
        expect(result.stats.engage).toEqual({ value: 0, delta: 0 })
        expect(result.stats.revenue.value).toBeCloseTo(150.25)
        expect(result.stats.revenue.delta).toBeCloseTo(((150.25 - 25.25) / 25.25) * 100)
        expect(result.sparks.views).toEqual([3, 7, 0, 0, 0, 0, 0])
        expect(result.sparks.leads).toEqual([0, 4, 16, 0, 0, 0, 0])
        expect(result.sparks.revenue).toEqual([100.1, 0, 0, 0, 0, 0, 50.15])
    })

    it('keeps aggregated values and percentage deltas finite for extreme finite inputs', async () => {
        // Arrange — each operand is finite, but IEEE-754 arithmetic overflows.
        mocks.execute
            .mockResolvedValueOnce({
                rows: [
                    { date_str: '2026-07-21', is_current: true, views: 1e308, leads: 0, engage: 0 },
                    { date_str: '2026-07-15', is_current: false, views: 1e-308, leads: 0, engage: 0 },
                ],
            })
            .mockResolvedValueOnce({
                rows: [
                    { date_str: '2026-07-20', count: 1e-308 },
                    { date_str: '2026-07-21', count: 1e308 },
                    { date_str: '2026-07-22', count: 1e308 },
                ],
            })

        // Act
        const result = await getGlanceData('7d', { user: authorizedUser })

        // Assert — AC-R05 forbids NaN/Infinity in the serialized contract.
        expect(result.stats.views.delta).toBe(0)
        expect(result.stats.revenue.value).toBe(0)
        Object.values(result.stats).forEach(({ value, delta }) => {
            expect(Number.isFinite(value)).toBe(true)
            expect(Number.isFinite(delta)).toBe(true)
        })
        Object.values(result.sparks).flat().forEach((value) => {
            expect(Number.isFinite(value)).toBe(true)
        })
    })
})
