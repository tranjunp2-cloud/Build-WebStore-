import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFind = vi.fn()

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ find: mockFind })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: vi.fn(async () => ({ allowed: true, resetAt: Date.now() + 1_000 })),
}))

import { GET } from '@/app/api/storefront/products/bounds/route'

describe('GET /api/storefront/products/bounds [TC-F09.251]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('[TC-F09.251] active site products produce min/max price and distinct attribute map', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({
            docs: [
                { price: 45, attributes: [{ key: 'color', value: 'red' }, { key: 'size', value: 'M' }] },
                { price: 10, attributes: [{ key: 'color', value: 'blue' }, { key: 'size', value: 'M' }] },
                { price: 70, attributes: [{ key: 'color', value: 'red' }, { key: 'material', value: 'cotton' }] },
            ],
        })
        const req = new Request('http://localhost/api/storefront/products/bounds?site=3')

        // Act
        const res = await GET(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body).toEqual({
            categoryIds: [],            minPrice: 10,
            maxPrice: 70,
            attributes: [
                { key: 'color', values: ['blue', 'red'] },
                { key: 'material', values: ['cotton'] },
                { key: 'size', values: ['M'] },
            ],
        })
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'products',
            where: expect.objectContaining({
                and: expect.arrayContaining([
                    { site: { equals: 3 } },
                    { status: { equals: 'active' } },
                    { deletedAt: { exists: false } },
                ]),
            }),
            select: { price: true, attributes: true, currency: true, category: true },
            overrideAccess: true,
        }))
    })

    it('[TC-F09.251] paginates through all product pages before deriving bounds and attributes', async () => {
        // Arrange
        mockFind
            .mockResolvedValueOnce({
                docs: [
                    { price: 45, attributes: [{ key: 'color', value: 'red' }] },
                ],
                page: 1,
                totalPages: 2,
            })
            .mockResolvedValueOnce({
                docs: [
                    { price: 5, attributes: [{ key: 'color', value: 'green' }, { key: 'size', value: 'XL' }] },
                ],
                page: 2,
                totalPages: 2,
            })
        const req = new Request('http://localhost/api/storefront/products/bounds?site=3')

        // Act
        const res = await GET(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body).toEqual({
            categoryIds: [],            minPrice: 5,
            maxPrice: 45,
            attributes: [
                { key: 'color', values: ['green', 'red'] },
                { key: 'size', values: ['XL'] },
            ],
        })
        expect(mockFind).toHaveBeenNthCalledWith(1, expect.objectContaining({ page: 1, limit: 1000 }))
        expect(mockFind).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 2, limit: 1000 }))
    })

    it('[TC-F09.251] empty catalogs return zeros and an empty attribute list', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({ docs: [] })
        const req = new Request('http://localhost/api/storefront/products/bounds?site=3')

        // Act
        const res = await GET(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body).toEqual({ minPrice: 0, maxPrice: 0, attributes: [], categoryIds: [] })
    })

    it('[TC-F09.252] missing site returns zeros without calling Payload', async () => {
        // Arrange
        const req = new Request('http://localhost/api/storefront/products/bounds')

        // Act
        const res = await GET(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body).toEqual({ minPrice: 0, maxPrice: 0, attributes: [] })
        expect(mockFind).not.toHaveBeenCalled()
    })

    it('[TC-F09.252] invalid site returns zeros without calling Payload', async () => {
        // Arrange
        const req = new Request('http://localhost/api/storefront/products/bounds?site=abc')

        // Act
        const res = await GET(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body).toEqual({ minPrice: 0, maxPrice: 0, attributes: [] })
        expect(mockFind).not.toHaveBeenCalled()
    })
})
