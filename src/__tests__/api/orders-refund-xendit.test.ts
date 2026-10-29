/**
 * TC-AICP-161 — the Xendit refund of POST /api/orders/[id]/refund (lib/orders/refund-order.ts, shared with the
 * AI copilot): the Xendit call carries the idempotency key `refund-<order id>-<CAS time>` (a retry of the call or a
 * lost response gets the first answer, never a second refund), and when Xendit REFUSES it (a 4xx) the order goes back to the status
 * and payment status it had — the same semantics as the Stripe branch — instead of staying "refunded" with no
 * money moved. TC-AICP-262 — when the outcome is UNKNOWN (timeout, network, 5xx, 408, 409, unreadable answer)
 * nothing is rolled back: the order stays refunded, an internal note says to check Xendit, the buyer is not
 * emailed and the stock stays, and the answer says so. TC-AICP-356 — a 4xx that says a refund is already running or
 * done (`REFUND_IN_PROGRESS`, duplicates) is unknown too, and an attempt after a refusal uses a new key.
 * Real: the route, the shared refund service, XenditError. Faked: auth, Payload, Xendit, stock, discount release.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)),
}))
vi.mock('@/app/api/orders/lib/stock-utils', () => ({ restockItem: vi.fn(async () => ({ productId: 'p1', restocked: 1 })) }))
vi.mock('@/lib/discounts/release-discount-redemption', () => ({ releaseDiscountRedemption: vi.fn() }))

const mockFindByID = vi.fn()
const mockDrizzleExecute = vi.fn()
const mockLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() }
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID, update: vi.fn(), sendEmail: vi.fn().mockResolvedValue(undefined), db: { drizzle: { execute: mockDrizzleExecute } }, logger: mockLogger })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/email/templates/order-refunded', () => ({ orderRefundedEmail: vi.fn(() => ({ subject: 's', html: '<p/>' })) }))
vi.mock('@/lib/email/get-template-config', () => ({ getTemplateConfig: vi.fn(async () => null) }))
vi.mock('@/lib/payment/stripe', () => ({ getStripeClient: vi.fn() }))
const mockXenditRefund = vi.fn()
vi.mock('@/lib/payment/xendit', () => ({ createRefund: (...args: unknown[]) => mockXenditRefund(...args) }))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({ plan: 'PROFESSIONAL_TM_USER' }),
    canUse: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/lib/subscriptions/feature-guard', () => ({ withFeatureGuard: vi.fn(() => (h: any) => h) }))

import { POST } from '@/app/api/orders/[id]/refund/route'
import { XenditError } from '@/lib/payment/xendit-client'
import { isDefiniteXenditRejection, xenditRefundKey } from '@/lib/orders/refund-order'
import { releaseDiscountRedemption } from '@/lib/discounts/release-discount-redemption'
import { restockItem } from '@/app/api/orders/lib/stock-utils'

const ctx = { params: Promise.resolve({ id: 'order-1' }) }
const CAS_AT = '2026-10-28T08:00:00.000Z'
const req = () => ({ headers: new Headers() }) as unknown as Request
const XENDIT_ORDER = {
    id: 'order-1',
    tenant: { id: 'tenant-1' },
    status: 'completed',
    paymentMethod: 'fpx',
    paymentStatus: 'paid',
    paymentProvider: 'xendit',
    xenditPaymentRequestId: 'inv_1',
    total: 120,
    items: [],
    customerEmail: 'a@b.my',
}

beforeEach(() => {
    vi.clearAllMocks()
    mockFindByID.mockReset().mockImplementation(async ({ collection }: { collection: string }) => (collection === 'tenants' ? { id: 'tenant-1', xenditSecretKey: 'xnd_key' } : { ...XENDIT_ORDER }))
    mockDrizzleExecute.mockReset().mockResolvedValue({ rows: [{ id: 'order-1', updated_at: CAS_AT }] })
    mockXenditRefund.mockReset().mockResolvedValue({ id: 'rfd_1', status: 'SUCCEEDED' })
})

describe('Xendit refund keeps the order safe [TC-AICP-161]', () => {
    it('asks Xendit for the refund with the idempotency key refund-<order id>-<CAS time> and the full RM amount', async () => {
        const res = await POST(req(), ctx as any)

        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({ success: true, data: { refundId: 'rfd_1' } })
        expect(mockXenditRefund).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'xnd_key', invoiceId: 'inv_1', amount: 120, idempotencyKey: `refund-order-1-${Date.parse(CAS_AT)}` }))
    })

    it('puts the order back (status and payment status) and answers 502 when Xendit refuses the refund (4xx)', async () => {
        mockXenditRefund.mockRejectedValue(new XenditError('XENDIT_API_ERROR', 'Xendit POST /refunds failed: 400 INVALID_AMOUNT', 400, { error_code: 'INVALID_AMOUNT' }))

        const res = await POST(req(), ctx as any)
        const body = await res.json()

        expect(res.status).toBe(502)
        expect(body.error.code).toBe('XENDIT_REFUND_ERROR')
        expect(body.error.message).toContain('left as it was')
        // CAS to refunded, then the rollback write
        expect(mockDrizzleExecute).toHaveBeenCalledTimes(2)
        const rollback = mockDrizzleExecute.mock.calls[1][0]
        expect(JSON.stringify(rollback)).toContain('completed')
        expect(JSON.stringify(rollback)).toContain('paid')
    })

    it.each([
        ['a timeout in the network layer', new TypeError('fetch failed')],
        ['a 500', new XenditError('XENDIT_API_ERROR', 'Xendit POST /refunds failed: 500', 500, {})],
        ['a 503', new XenditError('XENDIT_API_ERROR', 'Xendit POST /refunds failed: 503', 503, {})],
        ['a 408 request timeout', new XenditError('XENDIT_API_ERROR', 'Xendit POST /refunds failed: 408', 408, {})],
        ['a 409 duplicate / in-flight answer', new XenditError('XENDIT_API_ERROR', 'Xendit POST /refunds failed: 409 DUPLICATE_ERROR', 409, {})],
        ['an answer that is not JSON', new SyntaxError('Unexpected token < in JSON')],
    ])('keeps the order refunded, writes an internal note and tells the merchant when the outcome is unknown: %s [TC-AICP-262]', async (_label, failure) => {
        mockXenditRefund.mockRejectedValue(failure)

        const res = await POST(req(), ctx as any)
        const body = await res.json()

        expect(res.status).toBe(502)
        expect(body.error.code).toBe('XENDIT_REFUND_UNKNOWN')
        expect(body.error.message).toContain('Check the refund in the Xendit dashboard')
        expect(body.error.message).toContain('kept as refunded')
        // CAS to refunded, then ONLY the note: no write puts the order back
        expect(mockDrizzleExecute).toHaveBeenCalledTimes(2)
        const note = JSON.stringify(mockDrizzleExecute.mock.calls[1][0])
        expect(note).toContain('SET notes')
        expect(note).toContain('Refund sent to Xendit; result unknown - check the Xendit dashboard')
        expect(note).toContain('inv_1')
        expect(note).not.toContain("SET status")
        // no discount slot release, no restock (the money may not have moved)
        expect(releaseDiscountRedemption).not.toHaveBeenCalled()
        expect(restockItem).not.toHaveBeenCalled()
        expect(mockLogger.error).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('result unknown'))
    })

    it('still answers when the reconciliation note itself cannot be written', async () => {
        mockXenditRefund.mockRejectedValue(new TypeError('fetch failed'))
        mockDrizzleExecute.mockResolvedValueOnce({ rows: [{ id: 'order-1' }] }).mockRejectedValueOnce(new Error('db down'))

        const res = await POST(req(), ctx as any)

        expect(res.status).toBe(502)
        expect((await res.json()).error.code).toBe('XENDIT_REFUND_UNKNOWN')
    })

    it('tells a definite refusal from an unknown outcome [TC-AICP-262]', () => {
        const api = (status: number) => new XenditError('XENDIT_API_ERROR', 'x', status)

        for (const status of [400, 401, 403, 404, 422, 429]) expect(isDefiniteXenditRejection(api(status))).toBe(true)
        for (const status of [408, 409, 500, 502, 504, undefined]) expect(isDefiniteXenditRejection(status === undefined ? new XenditError('XENDIT_API_ERROR', 'x') : api(status))).toBe(false)
        // nothing was sent without the key
        expect(isDefiniteXenditRejection(new XenditError('XENDIT_CONFIG_ERROR', 'no key'))).toBe(true)
        expect(isDefiniteXenditRejection(new Error('boom'))).toBe(false)
        expect(isDefiniteXenditRejection(null)).toBe(false)
    })

    it('does not call Xendit twice when the order is already refunded', async () => {
        mockFindByID.mockImplementation(async () => ({ ...XENDIT_ORDER, status: 'refunded' }))

        const res = await POST(req(), ctx as any)

        expect(res.status).toBe(400)
        expect(mockXenditRefund).not.toHaveBeenCalled()
    })
})

describe('Xendit answers that a refund is already under way [TC-AICP-356]', () => {
    it('treats REFUND_IN_PROGRESS and duplicate answers as unknown, other 4xx codes as a refusal', () => {
        // Arrange
        const api = (status: number, error_code?: string) => new XenditError('XENDIT_API_ERROR', 'x', status, error_code ? { error_code } : {})
        // Act + Assert
        for (const code of ['REFUND_IN_PROGRESS', 'DUPLICATE_ERROR', 'DUPLICATE_REFUND_ERROR']) expect(isDefiniteXenditRejection(api(400, code))).toBe(false)
        for (const code of ['INVALID_AMOUNT', 'TEMPORARILY_UNAVAILABLE', undefined]) expect(isDefiniteXenditRejection(api(400, code))).toBe(true)
    })

    it('keeps the order refunded with a note naming the key when Xendit says the refund is in progress', async () => {
        // Arrange
        mockXenditRefund.mockRejectedValue(new XenditError('XENDIT_API_ERROR', 'in progress', 400, { error_code: 'REFUND_IN_PROGRESS' }))
        // Act
        const res = await POST(req(), ctx as any)
        // Assert
        expect(res.status).toBe(502)
        expect((await res.json()).error.code).toBe('XENDIT_REFUND_UNKNOWN')
        const sqlText = JSON.stringify(mockDrizzleExecute.mock.calls.slice(1))
        expect(sqlText).not.toContain("'paid'")
        expect(sqlText).toContain(`refund-order-1-${Date.parse(CAS_AT)}`)
        expect(restockItem).not.toHaveBeenCalled()
    })

    it('gives each refund attempt its own key, from the moment its CAS was won', () => {
        // Arrange
        const first = '2026-10-28T08:00:00.000Z'
        const second = '2026-10-28T08:05:00.000Z'
        // Act
        const keys = [xenditRefundKey('order-1', first), xenditRefundKey('order-1', new Date(second)), xenditRefundKey('order-1', first)]
        // Assert
        expect(keys).toEqual([`refund-order-1-${Date.parse(first)}`, `refund-order-1-${Date.parse(second)}`, `refund-order-1-${Date.parse(first)}`])
        expect(xenditRefundKey('order-1', undefined)).toMatch(/^refund-order-1-\d+$/)
    })
})
