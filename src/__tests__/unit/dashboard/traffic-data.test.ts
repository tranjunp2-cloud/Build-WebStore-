/**
 * @fileoverview Tests for getTrafficData (F37 US-01 cross-feature regression)
 * TC-ID: TC-F37-01-14 (provisional — docs/qa/F37*.md)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

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

    it('excludes local_business_data_saved from the doc-list query used for Top Referrers/Pages', async () => {
        const { getTrafficData } = await import('@/lib/dashboard/traffic-data')
        await getTrafficData('7d')

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
        const result = await getTrafficData('7d')

        const referrerDomains = result.top.referrers.map(r => r.path)
        expect(referrerDomains).not.toContain('malicious-or-internal.example.com')
    })
})
