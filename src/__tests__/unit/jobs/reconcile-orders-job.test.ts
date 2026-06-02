import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'

// ─── Mock factories ─────────────────────────────────────────────────────────
vi.mock('@/lib/payment/stripe')
vi.mock('@/lib/payment/reconcile-order-paid')
vi.mock('@/lib/email/templates/order-expired')
vi.mock('drizzle-orm', () => ({
    sql: (strings: TemplateStringsArray, ...values: any[]) => ({
        type: 'sql',
        strings,
        values,
    }),
}))

import { reconcileOrdersJob } from '@/lib/jobs/reconcile-orders'
import * as stripeModule from '@/lib/payment/stripe'
import * as reconcileModule from '@/lib/payment/reconcile-order-paid'

const mockRetrieveCheckoutSession = vi.mocked(stripeModule.retrieveCheckoutSession)
const mockReconcileOrderPaid = vi.mocked(reconcileModule.reconcileOrderPaid)

// ─── Test Helpers ─────────────────────────────────────────────────────────

function createMockPayload(): Payload {
    return {
        find: vi.fn(),
        db: { drizzle: { execute: vi.fn() } as any },
        sendEmail: vi.fn(),
        logger: {
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
        },
    } as unknown as Payload
}

// ─── TC-F13.155/156: Reconcile Orders Job (cron) ───────────────────────────

describe('[TC-F13.155/156] reconcileOrdersJob', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('[TC-F13.155] reconciles pending order when Stripe session paid', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockFind = vi.mocked(payload.find)

        const pendingOrder = {
            id: 123,
            orderNumber: 'ORD-001',
            status: 'pending',
            paymentMethod: 'card',
            createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
            stripeSessionId: 'cs_test_123',
            tenant: { id: 'tenant-1', stripeAccountId: 'acct_test', slug: 'shop-1', name: 'Test Shop' },
            items: [],
        }

        mockFind.mockResolvedValueOnce({ docs: [pendingOrder], totalDocs: 1 })
        mockRetrieveCheckoutSession.mockResolvedValueOnce({ payment_status: 'paid' })
        mockReconcileOrderPaid.mockResolvedValueOnce({ status: 'reconciled' })

        // Act
        const result = await reconcileOrdersJob(payload)

        // Assert
        expect(result.reconciled).toBe(1)
        expect(result.expired).toBe(0)
        expect(mockReconcileOrderPaid).toHaveBeenCalledWith(payload, expect.objectContaining({ orderId: 123, source: 'cron' }))
    })

    it('[TC-F13.156] expires pending order >24h old when not paid', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockFind = vi.mocked(payload.find)
        const mockExecute = vi.mocked((payload.db.drizzle as any).execute)

        const oldOrder = {
            id: 456,
            orderNumber: 'ORD-002',
            status: 'pending',
            paymentMethod: 'fpx',
            paymentStatus: 'awaiting_payment',
            createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
            stripeSessionId: 'cs_test_456',
            tenant: { id: 'tenant-1', stripeAccountId: 'acct_test', slug: 'shop-1', name: 'Test Shop' },
            items: [],
            customerEmail: 'c@example.com',
            subtotal: 100,
            shippingFee: 10,
            total: 110,
            currency: 'MYR',
        }

        mockFind.mockResolvedValueOnce({ docs: [oldOrder], totalDocs: 1 })
        mockRetrieveCheckoutSession.mockResolvedValueOnce(null)
        mockExecute.mockResolvedValueOnce({ rows: [{ id: 456 }] })

        const mockSendEmail = vi.mocked(payload.sendEmail)
        mockSendEmail.mockResolvedValueOnce(undefined)

        // Act
        const result = await reconcileOrdersJob(payload)

        // Assert
        expect(result.reconciled).toBe(0)
        expect(result.expired).toBe(1)
        expect(mockExecute).toHaveBeenCalled()
    })

    it('[TC-F13.156] skips pending order <24h old when not paid', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockFind = vi.mocked(payload.find)

        const youngOrder = {
            id: 789,
            orderNumber: 'ORD-003',
            status: 'pending',
            paymentMethod: 'card',
            paymentStatus: 'awaiting_payment',
            createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
            stripeSessionId: 'cs_test_789',
            tenant: { id: 'tenant-1', stripeAccountId: 'acct_test', slug: 'shop-1', name: 'Test Shop' },
            items: [],
        }

        mockFind.mockResolvedValueOnce({ docs: [youngOrder], totalDocs: 1 })
        mockRetrieveCheckoutSession.mockResolvedValueOnce(null)

        // Act
        const result = await reconcileOrdersJob(payload)

        // Assert
        expect(result.reconciled).toBe(0)
        expect(result.expired).toBe(0)
        expect(result.skipped).toBe(1)
    })

    it('handles multiple orders in batch', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockFind = vi.mocked(payload.find)
        const mockExecute = vi.mocked((payload.db.drizzle as any).execute)

        const orders = [
            {
                id: 111,
                status: 'pending',
                paymentMethod: 'card',
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                stripeSessionId: 'cs_1',
                tenant: { id: 'tenant-1', stripeAccountId: 'acct_test', slug: 'shop', name: 'Shop' },
                items: [],
            },
            {
                id: 222,
                status: 'pending',
                paymentMethod: 'fpx',
                paymentStatus: 'awaiting_payment',
                createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
                stripeSessionId: 'cs_2',
                tenant: { id: 'tenant-1', stripeAccountId: 'acct_test', slug: 'shop', name: 'Shop' },
                items: [],
                customerEmail: 'c@test.com',
            },
        ]

        mockFind.mockResolvedValueOnce({ docs: orders, totalDocs: 2 })
        mockRetrieveCheckoutSession
            .mockResolvedValueOnce({ payment_status: 'paid' })
            .mockResolvedValueOnce(null)

        mockReconcileOrderPaid.mockResolvedValueOnce({ status: 'reconciled' })
        mockExecute.mockResolvedValueOnce({ rows: [{ id: 222 }] })

        // Act
        const result = await reconcileOrdersJob(payload)

        // Assert
        expect(result.reconciled).toBe(1)
        expect(result.expired).toBe(1)
        expect(result.total).toBe(2)
    })

    it('respects limit option', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockFind = vi.mocked(payload.find)

        mockFind.mockResolvedValueOnce({
            docs: [{
                id: 1,
                status: 'pending',
                paymentMethod: 'card',
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                stripeSessionId: 'cs_1',
                tenant: { id: 'tenant-1', stripeAccountId: 'acct_test' },
                items: [],
            }],
            totalDocs: 500,
        })

        mockRetrieveCheckoutSession.mockResolvedValueOnce(null)

        // Act
        await reconcileOrdersJob(payload, { limit: 100 })

        // Assert
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }))
    })

    it('handles errors gracefully', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockFind = vi.mocked(payload.find)

        mockFind.mockResolvedValueOnce({
            docs: [{
                id: 999,
                status: 'pending',
                paymentMethod: 'card',
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                stripeSessionId: 'cs_error',
                tenant: { id: 'tenant-1', stripeAccountId: 'acct_test' },
                items: [],
            }],
            totalDocs: 1,
        })

        mockRetrieveCheckoutSession.mockRejectedValueOnce(new Error('Stripe API error'))

        // Act
        const result = await reconcileOrdersJob(payload)

        // Assert
        expect(result.errors).toBe(1)
        expect(result.reconciled).toBe(0)
    })

    it('returns empty result when no orders found', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockFind = vi.mocked(payload.find)

        mockFind.mockResolvedValueOnce({ docs: [], totalDocs: 0 })

        // Act
        const result = await reconcileOrdersJob(payload)

        // Assert
        expect(result.reconciled).toBe(0)
        expect(result.expired).toBe(0)
        expect(result.total).toBe(0)
    })

    it('filters for pending orders only', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockFind = vi.mocked(payload.find)

        mockFind.mockResolvedValueOnce({ docs: [], totalDocs: 0 })

        // Act
        await reconcileOrdersJob(payload)

        // Assert
        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    and: expect.arrayContaining([
                        expect.objectContaining({ status: { equals: 'pending' } }),
                        expect.objectContaining({ paymentMethod: { in: ['card', 'fpx'] } }),
                    ]),
                }),
            })
        )
    })
})
