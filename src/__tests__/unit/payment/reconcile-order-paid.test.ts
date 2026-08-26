import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'

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

import { reconcileOrderPaid, resolveActualPaymentMethod } from '@/lib/payment/reconcile-order-paid'
import * as stripeClient from '@/lib/payment/stripe-client'
import * as orderPaidEmails from '@/lib/payment/reconcile-order-paid-emails'
import * as tenantNotifications from '@/lib/notifications/notify-tenant-owners'

const mockGetStripeClient = vi.mocked(stripeClient.getStripeClient)
const mockSendOrderPaidEmailsAndNotify = vi.mocked(orderPaidEmails.sendOrderPaidEmailsAndNotify)
const mockNotifyTenantOwners = vi.mocked(tenantNotifications.notifyTenantOwners)

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

// ─── TC-F13.143: Idempotent Payment Reconciliation ─────────────────────────

describe('[TC-F13.143] reconcileOrderPaid — idempotency', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns already_processed when transition returns 0 rows (idempotent)', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockExecute = vi.fn().mockResolvedValueOnce({ rows: [] })
        ;(payload.db.drizzle as any).execute = mockExecute

        const ctx = {
            orderId: 123,
            session: { id: 'cs_test_123', payment_method_types: ['card'] },
            connectedAccountId: 'acct_test',
            source: 'webhook' as const,
        }

        // Act
        const result = await reconcileOrderPaid(payload, ctx)

        // Assert
        expect(result.status).toBe('already_processed')
        expect(payload.findByID).not.toHaveBeenCalled()
        expect(payload.update).not.toHaveBeenCalled()
        expect(mockSendOrderPaidEmailsAndNotify).not.toHaveBeenCalled()
    })

    it('transitions to new/paid on first delivery (reconciled)', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockExecute = vi.fn().mockResolvedValueOnce({ rows: [{ id: 123 }] })
        ;(payload.db.drizzle as any).execute = mockExecute

        const mockFindByID = vi.fn(payload.findByID)
        const mockUpdate = vi.fn(payload.update)
        payload.findByID = mockFindByID
        payload.update = mockUpdate

        mockFindByID.mockResolvedValueOnce({
            id: 123,
            orderNumber: 'ORD-001',
            items: [],
            tenant: { id: 'tenant-1' },
        })
        mockUpdate.mockResolvedValueOnce({})

        const ctx = {
            orderId: 123,
            session: { id: 'cs_test_123', payment_method_types: ['card'], payment_intent: 'pi_test_123' },
            connectedAccountId: 'acct_test',
            source: 'webhook' as const,
        }

        // Act
        const result = await reconcileOrderPaid(payload, ctx)

        // Assert
        expect(result.status).toBe('reconciled')
        expect(mockExecute).toHaveBeenCalled()
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'orders',
                id: 123,
                data: expect.objectContaining({
                    stripeSessionId: 'cs_test_123',
                    stripePaymentIntentId: 'pi_test_123',
                }),
            })
        )
        // sendOrderPaidEmailsAndNotify is called (tested via integration in e2e tests)
    })

    it('[TC-F13.147] resolves payment method: multi-method session with FPX detection', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockExecute = vi.fn().mockResolvedValueOnce({ rows: [{ id: 123 }] })
        ;(payload.db.drizzle as any).execute = mockExecute

        const mockFindByID = vi.fn(payload.findByID)
        const mockUpdate = vi.fn(payload.update)
        payload.findByID = mockFindByID
        payload.update = mockUpdate

        mockFindByID.mockResolvedValueOnce({
            id: 123,
            orderNumber: 'ORD-001',
            items: [],
            tenant: { id: 'tenant-1' },
        })
        mockUpdate.mockResolvedValueOnce({})
        mockSendOrderPaidEmailsAndNotify.mockResolvedValueOnce(undefined)

        const mockStripeClient = {
            paymentIntents: {
                retrieve: vi.fn().mockResolvedValueOnce({
                    payment_method: { type: 'fpx' },
                }),
            },
        }
        mockGetStripeClient.mockReturnValueOnce(mockStripeClient as any)

        const ctx = {
            orderId: 123,
            session: {
                id: 'cs_test_123',
                payment_method_types: ['card', 'fpx'],
                payment_intent: 'pi_test_123',
            },
            connectedAccountId: 'acct_test',
            source: 'webhook' as const,
        }

        // Act
        const result = await reconcileOrderPaid(payload, ctx)

        // Assert
        expect(result.status).toBe('reconciled')
        expect(mockGetStripeClient).toHaveBeenCalled()
        expect(mockStripeClient.paymentIntents.retrieve).toHaveBeenCalledWith(
            'pi_test_123',
            { expand: ['payment_method'] },
            { stripeAccount: 'acct_test' }
        )
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    paymentMethod: 'fpx',
                }),
            })
        )
    })

    it('[TC-F13.145] stock not decremented by reconcileOrderPaid (decremented at checkout)', async () => {
        // Stock is now decremented at Stripe session creation — reconcileOrderPaid must NOT touch inventory.
        // Arrange
        const payload = createMockPayload()
        const mockExecute = vi.fn()
            .mockResolvedValueOnce({ rows: [{ id: 123 }] })     // atomic transition
        ;(payload.db.drizzle as any).execute = mockExecute

        const mockFindByID = vi.fn(payload.findByID)
        const mockUpdate = vi.fn(payload.update)
        payload.findByID = mockFindByID
        payload.update = mockUpdate

        mockFindByID.mockResolvedValueOnce({
            id: 123,
            orderNumber: 'ORD-001',
            items: [
                { product: 999, quantity: 5 },
            ],
            tenant: { id: 'tenant-1' },
        })

        mockUpdate.mockResolvedValue({})

        const ctx = {
            orderId: 123,
            session: { id: 'cs_test_123', payment_method_types: ['card'] },
            connectedAccountId: 'acct_test',
            source: 'webhook' as const,
        }

        // Act
        const result = await reconcileOrderPaid(payload, ctx)

        // Assert
        expect(result.status).toBe('reconciled')
        // Only 1 SQL call: atomic transition (no stock decrement SQL)
        expect(mockExecute).toHaveBeenCalledTimes(1)
    })
})

// ─── resolveActualPaymentMethod Tests ──────────────────────────────────────

describe('[TC-F13.147] resolveActualPaymentMethod', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('single payment_method_type=fpx → fpx, no Stripe expand', async () => {
        // Arrange
        const session = { id: 'cs_test', payment_method_types: ['fpx'], payment_intent: 'pi_test' }

        // Act
        const result = await resolveActualPaymentMethod(session, 'acct_test')

        // Assert
        expect(result.method).toBe('fpx')
        expect(mockGetStripeClient).not.toHaveBeenCalled()
    })

    it('single payment_method_type=card → expands to capture brand + last4', async () => {
        // Arrange — card now expands the intent to read card details for the confirm "Method" line
        const mockStripeClient = {
            paymentIntents: {
                retrieve: vi.fn().mockResolvedValueOnce({ payment_method: { type: 'card', card: { brand: 'visa', last4: '4242' } } }),
            },
        }
        mockGetStripeClient.mockReturnValueOnce(mockStripeClient as any)
        const session = { id: 'cs_test', payment_method_types: ['card'], payment_intent: 'pi_test' }

        // Act
        const result = await resolveActualPaymentMethod(session, 'acct_test')

        // Assert
        expect(result).toEqual({ method: 'card', cardBrand: 'visa', cardLast4: '4242' })
    })

    it('multi-method session expands payment_intent → detects fpx', async () => {
        // Arrange
        const mockStripeClient = {
            paymentIntents: { retrieve: vi.fn().mockResolvedValueOnce({ payment_method: { type: 'fpx' } }) },
        }
        mockGetStripeClient.mockReturnValueOnce(mockStripeClient as any)
        const session = { id: 'cs_test', payment_method_types: ['card', 'fpx'], payment_intent: 'pi_test_123' }

        // Act
        const result = await resolveActualPaymentMethod(session, 'acct_test')

        // Assert
        expect(result.method).toBe('fpx')
        expect(mockStripeClient.paymentIntents.retrieve).toHaveBeenCalledWith(
            'pi_test_123',
            { expand: ['payment_method'] },
            { stripeAccount: 'acct_test' },
        )
    })

    it('expand fails → falls back to card (no details)', async () => {
        // Arrange
        const mockStripeClient = {
            paymentIntents: { retrieve: vi.fn().mockRejectedValueOnce(new Error('Rate limited')) },
        }
        mockGetStripeClient.mockReturnValueOnce(mockStripeClient as any)
        const session = { id: 'cs_test', payment_method_types: ['card', 'fpx'], payment_intent: 'pi_test_123' }

        // Act
        const result = await resolveActualPaymentMethod(session, 'acct_test')

        // Assert
        expect(result.method).toBe('card')
        expect(result.cardLast4).toBeUndefined()
    })

    it('missing payment_intent → card, no expand', async () => {
        // Arrange
        const session = { id: 'cs_test', payment_method_types: ['card', 'fpx'], payment_intent: undefined }

        // Act
        const result = await resolveActualPaymentMethod(session, 'acct_test')

        // Assert
        expect(result.method).toBe('card')
        expect(mockGetStripeClient).not.toHaveBeenCalled()
    })

    it('payment_intent as string resolves correctly', async () => {
        // Arrange
        const mockStripeClient = {
            paymentIntents: {
                retrieve: vi.fn().mockResolvedValueOnce({
                    payment_method: { type: 'card' },
                }),
            },
        }
        mockGetStripeClient.mockReturnValueOnce(mockStripeClient as any)

        const session = {
            id: 'cs_test',
            payment_method_types: ['card', 'fpx'],
            payment_intent: 'pi_string_id',
        }

        // Act
        const result = await resolveActualPaymentMethod(session, 'acct_test')

        // Assert
        expect(result.method).toBe('card')
    })
})
