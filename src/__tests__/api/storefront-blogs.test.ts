import { describe, it, expect, vi, beforeEach } from 'vitest'

// No auth mock — storefront is public
const mockFind = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ find: mockFind })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { GET } from '@/app/api/storefront/blogs/route'
// #2179: store availability has its own tests (store-unavailable.test.ts); here a store is unavailable only when suspended.
vi.mock('@/lib/storefront/store-availability', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/storefront/store-availability')>()),
    isTenantUnavailable: vi.fn(async (_payload: unknown, tenant: { status?: unknown } | null) => tenant?.status === 'suspended'),
    isTenantIdUnavailable: vi.fn(async () => false),
}))
import { isTenantIdUnavailable, isTenantUnavailable } from '@/lib/storefront/store-availability'

describe('GET /api/storefront/blogs [TC-F17-07]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('[TC-01] returns published blogs for valid tenant', async () => {
        mockFind.mockResolvedValue({ docs: [{ id: 1, title: 'Post', status: 'published' }], totalDocs: 1, page: 1, totalPages: 1 })
        const req = new Request('http://localhost/api/storefront/blogs?tenant=1&limit=12')
        const res = await GET(req)
        const body = await res.json()
        expect(res.status).toBe(200)
        expect(body.docs).toHaveLength(1)
        expect(body.totalDocs).toBe(1)
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'blogs',
            where: expect.objectContaining({
                and: expect.arrayContaining([
                    { tenant: { equals: '1' } },
                    { status: { equals: 'published' } },
                ]),
            }),
            overrideAccess: true,
        }))
    })

    it('[TC-F09.283] unavailable store returns no blogs', async () => {
        vi.mocked(isTenantIdUnavailable).mockResolvedValueOnce(true)

        const res = await GET(new Request('http://localhost/api/storefront/blogs?tenant=1'))

        expect(await res.json()).toEqual({ docs: [], totalDocs: 0 })
        expect(mockFind).not.toHaveBeenCalled()
    })

    it('[TC-02] returns empty for missing tenant', async () => {
        const req = new Request('http://localhost/api/storefront/blogs')
        const res = await GET(req)
        const body = await res.json()
        expect(body.docs).toEqual([])
        expect(body.totalDocs).toBe(0)
        expect(mockFind).not.toHaveBeenCalled()
    })

    it('[TC-03] only queries published status', async () => {
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0, page: 1, totalPages: 0 })
        const req = new Request('http://localhost/api/storefront/blogs?tenant=1')
        await GET(req)
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                and: expect.arrayContaining([
                    { status: { equals: 'published' } },
                ]),
            }),
        }))
    })

    it('[TC-04] filters by category slug via two-step lookup', async () => {
        // First call: category lookup by slug
        mockFind.mockResolvedValueOnce({ docs: [{ id: 'cat-1', slug: 'tech' }] })
        // Second call: blogs filtered by category ID
        mockFind.mockResolvedValueOnce({ docs: [], totalDocs: 0, page: 1, totalPages: 0 })
        const req = new Request('http://localhost/api/storefront/blogs?tenant=1&category=tech')
        await GET(req)
        // First call: lookup category by slug
        expect(mockFind).toHaveBeenNthCalledWith(1, expect.objectContaining({
            collection: 'blog_categories',
            where: expect.objectContaining({
                and: expect.arrayContaining([
                    { slug: { equals: 'tech' } },
                    { tenant: { equals: '1' } },
                ]),
            }),
        }))
        // Second call: blogs with category filter
        expect(mockFind).toHaveBeenNthCalledWith(2, expect.objectContaining({
            collection: 'blogs',
            where: expect.objectContaining({
                and: expect.arrayContaining([
                    { category: { equals: 'cat-1' } },
                ]),
            }),
        }))
    })

    it('[TC-05] passes pagination params', async () => {
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0, page: 2, totalPages: 3 })
        const req = new Request('http://localhost/api/storefront/blogs?tenant=1&page=2&limit=6')
        await GET(req)
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 6 }))
    })

    it('[TC-06] returns totalPages in response', async () => {
        mockFind.mockResolvedValue({ docs: [], totalDocs: 25, page: 1, totalPages: 3 })
        const req = new Request('http://localhost/api/storefront/blogs?tenant=1')
        const res = await GET(req)
        const body = await res.json()
        expect(body.totalPages).toBe(3)
        expect(body.page).toBe(1)
    })

    it('[TC-PERF-128] reads only the card fields: no tenant row, no author row', async () => {
        // Arrange
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0, page: 1, totalPages: 0 })

        // Act
        await GET(new Request('http://localhost/api/storefront/blogs?tenant=1'))

        // Assert
        const args = mockFind.mock.calls.find(([a]) => a.collection === 'blogs')![0]
        expect(args.depth).toBe(1)
        expect(args.select).toMatchObject({ title: true, slug: true, category: true, thumbnail: true })
        expect(args.select).not.toHaveProperty('tenant')
        expect(args.select).not.toHaveProperty('site')
        expect(args.select).not.toHaveProperty('author')
        expect(Object.keys(args.populate).sort()).toEqual(['blog_categories', 'media'])
    })
})

