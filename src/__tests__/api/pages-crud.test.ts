import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: unknown) => async (req: unknown, ctx: unknown) => (handler as Function)(mockUser, req, ctx)),
}))

const mockFind = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockFindByID = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        find: mockFind,
        create: mockCreate,
        update: mockUpdate,
        delete: mockDelete,
        findByID: mockFindByID,
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({
        id: 'mock-sub-1',
        plan: 'PROFESSIONAL_TM_USER',
        status: 'active',
        startDate: '2026-01-01T00:00:00.000Z',
    }),
    isSubscriptionActive: vi.fn().mockReturnValue(true),
    canUse: vi.fn().mockResolvedValue(true),
    canUseWithinLimit: vi.fn().mockResolvedValue(true),
    recordUsage: vi.fn().mockResolvedValue(undefined),
    reduceUsage: vi.fn().mockResolvedValue(undefined),
    getConsumed: vi.fn().mockResolvedValue(0),
}))

vi.mock('@/lib/subscriptions/feature-guard', () => ({
    withFeatureGuard: vi.fn(() => (h: any) => h),
}))

import { GET, POST } from '@/app/api/sites/[siteId]/pages/route'

// ─── TC-F05.02: Page Manager CRUD ────────────────────────────────────

const ctx = { params: Promise.resolve({ siteId: 'site-1' }) }

describe('GET /api/sites/[siteId]/pages [TC-F05.02]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns pages list for authorized site', async () => {
        // Arrange — site belongs to user's tenant
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 'site-1', tenant: 'tenant-1' }] }) // sites
            .mockResolvedValueOnce({ docs: [
                { id: 'p1', title: 'Home', slug: '/', _status: 'published', isHomepage: true, updatedAt: '2026-04-01' },
                { id: 'p2', title: 'About', slug: '/about', _status: 'draft', updatedAt: '2026-04-01' },
            ]}) // pages

        // Act
        const req = new Request('http://localhost/api/sites/site-1/pages')
        const res = await GET(req, ctx as { params: Promise<{ siteId: string }> })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.pages).toHaveLength(2)
        expect(body.pages[0].title).toBe('Home')
        expect(body.pages[0].isHomepage).toBe(true)
    })

    it('returns 403 for unauthorized site', async () => {
        mockFind.mockResolvedValueOnce({ docs: [] }) // no matching site

        const req = new Request('http://localhost/api/sites/other-site/pages')
        const res = await GET(req, ctx as { params: Promise<{ siteId: string }> })

        expect(res.status).toBe(403)
    })

    it('TC-F05-02-17: returns all pages beyond Payload default limit of 10 (queries with limit:0)', async () => {
        // Regression GH-1222: without an explicit limit Payload defaults to 10, so a
        // site's 11th+ page (e.g. a just-created page) silently dropped from the list.
        // Fix: pages query passes limit:0 → all pages returned.
        const fifteenPages = Array.from({ length: 15 }, (_, i) => ({
            id: `p${i + 1}`, title: `Page ${i + 1}`, slug: i === 0 ? '/' : `/page-${i + 1}`,
            _status: 'draft', updatedAt: '2026-04-01',
        }))
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 'site-1', tenant: 'tenant-1' }] }) // sites
            .mockResolvedValueOnce({ docs: fifteenPages }) // pages

        const req = new Request('http://localhost/api/sites/site-1/pages')
        const res = await GET(req, ctx as { params: Promise<{ siteId: string }> })
        const body = await res.json()

        expect(res.status).toBe(200)
        // All 15 returned — not truncated to the default 10.
        expect(body.pages).toHaveLength(15)
        // The pages query (2nd find call) must request limit:0 — this is the fix.
        const pagesFindArgs = mockFind.mock.calls[1][0]
        expect(pagesFindArgs.collection).toBe('pages')
        expect(pagesFindArgs.limit).toBe(0)
    })
})

describe('POST /api/sites/[siteId]/pages [TC-F05.02]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('creates page with valid data', async () => {
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 'site-1', tenant: 'tenant-1' }] }) // auth
            .mockResolvedValueOnce({ totalDocs: 3 }) // page count check
            .mockResolvedValueOnce({ docs: [] }) // no duplicate slug
        mockCreate.mockResolvedValue({
            id: 'p-new', title: 'Contact', slug: '/contact',
            _status: 'draft', isHomepage: false, isVisible: true,
            seo: {}, updatedAt: '2026-04-01',
        })

        const req = { json: () => Promise.resolve({ title: 'Contact', slug: 'contact' }) } as unknown as Request
        const res = await POST(req, ctx as { params: Promise<{ siteId: string }> })
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.page.title).toBe('Contact')
        expect(body.page.slug).toBe('/contact')
    })

    it('returns 409 for duplicate slug', async () => {
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 'site-1', tenant: 'tenant-1' }] })
            .mockResolvedValueOnce({ totalDocs: 3 }) // page count check
            .mockResolvedValueOnce({ docs: [{ id: 'existing' }] }) // duplicate

        const req = { json: () => Promise.resolve({ title: 'About', slug: 'about' }) } as unknown as Request
        const res = await POST(req, ctx as { params: Promise<{ siteId: string }> })

        expect(res.status).toBe(409)
    })

    it('returns 400 for invalid slug', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: 'site-1', tenant: 'tenant-1' }] })

        const req = { json: () => Promise.resolve({ title: 'Bad', slug: 'Bad Slug!!!' }) } as unknown as Request
        const res = await POST(req, ctx as { params: Promise<{ siteId: string }> })

        expect(res.status).toBe(400)
    })

    it('returns 403 for unauthorized site', async () => {
        mockFind.mockResolvedValueOnce({ docs: [] })

        const req = { json: () => Promise.resolve({ title: 'X', slug: 'x' }) } as unknown as Request
        const res = await POST(req, ctx as { params: Promise<{ siteId: string }> })

        expect(res.status).toBe(403)
    })
})
