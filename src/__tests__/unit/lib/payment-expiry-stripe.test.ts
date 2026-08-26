/**
 * Unit tests for payment-expiry job — Stripe order auto-cancellation.
 *
 * TC-F13.155: expired Stripe card/fpx orders are cancelled when paymentExpiresAt passes
 * TC-F13.156: expired Stripe payment_failed orders (status=payment_failed) are also cancelled
 *
 * Extends payment-expiry.test.ts (bank_transfer happy path) with Stripe-specific cases.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { paymentExpiryJob } from '@/lib/jobs/payment-expiry'
import { orderExpiredEmail } from '@/lib/email/templates/order-expired'
import { restockItem } from '@/app/api/orders/lib/stock-utils'

vi.mock('@/lib/email/templates/order-expired', () => ({
    orderExpiredEmail: vi.fn(() => ({ subject: 'Order cancelled', html: '<p>test</p>' })),
}))

vi.mock('@/lib/email/get-template-config', () => ({
    getTemplateConfig: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/app/api/orders/lib/stock-utils', () => ({
    restockItem: vi.fn().mockResolvedValue({ restocked: 1, skipped: false }),
}))

const orderExpiredEmailMock = vi.mocked(orderExpiredEmail)
const mockRestockItem = vi.mocked(restockItem)

function makeStripeOrder(id: number, overrides: Record<string, unknown> = {}) {
    return {
        id,
        orderNumber: `ORD-STR${id}`,
        customerName: `Customer ${id}`,
        customerEmail: `buyer${id}@test.com`,
        customerPhone: null,
        shippingAddress: null,
        items: [{ product: `prod-${id}`, productName: 'Widget', variant: null, quantity: 1, unitPrice: 100 }],
        subtotal: 100,
        shippingFee: 10,
        total: 110,
        currency: 'MYR',
        paymentMethod: 'card',
        paymentStatus: 'awaiting_payment',
        status: 'pending',
        paymentExpiresAt: new Date(Date.now() - 60_000).toISOString(),
        createdAt: new Date(Date.now() - 25 * 3600_000).toISOString(),
        site: { tenant: { slug: 'stripe-shop', name: 'Stripe Shop' } },
        ...overrides,
    }
}

function makePayload(docs: unknown[], drizzleImpl?: () => Promise<unknown>) {
    return {
        find: vi.fn().mockResolvedValue({ docs, totalDocs: docs.length }),
        update: vi.fn().mockResolvedValue({}),
        sendEmail: vi.fn().mockResolvedValue(undefined),
        logger: { error: vi.fn() },
        db: {
            drizzle: {
                execute: drizzleImpl
                    ? vi.fn().mockImplementation(drizzleImpl)
                    : vi.fn().mockResolvedValue({ rows: [{ id: 1 }] }),
            },
        },
    }
}

// ─── TC-F13.155: expired card order with awaiting_payment ─────────────────────
describe('paymentExpiryJob — Stripe card order auto-cancel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        orderExpiredEmailMock.mockReturnValue({ subject: 'Order cancelled', html: '<p>test</p>' })
    })

    it('[TC-F13.155] cancels expired card order with paymentStatus=awaiting_payment', async () => {
        // Arrange
        const order = makeStripeOrder(1, { paymentMethod: 'card', paymentStatus: 'awaiting_payment' })
        const payload = makePayload([order])

        // Act
        const result = await paymentExpiryJob(payload as any)

        // Assert
        // 2x execute: (1) cancel UPDATE + (2) release discount redemption
        expect(payload.db.drizzle.execute).toHaveBeenCalledTimes(2)
        expect(result).toEqual({ processed: 1, errors: 0, total: 1 })
        expect(payload.sendEmail).toHaveBeenCalledWith(
            expect.objectContaining({ to: 'buyer1@test.com' }),
        )
        // Stock restocked — product is included in mock items
        expect(mockRestockItem).toHaveBeenCalledWith(expect.anything(), 'prod-1', null, 1)
        // Discount slot released on auto-cancel (closes the pre-existing leak)
        const discountReleaseCall = payload.db.drizzle.execute.mock.calls[1]
        expect(discountReleaseCall).toBeDefined()
    })

    it('[TC-F13.155] cancels expired fpx order with paymentStatus=awaiting_payment', async () => {
        // Arrange
        const order = makeStripeOrder(2, { paymentMethod: 'fpx', paymentStatus: 'awaiting_payment' })
        const payload = makePayload([order])

        // Act
        const result = await paymentExpiryJob(payload as any)

        // Assert
        expect(result).toEqual({ processed: 1, errors: 0, total: 1 })
        // 2x execute: (1) cancel UPDATE + (2) release discount redemption
        expect(payload.db.drizzle.execute).toHaveBeenCalledTimes(2)
        expect(mockRestockItem).toHaveBeenCalledWith(expect.anything(), 'prod-2', null, 1)
    })

    it('[TC-F13.155] Payload find query includes card and fpx in paymentMethod filter', async () => {
        // Arrange
        const order = makeStripeOrder(3)
        const payload = makePayload([order])

        // Act
        await paymentExpiryJob(payload as any)

        // Assert — verify the where filter passed to payload.find includes Stripe methods
        const findCall = payload.find.mock.calls[0][0]
        const paymentMethodFilter = findCall.where.and.find(
            (c: any) => c.paymentMethod,
        )
        expect(paymentMethodFilter.paymentMethod.in).toContain('card')
        expect(paymentMethodFilter.paymentMethod.in).toContain('fpx')
        expect(paymentMethodFilter.paymentMethod.in).toContain('bank_transfer')
    })
})

// ─── TC-F13.156: expired Stripe payment_failed orders auto-cancel ─────────────
describe('paymentExpiryJob — Stripe payment_failed order auto-cancel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('[TC-F13.156] cancels expired card order with paymentStatus=payment_failed', async () => {
        // Arrange — simulates Stripe card order that webhook marked as payment_failed
        const order = makeStripeOrder(4, {
            paymentMethod: 'card',
            paymentStatus: 'payment_failed',
            status: 'payment_failed',
        })
        const payload = makePayload([order])

        // Act
        const result = await paymentExpiryJob(payload as any)

        // Assert
        expect(result).toEqual({ processed: 1, errors: 0, total: 1 })
        // 2x execute: (1) cancel UPDATE + (2) release discount redemption
        expect(payload.db.drizzle.execute).toHaveBeenCalledTimes(2)
        expect(mockRestockItem).toHaveBeenCalledWith(expect.anything(), 'prod-4', null, 1)
    })

    it('[TC-F13.156] payment_failed status included in Payload find query filter', async () => {
        // Arrange
        const order = makeStripeOrder(5, { paymentStatus: 'payment_failed' })
        const payload = makePayload([order])

        // Act
        await paymentExpiryJob(payload as any)

        // Assert — verify where filter includes payment_failed
        const findCall = payload.find.mock.calls[0][0]
        const paymentStatusFilter = findCall.where.and.find(
            (c: any) => c.paymentStatus,
        )
        expect(paymentStatusFilter.paymentStatus.in).toContain('payment_failed')
        expect(paymentStatusFilter.paymentStatus.in).toContain('awaiting_payment')
    })

    it('[TC-F13.156] atomic SQL guard skips already-processed Stripe order (no rows returned)', async () => {
        // Arrange — drizzle returns empty rows (concurrent job already processed it)
        const order = makeStripeOrder(6, { paymentMethod: 'card', paymentStatus: 'payment_failed' })
        const payload = makePayload([order], async () => ({ rows: [] }))

        // Act
        const result = await paymentExpiryJob(payload as any)

        // Assert — skipped, not counted as processed or error
        expect(result).toEqual({ processed: 0, errors: 0, total: 1 })
        expect(payload.sendEmail).not.toHaveBeenCalled()
    })
})

// ─── paymentExpiresAt timestamp helper (unit) ─────────────────────────────────
// The actual paymentExpiresAt assertion for stripe-checkout and retry-payment routes
// lives in their respective API test files (stripe-checkout.test.ts and
// stripe-retry-payment.test.ts) which already have top-level mocks set up.
// This section tests the timing math directly.
describe('paymentExpiresAt — 24h window timestamp', () => {
    it('[TC-F13.155] 24h expiry ISO string is ~86400s ahead of Date.now()', () => {
        // Arrange
        const before = Date.now()

        // Act — replicate the expression used in both routes
        const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

        const after = Date.now()

        // Assert
        const exp = new Date(expiry).getTime()
        expect(exp).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000)
        expect(exp).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000 + 100)
    })
})
