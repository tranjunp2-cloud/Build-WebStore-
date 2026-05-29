import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDrizzleExecute = vi.fn()

// Hoisted mocks
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        findByID: vi.fn(),
        update: vi.fn(),
        sendEmail: vi.fn(() => Promise.resolve()),
        db: { drizzle: { execute: mockDrizzleExecute } },
        logger: { warn: vi.fn(), error: vi.fn() },
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
        mockDrizzleExecute.mockReset()
        mockDrizzleExecute.mockResolvedValue({ rows: [{ id: 1 }] }) // default: SQL succeeds
        mockFindByID = vi.fn()
        mockUpdate = vi.fn().mockResolvedValue({ ...baseBTOrder, paymentStatus: 'paid' })
        mockSendEmail = vi.fn().mockResolvedValue(undefined)
        vi.mocked(getPayload).mockResolvedValue({
            findByID: mockFindByID,
            update: mockUpdate,
            sendEmail: mockSendEmail,
            db: { drizzle: { execute: mockDrizzleExecute } },
            logger: { warn: vi.fn(), error: vi.fn() },
        } as any)
    })

    // ─── APPROVE ────────────────────────────────────────────────────────────────

    it('[TC-F10-06-01] approve pending_verification → 200, CAS fires, ORM update NOT called', async () => {
        // Arrange: initial ACL fetch + post-CAS full-order fetch
        mockFindByID
            .mockResolvedValueOnce({ ...baseBTOrder })
            .mockResolvedValueOnce({ ...baseBTOrder, paymentStatus: 'paid' })
        // default mockDrizzleExecute returns { rows: [{ id: 1 }] } — CAS succeeds

        // Act
        const res = await ApprovePATCH(mockReq(), mockParams('order-1'))
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(mockDrizzleExecute).toHaveBeenCalledTimes(1) // CAS only (no inventory items)
        expect(mockUpdate).not.toHaveBeenCalled() // CAS replaces ORM update
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

    // ─── TC-F10-06-41 through TC-F10-06-43: variant-aware inventory decrement ────

    it('[TC-F10-06-41] approve with variant item → decrementVariantStock SQL called', async () => {
        mockFindByID
            .mockResolvedValueOnce({
                ...baseBTOrder,
                items: [{ product: 'prod-v', variant: 'Red - M', quantity: 2 }],
            })
            .mockResolvedValueOnce({ ...baseBTOrder, paymentStatus: 'paid' }) // post-CAS fetch
        // SQL call sequence: approve CAS + product check + variant CAS decrement + inventory recompute
        mockDrizzleExecute
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })            // approve CAS → success
            .mockResolvedValueOnce({ rows: [{ id: 'prod-v' }] })     // product check
            .mockResolvedValueOnce({ rows: [{ id: 'uuid-v' }] })     // variant CAS decrement → success
            .mockResolvedValueOnce({ rows: [] })                      // inventory recompute

        const res = await ApprovePATCH(mockReq(), mockParams('order-1'))
        expect(res.status).toBe(200)
        expect(mockDrizzleExecute).toHaveBeenCalledTimes(4) // approve CAS + 3 variant decrement calls
        // ORM update NOT called for variant stock (SQL path)
        const variantUpdateCall = mockUpdate.mock.calls.find(c => c[0]?.data?.variants !== undefined)
        expect(variantUpdateCall).toBeUndefined()
    })

    it('[TC-F10-06-42] approve variant with insufficient stock → approval still 200 (best-effort)', async () => {
        // Payment received — must approve even if concurrent sale emptied stock
        mockFindByID
            .mockResolvedValueOnce({
                ...baseBTOrder,
                items: [{ product: 'prod-v', variant: 'Red - M', quantity: 2 }],
            })
            .mockResolvedValueOnce({ ...baseBTOrder, paymentStatus: 'paid' }) // post-CAS fetch
        mockDrizzleExecute
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })        // approve CAS → success
            .mockResolvedValueOnce({ rows: [{ id: 'prod-v' }] }) // product check
            .mockResolvedValueOnce({ rows: [] })                  // variant CAS: insufficient → 0 rows
            .mockResolvedValueOnce({ rows: [{ stock: 0 }] })      // diagnostic → insufficient_stock

        const res = await ApprovePATCH(mockReq(), mockParams('order-1'))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(mockUpdate).not.toHaveBeenCalled() // CAS replaces ORM update
    })

    it('[TC-F10-06-43] approve with non-variant item → aggregate GREATEST(0,...) SQL called', async () => {
        mockFindByID
            .mockResolvedValueOnce({
                ...baseBTOrder,
                items: [{ product: 'prod-n', variant: '', quantity: 3 }],
            })
            .mockResolvedValueOnce({ ...baseBTOrder, paymentStatus: 'paid' }) // post-CAS fetch
        // Default mockDrizzleExecute resolves { rows: [{ id: 1 }] }

        const res = await ApprovePATCH(mockReq(), mockParams('order-1'))
        expect(res.status).toBe(200)
        expect(mockDrizzleExecute).toHaveBeenCalledTimes(2) // approve CAS + GREATEST update
    })

    // ─── TC-F10-06-44 through TC-F10-06-46: cancel+approve race fixes ────────────

    it('[TC-F10-06-44] approve when order.status=cancelled → 422 INVALID_STATE (defensive guard)', async () => {
        // Cancel CAS may have already run before this approve reads the order snapshot.
        // Defensive in-memory guard catches this before issuing the CAS.
        mockFindByID.mockResolvedValueOnce({ ...baseBTOrder, status: 'cancelled' })

        const res = await ApprovePATCH(mockReq(), mockParams('order-1'))
        const body = await res.json()

        expect(res.status).toBe(422)
        expect(body.success).toBe(false)
        expect(body.error.code).toBe('INVALID_STATE')
        expect(mockDrizzleExecute).not.toHaveBeenCalled() // guard short-circuits before CAS
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('[TC-F10-06-45] CAS 0 rows — order cancelled mid-flight → 409 CONFLICT', async () => {
        // Guard passed (snapshot showed status=pending before cancel CAS fired).
        // By the time our approve CAS executes, cancel already set status='cancelled' → 0 rows.
        mockFindByID
            .mockResolvedValueOnce({ ...baseBTOrder })                       // initial: guard passes
            .mockResolvedValueOnce({ ...baseBTOrder, status: 'cancelled' }) // recheck: cancelled
        mockDrizzleExecute.mockResolvedValueOnce({ rows: [] }) // CAS → 0 rows

        const res = await ApprovePATCH(mockReq(), mockParams('order-1'))
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.success).toBe(false)
        expect(body.error.code).toBe('CONFLICT')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('[TC-F10-06-46] CAS 0 rows — order already paid (double-approve) → 200 idempotent', async () => {
        // Two concurrent approve requests: first CAS wins, second sees 0 rows.
        // Second request rechecks → paymentStatus=paid → returns idempotent success without side effects.
        mockFindByID
            .mockResolvedValueOnce({ ...baseBTOrder })                          // initial: guard passes
            .mockResolvedValueOnce({ ...baseBTOrder, paymentStatus: 'paid' }) // recheck: already paid
        mockDrizzleExecute.mockResolvedValueOnce({ rows: [] }) // CAS → 0 rows (first request won)

        const res = await ApprovePATCH(mockReq(), mockParams('order-1'))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(mockUpdate).not.toHaveBeenCalled()
        expect(mockSendEmail).not.toHaveBeenCalled() // no duplicate email on idempotent path
    })
})
