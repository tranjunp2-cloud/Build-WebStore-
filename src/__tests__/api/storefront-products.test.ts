import { describe, it, expect, vi, beforeEach } from 'vitest'

// No auth mock — storefront/products is a public endpoint
const mockFind = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ find: mockFind })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { GET } from '@/app/api/storefront/products/route'

describe('GET /api/storefront/products [TC-F08-831]', () => {
    beforeEach(() => vi.clearAllMocks())

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
})
