import { describe, it, expect, vi, beforeEach } from 'vitest'

// No auth mock — storefront/products is a public endpoint
const mockFind = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ find: mockFind })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: vi.fn(async () => ({ allowed: true, resetAt: Date.now() + 1_000 })),
}))

import { GET } from '@/app/api/storefront/products/route'
// #2179: store availability has its own tests (store-unavailable.test.ts); here a store is unavailable only when suspended.
vi.mock('@/lib/storefront/store-availability', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/storefront/store-availability')>()),
    isTenantUnavailable: vi.fn(async (_payload: unknown, tenant: { status?: unknown } | null) => tenant?.status === 'suspended'),
    isTenantIdUnavailable: vi.fn(async () => false),
}))
// #2179: store availability has its own tests (store-unavailable.test.ts); available unless a test says otherwise.
vi.mock('@/lib/storefront/cached-store-availability', () => ({ isCachedSiteUnavailable: vi.fn(async () => false) }))
import { isCachedSiteUnavailable } from '@/lib/storefront/cached-store-availability'
import { isTenantIdUnavailable, isTenantUnavailable } from '@/lib/storefront/store-availability'

describe('GET /api/storefront/products [TC-F08-831]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('[TC-F09-2378-06] summary (only with summary=1) falls back to the description text; shortDescription wins', async () => {
        // Arrange
        const lexicalDesc = { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'From the form', mode: 'normal', style: '', detail: 0, format: 0, version: 1 }] }] } }
        const base = { price: 10, currency: 'MYR', images: [], status: 'active', hasVariants: false, variants: [] }
        mockFind.mockResolvedValue({
            docs: [
                { ...base, id: 1, name: 'A', slug: 'a', description: lexicalDesc },
                { ...base, id: 2, name: 'B', slug: 'b', shortDescription: 'Short blurb', description: lexicalDesc },
            ],
            totalDocs: 2, page: 1, totalPages: 1,
        })

        // Act
        const res = await GET(new Request('http://localhost/api/storefront/products?site=1&summary=1'))
        const body = await res.json()
        const plain = await (await GET(new Request('http://localhost/api/storefront/products?site=1'))).json()

        // Assert
        expect(body.docs[0].summary).toBe('From the form')
        expect(body.docs[1].summary).toBe('Short blurb')
        expect(body.docs[1].shortDescription).toBe('Short blurb')
        // grids that do not ask for it skip the description rendering
        expect(plain.docs[0]).not.toHaveProperty('summary')
    })

    it('[TC-F08-831-05] non-numeric site param returns 200 empty without calling Payload', async () => {
        // Arrange
        const req = new Request('http://localhost/api/storefront/products?site=abc')
        // Act
        const res = await GET(req)
        const body = await res.json()
        // Assert
        expect(res.status).toBe(200)
        expect(body.docs).toEqual([])
        expect(body.totalDocs).toBe(0)
        expect(mockFind).not.toHaveBeenCalled()
    })

    it('[TC-F08-831-03] missing site param returns 200 empty without calling Payload', async () => {
        // Arrange
        const req = new Request('http://localhost/api/storefront/products')
        // Act
        const res = await GET(req)
        const body = await res.json()
        // Assert
        expect(res.status).toBe(200)
        expect(body.docs).toEqual([])
        expect(body.totalDocs).toBe(0)
        expect(mockFind).not.toHaveBeenCalled()
    })

    it('[TC-F08-831-01] valid numeric site param calls Payload with integer and returns products', async () => {
        // Arrange
        mockFind.mockResolvedValue({
            docs: [
                {
                    id: 10,
                    name: 'Test Product',
                    slug: 'test-product',
                    shortDescription: 'A product',
                    price: 99.9,
                    compareAtPrice: null,
                    currency: 'MYR',
                    images: [],
                    status: 'active',
                    hasVariants: false,
                    variants: [],
                },
            ],
            totalDocs: 1,
            page: 1,
            totalPages: 1,
        })
        const req = new Request('http://localhost/api/storefront/products?site=1')
        // Act
        const res = await GET(req)
        const body = await res.json()
        // Assert
        expect(res.status).toBe(200)
        expect(body.totalDocs).toBe(1)
        expect(body.docs).toHaveLength(1)
        expect(body.docs[0].name).toBe('Test Product')
        // Critical: site must be passed as integer, not string
        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'products',
                where: expect.objectContaining({
                    and: expect.arrayContaining([{ site: { equals: 1 } }]),
                }),
                overrideAccess: true,
            }),
        )
    })

    it('[TC-F09.283] unavailable store returns 200 empty without querying products', async () => {
        // Arrange
        vi.mocked(isCachedSiteUnavailable).mockResolvedValueOnce(true)

        // Act
        const res = await GET(new Request('http://localhost/api/storefront/products?site=5'))

        // Assert
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ docs: [], totalDocs: 0 })
        expect(mockFind).not.toHaveBeenCalled()
    })

    it('[TC-F08-831-04] zero site param returns 200 empty without calling Payload', async () => {
        // Arrange
        const req = new Request('http://localhost/api/storefront/products?site=0')
        // Act
        const res = await GET(req)
        const body = await res.json()
        // Assert
        expect(res.status).toBe(200)
        expect(body.docs).toEqual([])
        expect(body.totalDocs).toBe(0)
        expect(mockFind).not.toHaveBeenCalled()
    })

    it('[TC-F08-831-06] decimal site param returns 200 empty without calling Payload', async () => {
        // Arrange
        const req = new Request('http://localhost/api/storefront/products?site=1.5')
        // Act
        const res = await GET(req)
        const body = await res.json()
        // Assert
        expect(res.status).toBe(200)
        expect(body.docs).toEqual([])
        expect(body.totalDocs).toBe(0)
        expect(mockFind).not.toHaveBeenCalled()
    })

    it('[TC-F09.247] valid categoryId filters products to category and descendants', async () => {
        // Arrange
        mockFind
            .mockResolvedValueOnce({
                docs: [
                    { id: 10, parent: null },
                    { id: 11, parent: 10 },
                    { id: 12, parent: { id: 11 } },
                    { id: 20, parent: null },
                ],
            })
            .mockResolvedValueOnce({ docs: [], totalDocs: 0, page: 1, totalPages: 0 })
        const req = new Request('http://localhost/api/storefront/products?site=1&categoryId=10')

        // Act
        const res = await GET(req)

        // Assert
        expect(res.status).toBe(200)
        expect(mockFind).toHaveBeenNthCalledWith(1, expect.objectContaining({
            collection: 'categories',
            overrideAccess: true,
        }))
        expect(mockFind).toHaveBeenNthCalledWith(2, expect.objectContaining({
            collection: 'products',
            where: expect.objectContaining({
                and: expect.arrayContaining([{ category: { in: [10, 11, 12] } }]),
            }),
        }))
    })

    it('[TC-F09.247a] stale or cross-site categoryId returns an empty result without querying products', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({
            docs: [{ id: 20, parent: null }],
            page: 1,
            totalPages: 1,
        })
        const req = new Request('http://localhost/api/storefront/products?site=1&categoryId=999&page=2')

        // Act
        const res = await GET(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body).toEqual({ docs: [], totalDocs: 0, page: 2, totalPages: 1 })
        expect(mockFind).toHaveBeenCalledTimes(1)
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'categories',
            where: { and: [{ site: { equals: 1 } }, { deletedAt: { exists: false } }] },
        }))
    })

    it('[TC-F09.247] category descendant lookup paginates through every category page', async () => {
        // Arrange
        mockFind
            .mockResolvedValueOnce({
                docs: [{ id: 10, parent: null }],
                page: 1,
                totalPages: 2,
            })
            .mockResolvedValueOnce({
                docs: [{ id: 11, parent: { id: 10 } }],
                page: 2,
                totalPages: 2,
            })
            .mockResolvedValueOnce({ docs: [], totalDocs: 0, page: 1, totalPages: 0 })
        const req = new Request('http://localhost/api/storefront/products?site=1&categoryId=10')

        // Act
        const res = await GET(req)

        // Assert
        expect(res.status).toBe(200)
        expect(mockFind).toHaveBeenNthCalledWith(1, expect.objectContaining({ collection: 'categories', page: 1, limit: 500 }))
        expect(mockFind).toHaveBeenNthCalledWith(2, expect.objectContaining({ collection: 'categories', page: 2, limit: 500 }))
        expect(mockFind).toHaveBeenNthCalledWith(3, expect.objectContaining({
            collection: 'products',
            where: expect.objectContaining({
                and: expect.arrayContaining([{ category: { in: [10, 11] } }]),
            }),
        }))
    })

    it('[TC-F09.248] valid minPrice and maxPrice add price predicates', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({ docs: [], totalDocs: 0, page: 1, totalPages: 0 })
        const req = new Request('http://localhost/api/storefront/products?site=1&minPrice=10&maxPrice=99.5')

        // Act
        const res = await GET(req)

        // Assert
        expect(res.status).toBe(200)
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                and: expect.arrayContaining([
                    { price: { greater_than_equal: 10 } },
                    { price: { less_than_equal: 99.5 } },
                ]),
            }),
        }))
    })

    it('[TC-F09.249a] search param adds keyword predicates for name and shortDescription', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({ docs: [], totalDocs: 0, page: 1, totalPages: 0 })
        const req = new Request('http://localhost/api/storefront/products?site=1&search=volley')

        // Act
        const res = await GET(req)

        // Assert
        expect(res.status).toBe(200)
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                and: expect.arrayContaining([
                    {
                        or: [
                            { name: { contains: 'volley' } },
                            { shortDescription: { contains: 'volley' } },
                        ],
                    },
                ]),
            }),
        }))
    })

    it('[TC-F09.249] repeatable attr_* params build elemMatch filter with OR values', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({ docs: [], totalDocs: 0, page: 1, totalPages: 0 })
        const req = new Request('http://localhost/api/storefront/products?site=1&attr_color=red&attr_color=blue')

        // Act
        const res = await GET(req)

        // Assert
        expect(res.status).toBe(200)
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                and: expect.arrayContaining([
                    {
                        attributes: {
                            elemMatch: {
                                and: [
                                    { key: { equals: 'color' } },
                                    { value: { in: ['red', 'blue'] } },
                                ],
                            },
                        },
                    },
                ]),
            }),
        }))
    })

    it('[TC-F09.250] category, price, and attribute filters compose together', async () => {
        // Arrange
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 10, parent: null }, { id: 11, parent: 10 }] })
            .mockResolvedValueOnce({ docs: [], totalDocs: 0, page: 1, totalPages: 0 })
        const req = new Request('http://localhost/api/storefront/products?site=1&categoryId=10&minPrice=15&maxPrice=40&attr_size=M&attr_color= navy ')

        // Act
        const res = await GET(req)

        // Assert
        expect(res.status).toBe(200)
        expect(mockFind).toHaveBeenNthCalledWith(2, expect.objectContaining({
            where: expect.objectContaining({
                and: expect.arrayContaining([
                    { category: { in: [10, 11] } },
                    { price: { greater_than_equal: 15 } },
                    { price: { less_than_equal: 40 } },
                    {
                        attributes: {
                            elemMatch: {
                                and: [
                                    { key: { equals: 'size' } },
                                    { value: { in: ['M'] } },
                                ],
                            },
                        },
                    },
                    {
                        attributes: {
                            elemMatch: {
                                and: [
                                    { key: { equals: 'color' } },
                                    { value: { in: ['navy'] } },
                                ],
                            },
                        },
                    },
                ]),
            }),
        }))
    })

    it('[TC-F09.252] invalid filter params are ignored without returning 500', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({ docs: [], totalDocs: 0, page: 1, totalPages: 0 })
        const req = new Request('http://localhost/api/storefront/products?site=1&categoryId=abc&minPrice=nope&maxPrice=-1&attr_color=&attr_%20=')

        // Act
        const res = await GET(req)

        // Assert
        expect(res.status).toBe(200)
        expect(mockFind).toHaveBeenCalledTimes(1)
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                and: [
                    { site: { equals: 1 } },
                    { status: { equals: 'active' } },
                    { deletedAt: { exists: false } },
                ],
            },
        }))
    })
})
