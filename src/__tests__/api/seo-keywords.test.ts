import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockUser = {
    id: 1,
    roles: [] as string[],
    tenants: [{ tenant: 'tenant-1' }],
}
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)),
}))

const mockFindByID = vi.fn()
const mockFind = vi.fn()
const mockUpdate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        findByID: mockFindByID,
        find: mockFind,
        update: mockUpdate,
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/seo/rank-tracker', () => ({
    checkKeywordRank: vi.fn().mockResolvedValue(7),
}))

import { GET, POST, DELETE } from '@/app/api/seo/keywords/route'

// ─── TC-F03.46: Keyword chip array handling ───────────────────────────
// ─── TC-F03.47: Keyword limit enforcement (max 5) ────────────────────

describe('GET /api/seo/keywords [TC-F03.46]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns keyword list with trend calculation', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            tenant: 'tenant-1',
            seo: {
                trackedKeywords: [
                    { id: 'k1', keyword: 'cafe KL', currentRank: 3, previousRank: 5, lastCheckedAt: '2026-03-01' },
                    { id: 'k2', keyword: 'nasi lemak', currentRank: 8, previousRank: 8, lastCheckedAt: '2026-03-01' },
                ],
            },
        })

        // Act
        const req = new Request('http://localhost/api/seo/keywords?siteId=site-1')
        const res = await GET(req, {} as any)
        const body = await res.json()

        // Assert
        expect(body.success).toBe(true)
        expect(body.data.keywords).toHaveLength(2)
        expect(body.data.keywords[0].trend).toBe('up')   // 3 < 5 = improved
        expect(body.data.keywords[1].trend).toBe('same')  // 8 == 8
    })

    it('returns 400 when siteId missing', async () => {
        const req = new Request('http://localhost/api/seo/keywords')
        const res = await GET(req, {} as any)
        expect(res.status).toBe(400)
    })

    it('returns 403 for unauthorized site access', async () => {
        mockFindByID.mockResolvedValue({ id: 'site-1', tenant: 'other-tenant', seo: {} })
        const req = new Request('http://localhost/api/seo/keywords?siteId=site-1')
        const res = await GET(req, {} as any)
        expect(res.status).toBe(403)
    })
})

describe('POST /api/seo/keywords [TC-F03.47]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('adds keyword and checks initial rank', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            tenant: 'tenant-1',
            domain: 'test.com',
            seo: { trackedKeywords: [] },
        })
        mockFind.mockResolvedValue({
            docs: [{ seo: { trackedKeywords: [] } }],
        })
        mockUpdate.mockResolvedValue({
            seo: { trackedKeywords: [{ id: 'k1', keyword: 'coffee', currentRank: 7 }] },
        })

        // Act
        const req = { json: () => Promise.resolve({ siteId: 'site-1', keyword: 'coffee' }) } as unknown as Request
        const res = await POST(req, {} as any)
        const body = await res.json()

        // Assert
        expect(body.success).toBe(true)
        expect(body.data.keyword).toBe('coffee')
        expect(body.data.rank).toBe(7)
    })

    it('rejects when max 5 keywords reached [TC-F03.47]', async () => {
        // Arrange — 5 keywords already across tenant
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            tenant: 'tenant-1',
            seo: { trackedKeywords: [] },
        })
        mockFind.mockResolvedValue({
            docs: [
                { seo: { trackedKeywords: [{ keyword: 'a' }, { keyword: 'b' }, { keyword: 'c' }] } },
                { seo: { trackedKeywords: [{ keyword: 'd' }, { keyword: 'e' }] } },
            ],
        })

        // Act
        const req = { json: () => Promise.resolve({ siteId: 'site-1', keyword: 'sixth' }) } as unknown as Request
        const res = await POST(req, {} as any)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(400)
        expect(body.error.code).toBe('MAX_KEYWORDS_REACHED')
    })

    it('rejects duplicate keyword (case-insensitive)', async () => {
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            tenant: 'tenant-1',
            seo: { trackedKeywords: [{ keyword: 'Coffee' }] },
        })
        mockFind.mockResolvedValue({ docs: [{ seo: { trackedKeywords: [{ keyword: 'Coffee' }] } }] })

        const req = { json: () => Promise.resolve({ siteId: 'site-1', keyword: 'coffee' }) } as unknown as Request
        const res = await POST(req, {} as any)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('KEYWORD_EXISTS')
    })
})

describe('DELETE /api/seo/keywords', () => {
    beforeEach(() => vi.clearAllMocks())

    it('removes keyword from tracked list', async () => {
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            tenant: 'tenant-1',
            seo: {
                trackedKeywords: [
                    { id: 'k1', keyword: 'remove' },
                    { id: 'k2', keyword: 'keep' },
                ],
            },
        })
        mockUpdate.mockResolvedValue({})

        const req = new Request('http://localhost/api/seo/keywords?siteId=site-1&keywordId=k1')
        const res = await DELETE(req, {} as any)
        const body = await res.json()

        expect(body.success).toBe(true)
        expect(body.data.deleted).toBe(true)
    })

    it('returns 404 when keyword not found', async () => {
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            tenant: 'tenant-1',
            seo: { trackedKeywords: [{ id: 'k1' }] },
        })

        const req = new Request('http://localhost/api/seo/keywords?siteId=site-1&keywordId=nonexistent')
        const res = await DELETE(req, {} as any)
        expect(res.status).toBe(404)
    })

    it('returns 400 when params missing', async () => {
        const req = new Request('http://localhost/api/seo/keywords')
        const res = await DELETE(req, {} as any)
        expect(res.status).toBe(400)
    })
})
