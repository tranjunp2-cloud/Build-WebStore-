import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFind, mockGetPayload, mockCheckRateLimit } = vi.hoisted(() => ({
    mockFind: vi.fn(),
    mockGetPayload: vi.fn(),
    mockCheckRateLimit: vi.fn(),
}))

vi.mock('payload', () => ({ getPayload: mockGetPayload }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: mockCheckRateLimit }))

import { POST } from '@/app/api/storefront/cart/resolve/route'

const body = { siteId: 10, siteSlug: 'merchant', items: [{ productId: 20, quantity: 5, snapshot: { name: 'Old shirt', price: 50 } }] }
const request = (value = body, host = 'merchant.primeweb.app') => new Request('http://localhost/api/storefront/cart/resolve', { method: 'POST', headers: { host, 'x-forwarded-for': '203.0.113.1' }, body: JSON.stringify(value) })

describe('POST /api/storefront/cart/resolve [TC-F09.57]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockCheckRateLimit.mockResolvedValue({ allowed: true, resetAt: Date.now() + 60_000 })
        mockGetPayload.mockResolvedValue({ find: mockFind })
    })

    it('rejects invalid cart bodies before querying Payload', async () => {
        // Arrange
        const invalid = request({ siteId: 0, siteSlug: 'merchant', items: [] })

        // Act
        const response = await POST(invalid)

        // Assert
        expect(response.status).toBe(400)
        expect(mockFind).not.toHaveBeenCalled()
    })

    it('binds tenant/site and returns only canonical cart fields from one batched product query', async () => {
        // Arrange
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 1 }] })
            .mockResolvedValueOnce({ docs: [{ id: 10 }] })
            .mockResolvedValueOnce({ docs: [{ id: 20, name: 'New shirt', slug: 'new-shirt', price: 40, inventory: 3, status: 'active', currency: 'MYR', images: [{ url: 'https://cdn.example/new.jpg' }] }] })

        // Act
        const response = await POST(request())
        const json = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(mockFind).toHaveBeenCalledTimes(3)
        expect(mockFind.mock.calls[1][0].where).toMatchObject({ and: expect.arrayContaining([{ id: { equals: 10 } }, { tenant: { equals: 1 } }]) })
        expect(mockFind.mock.calls[2][0]).toMatchObject({ collection: 'products', limit: 1 })
        expect(json.lines[0]).toEqual(expect.objectContaining({ productId: 20, available: true, changed: expect.arrayContaining(['name', 'price']), product: expect.objectContaining({ name: 'New shirt', price: 40, quantity: 3 }) }))
        expect(json.lines[0].product).not.toHaveProperty('tenant')
        expect(json.lines[0].product).not.toHaveProperty('images')
    })

    it('does not leak a cart when requested site is not published for the hostname tenant', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({ docs: [{ id: 1 }] }).mockResolvedValueOnce({ docs: [] })

        // Act
        const response = await POST(request())

        // Assert
        expect(await response.json()).toEqual({ lines: [] })
        expect(mockFind).toHaveBeenCalledTimes(2)
    })

    it('rejects a pending custom domain before looking up its site [TC-F09.57]', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({ docs: [{ id: 1, customDomains: [{ domain: 'shop.example.com', status: 'pending' }] }] })

        // Act
        const response = await POST(request(body, 'shop.example.com'))

        // Assert
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ lines: [] })
        expect(mockFind).toHaveBeenCalledTimes(1)
    })

    it('returns Retry-After without parsing or querying when rate limited', async () => {
        // Arrange
        mockCheckRateLimit.mockResolvedValue({ allowed: false, resetAt: Date.now() + 1_000 })

        // Act
        const response = await POST(request())

        // Assert
        expect(response.status).toBe(429)
        expect(response.headers.get('Retry-After')).toBe('1')
        expect(mockGetPayload).not.toHaveBeenCalled()
    })
})
