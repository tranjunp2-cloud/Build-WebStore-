import { describe, it, expect, vi, beforeEach } from 'vitest'

// No auth mock — storefront is public
const mockFind = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ find: mockFind })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { GET } from '@/app/api/storefront/blogs/route'

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
            where: expect.objectContaining({ status: { equals: 'published' }, tenant: { equals: '1' } }),
            overrideAccess: true,
        }))
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
            where: expect.objectContaining({ status: { equals: 'published' } }),
        }))
    })

    it('[TC-04] filters by category slug', async () => {
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0, page: 1, totalPages: 0 })
        const req = new Request('http://localhost/api/storefront/blogs?tenant=1&category=tech')
        await GET(req)
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ 'category.slug': { equals: 'tech' } }),
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
})
