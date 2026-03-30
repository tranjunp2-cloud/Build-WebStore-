import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindByID = vi.fn()
const mockCreate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID, create: mockCreate })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { POST } from '@/app/api/analytics/track/route'

// ─── TC-F22.02: Analytics tracking endpoint ──────────────────────────

function mockReq(body: any) {
    return {
        json: () => Promise.resolve(body),
        headers: { get: (name: string) => name === 'x-forwarded-for' ? '1.2.3.4' : name === 'user-agent' ? 'TestBot/1.0' : null },
        nextUrl: { searchParams: new URLSearchParams() },
    } as any
}

describe('POST /api/analytics/track [TC-F22.02]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('tracks pageview with valid data', async () => {
        mockFindByID.mockResolvedValue({ id: 'site-1', tenant: 'tenant-1' })
        mockCreate.mockResolvedValue({})

        const res = await POST(mockReq({ siteId: 'site-1', pageUrl: '/home' }))
        const body = await res.json()

        expect(body.success).toBe(true)
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'analytics',
        }))
    })

    it('returns 404 when site not found', async () => {
        mockFindByID.mockResolvedValue(null)

        const res = await POST(mockReq({ siteId: 'bad', pageUrl: '/x' }))
        expect(res.status).toBe(404)
    })

    it('returns 400 for missing siteId', async () => {
        const res = await POST(mockReq({ pageUrl: '/x' }))
        expect(res.status).toBe(400)
    })

    it('silently succeeds on error (never breaks page)', async () => {
        mockFindByID.mockRejectedValue(new Error('DB down'))

        const res = await POST(mockReq({ siteId: 's1', pageUrl: '/x' }))
        const body = await res.json()
        expect(body.success).toBe(true) // never returns error
    })
})
