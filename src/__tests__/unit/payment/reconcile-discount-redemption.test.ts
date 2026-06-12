/**
 * Unit tests for discount redemption within reconcileOrderPaid flow.
 *
 * Tests the integration of recordDiscountRedemption at the single-winner
 * pending→paid transition boundary.
 *
 * TC-F33-07-06, TC-F33-07-07, TC-F33-07-10, TC-F33-07-08
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import { reconcileOrderPaid } from '@/lib/payment/reconcile-order-paid'

// ─── Mock factories (hoisted automatically) ─────────────────────────────────
vi.mock('@/lib/payment/stripe-client')
vi.mock('@/lib/payment/reconcile-order-paid-emails')
vi.mock('@/lib/notifications/notify-tenant-owners')
vi.mock('drizzle-orm', () => ({
    sql: (strings: TemplateStringsArray, ...values: any[]) => ({
        type: 'sql',
        strings,
        values,
    }),
}))

import * as stripeClient from '@/lib/payment/stripe-client'
import * as orderPaidEmails from '@/lib/payment/reconcile-order-paid-emails'

const mockGetStripeClient = vi.mocked(stripeClient.getStripeClient)
const mockSendOrderPaidEmailsAndNotify = vi.mocked(orderPaidEmails.sendOrderPaidEmailsAndNotify)

// ─── Test Helpers ─────────────────────────────────────────────────────────
function createMockPayload(): Payload {
    return {
        db: {
            drizzle: { execute: vi.fn() } as any,
        },
        findByID: vi.fn(),
        update: vi.fn(),
    } as unknown as Payload
}

// ─── TC-F33-07-06: Redeem once on pending→paid transition ─────────────────

describe('[TC-F33-07-06] reconcileOrderPaid — discount redemption on paid', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('calls recordDiscountRedemption for order with discount', async () => {
        // Arrange
        const payload = createMockPayload()

        // First execute: atomic transition pending→paid
        const mockExecute = vi.fn()
            .mockResolvedValueOnce({ rows: [{ id: 123 }] })
        ;(payload.db.drizzle as any).execute = mockExecute

        const mockFindByID = vi.fn(payload.findByID)
        const mockUpdate = vi.fn(payload.update)
        payload.findByID = mockFindByID
        payload.update = mockUpdate

        // Order with discount
        mockFindByID.mockResolvedValueOnce({
            id: 123,
            orderNumber: 'ORD-001',
            items: [],
            tenant: { id: 'tenant-1' },
            discount: { id: 456, code: 'SUMMER50' },
            discountCode: 'SUMMER50',
            discountAmount: 5000, // sen
            customerEmail: 'buyer@test.com',
        })

        mockUpdate.mockResolvedValue({})
        mockSendOrderPaidEmailsAndNotify.mockResolvedValue(undefined)

        const mockStripeClient = {
            paymentIntents: { retrieve: vi.fn().mockResolvedValueOnce({ payment_method: { type: 'card' } }) },
        }
        mockGetStripeClient.mockReturnValueOnce(mockStripeClient as any)

        const ctx = {
            orderId: 123,
            session: { id: 'cs_test', payment_method_types: ['card'], payment_intent: 'pi_test' },
            connectedAccountId: 'acct_test',
            source: 'webhook' as const,
        }

        // Act
        const result = await reconcileOrderPaid(payload, ctx)

        // Assert
        expect(result.status).toBe('reconciled')
        // Execute called twice: transition + redemption SQL
        expect(mockExecute).toHaveBeenCalledTimes(2)
        const secondCall = mockExecute.mock.calls[1][0]
        // Second call should be the redemption INSERT ... ON CONFLICT
        expect(secondCall.strings.join('?')).toContain('INSERT INTO discount_usage_history')
    })

    it('does not redeem when order has no discount', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockExecute = vi.fn()
            .mockResolvedValueOnce({ rows: [{ id: 123 }] })
        ;(payload.db.drizzle as any).execute = mockExecute

        const mockFindByID = vi.fn(payload.findByID)
        const mockUpdate = vi.fn(payload.update)
        payload.findByID = mockFindByID
        payload.update = mockUpdate

        // Order WITHOUT discount
        mockFindByID.mockResolvedValueOnce({
            id: 123,
            orderNumber: 'ORD-001',
            items: [],
            tenant: { id: 'tenant-1' },
            discount: null,
            discountAmount: null,
        })

        mockUpdate.mockResolvedValue({})
        mockSendOrderPaidEmailsAndNotify.mockResolvedValue(undefined)

        const mockStripeClient = {
            paymentIntents: { retrieve: vi.fn().mockResolvedValueOnce({ payment_method: { type: 'card' } }) },
        }
        mockGetStripeClient.mockReturnValueOnce(mockStripeClient as any)

        const ctx = {
            orderId: 123,
            session: { id: 'cs_test', payment_method_types: ['card'], payment_intent: 'pi_test' },
            connectedAccountId: 'acct_test',
            source: 'webhook' as const,
        }

        // Act
        const result = await reconcileOrderPaid(payload, ctx)

        // Assert
        expect(result.status).toBe('reconciled')
        // Execute called once: only transition (no redemption)
        expect(mockExecute).toHaveBeenCalledTimes(1)
    })

    it('skips redemption when discountAmount is 0 or falsy', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockExecute = vi.fn()
            .mockResolvedValueOnce({ rows: [{ id: 123 }] })
        ;(payload.db.drizzle as any).execute = mockExecute

        const mockFindByID = vi.fn(payload.findByID)
        const mockUpdate = vi.fn(payload.update)
        payload.findByID = mockFindByID
        payload.update = mockUpdate

        // Order with discount record but 0 amount
        mockFindByID.mockResolvedValueOnce({
            id: 123,
            orderNumber: 'ORD-001',
            items: [],
            tenant: { id: 'tenant-1' },
            discount: { id: 456 },
            discountAmount: 0, // Silently rejected at checkout
        })

        mockUpdate.mockResolvedValue({})
        mockSendOrderPaidEmailsAndNotify.mockResolvedValue(undefined)

        const mockStripeClient = {
            paymentIntents: { retrieve: vi.fn().mockResolvedValueOnce({ payment_method: { type: 'card' } }) },
        }
        mockGetStripeClient.mockReturnValueOnce(mockStripeClient as any)

        const ctx = {
            orderId: 123,
            session: { id: 'cs_test', payment_method_types: ['card'], payment_intent: 'pi_test' },
            connectedAccountId: 'acct_test',
            source: 'webhook' as const,
        }

        // Act
        const result = await reconcileOrderPaid(payload, ctx)

        // Assert
        expect(result.status).toBe('reconciled')
        // Execute called once: only transition (amount guard prevented redemption)
        expect(mockExecute).toHaveBeenCalledTimes(1)
    })
})

// ─── TC-F33-07-10: No redemption on failed/already-processed transition ────

describe('[TC-F33-07-10] reconcileOrderPaid — no redemption on early return', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does not redeem when transition returns 0 rows (already_processed)', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockExecute = vi.fn()
            .mockResolvedValueOnce({ rows: [] }) // 0 rows = already transitioned
        ;(payload.db.drizzle as any).execute = mockExecute

        const mockFindByID = vi.fn(payload.findByID)
        payload.findByID = mockFindByID

        const ctx = {
            orderId: 123,
            session: { id: 'cs_test', payment_method_types: ['card'] },
            connectedAccountId: 'acct_test',
            source: 'webhook' as const,
        }

        // Act
        const result = await reconcileOrderPaid(payload, ctx)

        // Assert
        expect(result.status).toBe('already_processed')
        // Execute called once: transition only (early return)
        expect(mockExecute).toHaveBeenCalledTimes(1)
        // No findByID (skipped due to early return)
        expect(mockFindByID).not.toHaveBeenCalled()
    })
})

// ─── TC-F33-07-07: Webhook re-delivery / retry idempotency ────────────────

describe('[TC-F33-07-07] reconcileOrderPaid — re-delivery idempotency', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('second reconcile of same order records redemption once (ON CONFLICT guards it)', async () => {
        // Arrange — first reconcile
        const payload = createMockPayload()
        let callCount = 0

        const mockExecute = vi.fn((sql) => {
            callCount++
            if (callCount === 1) {
                // First transition: success
                return Promise.resolve({ rows: [{ id: 123 }] })
            } else if (callCount === 2) {
                // First redemption: inserted
                return Promise.resolve({ rows: [{ inserted: 1 }] })
            } else if (callCount === 3) {
                // Second transition: already processed
                return Promise.resolve({ rows: [] })
            } else {
                // Should not reach here
                return Promise.resolve({ rows: [] })
            }
        })
        ;(payload.db.drizzle as any).execute = mockExecute

        const mockFindByID = vi.fn(payload.findByID)
        const mockUpdate = vi.fn(payload.update)
        payload.findByID = mockFindByID
        payload.update = mockUpdate

        mockFindByID.mockResolvedValue({
            id: 123,
            orderNumber: 'ORD-001',
            items: [],
            tenant: { id: 'tenant-1' },
            discount: { id: 456 },
            discountCode: 'SUMMER50',
            discountAmount: 5000,
        })

        mockUpdate.mockResolvedValue({})
        mockSendOrderPaidEmailsAndNotify.mockResolvedValue(undefined)

        const mockStripeClient = {
            paymentIntents: { retrieve: vi.fn().mockResolvedValue({ payment_method: { type: 'card' } }) },
        }
        mockGetStripeClient.mockReturnValue(mockStripeClient as any)

        const ctx = {
            orderId: 123,
            session: { id: 'cs_test', payment_method_types: ['card'], payment_intent: 'pi_test' },
            connectedAccountId: 'acct_test',
            source: 'webhook' as const,
        }

        // Act — first delivery
        const result1 = await reconcileOrderPaid(payload, ctx)

        // Assert first delivery
        expect(result1.status).toBe('reconciled')

        // Act — second delivery (webhook re-delivery)
        const result2 = await reconcileOrderPaid(payload, ctx)

        // Assert second delivery
        expect(result2.status).toBe('already_processed')
        // Total execute calls: transition1 + redemption1 + transition2
        expect(mockExecute).toHaveBeenCalledTimes(3)
        // NO second redemption SQL (early return after already_processed)
    })
})

// ─── TC-F33-07-08: Email discount line integration ────────────────────────

describe('[TC-F33-07-08] reconcileOrderPaid — discount line in email', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('passes discountCode + discountAmount to email sender', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockExecute = vi.fn()
            .mockResolvedValueOnce({ rows: [{ id: 123 }] })
        ;(payload.db.drizzle as any).execute = mockExecute

        const mockFindByID = vi.fn(payload.findByID)
        const mockUpdate = vi.fn(payload.update)
        payload.findByID = mockFindByID
        payload.update = mockUpdate

        const orderWithDiscount = {
            id: 123,
            orderNumber: 'ORD-001',
            items: [],
            tenant: { id: 'tenant-1' },
            discount: { id: 456 },
            discountCode: 'SUMMER50',
            discountAmount: 5000, // sen
            customerEmail: 'buyer@test.com',
        }

        mockFindByID.mockResolvedValueOnce(orderWithDiscount)
        mockUpdate.mockResolvedValue({})
        mockSendOrderPaidEmailsAndNotify.mockResolvedValue(undefined)

        const mockStripeClient = {
            paymentIntents: { retrieve: vi.fn().mockResolvedValueOnce({ payment_method: { type: 'card' } }) },
        }
        mockGetStripeClient.mockReturnValueOnce(mockStripeClient as any)

        const ctx = {
            orderId: 123,
            session: { id: 'cs_test', payment_method_types: ['card'], payment_intent: 'pi_test' },
            connectedAccountId: 'acct_test',
            source: 'webhook' as const,
        }

        // Act
        const result = await reconcileOrderPaid(payload, ctx)

        // Assert
        expect(result.status).toBe('reconciled')
        expect(mockSendOrderPaidEmailsAndNotify).toHaveBeenCalledWith(
            payload,
            expect.objectContaining({
                discountCode: 'SUMMER50',
                discountAmount: 5000,
            })
        )
    })
})
