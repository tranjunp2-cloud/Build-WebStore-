import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'

// ─── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('@/lib/payment/stripe')
vi.mock('@/lib/payment/xendit')
vi.mock('@/lib/payment/reconcile-order-paid')

import { reconcileOrdersJob } from '@/lib/jobs/reconcile-orders'
import * as stripeModule from '@/lib/payment/stripe'
import * as xenditModule from '@/lib/payment/xendit'
import * as reconcileModule from '@/lib/payment/reconcile-order-paid'

const mockRetrieveCheckoutSession = vi.mocked(stripeModule.retrieveCheckoutSession)
const mockGetPaymentRequest = vi.mocked(xenditModule.getPaymentRequest)
const mockReconcileOrderPaid = vi.mocked(reconcileModule.reconcileOrderPaid)

function createMockPayload(): Payload {
    return {
        find: vi.fn(),
        logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
    } as unknown as Payload
}

function pendingOrder(over: Record<string, any> = {}) {
    return {
        id: 123,
        orderNumber: 'ORD-001',
        status: 'pending',
        paymentMethod: 'card',
        createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        stripeSessionId: 'cs_test_123',
        tenant: { id: 'tenant-1', stripeAccountId: 'acct_test', slug: 'shop-1', name: 'Test Shop' },
        items: [],
        ...over,
    }
}

// ─── reconcileOrdersJob — HEAL ONLY (cancel is payment-expiry's job) ─────────

describe('reconcileOrdersJob (heal-only)', () => {
    beforeEach(() => vi.clearAllMocks())

    it('[TC-F13.155] reconciles a pending order when its Stripe session is paid', async () => {
        // Arrange
        const payload = createMockPayload()
        // Mock 2 calls: (1) Stripe orders query, (2) Xendit orders query
        vi.mocked(payload.find)
            .mockResolvedValueOnce({ docs: [pendingOrder()], totalDocs: 1 } as any)
            .mockResolvedValueOnce({ docs: [], totalDocs: 0 } as any) // Xendit query returns empty
        mockRetrieveCheckoutSession.mockResolvedValueOnce({ payment_status: 'paid' } as any)
        mockReconcileOrderPaid.mockResolvedValueOnce({ status: 'reconciled' })

        // Act
        const result = await reconcileOrdersJob(payload)

        // Assert
        expect(result.reconciled).toBe(1)
        expect(mockReconcileOrderPaid).toHaveBeenCalledWith(payload, expect.objectContaining({ orderId: 123, source: 'cron' }))
    })

    it('[TC-F13.155] skips (does NOT cancel) a pending order not yet paid at Stripe — regardless of age', async () => {
        // Arrange — a >24h-old unpaid order is left untouched; cancelling it is payment-expiry's job
        const payload = createMockPayload()
        vi.mocked(payload.find)
            .mockResolvedValueOnce({
                docs: [pendingOrder({ id: 456, createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() })],
                totalDocs: 1,
            } as any)
            .mockResolvedValueOnce({ docs: [], totalDocs: 0 } as any) // Xendit query returns empty
        mockRetrieveCheckoutSession.mockResolvedValueOnce(null)

        // Act
        const result = await reconcileOrdersJob(payload)

        // Assert — no reconcile, no cancel side effect; just skipped
        expect(result.reconciled).toBe(0)
        expect(result.skipped).toBe(1)
        expect(mockReconcileOrderPaid).not.toHaveBeenCalled()
    })

    it('skips an order with no stripeSessionId / connectedAccountId', async () => {
        // Arrange
        const payload = createMockPayload()
        vi.mocked(payload.find)
            .mockResolvedValueOnce({
                docs: [pendingOrder({ stripeSessionId: null })],
                totalDocs: 1,
            } as any)
            .mockResolvedValueOnce({ docs: [], totalDocs: 0 } as any) // Xendit query returns empty

        // Act
        const result = await reconcileOrdersJob(payload)

        // Assert
        expect(result.skipped).toBe(1)
        expect(mockRetrieveCheckoutSession).not.toHaveBeenCalled()
    })

    it('handles a batch: one healed, one not-paid skipped', async () => {
        // Arrange
        const payload = createMockPayload()
        vi.mocked(payload.find)
            .mockResolvedValueOnce({
                docs: [pendingOrder({ id: 111, stripeSessionId: 'cs_1' }), pendingOrder({ id: 222, stripeSessionId: 'cs_2' })],
                totalDocs: 2,
            } as any)
            .mockResolvedValueOnce({ docs: [], totalDocs: 0 } as any) // Xendit query returns empty
        mockRetrieveCheckoutSession
            .mockResolvedValueOnce({ payment_status: 'paid' } as any)
            .mockResolvedValueOnce(null)
        mockReconcileOrderPaid.mockResolvedValueOnce({ status: 'reconciled' })

        // Act
        const result = await reconcileOrdersJob(payload)

        // Assert
        expect(result.reconciled).toBe(1)
        expect(result.skipped).toBe(1)
        expect(result.total).toBe(2)
    })

    it('respects the limit option', async () => {
        // Arrange
        const payload = createMockPayload()
        vi.mocked(payload.find)
            .mockResolvedValueOnce({ docs: [], totalDocs: 0 } as any)
            .mockResolvedValueOnce({ docs: [], totalDocs: 0 } as any) // Xendit query returns empty

        // Act
        await reconcileOrdersJob(payload, { limit: 100 })

        // Assert
        expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }))
    })

    it('counts a Stripe error as an error, not a crash', async () => {
        // Arrange
        const payload = createMockPayload()
        vi.mocked(payload.find)
            .mockResolvedValueOnce({ docs: [pendingOrder({ id: 999 })], totalDocs: 1 } as any)
            .mockResolvedValueOnce({ docs: [], totalDocs: 0 } as any) // Xendit query returns empty
        mockRetrieveCheckoutSession.mockRejectedValueOnce(new Error('Stripe API error'))

        // Act
        const result = await reconcileOrdersJob(payload)

        // Assert
        expect(result.errors).toBe(1)
        expect(result.reconciled).toBe(0)
    })

    it('filters for pending Stripe (card/fpx) orders only', async () => {
        // Arrange
        const payload = createMockPayload()
        vi.mocked(payload.find)
            .mockResolvedValueOnce({ docs: [], totalDocs: 0 } as any)
            .mockResolvedValueOnce({ docs: [], totalDocs: 0 } as any) // Xendit query returns empty

        // Act
        await reconcileOrdersJob(payload)

        // Assert
        expect(payload.find).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    and: expect.arrayContaining([
                        expect.objectContaining({ status: { equals: 'pending' } }),
                        expect.objectContaining({ paymentMethod: { in: ['card', 'fpx'] } }),
                    ]),
                }),
            }),
        )
    })
})
