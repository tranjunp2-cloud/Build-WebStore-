/**
 * Unit Tests — Dashboard & Analytics Summary APIs
 * Coverage Map (QA Doc Traceability):
 *   TC-F03.01  → Dashboard summary returns metrics
 *   TC-F03.02  → Cache hit returns cached data
 *   TC-F03.17  → Tenant auth check
 *   TC-F03.20  → Analytics summary returns chart data
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cacheGet, cacheSet, cacheDelete } from '@/lib/cache'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockUser = { id: 1, roles: [] as string[], tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any) => handler(mockUser, req)),
}))

const mockCount = vi.fn().mockResolvedValue({ totalDocs: 10 })
const mockFind = vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 })
const mockExecute = vi.fn().mockResolvedValue({ rows: [{ count: '100' }] })

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        count: mockCount,
        find: mockFind,
        findByID: vi.fn().mockResolvedValue({ id: 'tenant-1', settings: {} }),
        db: { drizzle: { execute: mockExecute } },
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
// ─── Tests ────────────────────────────────────────────────────────────

describe('GET /api/dashboard/summary [TC-F03.01, TC-F03.02, TC-F03.17]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUser.tenants = [{ tenant: 'tenant-1' }]
        cacheDelete('dashboard:tenant-1:7d')
    })

    it('[TC-F03.01] returns metrics, series, and pendingOrders', async () => {
        const { GET } = await import('@/app/api/dashboard/summary/route')
        const req = new Request('http://localhost/api/dashboard/summary?period=7d')

        const res = await GET(req, {} as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.metrics).toBeDefined()
        expect(body.data.metrics.views).toBeDefined()
        expect(body.data.metrics.leads).toBeDefined()
        expect(body.data.metrics.revenue).toBeDefined()
        expect(body.data.series).toBeDefined()
        expect(body.data.series.views).toBeInstanceOf(Array)
        expect(body.data.pendingOrders).toBeInstanceOf(Array)
    })

    it('[TC-F03.02] returns cached data on cache hit', async () => {
        const cachedData = { metrics: { views: 999 }, series: {}, pendingOrders: [] }
        cacheSet('dashboard:tenant-1:7d', cachedData)

        const { GET } = await import('@/app/api/dashboard/summary/route')
        const req = new Request('http://localhost/api/dashboard/summary?period=7d')

        const res = await GET(req, {} as any)
        const body = await res.json()

        expect(body.data.metrics.views).toBe(999)
        expect(res.headers.get('Cache-Control')).toBe('private, max-age=60')
    })

    it('[TC-F03.17] returns 403 when user has no tenant', async () => {
        mockUser.tenants = []

        const { GET } = await import('@/app/api/dashboard/summary/route')
        const req = new Request('http://localhost/api/dashboard/summary?period=7d')

        const res = await GET(req, {} as any)
        expect(res.status).toBe(403)
    })

    it('sets Cache-Control header on fresh response', async () => {
        const { GET } = await import('@/app/api/dashboard/summary/route')
        const req = new Request('http://localhost/api/dashboard/summary?period=7d')

        const res = await GET(req, {} as any)
        expect(res.headers.get('Cache-Control')).toBe('private, max-age=60')
    })

    it('defaults period to 7d when not specified', async () => {
        const { GET } = await import('@/app/api/dashboard/summary/route')
        const req = new Request('http://localhost/api/dashboard/summary')

        const res = await GET(req, {} as any)
        const body = await res.json()

        expect(body.success).toBe(true)
    })
})

describe('GET /api/analytics/summary [TC-F03.20]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUser.tenants = [{ tenant: 'tenant-1' }]
        cacheDelete('analytics:tenant-1:7d')
    })

    it('[TC-F03.20] returns chart, topPages, metrics', async () => {
        // Need non-zero data to avoid empty state
        mockCount.mockResolvedValue({ totalDocs: 5 })
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0 })

        const { GET } = await import('@/app/api/analytics/summary/route')
        const req = new Request('http://localhost/api/analytics/summary?period=7d')

        const res = await GET(req, {} as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.chart).toBeDefined()
        expect(body.data.topPages).toBeDefined()
        expect(body.data.metrics).toBeDefined()
    })

    it('returns empty state when no analytics data', async () => {
        mockCount.mockResolvedValue({ totalDocs: 0 })

        const { GET } = await import('@/app/api/analytics/summary/route')
        const req = new Request('http://localhost/api/analytics/summary?period=7d')

        const res = await GET(req, {} as any)
        const body = await res.json()

        expect(body.data.empty).toBe(true)
    })

    it('returns 403 when user has no tenant', async () => {
        mockUser.tenants = []

        const { GET } = await import('@/app/api/analytics/summary/route')
        const req = new Request('http://localhost/api/analytics/summary?period=7d')

        const res = await GET(req, {} as any)
        expect(res.status).toBe(403)
    })

    it('[TC-F37-01-13] excludes internal feature-adoption events (local_business_data_saved) from views/clicks counts and the doc-list query, so they never pollute topPages/chart', async () => {
        mockCount.mockResolvedValue({ totalDocs: 5 })
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0 })

        const { GET } = await import('@/app/api/analytics/summary/route')
        const req = new Request('http://localhost/api/analytics/summary?period=7d')
        await GET(req, {} as any)

        const notInFilter = (call: any[]) => call[0]?.where?.event?.not_in
        const viewsCountCalls = mockCount.mock.calls.filter(call => Array.isArray(notInFilter(call)))
        // Both current-period AND previous-period views-count queries must exclude
        // internal events — a fix that only covers the current period would let
        // pollution silently reappear in the week-over-week trend (prevViews).
        expect(viewsCountCalls.length).toBe(2)
        for (const call of viewsCountCalls) {
            expect(notInFilter(call)).toEqual(expect.arrayContaining(['local_business_data_saved']))
        }

        const findCall = mockFind.mock.calls[0]
        expect(findCall[0].where.event.not_in).toEqual(expect.arrayContaining(['local_business_data_saved']))
    })
})
