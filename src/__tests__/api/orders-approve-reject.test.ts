import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mocks
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        findByID: vi.fn(),
        update: vi.fn(),
        sendEmail: vi.fn(() => Promise.resolve()),
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth', () => ({
    withAuth: (handler: Function) => (req: Request, ctx: any) =>
        handler({ id: 'user-1', email: 'seller@test.com' }, req, ctx),
}))
vi.mock('@/lib/auth/order-token', () => ({
    signOrderToken: vi.fn(() => Promise.resolve('signed-token-abc')),
}))
vi.mock('@/lib/email/templates/payment-confirmed', () => ({
    paymentConfirmedEmail: vi.fn(() => ({ subject: 'confirmed', html: '<p>confirmed</p>' })),
}))
vi.mock('@/lib/email/templates/payment-rejected', () => ({
    paymentRejectedEmail: vi.fn(() => ({ subject: 'rejected', html: '<p>rejected</p>' })),
}))

import { PATCH as ApprovePATCH } from '@/app/api/orders/[id]/approve-payment/route'
import { PATCH as RejectPATCH } from '@/app/api/orders/[id]/reject-payment/route'
import { getPayload } from 'payload'

let mockFindByID: ReturnType<typeof vi.fn>
let mockUpdate: ReturnType<typeof vi.fn>
let mockSendEmail: ReturnType<typeof vi.fn>

function mockReq(body?: object) {
    return {
        json: () => Promise.resolve(body ?? {}),
    } as unknown as Request
}

function mockParams(id: string) {
    return { params: Promise.resolve({ id }) }
}

const baseBTOrder = {
    id: 'order-1',
    orderNumber: 'ORD-001',
    customerName: 'Alice',
    customerEmail: 'alice@example.com',
    total: 200,
    currency: 'MYR',
    paymentMethod: 'bank_transfer',
    paymentStatus: 'pending_verification',
    status: 'pending',
    items: [],
    site: { slug: 'myshop' },
    magicLinkSecret: 'secret-xyz',
}

describe('Approve/Reject Payment APIs [TC-F10-06]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFindByID = vi.fn()
        mockUpdate = vi.fn().mockResolvedValue({ ...baseBTOrder, paymentStatus: 'paid' })
        mockSendEmail = vi.fn().mockResolvedValue(undefined)
        vi.mocked(getPayload).mockResolvedValue({
            findByID: mockFindByID,
            update: mockUpdate,
            sendEmail: mockSendEmail,
        } as any)
    })

    // ─── APPROVE ────────────────────────────────────────────────────────────────

    it('[TC-F10-06-01] approve pending_verification → 200, update called with paymentStatus=paid', async () => {
        // Arrange
        mockFindByID.mockResolvedValueOnce({ ...baseBTOrder })

        // Act
        const res = await ApprovePATCH(mockReq(), mockParams('order-1'))
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'orders',
            data: expect.objectContaining({ paymentStatus: 'paid' }),
        }))
    })

    it('[TC-F10-06-02] approve when paymentStatus=awaiting_payment → 422', async () => {
        // Arrange
        mockFindByID.mockResolvedValueOnce({ ...baseBTOrder, paymentStatus: 'awaiting_payment' })

        // Act
        const res = await ApprovePATCH(mockReq(), mockParams('order-1'))
        const body = await res.json()

        // Assert
        expect(res.status).toBe(422)
        expect(body.success).toBe(false)
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    // ─── REJECT ──────────────────────────────────────────────────────────────────

    it('[TC-F10-06-03] reject "other" without sufficient detail → 400', async () => {
        // Arrange — no findByID call needed; parseRequest fails first
        mockFindByID.mockResolvedValueOnce({ ...baseBTOrder })

        // Act — detail only 5 chars, below 10
        const res = await RejectPATCH(
            mockReq({ reason: 'other', detail: 'short' }),
            mockParams('order-1')
        )
        const body = await res.json()

        // Assert
        expect(res.status).toBe(400)
        expect(body.success).toBe(false)
    })

    it('[TC-F10-06-04] reject success → 200, update called with paymentStatus=awaiting_payment + new magicLinkSecret', async () => {
        // Arrange
        mockFindByID.mockResolvedValueOnce({ ...baseBTOrder })
        mockUpdate.mockResolvedValueOnce({ ...baseBTOrder, paymentStatus: 'awaiting_payment' })

        // Act
        const res = await RejectPATCH(
            mockReq({ reason: 'wrong_amount' }),
            mockParams('order-1')
        )
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'orders',
            overrideAccess: true,
            data: expect.objectContaining({
                paymentStatus: 'awaiting_payment',
                paymentRejectionReason: 'wrong_amount',
            }),
        }))
        // magicLinkSecret must be a new non-empty string
        const updateCall = mockUpdate.mock.calls[0][0]
        expect(typeof updateCall.data.magicLinkSecret).toBe('string')
        expect(updateCall.data.magicLinkSecret.length).toBeGreaterThan(10)
    })

    it('[TC-F10-06-05] re-approve after reject (paymentStatus=awaiting_payment) → 422', async () => {
        // Arrange — after rejection, status is awaiting_payment, not pending_verification
        mockFindByID.mockResolvedValueOnce({ ...baseBTOrder, paymentStatus: 'awaiting_payment' })

        // Act
        const res = await ApprovePATCH(mockReq(), mockParams('order-1'))
        const body = await res.json()

        // Assert
        expect(res.status).toBe(422)
        expect(body.success).toBe(false)
        expect(mockUpdate).not.toHaveBeenCalled()
    })
})
