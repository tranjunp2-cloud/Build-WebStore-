/**
 * Unit Tests — Analytics Summary API
 * Coverage Map (QA Doc Traceability):
 *   TC-F03.20  → Analytics summary returns chart data
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cacheDelete } from '@/lib/cache'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockUser = { id: 1, roles: [] as string[], tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any) => handler(mockUser, req)),
}))

const mockCount = vi.fn().mockResolvedValue({ totalDocs: 10 })
const mockFind = vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 })
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        count: mockCount,
        find: mockFind,
        findByID: vi.fn().mockResolvedValue({ id: 'tenant-1', settings: {} }),
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
// ─── Tests ────────────────────────────────────────────────────────────

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
