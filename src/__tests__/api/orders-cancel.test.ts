import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)),
}))

const mockFindByID = vi.fn()
const mockUpdate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID, update: mockUpdate })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/email/send', () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }))

import { POST } from '@/app/api/orders/[id]/cancel/route'

// ─── TC-F10.16: Order cancellation ───────────────────────────────────

describe('POST /api/orders/[id]/cancel [TC-F10.16]', () => {
    const ctx = { params: Promise.resolve({ id: 'order-1' }) }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('cancels order with valid reason', async () => {
        mockFindByID
            .mockResolvedValueOnce({ id: 'order-1', status: 'pending', items: [] }) // order
        mockUpdate.mockResolvedValue({ id: 'order-1', status: 'cancelled', customer: {} })

        const req = { json: () => Promise.resolve({ reason: 'Customer request' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
    })

    it('rejects cancellation from terminal state [TC-F10.16]', async () => {
        mockFindByID.mockResolvedValue({ id: 'order-1', status: 'completed', items: [] })

        const req = { json: () => Promise.resolve({ reason: 'Too late' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(422)
        expect(body.error.code).toBe('INVALID_TRANSITION')
    })

    it('rejects empty reason', async () => {
        const req = { json: () => Promise.resolve({ reason: '' }) } as unknown as Request
        const res = await POST(req, ctx as any)

        expect(res.status).toBe(400)
    })

    it('returns 404 when order not found', async () => {
        mockFindByID.mockResolvedValue(null)

        const req = { json: () => Promise.resolve({ reason: 'Cancel' }) } as unknown as Request
        const res = await POST(req, ctx as any)

        expect(res.status).toBe(404)
    })

    it('restocks inventory on cancellation', async () => {
        mockFindByID
            .mockResolvedValueOnce({ id: 'order-1', status: 'confirmed', items: [{ product: 'prod-1', quantity: 3 }] }) // order
            .mockResolvedValueOnce({ id: 'prod-1', inventory: 5 }) // product for restock
        mockUpdate
            .mockResolvedValueOnce({ id: 'order-1', status: 'cancelled', customer: {} }) // cancel
            .mockResolvedValueOnce({}) // restock

        const req = { json: () => Promise.resolve({ reason: 'Test' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(body.success).toBe(true)
        expect(body.restock).toBeDefined()
    })
})
