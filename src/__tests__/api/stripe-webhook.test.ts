import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all dependencies
const mockFind = vi.fn()
const mockUpdate = vi.fn()
const mockFindByID = vi.fn()
const mockCreate = vi.fn()

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        find: mockFind,
        update: mockUpdate,
        findByID: mockFindByID,
        create: mockCreate,
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/payment/stripe', () => ({
    verifyStripeWebhook: vi.fn(),
    normalizeStripeEvent: vi.fn(),
}))
vi.mock('@/lib/email/send', () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/email/templates/order-confirmation', () => ({
    orderConfirmationEmail: vi.fn(() => ({ subject: 'Order', html: '<p>Order</p>' })),
}))

import { POST } from '@/app/api/webhooks/stripe/route'
import { verifyStripeWebhook, normalizeStripeEvent } from '@/lib/payment/stripe'

const mockVerify = vi.mocked(verifyStripeWebhook)
const mockNormalize = vi.mocked(normalizeStripeEvent)

// ─── TC-F13: Stripe webhook handling ──────────────────────────────────

function createRequest(body: string, signature?: string) {
    return {
        text: () => Promise.resolve(body),
        headers: {
            get: (name: string) => name === 'stripe-signature' ? signature ?? null : null,
        },
    } as any
}

describe('POST /api/webhooks/stripe [TC-F13]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns 400 when stripe-signature header is missing', async () => {
        const res = await POST(createRequest('{}'))
        expect(res.status).toBe(400)
    })

    it('returns 400 when signature verification fails', async () => {
        mockVerify.mockImplementation(() => { throw new Error('Invalid signature') })

        const res = await POST(createRequest('{}', 'sig_invalid'))
        expect(res.status).toBe(400)
    })

    it('returns 200 for valid payment_success event', async () => {
        mockVerify.mockReturnValue({ type: 'checkout.session.completed' })
        mockNormalize.mockReturnValue({
            type: 'payment_success',
            data: { id: 'sess_1', client_reference_id: 'order-1' },
        })
        mockFind.mockResolvedValue({ docs: [] })
        mockUpdate.mockResolvedValue({})
        mockFindByID.mockResolvedValue({ id: 'order-1', items: [], customerEmail: 'test@test.com', orderNumber: 'ORD-001' })

        const res = await POST(createRequest('{}', 'sig_valid'))
        expect(res.status).toBe(200)
    })

    it('returns 200 for payment_failed event', async () => {
        mockVerify.mockReturnValue({ type: 'payment_intent.payment_failed' })
        mockNormalize.mockReturnValue({
            type: 'payment_failed',
            data: { id: 'pi_1', metadata: { orderId: 'order-2' } },
        })
        mockFind.mockResolvedValue({ docs: [{ id: 'order-2' }] })
        mockUpdate.mockResolvedValue({})

        const res = await POST(createRequest('{}', 'sig_valid'))
        expect(res.status).toBe(200)
    })

    it('returns 200 for subscription_updated event', async () => {
        mockVerify.mockReturnValue({ type: 'customer.subscription.updated' })
        mockNormalize.mockReturnValue({
            type: 'subscription_updated',
            data: { id: 'sub_1', status: 'active', current_period_start: 1700000000, current_period_end: 1703000000 },
        })
        mockFind.mockResolvedValue({ docs: [{ id: 'sub-doc-1' }] })
        mockUpdate.mockResolvedValue({})

        const res = await POST(createRequest('{}', 'sig_valid'))
        expect(res.status).toBe(200)
    })

    it('returns 200 for account_updated event', async () => {
        mockVerify.mockReturnValue({ type: 'account.updated' })
        mockNormalize.mockReturnValue({
            type: 'account_updated',
            data: { id: 'acct_1', charges_enabled: true, payouts_enabled: true, details_submitted: true },
        })
        mockFind.mockResolvedValue({ docs: [{ id: 'tenant-1' }] })
        mockUpdate.mockResolvedValue({})

        const res = await POST(createRequest('{"account":"acct_1"}', 'sig_valid'))
        expect(res.status).toBe(200)
    })

    it('returns 200 for unhandled event type (logs but does not fail)', async () => {
        mockVerify.mockReturnValue({ type: 'unknown.event' })
        mockNormalize.mockReturnValue({ type: 'unknown', data: {} })

        const res = await POST(createRequest('{}', 'sig_valid'))
        expect(res.status).toBe(200)
    })

    it('returns 200 even when event processing throws (prevents Stripe retry)', async () => {
        mockVerify.mockReturnValue({ type: 'checkout.session.completed' })
        mockNormalize.mockReturnValue({
            type: 'payment_success',
            data: { id: 'sess_err', client_reference_id: 'order-err' },
        })
        mockFind.mockRejectedValue(new Error('DB error'))

        const res = await POST(createRequest('{}', 'sig_valid'))
        expect(res.status).toBe(200) // Still 200 to prevent Stripe retries
    })

    it('[TC-F13.14] skips already processed orders (idempotency)', async () => {
        mockVerify.mockReturnValue({ type: 'checkout.session.completed' })
        mockNormalize.mockReturnValue({
            type: 'payment_success',
            data: { id: 'sess_dup', client_reference_id: 'order-dup' },
        })
        mockFind.mockResolvedValue({ docs: [{ id: 'order-dup', status: 'paid' }] })

        const res = await POST(createRequest('{}', 'sig_valid'))
        expect(res.status).toBe(200)
        // update should NOT be called for already-processed order
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    // ─── TC-F13.11: FPX payment method mapping ───────────────────────
    it('[TC-F13.11] maps FPX payment_method_types to paymentMethod=fpx in order', async () => {
        // Arrange
        mockVerify.mockReturnValue({ type: 'checkout.session.completed' })
        mockNormalize.mockReturnValue({
            type: 'payment_success',
            data: {
                id: 'sess_fpx_123',
                client_reference_id: 'order-fpx',
                payment_method_types: ['fpx'],
                payment_intent: 'pi_fpx_456',
            },
        })
        mockFind.mockResolvedValue({ docs: [] }) // Not already processed
        mockUpdate.mockResolvedValue({})
        mockFindByID.mockResolvedValue({
            id: 'order-fpx',
            items: [],
            customerEmail: 'buyer@test.com',
            orderNumber: 'ORD-FPX-001',
            tenant: 'tenant-1',
        })

        // Act
        const res = await POST(createRequest('{}', 'sig_valid'))

        // Assert
        expect(res.status).toBe(200)
        // First update call should set paymentMethod to 'fpx'
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'orders',
                id: 'order-fpx',
                data: expect.objectContaining({
                    paymentMethod: 'fpx',
                    status: 'paid',
                }),
            }),
        )
    })

    // ─── TC-F13.11b: Card payment method mapping ────────────────────
    it('[TC-F13.11b] maps card payment_method_types to paymentMethod=card in order', async () => {
        // Arrange
        mockVerify.mockReturnValue({ type: 'checkout.session.completed' })
        mockNormalize.mockReturnValue({
            type: 'payment_success',
            data: {
                id: 'sess_card_123',
                client_reference_id: 'order-card',
                payment_method_types: ['card'],
                payment_intent: 'pi_card_456',
            },
        })
        mockFind.mockResolvedValue({ docs: [] })
        mockUpdate.mockResolvedValue({})
        mockFindByID.mockResolvedValue({
            id: 'order-card',
            items: [],
            customerEmail: 'buyer@test.com',
            orderNumber: 'ORD-CARD-001',
            tenant: 'tenant-1',
        })

        // Act
        const res = await POST(createRequest('{}', 'sig_valid'))

        // Assert
        expect(res.status).toBe(200)
        // Update should set paymentMethod to 'card'
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'orders',
                id: 'order-card',
                data: expect.objectContaining({
                    paymentMethod: 'card',
                    status: 'paid',
                }),
            }),
        )
    })

    // ─── TC-F13.11: stripeChargeId extraction from payment_intent ─────
    it('[TC-F13.11] extracts stripeChargeId from expanded payment_intent.latest_charge', async () => {
        // Arrange
        mockVerify.mockReturnValue({ type: 'checkout.session.completed' })
        mockNormalize.mockReturnValue({
            type: 'payment_success',
            data: {
                id: 'sess_charge_123',
                client_reference_id: 'order-charge',
                payment_method_types: ['fpx'],
                payment_intent: {
                    id: 'pi_with_charge',
                    latest_charge: 'ch_test_charge_abc123',
                },
            },
        })
        mockFind.mockResolvedValue({ docs: [] })
        mockUpdate.mockResolvedValue({})
        mockFindByID.mockResolvedValue({
            id: 'order-charge',
            items: [],
            customerEmail: 'buyer@test.com',
            orderNumber: 'ORD-CHARGE-001',
            tenant: 'tenant-1',
        })

        // Act
        const res = await POST(createRequest('{}', 'sig_valid'))

        // Assert
        expect(res.status).toBe(200)
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    stripeChargeId: 'ch_test_charge_abc123',
                    stripePaymentIntentId: 'pi_with_charge',
                }),
            }),
        )
    })
})
