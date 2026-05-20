/**
 * Unit tests for payment-expiry background job.
 *
 * TC-F10-06-10: happy path — expired BT orders are cancelled
 * TC-F10-06-11: email error does not bubble (fire-and-forget)
 * TC-F10-06-12: update error is caught per-order; others still process
 */

import { describe, it, expect, vi } from 'vitest'
import { paymentExpiryJob } from '@/lib/jobs/payment-expiry'
import { orderExpiredEmail } from '@/lib/email/templates/order-expired'

vi.mock('@/lib/email/templates/order-expired', () => ({
    orderExpiredEmail: vi.fn(() => ({ subject: 'Order cancelled', html: '<p>test</p>' })),
}))

const orderExpiredEmailMock = vi.mocked(orderExpiredEmail)

const makeOrder = (id: number, overrides: Record<string, unknown> = {}) => ({
    id,
    orderNumber: `ECH-00${id}`,
    customerName: `Customer ${id}`,
    customerEmail: `customer${id}@test.com`,
    customerPhone: `0123456${id}`,
    shippingAddress: {
        line1: `${id} Jalan Test`,
        city: 'Kuala Lumpur',
        state: 'WP',
        postcode: '50000',
        country: 'MY',
    },
    items: [
        { productName: `Product A`, variant: 'Size M', quantity: 2, unitPrice: 50 * id },
        { productName: `Product B`, variant: null, quantity: 1, unitPrice: 30 * id },
    ],
    subtotal: 130 * id,
    shippingFee: 8,
    total: 138 * id,
    currency: 'MYR',
    paymentMethod: 'bank_transfer',
    paymentStatus: 'awaiting_payment',
    paymentExpiresAt: new Date(Date.now() - 60_000).toISOString(),
    createdAt: new Date(Date.now() - 26 * 3600_000).toISOString(), // 26h ago
    site: { tenant: { slug: 'test-shop', name: 'Test Shop' } },
    ...overrides,
})

const makePayload = (docs: unknown[], updateImpl?: (args: unknown) => Promise<unknown>) => ({
    find: vi.fn().mockResolvedValue({ docs, totalDocs: docs.length }),
    update: updateImpl
        ? vi.fn().mockImplementation(updateImpl)
        : vi.fn().mockResolvedValue({}),
    sendEmail: vi.fn().mockResolvedValue(undefined),
    logger: { error: vi.fn() },
})

// ─── TC-F10-06-10: happy path ─────────────────────────────────────────────────
describe('paymentExpiryJob — happy path', () => {
    it('cancels all expired BT orders and returns correct counts', async () => {
        const orders = [makeOrder(1), makeOrder(2), makeOrder(3)]
        const payload = makePayload(orders)

        const result = await paymentExpiryJob(payload as any)

        expect(payload.update).toHaveBeenCalledTimes(3)
        expect(payload.update).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'orders',
                data: expect.objectContaining({
                    status: 'cancelled',
                    paymentStatus: 'cancelled',
                    cancelReason: 'Auto-cancelled: payment not received within 24h',
                }),
            }),
        )
        expect(result).toEqual({ processed: 3, errors: 0, total: 3 })
    })

    it('passes full order data to orderExpiredEmail', async () => {
        const order = makeOrder(1)
        const payload = makePayload([order])

        await paymentExpiryJob(payload as any)

        expect(orderExpiredEmailMock).toHaveBeenCalledWith(
            expect.objectContaining({
                shopName: 'Test Shop',
                orderNumber: 'ECH-001',
                customerName: 'Customer 1',
                customerEmail: 'customer1@test.com',
                customerPhone: '01234561',
                items: [
                    expect.objectContaining({ name: 'Product A', variant: 'Size M', quantity: 2, unitPrice: 50 }),
                    expect.objectContaining({ name: 'Product B', variant: null, quantity: 1, unitPrice: 30 }),
                ],
                subtotal: 130,
                shippingFee: 8,
                total: 138,
                currency: 'MYR',
                reorderUrl: expect.stringContaining('/sites/test-shop/products'),
                elapsedTime: expect.stringMatching(/\d+ jam \d+ minit/),
            }),
        )
        expect(payload.sendEmail).toHaveBeenCalledWith({ subject: 'Order cancelled', html: '<p>test</p>' })
    })
})

// ─── TC-F10-06-11: email error does not bubble ────────────────────────────────
describe('paymentExpiryJob — email failure is fire-and-forget', () => {
    it('still increments processed when sendEmail rejects', async () => {
        const orders = [makeOrder(1)]
        const payload = makePayload(orders)
        payload.sendEmail = vi.fn().mockRejectedValue(new Error('SES timeout'))

        const result = await paymentExpiryJob(payload as any)

        // Give the rejected promise microtask a chance to settle
        await new Promise((r) => setTimeout(r, 0))

        expect(result).toEqual({ processed: 1, errors: 0, total: 1 })
        expect(payload.logger.error).toHaveBeenCalledWith(
            expect.objectContaining({ orderId: 1 }),
            'order-expired email failed',
        )
    })
})

// ─── TC-F10-06-12: update error is caught per-order ──────────────────────────
describe('paymentExpiryJob — update error is isolated', () => {
    it('counts failed update as error; other orders still process', async () => {
        const orders = [makeOrder(1), makeOrder(2), makeOrder(3)]
        let callCount = 0
        const updateImpl = async () => {
            callCount++
            if (callCount === 2) throw new Error('DB write failed')
            return {}
        }
        const payload = makePayload(orders, updateImpl)

        const result = await paymentExpiryJob(payload as any)

        expect(result).toEqual({ processed: 2, errors: 1, total: 3 })
        expect(payload.logger.error).toHaveBeenCalledWith(
            expect.objectContaining({ orderId: 2 }),
            'payment-expiry update failed',
        )
    })
})
