import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Auth mock ─────────────────────────────────────────────────────────
const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)),
}))

// ─── stock-utils mock ─────────────────────────────────────────────────
const mockRestockItem = vi.fn()
vi.mock('@/app/api/orders/lib/stock-utils', async (importOriginal) => {
    const original = await importOriginal() as any
    return {
        ...original,
        restockItem: (...args: any[]) => mockRestockItem(...args),
    }
})

// ─── Payload mock ──────────────────────────────────────────────────────
const mockFindByID = vi.fn()
const mockUpdate = vi.fn()
const mockSendEmail = vi.fn().mockResolvedValue(undefined)
const mockDrizzleExecute = vi.fn()
const mockLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() }

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        findByID: mockFindByID,
        update: mockUpdate,
        sendEmail: mockSendEmail,
        db: { drizzle: { execute: mockDrizzleExecute } },
        logger: mockLogger,
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/email/templates/order-refunded', () => ({
    orderRefundedEmail: vi.fn(() => ({ subject: 'Order refunded', html: '<p>refunded</p>' })),
}))
vi.mock('@/lib/email/get-template-config', () => ({
    getTemplateConfig: vi.fn(() => Promise.resolve(null)),
}))

// ─── Stripe mock ───────────────────────────────────────────────────────
const mockRefundsCreate = vi.fn()
vi.mock('@/lib/payment/stripe', () => ({
    getStripeClient: vi.fn(() => ({
        refunds: { create: mockRefundsCreate },
        checkout: { sessions: { retrieve: vi.fn() } },
    })),
}))

vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({
        id: 'mock-sub-1',
        plan: 'PROFESSIONAL_TM_USER',
        status: 'active',
        startDate: '2026-01-01T00:00:00.000Z',
    }),
    isSubscriptionActive: vi.fn().mockReturnValue(true),
    canUse: vi.fn().mockResolvedValue(true),
    canUseWithinLimit: vi.fn().mockResolvedValue(true),
    recordUsage: vi.fn().mockResolvedValue(undefined),
    reduceUsage: vi.fn().mockResolvedValue(undefined),
    getConsumed: vi.fn().mockResolvedValue(0),
}))

vi.mock('@/lib/subscriptions/feature-guard', () => ({
    withFeatureGuard: vi.fn(() => (h: any) => h),
}))

import { POST } from '@/app/api/orders/[id]/refund/route'
import { orderRefundedEmail } from '@/lib/email/templates/order-refunded'

// ─── Helpers ───────────────────────────────────────────────────────────
function makeReq() {
    return {} as unknown as Request
}
const ctx = { params: Promise.resolve({ id: 'order-1' }) }

const BASE_BT_ORDER = {
    id: 'order-1',
    tenant: 'tenant-1',
    status: 'shipped',
    paymentMethod: 'bank_transfer',
    paymentStatus: 'paid',
    items: [],
    customerEmail: 'customer@test.com',
}

const BASE_STRIPE_ORDER = {
    id: 'order-1',
    tenant: { id: 'tenant-1', stripeAccountId: 'acct_test' },
    status: 'shipped',
    paymentMethod: 'stripe',
    stripePaymentIntentId: 'pi_test_123',
    items: [],
    customerEmail: 'customer@test.com',
}

// ─── TC-F10.R: Refund restock tests (#1082) ────────────────────────────
describe('POST /api/orders/[id]/refund — inventory restock [TC-F10.R]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFindByID.mockReset()
        mockUpdate.mockReset()
        mockDrizzleExecute.mockReset()
        mockRestockItem.mockReset()
        mockRefundsCreate.mockReset()
        // Default: CAS succeeds
        mockDrizzleExecute.mockResolvedValue({ rows: [{ id: 'order-1' }] })
        // Default: restock succeeds
        mockRestockItem.mockResolvedValue({ productId: 'prod-1', restocked: 1 })
        // Default: update succeeds
        mockUpdate.mockResolvedValue({})
        // Default: Stripe refund succeeds
        mockRefundsCreate.mockResolvedValue({ id: 'refund_123' })
    })

    // ─── TC-F10.R1: bank_transfer variant product ──────────────────────

    it('[TC-F10.R1] bank_transfer: variant product refund restocks correct variant', async () => {
        mockFindByID.mockResolvedValue({
            ...BASE_BT_ORDER,
            items: [{ product: 'prod-1', variant: 'Size M', quantity: 2 }],
        })
        mockRestockItem.mockResolvedValue({ productId: 'prod-1', restocked: 2 })

        const res = await POST(makeReq(), ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(mockRestockItem).toHaveBeenCalledWith(
            expect.anything(), // payload
            'prod-1',
            'Size M',
            2,
        )
        expect(body.restock).toHaveLength(1)
        expect(body.restock[0].restocked).toBe(2)
    })

    // ─── TC-F10.R1b: refund email carries variant name (not null) ─────

    it('[TC-F10.R1b] bank_transfer: refund email items carry variant field value, not null', async () => {
        mockFindByID.mockResolvedValue({
            ...BASE_BT_ORDER,
            items: [{ product: 'prod-1', variant: 'Size M', quantity: 2 }],
        })
        mockRestockItem.mockResolvedValue({ productId: 'prod-1', restocked: 2 })

        await POST(makeReq(), ctx as any)
        // flush fire-and-forget microtasks so fireRefundEmail() completes
        await Promise.resolve()

        expect(orderRefundedEmail).toHaveBeenCalledWith(
            expect.objectContaining({
                items: expect.arrayContaining([
                    expect.objectContaining({ variant: 'Size M' }),
                ]),
            }),
            undefined,
        )
    })

    // ─── TC-F10.R2: bank_transfer non-variant product ──────────────────

    it('[TC-F10.R2] bank_transfer: non-variant product refund restocks product.inventory', async () => {
        mockFindByID.mockResolvedValue({
            ...BASE_BT_ORDER,
            paymentMethod: 'cod',
            items: [{ product: 'prod-2', quantity: 3 }],
        })
        mockRestockItem.mockResolvedValue({ productId: 'prod-2', restocked: 3 })

        const res = await POST(makeReq(), ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(mockRestockItem).toHaveBeenCalledWith(
            expect.anything(),
            'prod-2',
            undefined,
            3,
        )
        expect(body.restock[0].restocked).toBe(3)
    })

    // ─── TC-F10.R3: Stripe mixed items ─────────────────────────────────

    it('[TC-F10.R3] Stripe: mixed items (variant + non-variant) both restocked, refundId returned', async () => {
        mockFindByID.mockResolvedValue({
            ...BASE_STRIPE_ORDER,
            items: [
                { product: 'prod-v', variant: 'Red - M', quantity: 2 },
                { product: 'prod-n', quantity: 1 },
            ],
        })
        mockRestockItem
            .mockResolvedValueOnce({ productId: 'prod-v', restocked: 2 })
            .mockResolvedValueOnce({ productId: 'prod-n', restocked: 1 })

        const res = await POST(makeReq(), ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(mockRestockItem).toHaveBeenCalledTimes(2)
        expect(mockRefundsCreate).toHaveBeenCalledOnce()
        expect(body.restock).toHaveLength(2)
        expect(body.data.refundId).toBe('refund_123')
    })

    // ─── TC-F10.R4: missing product ID ─────────────────────────────────

    it('[TC-F10.R4] bank_transfer: item with null product → skipped with product_not_found, ops alert fired, no crash', async () => {
        mockFindByID.mockResolvedValue({
            ...BASE_BT_ORDER,
            items: [{ product: null, quantity: 1 }],
        })

        const res = await POST(makeReq(), ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(mockRestockItem).not.toHaveBeenCalled()
        expect(body.restock[0].skipped).toBe(true)
        expect(body.restock[0].reason).toBe('product_not_found')
        // Ops alert IS triggered — product_not_found is in the alertable filter (data integrity concern)
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ orderId: 'order-1' }),
            '[Order Refund] Restock failed — manual inventory reconciliation required',
        )
    })

    // ─── TC-F10.R5: Stripe restock write_failed → ops alert, still 200 ─

    it('[TC-F10.R5] Stripe: restock write_failed → logger.error called, refund still succeeds', async () => {
        mockFindByID.mockResolvedValue({
            ...BASE_STRIPE_ORDER,
            items: [{ product: 'prod-1', quantity: 2 }],
        })
        mockRestockItem.mockResolvedValue({ productId: 'prod-1', restocked: 0, skipped: true, reason: 'write_failed' })

        const res = await POST(makeReq(), ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.refundId).toBe('refund_123')
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ orderId: 'order-1' }),
            '[Order Refund] Restock failed — manual inventory reconciliation required',
        )
    })

    // ─── TC-F10.R6: already-refunded order (idempotency) ───────────────

    it('[TC-F10.R6] bank_transfer: already-refunded order → ALREADY_REFUNDED, restockItem NOT called', async () => {
        mockFindByID.mockResolvedValue({ ...BASE_BT_ORDER, status: 'refunded' })
        mockDrizzleExecute.mockResolvedValue({ rows: [] }) // CAS misses — 'refunded' not in ['shipped','completed']

        const res = await POST(makeReq(), ctx as any)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('ALREADY_REFUNDED')
        expect(mockRestockItem).not.toHaveBeenCalled()
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    // ─── TC-F10.R7: Stripe CAS miss (concurrent refund) ────────────────

    it('[TC-F10.R7] Stripe: CAS miss (concurrent refund) → ALREADY_REFUNDED, restockItem NOT called', async () => {
        mockFindByID.mockResolvedValue({ ...BASE_STRIPE_ORDER, items: [{ product: 'prod-1', quantity: 1 }] })
        mockDrizzleExecute.mockResolvedValue({ rows: [] }) // CAS miss

        const res = await POST(makeReq(), ctx as any)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('ALREADY_REFUNDED')
        expect(mockRestockItem).not.toHaveBeenCalled()
        expect(mockRefundsCreate).not.toHaveBeenCalled()
    })

    // ─── TC-F10.R8: restock runs AFTER Stripe success (C1) ─────────────

    it('[TC-F10.R8] Stripe: restock runs AFTER stripe.refunds.create (success-gated)', async () => {
        const callOrder: string[] = []
        mockFindByID.mockResolvedValue({
            ...BASE_STRIPE_ORDER,
            items: [{ product: 'prod-1', quantity: 1 }],
        })
        mockRefundsCreate.mockImplementation(async () => {
            callOrder.push('stripe')
            return { id: 'refund_123' }
        })
        mockRestockItem.mockImplementation(async () => {
            callOrder.push('restock')
            return { productId: 'prod-1', restocked: 1 }
        })

        const res = await POST(makeReq(), ctx as any)
        expect(res.status).toBe(200)
        expect(callOrder).toEqual(['stripe', 'restock'])
    })

    // ─── TC-F10.R10: Stripe failure → no restock, SQL rollback ──────────

    it('[TC-F10.R10] Stripe: refunds.create fails → 502, restock NOT called, status rolled back', async () => {
        mockFindByID.mockResolvedValueOnce({ ...BASE_STRIPE_ORDER, items: [{ product: 'prod-1', quantity: 2 }] })
        mockRefundsCreate.mockRejectedValue(new Error('Stripe network error'))

        const res = await POST(makeReq(), ctx as any)
        const body = await res.json()

        expect(res.status).toBe(502)
        expect(body.error.code).toBe('REFUND_FAILED')
        expect(mockRestockItem).not.toHaveBeenCalled()  // restock gated behind Stripe success
        expect(body.restock).toBeUndefined()             // no inventory side effect to report
        expect(mockDrizzleExecute).toHaveBeenCalled()    // unconditional rollback SQL fired
        // rollback succeeded → Stripe-failure log fires, but NOT the rollback-failure log
        expect(mockLogger.error).not.toHaveBeenCalledWith(
            expect.anything(),
            '[Refund] Status rollback failed — DB state may be inconsistent'
        )
    })

    // ─── TC-F10.R13: Stripe failure + rollback failure → both errors logged ─

    it('[TC-F10.R13] Stripe: refunds.create fails AND rollback UPDATE fails → 502, both errors logged', async () => {
        mockFindByID.mockResolvedValueOnce({ ...BASE_STRIPE_ORDER, items: [{ product: 'prod-1', quantity: 2 }] })
        mockRefundsCreate.mockRejectedValue(new Error('Stripe network error'))
        // CAS succeeds (1st execute), rollback throws (2nd execute)
        mockDrizzleExecute
            .mockResolvedValueOnce({ rows: [{ id: 'order-1' }] })        // CAS success
            .mockRejectedValueOnce(new Error('rollback db down'))         // rollback failure

        const res = await POST(makeReq(), ctx as any)
        const body = await res.json()

        expect(res.status).toBe(502)
        expect(body.error.code).toBe('REFUND_FAILED')
        expect(mockRestockItem).not.toHaveBeenCalled()
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.anything(),
            '[Refund] Stripe refund failed — status rolled back'
        )
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ rollbackErr: 'rollback db down', orderId: 'order-1', originalStatus: 'shipped' }),
            '[Refund] Status rollback failed — DB state may be inconsistent'
        )
    })

    // ─── TC-F10.R10b: charge_already_refunded → idempotent 200 ──────────

    it('[TC-F10.R10b] Stripe: charge_already_refunded → 200 idempotent success, restock called, refundId null', async () => {
        mockFindByID.mockResolvedValueOnce({ ...BASE_STRIPE_ORDER, items: [{ product: 'prod-1', quantity: 1 }] })
        mockRefundsCreate.mockRejectedValue(
            Object.assign(new Error('Charge already refunded'), { code: 'charge_already_refunded' }),
        )
        mockRestockItem.mockResolvedValue({ productId: 'prod-1', restocked: 1 })

        const res = await POST(makeReq(), ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.refundId).toBeNull()
        expect(mockRestockItem).toHaveBeenCalledOnce()
        expect(body.restock).toHaveLength(1)
    })

    // ─── TC-F10.R12: null_inventory restock → warn only, no ops alert ───

    it('[TC-F10.R12] Stripe: restock null_inventory → logger.warn only, refund still 200', async () => {
        mockFindByID.mockResolvedValueOnce({ ...BASE_STRIPE_ORDER, items: [{ product: 'prod-1', quantity: 1 }] })
        mockRestockItem.mockResolvedValue({ productId: 'prod-1', restocked: 0, skipped: true, reason: 'null_inventory' })

        const res = await POST(makeReq(), ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        // null_inventory is a warn (tracking disabled), not a data-integrity error
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.objectContaining({ orderId: 'order-1' }),
            '[Order Refund] Restock skipped — inventory tracking disabled',
        )
        expect(mockLogger.error).not.toHaveBeenCalled()
    })

    // ─── TC-F10.R11: bank_transfer CAS miss (concurrent refund) (H1) ────

    it('[TC-F10.R11] bank_transfer: CAS miss (concurrent refund) → ALREADY_REFUNDED, restockItem NOT called', async () => {
        mockFindByID.mockResolvedValue({ ...BASE_BT_ORDER, items: [{ product: 'prod-1', quantity: 1 }] })
        mockDrizzleExecute.mockResolvedValue({ rows: [] }) // CAS returns 0 rows

        const res = await POST(makeReq(), ctx as any)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('ALREADY_REFUNDED')
        expect(mockRestockItem).not.toHaveBeenCalled()
    })

    // ─── Regression: product ID as object (depth:1 expansion) ──────────

    it('[TC-F10.R9] bank_transfer: item.product as expanded object → productId extracted correctly', async () => {
        mockFindByID.mockResolvedValue({
            ...BASE_BT_ORDER,
            items: [{ product: { id: 'prod-1', name: 'T-Shirt' }, variant: 'Blue', quantity: 1 }],
        })
        mockRestockItem.mockResolvedValue({ productId: 'prod-1', restocked: 1 })

        const res = await POST(makeReq(), ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(mockRestockItem).toHaveBeenCalledWith(
            expect.anything(),
            'prod-1',
            'Blue',
            1,
        )
        expect(body.restock[0].restocked).toBe(1)
    })

    // ─── TC-F10.R14: CAS SQL includes updated_at = NOW() ─────────────────

    it('[TC-F10.R14] bank_transfer: refund CAS SQL sets updated_at = NOW() to keep ORM timestamps coherent', async () => {
        mockFindByID.mockResolvedValue({ ...BASE_BT_ORDER, items: [] })
        await POST(makeReq(), ctx as any)

        const casCall = mockDrizzleExecute.mock.calls[0][0]
        const sqlText = JSON.stringify(casCall)
        expect(sqlText).toMatch(/updated_at/)
        expect(sqlText).toMatch(/NOW\(\)/)
    })

    // ─── TC-F10.R9b: numeric-string ID coercion ────────────────────────

    it('[TC-F10.R9b] bank_transfer: expanded product with numeric-string ID → coerced to number', async () => {
        mockFindByID.mockResolvedValue({
            ...BASE_BT_ORDER,
            items: [{ product: { id: '1', name: 'T-Shirt' }, variant: 'Blue', quantity: 1 }],
        })
        mockRestockItem.mockResolvedValue({ productId: '1', restocked: 1 })

        const res = await POST(makeReq(), ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        // '1' → Number.isFinite(Number('1')) = true → coerced to number 1
        expect(mockRestockItem).toHaveBeenCalledWith(
            expect.anything(),
            1,          // number, not string '1'
            'Blue',
            1,
        )
        expect(body.restock[0].restocked).toBe(1)
    })

})
