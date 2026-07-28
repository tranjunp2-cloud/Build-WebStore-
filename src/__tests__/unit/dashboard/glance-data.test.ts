import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    count: vi.fn(),
    execute: vi.fn(),
    getCurrentTenantId: vi.fn(),
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
}))

import { getPayload } from 'payload'
import { emptyGlanceData, getGlanceData } from '@/lib/dashboard/glance-data'

interface CapturedSql {
    strings: TemplateStringsArray
    values: unknown[]
}

const sqlText = (query: CapturedSql) => query.strings.join('?')

beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-27T12:00:00.000Z'))
    vi.clearAllMocks()
    mocks.getCurrentTenantId.mockResolvedValue('tenant-a')
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

        // Act
        const result = await getGlanceData('today')

        // Assert
        expect(result).toEqual(emptyGlanceData())
        expect(getPayload).not.toHaveBeenCalled()
        expect(mocks.count).not.toHaveBeenCalled()
        expect(mocks.execute).not.toHaveBeenCalled()
    })

    it('uses equal UTC bounds for Views, Leads, and Engagement counts', async () => {
        // Arrange — default empty query responses

        // Act
        await getGlanceData('7d')

        // Assert
        expect(mocks.count).toHaveBeenCalledTimes(6)
        const countCalls = mocks.count.mock.calls.map(call => call[0])
        const currentBounds = {
            greater_than_equal: '2026-07-21T00:00:00.000Z',
            less_than: '2026-07-28T00:00:00.000Z',
        }
        const previousBounds = {
            greater_than_equal: '2026-07-14T00:00:00.000Z',
            less_than: '2026-07-21T00:00:00.000Z',
        }
        expect(countCalls.map(call => call.where.createdAt)).toEqual([
            currentBounds, previousBounds,
            currentBounds, previousBounds,
            currentBounds, previousBounds,
        ])
        expect(countCalls.map(call => call.where.tenant)).toEqual(
            Array.from({ length: 6 }, () => ({ equals: 'tenant-a' })),
        )
        expect(countCalls.map(call => call.where.event)).toEqual([
            { equals: 'pageview' },
            { equals: 'pageview' },
            { equals: 'click' },
            { equals: 'click' },
            { in: ['add_to_cart', 'checkout'] },
            { in: ['add_to_cart', 'checkout'] },
        ])
    })
    it('uses UTC in every SQL series and enforces completed MYR created-at Revenue', async () => {
        // Arrange — default empty query responses

        // Act
        await getGlanceData('7d')

        // Assert
        expect(mocks.execute).toHaveBeenCalledTimes(4)
        const queries = mocks.execute.mock.calls.map(call => call[0] as CapturedSql)
        queries.forEach((query) => {
            expect(sqlText(query)).toContain('created_at AT TIME ZONE ?')
            expect(sqlText(query)).toContain("GROUP BY 1")
            expect(query.values.filter(value => value === "UTC")).toHaveLength(1)
            expect(query.values).toContain('tenant-a')
        })
        const revenueQuery = queries[3]
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

    it('loads tenant aggregate without consulting an Orders permission gate', async () => {
        // Arrange — server auth has resolved a tenant for a dashboard user
        mocks.getCurrentTenantId.mockResolvedValue('tenant-with-view-only-user')

        // Act
        await getGlanceData('today')

        // Assert
        expect(getPayload).toHaveBeenCalledTimes(1)
        const revenueQuery = mocks.execute.mock.calls[3][0] as CapturedSql
        expect(revenueQuery.values).toContain('tenant-with-view-only-user')
    })
    it('derives current total, comparison, and zero-filled series from one Revenue aggregate', async () => {
        // Arrange
        mocks.count
            .mockResolvedValueOnce({ totalDocs: 10 })
            .mockResolvedValueOnce({ totalDocs: 5 })
            .mockResolvedValueOnce({ totalDocs: 20 })
            .mockResolvedValueOnce({ totalDocs: 10 })
            .mockResolvedValueOnce({ totalDocs: 0 })
            .mockResolvedValueOnce({ totalDocs: 0 })
        mocks.execute
            .mockResolvedValueOnce({ rows: [{ date_str: '2026-07-21', count: '3' }] })
            .mockResolvedValueOnce({ rows: [{ date_str: '2026-07-22', count: '4' }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({
                rows: [
                    { date_str: '2026-07-19', count: '25.25' },
                    { date_str: '2026-07-21', count: '100.10' },
                    { date_str: '2026-07-24', count: 'not-a-number' },
                    { date_str: '2026-07-27', count: 50.15 },
                ],
            })

        // Act
        const result = await getGlanceData('7d')

        // Assert
        expect(result.rangeLabel).toBe('21 – 27 Jul 2026')
        expect(result.stats.views).toEqual({ value: 10, delta: 100 })
        expect(result.stats.leads).toEqual({ value: 20, delta: 100 })
        expect(result.stats.engage).toEqual({ value: 0, delta: 0 })
        expect(result.stats.revenue.value).toBeCloseTo(150.25)
        expect(result.stats.revenue.delta).toBeCloseTo(((150.25 - 25.25) / 25.25) * 100)
        expect(result.sparks.views).toEqual([3, 0, 0, 0, 0, 0, 0])
        expect(result.sparks.leads).toEqual([0, 4, 0, 0, 0, 0, 0])
        expect(result.sparks.revenue).toEqual([100.1, 0, 0, 0, 0, 0, 50.15])
    })
})
