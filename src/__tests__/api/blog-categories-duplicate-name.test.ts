// GH-2265: a blog category name that already exists (other case, accents, or kept by a rename)
// must be refused on create AND on rename, with code DUPLICATE_SLUG.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'

const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)),
    getCurrentUser: vi.fn(async () => mockUser),
}))

const mockFind = vi.fn()
const mockFindByID = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ find: mockFind, findByID: mockFindByID, create: mockCreate, update: mockUpdate })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/subscriptions/feature-guard', () => ({
    withFeatureGuard: vi.fn(() => (h: any) => h),
}))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({ id: 'sub-1', plan: 'PROFESSIONAL_TM_USER', status: 'active' }),
    canUse: vi.fn().mockResolvedValue(true),
}))

import { blogCategoryNameTaken } from '@/lib/blog/blog-category-name'
import { POST } from '@/app/api/blog-categories/route'
import { PATCH } from '@/app/api/blog-categories/[id]/route'
import { createBlogCategoryAction, updateBlogCategoryAction } from '@/app/(dashboard)/blog/actions'

// A store that has "Recent News", a "Tin tức" category, and "Tips" — renamed from "News" via the API,
// so it still holds the slug "news".
const STORE = [
    { id: 'cat-1', name: 'Recent News', slug: 'recent-news' },
    { id: 'cat-2', name: 'Tin tức', slug: 'tin-tuc' },
    { id: 'cat-3', name: 'Tips', slug: 'news' },
]
const jsonReq = (body: unknown) => ({ json: () => Promise.resolve(body) }) as unknown as Request
const payloadStub = { find: mockFind } as unknown as Payload

describe('[TC-F17-05-02] blogCategoryNameTaken', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFind.mockResolvedValue({ docs: STORE })
    })

    it.each([
        ['recent news', 'other letter case'],
        ['  Recent   News ', 'extra spaces'],
        ['Tin tuc', 'missing accents'],
        ['News', 'a slug a rename kept'],
    ])('"%s" is taken (%s)', async (name) => {
        // Arrange / Act
        const taken = await blogCategoryNameTaken(payloadStub, { tenantId: 'tenant-1', name })

        // Assert
        expect(taken).toBe(true)
    })

    it('a new name is free, and only this tenant is searched', async () => {
        // Arrange / Act
        const taken = await blogCategoryNameTaken(payloadStub, { tenantId: 'tenant-1', name: 'Events' })

        // Assert
        expect(taken).toBe(false)
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'blog_categories', where: { tenant: { equals: 'tenant-1' } }, depth: 0,
        }))
    })

    it('a category does not clash with itself when renamed to its own name in another case', async () => {
        // Arrange / Act
        const taken = await blogCategoryNameTaken(payloadStub, { tenantId: 'tenant-1', name: 'RECENT NEWS', excludeId: 'cat-1' })

        // Assert
        expect(taken).toBe(false)
    })
})

describe('[TC-F17-05-02] API routes refuse a taken name', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFind.mockResolvedValue({ docs: STORE })
    })

    it('POST "recent news" → 409 DUPLICATE_SLUG, nothing created', async () => {
        // Arrange / Act
        const res = await POST(jsonReq({ name: 'recent news' }), {} as any)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(409)
        expect(body.error.code).toBe('DUPLICATE_SLUG')
        expect(mockCreate).not.toHaveBeenCalled()
    })

    it('PATCH renaming "Tips" to "Recent News" → 409 DUPLICATE_SLUG, nothing updated', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ id: 'cat-3', tenant: 'tenant-1', name: 'Tips' })

        // Act
        const res = await PATCH(jsonReq({ name: 'Recent News' }), { params: Promise.resolve({ id: 'cat-3' }) } as any)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(409)
        expect(body.error.code).toBe('DUPLICATE_SLUG')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('PATCH to a free name still saves', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ id: 'cat-3', tenant: 'tenant-1', name: 'Tips' })
        mockUpdate.mockResolvedValue({ id: 'cat-3', name: 'Guides' })

        // Act
        const res = await PATCH(jsonReq({ name: 'Guides' }), { params: Promise.resolve({ id: 'cat-3' }) } as any)

        // Assert
        expect(res.status).toBe(200)
        expect(mockUpdate).toHaveBeenCalledTimes(1)
    })
})

describe('[TC-F17-05-02] Server actions refuse a taken name with a code the UI can read', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFind.mockImplementation(async ({ collection }: { collection: string }) =>
            collection === 'sites' ? { docs: [{ id: 'site-1' }] } : { docs: STORE })
    })

    it('create "recent news" → DUPLICATE_SLUG (used to pass the exact-name check, then fail on the index)', async () => {
        // Arrange / Act
        const result = await createBlogCategoryAction({ name: 'recent news' })

        // Assert
        expect(result).toEqual({ error: 'A category with this name already exists', code: 'DUPLICATE_SLUG' })
        expect(mockCreate).not.toHaveBeenCalled()
    })

    it('rename "Tips" to "recent news" → DUPLICATE_SLUG, nothing updated', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ id: 'cat-3', tenant: 'tenant-1', name: 'Tips' })

        // Act
        const result = await updateBlogCategoryAction('cat-3', { name: 'recent news' })

        // Assert
        expect(result).toEqual({ error: 'A category with this name already exists', code: 'DUPLICATE_SLUG' })
        expect(mockUpdate).not.toHaveBeenCalled()
    })
})
