import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock factories ─────────────────────────────────────────────────────────
vi.mock('payload')
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers')
vi.mock('@/lib/orders/upload-token')
vi.mock('@/lib/payment/stripe')
vi.mock('@/lib/payment/reconcile-order-paid')

import { POST } from '@/app/api/orders/[id]/payment-status/route'
import { getPayload } from 'payload'
import { verifyConfirmToken } from '@/lib/orders/upload-token'
import { retrieveCheckoutSession } from '@/lib/payment/stripe'
import { reconcileOrderPaid } from '@/lib/payment/reconcile-order-paid'
import { cookies } from 'next/headers'

const mockGetPayload = vi.mocked(getPayload)
const mockVerifyConfirmToken = vi.mocked(verifyConfirmToken)
const mockRetrieveCheckoutSession = vi.mocked(retrieveCheckoutSession)
const mockReconcileOrderPaid = vi.mocked(reconcileOrderPaid)
const mockCookies = vi.mocked(cookies)

// ─── TC-F13.152: Payment Status Check (confirm polling) ────────────────────

describe('POST /api/orders/[id]/payment-status [TC-F13.152]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns 401 when ct_ cookie missing', async () => {
        // Arrange
        const mockFindByID = vi.fn().mockResolvedValueOnce({
            id: '123',
            orderNumber: 'ORD-001',
            status: 'pending',
        })
        mockGetPayload.mockResolvedValueOnce({ findByID: mockFindByID } as any)

        const mockCookieStore = { get: vi.fn().mockReturnValueOnce(undefined) }
        mockCookies.mockResolvedValueOnce(mockCookieStore as any)

        // Act
        const res = await POST(new Request('http://localhost/api/orders/123/payment-status'), {
            params: Promise.resolve({ id: '123' }),
        })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(401)
        expect(body.error.code).toBe('UNAUTHORIZED')
    })

    it('returns 404 when order not found', async () => {
        // Arrange
        const mockFindByID = vi.fn().mockResolvedValueOnce(null)
        mockGetPayload.mockResolvedValueOnce({ findByID: mockFindByID } as any)

        // Act
        const res = await POST(new Request('http://localhost/api/orders/999/payment-status'), {
            params: Promise.resolve({ id: '999' }),
        })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(404)
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('[TC-F13.152] returns 200 {reconciled:false} when order already paid', async () => {
        // Arrange
        const mockFindByID = vi.fn().mockResolvedValueOnce({
            id: '123',
            orderNumber: 'ORD-001',
            status: 'shipped', // NOT pending
            paymentStatus: 'paid',
            tenant: { id: 'tenant-1' },
        })
        mockGetPayload.mockResolvedValueOnce({ findByID: mockFindByID } as any)

        const mockCookieStore = { get: vi.fn().mockReturnValueOnce({ value: 'valid-token' }) }
        mockCookies.mockResolvedValueOnce(mockCookieStore as any)

        mockVerifyConfirmToken.mockReturnValueOnce(true)

        // Act
        const res = await POST(new Request('http://localhost/api/orders/123/payment-status'), {
            params: Promise.resolve({ id: '123' }),
        })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.status).toBe('shipped')
        expect(body.paymentStatus).toBe('paid')
        expect(body.reconciled).toBe(false)
        expect(mockReconcileOrderPaid).not.toHaveBeenCalled()
    })

    it('[TC-F13.150/152] reconciles when pending + Stripe session paid', async () => {
        // Arrange
        const mockFindByID = vi.fn()
            .mockResolvedValueOnce({
                id: '123',
                orderNumber: 'ORD-001',
                status: 'pending',
                paymentStatus: 'awaiting_payment',
                stripeSessionId: 'cs_test_123',
                tenant: { id: 'tenant-1', stripeAccountId: 'acct_test' },
            })
            .mockResolvedValueOnce({
                id: '123',
                status: 'new',
                paymentStatus: 'paid',
            })

        mockGetPayload.mockResolvedValue({ findByID: mockFindByID } as any)

        const mockCookieStore = { get: vi.fn().mockReturnValueOnce({ value: 'valid-token' }) }
        mockCookies.mockResolvedValue(mockCookieStore as any)

        mockVerifyConfirmToken.mockReturnValueOnce(true)

        mockRetrieveCheckoutSession.mockResolvedValueOnce({
            id: 'cs_test_123',
            payment_status: 'paid',
            payment_method_types: ['card'],
        })

        mockReconcileOrderPaid.mockResolvedValueOnce({ status: 'reconciled' })

        // Act
        const res = await POST(new Request('http://localhost/api/orders/123/payment-status'), {
            params: Promise.resolve({ id: '123' }),
        })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.status).toBe('new')
        expect(body.paymentStatus).toBe('paid')
        expect(body.reconciled).toBe(true)

        expect(mockRetrieveCheckoutSession).toHaveBeenCalledWith('cs_test_123', 'acct_test')
        expect(mockReconcileOrderPaid).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({
                orderId: 123,
                source: 'poll',
            })
        )
    })

    it('[TC-F13.150/152] returns gracefully when Stripe retrieve returns null', async () => {
        // Arrange
        const mockFindByID = vi.fn().mockResolvedValueOnce({
            id: '123',
            orderNumber: 'ORD-001',
            status: 'pending',
            paymentStatus: 'awaiting_payment',
            stripeSessionId: 'cs_test_123',
            tenant: { id: 'tenant-1', stripeAccountId: 'acct_test' },
        })
        mockGetPayload.mockResolvedValueOnce({ findByID: mockFindByID } as any)

        const mockCookieStore = { get: vi.fn().mockReturnValueOnce({ value: 'valid-token' }) }
        mockCookies.mockResolvedValueOnce(mockCookieStore as any)

        mockVerifyConfirmToken.mockReturnValueOnce(true)
        mockRetrieveCheckoutSession.mockResolvedValueOnce(null)

        // Act
        const res = await POST(new Request('http://localhost/api/orders/123/payment-status'), {
            params: Promise.resolve({ id: '123' }),
        })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200) // NOT 500
        expect(body.status).toBe('pending')
        expect(body.reconciled).toBe(false)
        expect(mockReconcileOrderPaid).not.toHaveBeenCalled()
    })

    it('handles missing stripeSessionId gracefully', async () => {
        // Arrange
        const mockFindByID = vi.fn().mockResolvedValueOnce({
            id: '123',
            orderNumber: 'ORD-001',
            status: 'pending',
            paymentStatus: 'awaiting_payment',
            stripeSessionId: null,
            tenant: { id: 'tenant-1', stripeAccountId: 'acct_test' },
        })
        mockGetPayload.mockResolvedValueOnce({ findByID: mockFindByID } as any)

        const mockCookieStore = { get: vi.fn().mockReturnValueOnce({ value: 'valid-token' }) }
        mockCookies.mockResolvedValueOnce(mockCookieStore as any)

        mockVerifyConfirmToken.mockReturnValueOnce(true)

        // Act
        const res = await POST(new Request('http://localhost/api/orders/123/payment-status'), {
            params: Promise.resolve({ id: '123' }),
        })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.status).toBe('pending')
        expect(body.reconciled).toBe(false)
        expect(mockRetrieveCheckoutSession).not.toHaveBeenCalled()
    })

    it('catches unexpected errors and returns 500', async () => {
        // Arrange
        mockGetPayload.mockRejectedValueOnce(new Error('DB connection failed'))

        // Act
        const res = await POST(new Request('http://localhost/api/orders/123/payment-status'), {
            params: Promise.resolve({ id: '123' }),
        })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(500)
        expect(body.error.code).toBe('INTERNAL_ERROR')
    })
})
