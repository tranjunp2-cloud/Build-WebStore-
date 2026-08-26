import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock auth
const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)),
    getCurrentUser: vi.fn(() => Promise.resolve(mockUser)),
}))

const mockFind = vi.fn()
const mockCreate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ find: mockFind, create: mockCreate })),
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

import { GET, POST } from '@/app/api/blogs/route'

// ─── TC-F17: Blog CRUD API ───────────────────────────────────────────

describe('GET /api/blogs [TC-F17]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns paginated blog list', async () => {
        mockFind.mockResolvedValue({
            docs: [{ id: 1, title: 'Post 1' }],
            totalDocs: 1,
            totalPages: 1,
            page: 1,
            limit: 20,
            hasPrevPage: false,
            hasNextPage: false,
        })

        const req = new Request('http://localhost/api/blogs')
        const res = await GET(req, {} as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body).toHaveProperty('success', true)
        expect(body.data).toHaveLength(1)
    })

    it('supports search query param', async () => {
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0, totalPages: 0, page: 1, limit: 20, hasPrevPage: false, hasNextPage: false })

        const req = new Request('http://localhost/api/blogs?search=test')
        await GET(req, {} as any)

        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ title: { contains: 'test' } }),
            }),
        )
    })

    it('supports status filter', async () => {
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0, totalPages: 0, page: 1, limit: 20, hasPrevPage: false, hasNextPage: false })

        const req = new Request('http://localhost/api/blogs?status=published')
        await GET(req, {} as any)

        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ status: { equals: 'published' } }),
            }),
        )
    })
})

describe('POST /api/blogs [TC-F17]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('creates a blog post', async () => {
        mockFind.mockResolvedValue({ docs: [] }) // sites find + slug check
        mockCreate.mockResolvedValue({ id: 1, title: 'New Post', slug: 'new-post' })

        // First call: sites lookup, second call: slug check
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 'site-1' }] }) // sites
            .mockResolvedValueOnce({ docs: [] }) // slug uniqueness

        const req = {
            json: () => Promise.resolve({ title: 'New Post' }),
            url: 'http://localhost/api/blogs',
        } as unknown as Request

        const res = await POST(req, {} as any)

        expect(res.status).toBe(201)
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'blogs',
                data: expect.objectContaining({ title: 'New Post' }),
                user: mockUser,
                overrideAccess: false,
            }),
        )
    })

    it('returns 400 when no tenant found', async () => {
        // Mutate the shared mockUser reference directly — POST already
        // closed over this object via withAuth at import time, so
        // rebinding withAuth would not affect the existing handler.
        const originalTenants = mockUser.tenants
        mockUser.tenants = [] as any

        const req = {
            json: () => Promise.resolve({ title: 'Post' }),
            url: 'http://localhost/api/blogs',
        } as unknown as Request

        const res = await POST(req, {} as any)
        expect(res.status).toBe(400)

        // Restore for other tests
        mockUser.tenants = originalTenants
    })

    it('returns 400 VALIDATION_ERROR when category belongs to a different tenant', async () => {
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 'site-1' }] })
            .mockResolvedValueOnce({ docs: [] })
        mockCreate.mockRejectedValueOnce(new Error('BLOG_CATEGORY_TENANT_MISMATCH'))

        const req = {
            json: () => Promise.resolve({ title: 'New Post', category: '999' }),
            url: 'http://localhost/api/blogs',
        } as unknown as Request

        const res = await POST(req, {} as any)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
        expect(body.error.details).toBe('Invalid category selection')
    })
})
