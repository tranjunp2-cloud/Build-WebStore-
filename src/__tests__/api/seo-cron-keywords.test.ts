import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockFind = vi.fn()
const mockUpdate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ find: mockFind, update: mockUpdate })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/seo/rank-tracker', () => ({
    checkKeywordRank: vi.fn().mockResolvedValue(5),
}))

import { GET } from '@/app/api/seo/cron/keywords/route'

// ─── TC-F03.48: SERP ranking cron update ──────────────────────────────

function mockReq(authHeader?: string) {
    return {
        headers: { get: (name: string) => name === 'authorization' ? authHeader ?? null : null },
    } as unknown as Request
}

describe('GET /api/seo/cron/keywords [TC-F03.48]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        delete process.env.NODE_ENV
    })

    it('updates keyword rankings for sites with tracked keywords', async () => {
        // Arrange
        mockFind.mockResolvedValue({
            docs: [{
                id: 'site-1',
                domain: 'test.com',
                name: 'Test',
                seo: {
                    trackedKeywords: [{
                        keyword: 'best cafe',
                        currentRank: 10,
                        previousRank: 12,
                        lastCheckedAt: new Date(0).toISOString(), // very old
                    }],
                },
            }],
        })
        mockUpdate.mockResolvedValue({})

        // Act
        const res = await GET(mockReq('Bearer dev-cron-secret'))
        const body = await res.json()

        // Assert
        expect(body.success).toBe(true)
        expect(body.message).toContain('1 keywords')
        expect(mockUpdate).toHaveBeenCalled()
    })

    it('skips keywords checked within 23 hours', async () => {
        // Arrange — checked 1 hour ago
        mockFind.mockResolvedValue({
            docs: [{
                id: 'site-1',
                domain: 'test.com',
                seo: {
                    trackedKeywords: [{
                        keyword: 'cafe',
                        currentRank: 3,
                        lastCheckedAt: new Date().toISOString(), // just now
                    }],
                },
            }],
        })

        // Act
        const res = await GET(mockReq('Bearer dev-cron-secret'))
        const body = await res.json()

        // Assert — no updates because recently checked
        expect(body.message).toContain('0 keywords')
    })

    it('skips sites without tracked keywords', async () => {
        // Arrange
        mockFind.mockResolvedValue({
            docs: [
                { id: 'site-1', seo: {} },
                { id: 'site-2', seo: { trackedKeywords: [] } },
            ],
        })

        // Act
        const res = await GET(mockReq('Bearer dev-cron-secret'))
        const body = await res.json()

        // Assert
        expect(body.message).toContain('0 keywords')
        expect(body.message).toContain('0 sites')
    })

    it('returns 401 in production without valid token', async () => {
        // Arrange
        process.env.NODE_ENV = 'production'

        // Act
        const res = await GET(mockReq('Bearer wrong-secret'))

        // Assert
        expect(res.status).toBe(401)
    })

    it('allows access in development without token', async () => {
        // Arrange — dev mode (NODE_ENV not 'production')
        mockFind.mockResolvedValue({ docs: [] })

        // Act
        const res = await GET(mockReq())
        const body = await res.json()

        // Assert
        expect(body.success).toBe(true)
    })
})
