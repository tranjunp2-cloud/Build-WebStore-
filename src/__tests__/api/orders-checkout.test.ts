import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindByID = vi.fn()
const mockFind = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID, find: mockFind, create: mockCreate, update: mockUpdate })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { POST } from '@/app/api/orders/checkout/route'

// ─── TC-F10: Order checkout API ──────────────────────────────────────

function mockReq(body: any) {
    return { json: () => Promise.resolve(body) } as unknown as Request
}

const validBody = {
    siteId: 'site-1',
    items: [{ productId: 'prod-1', quantity: 2 }],
    customer: { name: 'John', email: 'john@test.com' },
    paymentMethod: 'cod',
}

describe('POST /api/orders/checkout [TC-F10]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('creates order with valid input', async () => {
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' }) // site
            .mockResolvedValueOnce({ id: 'prod-1', name: 'Product 1', price: 25, stock: 10 }) // product
            .mockResolvedValueOnce({ id: 'prod-1', stock: 10 }) // restock check
        mockCreate.mockResolvedValue({ id: 'order-1' })
        mockUpdate.mockResolvedValue({})

        const res = await POST(mockReq(validBody))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.status).toBe('pending')
    })

    it('returns 400 for invalid body (missing customer)', async () => {
        const res = await POST(mockReq({ siteId: '1', items: [{ productId: '1', quantity: 1 }], paymentMethod: 'cod' }))
        expect(res.status).toBe(400)
    })

    it('returns 404 when site not found', async () => {
        mockFindByID.mockResolvedValueOnce(null)

        const res = await POST(mockReq(validBody))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('returns 404 when product not found', async () => {
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
            .mockResolvedValueOnce(null) // product not found

        const res = await POST(mockReq(validBody))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.code).toBe('PRODUCT_NOT_FOUND')
    })

    it('returns 422 when out of stock', async () => {
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
            .mockResolvedValueOnce({ id: 'prod-1', name: 'Product', price: 25, stock: 1 }) // only 1 left

        const res = await POST(mockReq(validBody)) // requesting 2
        const body = await res.json()

        expect(res.status).toBe(422)
        expect(body.error.code).toBe('OUT_OF_STOCK')
    })

    it('calculates SST 6% tax', async () => {
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
            .mockResolvedValueOnce({ id: 'prod-1', name: 'P', price: 100, stock: 10 })
            .mockResolvedValueOnce({ id: 'prod-1', stock: 10 })
        mockCreate.mockResolvedValue({ id: 'order-1' })
        mockUpdate.mockResolvedValue({})

        const res = await POST(mockReq({ ...validBody, items: [{ productId: 'prod-1', quantity: 1 }] }))
        const body = await res.json()

        expect(body.data.total).toBe(106) // 100 + 6% tax
    })
})
