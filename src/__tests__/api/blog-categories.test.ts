import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)),
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

import { GET, POST } from '@/app/api/blog-categories/route'

// ─── TC-F17: Blog categories API ─────────────────────────────────────

describe('GET /api/blog-categories [TC-F17]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns all categories (hard-delete means no soft-deleted in DB)', async () => {
        mockFind.mockResolvedValue({
            docs: [
                { id: 1, name: 'Tech', status: 'active' },
                { id: 2, name: 'News', status: 'active' },
            ],
        })

        const req = new Request('http://localhost')
        const res = await GET(req, {} as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data).toHaveLength(2)
        expect(body.data[0].name).toBe('Tech')
    })
})

describe('POST /api/blog-categories [TC-F17]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('creates category with valid name', async () => {
        mockFind.mockResolvedValue({ docs: [] }) // no duplicate
        mockCreate.mockResolvedValue({ id: 1, name: 'New Category', slug: 'new-category' })

        const req = { json: () => Promise.resolve({ name: 'New Category' }) } as unknown as Request
        const res = await POST(req, {} as any)
        const body = await res.json()

        expect(res.status).toBe(201)
        expect(body.data.name).toBe('New Category')
    })

    it('returns 409 for duplicate slug', async () => {
        mockFind.mockResolvedValue({ docs: [{ id: 1, name: 'Existing', slug: 'existing' }] }) // existing category

        const req = { json: () => Promise.resolve({ name: 'Existing' }) } as unknown as Request
        const res = await POST(req, {} as any)
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error.code).toBe('DUPLICATE_SLUG')
    })

    it('rejects empty name', async () => {
        const req = { json: () => Promise.resolve({ name: '' }) } as unknown as Request
        const res = await POST(req, {} as any)

        expect(res.status).toBe(400)
    })
})

describe('blog categories keep the tenant an id [TC-PERF-129]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('GET and POST read at depth 0, so no tenant row (Xendit / EasyParcel secrets) reaches the browser', async () => {
        // Arrange
        mockFind.mockResolvedValue({ docs: [] })
        mockCreate.mockResolvedValue({ id: 1, name: 'Tips', slug: 'tips', tenant: 'tenant-1' })

        // Act
        await GET(new Request('http://localhost'), {} as any)
        await POST({ json: () => Promise.resolve({ name: 'Tips' }) } as unknown as Request, {} as any)

        // Assert
        expect(mockFind.mock.calls[0][0]).toMatchObject({ collection: 'blog_categories', depth: 0 })
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ collection: 'blog_categories', depth: 0 }))
    })
})
