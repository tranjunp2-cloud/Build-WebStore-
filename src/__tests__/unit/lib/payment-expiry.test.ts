/**
 * Unit tests for payment-expiry background job.
 *
 * TC-F10-06-10: happy path — expired BT orders are cancelled
 * TC-F10-06-11: email error does not bubble (fire-and-forget)
 * TC-F10-06-12: update error is caught per-order; others still process
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { paymentExpiryJob } from '@/lib/jobs/payment-expiry'

vi.mock('@/lib/email/templates/order-expired', () => ({
    orderExpiredEmail: vi.fn(() => ({ subject: 'Order cancelled', html: '<p>test</p>' })),
}))

const makeOrder = (id: number, overrides: Record<string, unknown> = {}) => ({
    id,
    orderNumber: `ECH-00${id}`,
    customerName: `Customer ${id}`,
    total: 100 * id,
    currency: 'MYR',
    paymentMethod: 'bank_transfer',
    paymentStatus: 'awaiting_payment',
    paymentExpiresAt: new Date(Date.now() - 60_000).toISOString(),
    site: { slug: 'test-shop' },
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
