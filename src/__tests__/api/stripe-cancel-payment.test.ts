import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockFindByID = vi.fn()
const mockExecute = vi.fn()
const mockLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() }

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        findByID: mockFindByID,
        db: { drizzle: { execute: mockExecute } },
        logger: mockLogger,
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

const mockCookieGet = vi.fn()
vi.mock('next/headers', () => ({
    cookies: vi.fn(() => Promise.resolve({ get: mockCookieGet })),
}))

vi.mock('@/lib/orders/upload-token', () => ({
    verifyConfirmToken: vi.fn(),
}))
vi.mock('@/lib/auth/order-token', () => ({
    verifyOrderToken: vi.fn(),
}))

import { POST } from '@/app/api/orders/[id]/cancel-payment/route'
import { verifyConfirmToken } from '@/lib/orders/upload-token'
import { verifyOrderToken } from '@/lib/auth/order-token'

const mockVerifyConfirmToken = vi.mocked(verifyConfirmToken)
const mockVerifyOrderToken = vi.mocked(verifyOrderToken)

// ─── Helpers ──────────────────────────────────────────────────────────

function mockRequest(body: Record<string, unknown> = {}) {
    return { json: () => Promise.resolve(body) } as unknown as Request
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

const AWAITING_ORDER = {
    id: 78,
    orderNumber: 'ORD-ABC123',
    status: 'pending',
    paymentStatus: 'awaiting_payment',
    magicLinkSecret: 'secret-xyz',
}

// ─── Fixtures for restock tests ───────────────────────────────────────

const ORDER_NONVARIANT = {
    ...AWAITING_ORDER,
    items: [{ product: 1, productName: 'Product A', variant: null, quantity: 2 }],
}

const ORDER_VARIANT = {
    ...AWAITING_ORDER,
    items: [{ product: 1, productName: 'Product B', variant: 'Red - M', quantity: 3 }],
}

const ORDER_MIXED = {
    ...AWAITING_ORDER,
    items: [
        { product: 1, productName: 'Product B', variant: 'Red - M', quantity: 2 },
        { product: 2, productName: 'Product A', variant: null, quantity: 1 },
    ],
}

beforeEach(() => {
    vi.clearAllMocks()
    mockCookieGet.mockReturnValue(undefined)
    mockVerifyConfirmToken.mockReturnValue(false)
    mockVerifyOrderToken.mockResolvedValue({ ok: false } as any)
})

// ─── Tests (TC-F13.07: buyer cancel flow) ─────────────────────────────

describe('POST /api/orders/[id]/cancel-payment [TC-F13.07]', () => {
    it('[TC-F13.07] cancels an awaiting-payment order with a valid ct_ cookie', async () => {
        // Arrange
        mockFindByID.mockResolvedValueOnce(AWAITING_ORDER)
        mockCookieGet.mockReturnValue({ value: 'valid-ct' })
        mockVerifyConfirmToken.mockReturnValue(true)
        mockExecute.mockResolvedValueOnce({ rows: [{ id: 78 }] })

        // Act
        const res = await POST(mockRequest(), ctx('78'))
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.cancelled).toBe(true)
        expect(mockExecute).toHaveBeenCalledOnce()
    })

    it('[TC-F13.07] cancels with a valid magic-link token when no cookie', async () => {
        // Arrange
        mockFindByID.mockResolvedValueOnce(AWAITING_ORDER)
        mockVerifyOrderToken.mockResolvedValue({ ok: true } as any)
        mockExecute.mockResolvedValueOnce({ rows: [{ id: 78 }] })

        // Act
        const res = await POST(mockRequest({ token: 'magic' }), ctx('78'))
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
    })

    it('[TC-F13.07] returns 401 when neither cookie nor token is valid', async () => {
        // Arrange
        mockFindByID.mockResolvedValueOnce(AWAITING_ORDER)

        // Act
        const res = await POST(mockRequest(), ctx('78'))
        const body = await res.json()

        // Assert
        expect(res.status).toBe(401)
        expect(body.error.code).toBe('UNAUTHORIZED')
        expect(mockExecute).not.toHaveBeenCalled()
    })

    it('[TC-F13.07] returns 404 when order not found', async () => {
        // Arrange
        mockFindByID.mockRejectedValueOnce(new Error('not found'))

        // Act
        const res = await POST(mockRequest(), ctx('999'))
        const body = await res.json()

        // Assert
        expect(res.status).toBe(404)
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('[TC-F13.07] returns 409 NOT_CANCELLABLE when order is already paid (CAS matches no rows)', async () => {
        // Arrange — paid order: CAS returns no rows, re-fetch shows non-cancelled status
        mockFindByID
            .mockResolvedValueOnce({ ...AWAITING_ORDER, status: 'new', paymentStatus: 'paid' })
            .mockResolvedValueOnce({ ...AWAITING_ORDER, status: 'new', paymentStatus: 'paid' })
        mockCookieGet.mockReturnValue({ value: 'valid-ct' })
        mockVerifyConfirmToken.mockReturnValue(true)
        mockExecute.mockResolvedValueOnce({ rows: [] })

        // Act
        const res = await POST(mockRequest(), ctx('78'))
        const body = await res.json()

        // Assert
        expect(res.status).toBe(409)
        expect(body.error.code).toBe('NOT_CANCELLABLE')
    })

    it('[TC-F13.07] returns idempotent success when order already cancelled', async () => {
        // Arrange — CAS no rows, re-fetch shows already cancelled
        mockFindByID
            .mockResolvedValueOnce(AWAITING_ORDER)
            .mockResolvedValueOnce({ ...AWAITING_ORDER, status: 'cancelled' })
        mockCookieGet.mockReturnValue({ value: 'valid-ct' })
        mockVerifyConfirmToken.mockReturnValue(true)
        mockExecute.mockResolvedValueOnce({ rows: [] })

        // Act
        const res = await POST(mockRequest(), ctx('78'))
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.alreadyCancelled).toBe(true)
    })
})

// ─── TC-F13.07-RW: Restock on buyer cancel (Bug #1082 rework) ─────────
// stock IS decremented at checkout (BT) / session creation (Stripe).
// restockItem SQL call sequence per item (shared mockExecute):
//   non-variant: SELECT has_variants (false) → UPDATE products.inventory       = 2 calls
//   variant:     SELECT has_variants (true)  → UPDATE products_variants.stock
//                                            → UPDATE products.inventory recompute = 3 calls

describe('POST /api/orders/[id]/cancel-payment — restock [TC-F13.07-RW]', () => {
    it('[TC-F13.07-RW-01] non-variant order: restocks products.inventory via SQL', async () => {
        // Arrange
        // CAS (1) + product check has_variants:false (1) + inventory increment (1) = 3
        mockFindByID.mockResolvedValueOnce(ORDER_NONVARIANT)
        mockCookieGet.mockReturnValue({ value: 'valid-ct' })
        mockVerifyConfirmToken.mockReturnValue(true)
        mockExecute
            .mockResolvedValueOnce({ rows: [{ id: 78 }] })                             // CAS succeeds
            .mockResolvedValueOnce({ rows: [{ id: 1, has_variants: false }] })         // product check
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })                              // inventory increment

        // Act
        const res = await POST(mockRequest(), ctx('78'))
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.cancelled).toBe(true)
        // CAS + 2 restockItem SQL calls
        expect(mockExecute).toHaveBeenCalledTimes(3)
    })

    it('[TC-F13.07-RW-02] variant order: restocks products_variants.stock via SQL', async () => {
        // Arrange
        // CAS (1) + product check has_variants:true (1) + UPDATE products_variants (1)
        //         + inventory recompute (1) = 4
        mockFindByID.mockResolvedValueOnce(ORDER_VARIANT)
        mockCookieGet.mockReturnValue({ value: 'valid-ct' })
        mockVerifyConfirmToken.mockReturnValue(true)
        mockExecute
            .mockResolvedValueOnce({ rows: [{ id: 78 }] })                             // CAS succeeds
            .mockResolvedValueOnce({ rows: [{ id: 1, has_variants: true }] })          // product check
            .mockResolvedValueOnce({ rows: [{ id: 'uuid-v' }] })                       // variant stock increment
            .mockResolvedValueOnce({ rows: [] })                                        // inventory recompute

        // Act
        const res = await POST(mockRequest(), ctx('78'))
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.cancelled).toBe(true)
        // CAS + 3 restockItem SQL calls
        expect(mockExecute).toHaveBeenCalledTimes(4)
    })

    it('[TC-F13.07-RW-03] mixed order: both variant and non-variant lines restock correctly', async () => {
        // Arrange
        // CAS (1) + variant: product check (1) + UPDATE variants (1) + recompute (1)
        //         + non-variant: product check (1) + UPDATE inventory (1) = 6
        mockFindByID.mockResolvedValueOnce(ORDER_MIXED)
        mockCookieGet.mockReturnValue({ value: 'valid-ct' })
        mockVerifyConfirmToken.mockReturnValue(true)
        mockExecute
            .mockResolvedValueOnce({ rows: [{ id: 78 }] })                             // CAS succeeds
            .mockResolvedValueOnce({ rows: [{ id: 1, has_variants: true }] })          // variant: product check
            .mockResolvedValueOnce({ rows: [{ id: 'uuid-v' }] })                       // variant: stock increment
            .mockResolvedValueOnce({ rows: [] })                                        // variant: inventory recompute
            .mockResolvedValueOnce({ rows: [{ id: 2, has_variants: false }] })         // non-variant: product check
            .mockResolvedValueOnce({ rows: [{ id: 2 }] })                              // non-variant: inventory increment

        // Act
        const res = await POST(mockRequest(), ctx('78'))
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        // CAS + 3 (variant) + 2 (non-variant)
        expect(mockExecute).toHaveBeenCalledTimes(6)
    })

    it('[TC-F13.07-RW-04] concurrent cancel: CAS loser path returns alreadyCancelled without restocking', async () => {
        // Arrange — CAS returns 0 rows (concurrent request already cancelled); re-fetch shows cancelled
        mockFindByID
            .mockResolvedValueOnce(ORDER_NONVARIANT)                                    // initial fetch passes auth
            .mockResolvedValueOnce({ ...ORDER_NONVARIANT, status: 'cancelled' })       // re-fetch after CAS miss
        mockCookieGet.mockReturnValue({ value: 'valid-ct' })
        mockVerifyConfirmToken.mockReturnValue(true)
        mockExecute.mockResolvedValueOnce({ rows: [] })                                 // CAS misses

        // Act
        const res = await POST(mockRequest(), ctx('78'))
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.alreadyCancelled).toBe(true)
        // Only the CAS SQL — restock must NOT run on the loser path (no double-restock)
        expect(mockExecute).toHaveBeenCalledTimes(1)
    })
})
