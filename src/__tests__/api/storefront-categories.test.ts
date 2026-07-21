import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFind = vi.fn()

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ find: mockFind })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: vi.fn(async () => ({ allowed: true, resetAt: Date.now() + 1_000 })),
}))

import { GET } from '@/app/api/storefront/categories/route'

describe('GET /api/storefront/categories [TC-F09.242]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('[TC-F09.242] valid site returns flat, site-scoped categories with normalized parent ids', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({
            docs: [
                { id: 10, name: 'Parent', slug: 'parent', parent: null, breadcrumbs: 'Parent', tenant: 999 },
                { id: 11, name: 'Child', slug: 'child', parent: { id: 10 }, breadcrumbs: 'Parent > Child' },
            ],
        })
        const req = new Request('http://localhost/api/storefront/categories?site=2')

        // Act
        const res = await GET(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body).toEqual({
            docs: [
                { id: 10, name: 'Parent', slug: 'parent', parent: null, breadcrumbs: 'Parent' },
                { id: 11, name: 'Child', slug: 'child', parent: 10, breadcrumbs: 'Parent > Child' },
            ],
        })
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'categories',
            where: expect.objectContaining({
                and: expect.arrayContaining([
                    { site: { equals: 2 } },
                    { deletedAt: { exists: false } },
                ]),
            }),
            select: {
                name: true,
                slug: true,
                parent: true,
                breadcrumbs: true,
            },
            overrideAccess: true,
        }))
    })

    it('[TC-F09.242] paginates through all category pages before building the response tree', async () => {
        // Arrange
        mockFind
            .mockResolvedValueOnce({
                docs: [
                    { id: 10, name: 'Parent', slug: 'parent', parent: null, breadcrumbs: 'Parent' },
                ],
                page: 1,
                totalPages: 2,
            })
            .mockResolvedValueOnce({
                docs: [
                    { id: 11, name: 'Child', slug: 'child', parent: { id: 10 }, breadcrumbs: 'Parent > Child' },
                ],
                page: 2,
                totalPages: 2,
            })
        const req = new Request('http://localhost/api/storefront/categories?site=2')

        // Act
        const res = await GET(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.docs).toEqual([
            { id: 10, name: 'Parent', slug: 'parent', parent: null, breadcrumbs: 'Parent' },
            { id: 11, name: 'Child', slug: 'child', parent: 10, breadcrumbs: 'Parent > Child' },
        ])
        expect(mockFind).toHaveBeenNthCalledWith(1, expect.objectContaining({ page: 1, limit: 500 }))
        expect(mockFind).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 2, limit: 500 }))
    })

    it('[TC-F09.252] missing site returns empty docs without calling Payload', async () => {
        // Arrange
        const req = new Request('http://localhost/api/storefront/categories')

        // Act
        const res = await GET(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body).toEqual({ docs: [] })
        expect(mockFind).not.toHaveBeenCalled()
    })

    it('[TC-F09.252] invalid site returns empty docs without calling Payload', async () => {
        // Arrange
        const req = new Request('http://localhost/api/storefront/categories?site=abc')

        // Act
        const res = await GET(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body).toEqual({ docs: [] })
        expect(mockFind).not.toHaveBeenCalled()
    })
})
