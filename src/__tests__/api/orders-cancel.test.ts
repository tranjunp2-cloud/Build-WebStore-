import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)),
}))

const mockFindByID = vi.fn()
const mockUpdate = vi.fn()
const mockSendEmail = vi.fn().mockResolvedValue(undefined)
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID, update: mockUpdate, sendEmail: mockSendEmail })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/email/templates/order-cancelled', () => ({
    orderCancelledEmail: vi.fn(() => ({ subject: 'Order cancelled', html: '<p>cancelled</p>' })),
}))

import { POST } from '@/app/api/orders/[id]/cancel/route'

// ─── TC-F10.16: Order cancellation ───────────────────────────────────

describe('POST /api/orders/[id]/cancel [TC-F10.16]', () => {
    const ctx = { params: Promise.resolve({ id: 'order-1' }) }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('[TC-F10-03-01] cancels order with valid reason', async () => {
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

    it('[TC-F10-03-03] rejects empty reason', async () => {
        const req = { json: () => Promise.resolve({ reason: '' }) } as unknown as Request
        const res = await POST(req, ctx as any)

        expect(res.status).toBe(400)
    })

    it('[TC-F10-03-03] Rejects whitespace-only reason', async () => {
        const req = { json: () => Promise.resolve({ reason: '   ' }) } as unknown as Request
        const res = await POST(req, ctx as any)

        expect(res.status).toBe(400)
    })

    it('[GUARD] returns 404 when order not found', async () => {
        mockFindByID.mockResolvedValue(null)

        const req = { json: () => Promise.resolve({ reason: 'Cancel' }) } as unknown as Request
        const res = await POST(req, ctx as any)

        expect(res.status).toBe(404)
    })

    it('[TC-F10-03-05] restocks inventory on cancellation', async () => {
        mockFindByID
            .mockResolvedValueOnce({ id: 'order-1', status: 'confirmed', items: [{ product: 'prod-1', quantity: 3 }] }) // order
            .mockResolvedValueOnce({ id: 'prod-1', stock: 5 }) // product for restock (stock field, not inventory)
        mockUpdate
            .mockResolvedValueOnce({ id: 'order-1', status: 'cancelled', customer: {} }) // cancel
            .mockResolvedValueOnce({}) // restock

        const req = { json: () => Promise.resolve({ reason: 'Test' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(body.success).toBe(true)
        expect(body.restock).toBeDefined()
    })

    it('[TC-F10.16-FIX-1] Cancellation email sent to customerEmail field', async () => {
        mockFindByID
            .mockResolvedValueOnce({ id: 'order-1', status: 'pending', items: [], customerEmail: 'test@example.com', customerName: 'John Doe' })
        mockUpdate
            .mockResolvedValueOnce({ id: 'order-1', status: 'cancelled', customerEmail: 'test@example.com', customerName: 'John Doe' })

        const req = { json: () => Promise.resolve({ reason: 'Customer request' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        // Verify email sent via payload.sendEmail to customerEmail field (fire-and-forget)
        expect(mockSendEmail).toHaveBeenCalledWith(
            expect.objectContaining({ to: 'test@example.com' })
        )
    })

    it('[TC-F10.16-FIX-2] Restock updates stock field (not inventory)', async () => {
        mockFindByID
            .mockResolvedValueOnce({ id: 'order-1', status: 'confirmed', items: [{ product: 'prod-2', quantity: 2 }] })
            .mockResolvedValueOnce({ id: 'prod-2', stock: 10 }) // stock field
        mockUpdate
            .mockResolvedValueOnce({ id: 'order-1', status: 'cancelled' })
            .mockResolvedValueOnce({}) // restock update

        const req = { json: () => Promise.resolve({ reason: 'Test' }) } as unknown as Request
        const res = await POST(req, ctx as any)

        expect(res.status).toBe(200)
        // Verify second update call used stock field (10 + 2 = 12)
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    stock: 12 // Updated stock: 10 + 2 items
                })
            })
        )
    })

    it('[TC-F10-03-01] Cancel QR Banking order in pending status succeeds', async () => {
        mockFindByID
            .mockResolvedValueOnce({
                id: 'order-3',
                status: 'pending',
                items: [],
                paymentMethod: 'qr_banking',
                paymentStatus: 'unpaid',
                customerEmail: 'qr@test.com',
                customerName: 'QR Customer'
            })
        mockUpdate
            .mockResolvedValueOnce({
                id: 'order-3',
                status: 'cancelled',
                paymentStatus: 'cancelled'
            })

        const req = { json: () => Promise.resolve({ reason: 'Customer changed mind' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        // Verify update call included status: cancelled
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: 'cancelled',
                    cancelReason: 'Customer changed mind'
                })
            })
        )
    })

    it('[TC-F10-03-07] Idempotency: already-cancelled order returns success without re-restocking', async () => {
        mockFindByID.mockResolvedValueOnce({ id: 'order-4', status: 'cancelled', items: [{ product: 'prod-1', quantity: 1 }] })

        const req = { json: () => Promise.resolve({ reason: 'Duplicate request' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        // No update or restock should occur
        expect(mockUpdate).not.toHaveBeenCalled()
        expect(body.restock).toEqual([])
    })

    it('[TC-F10-03-11] Rejects cancel reason exceeding 500 characters', async () => {
        const longReason = 'a'.repeat(501)
        const req = { json: () => Promise.resolve({ reason: longReason }) } as unknown as Request
        const res = await POST(req, ctx as any)

        expect(res.status).toBe(400)
    })
})
