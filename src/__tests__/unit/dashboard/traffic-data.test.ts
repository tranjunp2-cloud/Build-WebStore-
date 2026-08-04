/**
 * @fileoverview Tests for getTrafficData (F37 US-01 cross-feature regression)
 * TC-ID: TC-F37-01-14 (provisional — docs/qa/F37*.md)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
    getCurrentTenantId: vi.fn().mockResolvedValue('tenant-1'),
}))

const mockCount = vi.fn().mockResolvedValue({ totalDocs: 5 })
const mockFind = vi.fn().mockResolvedValue({ docs: [] })

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ count: mockCount, find: mockFind })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

describe('[TC-F37-01-14] getTrafficData — excludes internal feature-adoption events', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockCount.mockResolvedValue({ totalDocs: 5 })
        mockFind.mockResolvedValue({ docs: [] })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('excludes local_business_data_saved from the doc-list query used for Top Referrers/Pages', async () => {
        const { getTrafficData } = await import('@/lib/dashboard/traffic-data')
        await getTrafficData('7d', 'UTC')

        expect(mockFind).toHaveBeenCalledTimes(1)
        const findCall = mockFind.mock.calls[0][0]
        expect(findCall.where.event.not_in).toEqual(expect.arrayContaining(['local_business_data_saved']))
    })

    it('never counts a local_business_data_saved referrer toward Top Referrers even if returned by a misbehaving query', async () => {
        mockFind.mockResolvedValue({
            docs: [
                { createdAt: new Date().toISOString(), event: 'local_business_data_saved', pageUrl: '/editor/123', referrer: 'https://malicious-or-internal.example.com/' },
                { createdAt: new Date().toISOString(), event: 'pageview', pageUrl: '/', referrer: 'https://google.com/' },
            ],
        })

        const { getTrafficData } = await import('@/lib/dashboard/traffic-data')
        const result = await getTrafficData('7d', 'UTC')

        const referrerDomains = result.top.referrers.map(r => r.path)
        expect(referrerDomains).not.toContain('malicious-or-internal.example.com')
    })

    it('buckets a UTC event into the seller hour and queries the exact GMT+7 local day', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-08-03T05:00:00.000Z'))
        mockFind.mockResolvedValue({
            docs: [
                {
                    createdAt: '2026-08-03T04:44:00.000Z',
                    event: 'pageview',
                    pageUrl: '/',
                    referrer: '',
                },
            ],
        })

        const { getTrafficData } = await import('@/lib/dashboard/traffic-data')
        const result = await getTrafficData('today', 'Asia/Ho_Chi_Minh')

        expect(result.days[11]).toEqual({
            date: '2026-08-03',
            hour: 11,
            views: 1,
        })
        expect(result.days[4].views).toBe(0)

        const pageviewCountWhere = mockCount.mock.calls[0][0].where
        expect(pageviewCountWhere.createdAt).toEqual({
            greater_than_equal: '2026-08-02T17:00:00.000Z',
            less_than: '2026-08-03T17:00:00.000Z',
        })
        expect(mockFind.mock.calls[0][0].where.createdAt).toEqual(
            pageviewCountWhere.createdAt,
        )
    })

    it('buckets a UTC event into the seller hour and queries the exact GMT+8 local day', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-08-03T05:00:00.000Z'))
        mockFind.mockResolvedValue({
            docs: [
                {
                    createdAt: '2026-08-03T03:44:00.000Z',
                    event: 'pageview',
                    pageUrl: '/',
                    referrer: '',
                },
            ],
        })

        const { getTrafficData } = await import('@/lib/dashboard/traffic-data')
        const result = await getTrafficData('today', 'Asia/Kuala_Lumpur')

        expect(result.days[11]).toEqual({
            date: '2026-08-03',
            hour: 11,
            views: 1,
        })
        expect(result.days[3].views).toBe(0)
        expect(mockCount.mock.calls[0][0].where.createdAt).toEqual({
            greater_than_equal: '2026-08-02T16:00:00.000Z',
            less_than: '2026-08-03T16:00:00.000Z',
        })
    })

    it('uses viewer-local calendar boundaries and buckets for the 7-day series', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-08-03T05:00:00.000Z'))
        mockFind.mockResolvedValue({
            docs: [
                {
                    createdAt: '2026-08-02T16:30:00.000Z',
                    event: 'pageview',
                    pageUrl: '/',
                    referrer: '',
                },
            ],
        })

        const { getTrafficData } = await import('@/lib/dashboard/traffic-data')
        const result = await getTrafficData('7d', 'Asia/Kuala_Lumpur')

        expect(result.days).toHaveLength(7)
        expect(result.days[0].date).toBe('2026-07-28')
        expect(result.days[6]).toEqual({ date: '2026-08-03', views: 1 })
        expect(mockCount.mock.calls[0][0].where.createdAt).toEqual({
            greater_than_equal: '2026-07-27T16:00:00.000Z',
            less_than: '2026-08-03T16:00:00.000Z',
        })
    })
})
