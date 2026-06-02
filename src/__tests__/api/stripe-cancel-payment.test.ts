import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockFindByID = vi.fn()
const mockExecute = vi.fn()

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        findByID: mockFindByID,
        db: { drizzle: { execute: mockExecute } },
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

function mockRequest(body: any = {}) {
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
