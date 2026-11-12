import { describe, it, expect, vi, beforeEach } from 'vitest'

// GH-2158: the seller's free-text refund reason is stored on the order and shown to the buyer.

const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)),
}))

vi.mock('@/app/api/orders/lib/stock-utils', async (importOriginal) => {
    const original = await importOriginal() as any
    return { ...original, restockItem: vi.fn().mockResolvedValue({ productId: 'prod-1', restocked: 1 }) }
})
vi.mock('@/lib/discounts/release-discount-redemption', () => ({
    releaseDiscountRedemption: vi.fn(),
}))

const mockFindByID = vi.fn()
const mockSendEmail = vi.fn().mockResolvedValue(undefined)
const mockDrizzleExecute = vi.fn()
const mockLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() }

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        findByID: mockFindByID,
        update: vi.fn().mockResolvedValue({}),
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

const mockRefundsCreate = vi.fn()
vi.mock('@/lib/payment/stripe', () => ({
    getStripeClient: vi.fn(() => ({
        refunds: { create: mockRefundsCreate },
        checkout: { sessions: { retrieve: vi.fn() } },
    })),
}))

vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({ id: 'sub-1', plan: 'PROFESSIONAL_TM_USER', status: 'active' }),
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
import { MAX_REFUND_NOTE_LENGTH, normalizeRefundNote } from '@/lib/orders/refund-order'
import { orderRefundedEmail } from '@/lib/email/templates/order-refunded'

function jsonReq(body: unknown): Request {
    return {
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => body,
    } as unknown as Request
}
const ctx = { params: Promise.resolve({ id: 'order-1' }) }

const COD_ORDER = {
    id: 'order-1',
    tenant: 'tenant-1',
    status: 'completed',
    paymentMethod: 'cod',
    items: [],
    customerEmail: 'customer@test.com',
}
const STRIPE_ORDER = {
    id: 'order-1',
    tenant: { id: 'tenant-1', stripeAccountId: 'acct_test' },
    status: 'shipped',
    paymentMethod: 'stripe',
    stripePaymentIntentId: 'pi_test_123',
    items: [],
    customerEmail: 'customer@test.com',
}

type SqlPart = { kind: 'text' | 'value'; value: string | number | null }

/**
 * Flattens a drizzle `sql` template into its SQL text and its bound values, so a test can look for a column and the
 * value written to it. Text is a StringChunk (an object with a `value` array of strings); a bound value is a bare primitive.
 */
function flattenSql(node: unknown): SqlPart[] {
    if (node === null || typeof node === 'string' || typeof node === 'number') return [{ kind: 'value', value: node }]
    if (Array.isArray(node)) return node.flatMap(flattenSql)
    if (node && typeof node === 'object') {
        const record = node as { queryChunks?: unknown[]; value?: unknown }
        if (record.queryChunks) return flattenSql(record.queryChunks)
        if (Array.isArray(record.value)) return [{ kind: 'text', value: record.value.join('') }]
    }
    return []
}
const sqlText = (call: unknown[]) => flattenSql(call[0]).filter((part) => part.kind === 'text').map((part) => part.value).join('')
const sqlValues = (call: unknown[]) => flattenSql(call[0]).filter((part) => part.kind === 'value').map((part) => part.value)
const refundWrites = () => mockDrizzleExecute.mock.calls.filter((call) => /refund_reason\s*=/.test(sqlText(call)))

describe('normalizeRefundNote [TC-F10.R15]', () => {
    it('[TC-F10.R15] keeps the trimmed text', () => {
        expect(normalizeRefundNote('  UAT test refund  ')).toBe('UAT test refund')
    })

    it('[TC-F10.R15] returns null for empty, blank and non-string input', () => {
        expect(normalizeRefundNote('')).toBeNull()
        expect(normalizeRefundNote('   ')).toBeNull()
        expect(normalizeRefundNote(undefined)).toBeNull()
        expect(normalizeRefundNote({ reason: 'x' })).toBeNull()
    })

    it('[TC-F10.R15] cuts text longer than the limit', () => {
        const note = normalizeRefundNote('a'.repeat(MAX_REFUND_NOTE_LENGTH + 100))

        expect(note).toHaveLength(MAX_REFUND_NOTE_LENGTH)
    })
})

describe('POST /api/orders/[id]/refund — refund reason [TC-F10.R16]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFindByID.mockReset()
        mockDrizzleExecute.mockReset()
        mockRefundsCreate.mockReset()
        mockDrizzleExecute.mockResolvedValue({ rows: [{ id: 'order-1' }] })
        mockRefundsCreate.mockResolvedValue({ id: 'refund_123' })
    })

    it('[TC-F10.R16] COD: stores the reason in the refund update and passes it to the buyer email', async () => {
        mockFindByID.mockResolvedValueOnce({ ...COD_ORDER })

        const res = await POST(jsonReq({ reason: 'UAT test refund' }), ctx as any)

        expect(res.status).toBe(200)
        const writes = refundWrites()
        expect(writes).toHaveLength(1)
        expect(sqlValues(writes[0])).toContain('UAT test refund')
        expect(vi.mocked(orderRefundedEmail).mock.calls[0][0]).toMatchObject({ refundNote: 'UAT test refund' })
    })

    it('[TC-F10.R16] the free text is not lost when it is not one of the Xendit reasons', async () => {
        mockFindByID.mockResolvedValueOnce({ ...COD_ORDER })

        await POST(jsonReq({ reason: 'Item damaged in transit' }), ctx as any)

        expect(vi.mocked(orderRefundedEmail).mock.calls[0][0].refundNote).toBe('Item damaged in transit')
    })

    it('[TC-F10.R17] no reason in the request: stores null and the email has no note', async () => {
        mockFindByID.mockResolvedValueOnce({ ...COD_ORDER })

        const res = await POST({ headers: new Headers() } as unknown as Request, ctx as any)

        expect(res.status).toBe(200)
        expect(sqlValues(refundWrites()[0])).toContain(null)
        expect(vi.mocked(orderRefundedEmail).mock.calls[0][0].refundNote).toBeNull()
    })

    it('[TC-F10.R18] a reason over the limit is cut before it is stored and emailed', async () => {
        mockFindByID.mockResolvedValueOnce({ ...COD_ORDER })

        await POST(jsonReq({ reason: 'x'.repeat(MAX_REFUND_NOTE_LENGTH + 50) }), ctx as any)

        expect(vi.mocked(orderRefundedEmail).mock.calls[0][0].refundNote).toHaveLength(MAX_REFUND_NOTE_LENGTH)
    })

    it('[TC-F10.R20] Stripe refund fails: the rollback clears the stored reason', async () => {
        mockFindByID.mockResolvedValueOnce({ ...STRIPE_ORDER })
        mockRefundsCreate.mockRejectedValue(new Error('Stripe network error'))

        const res = await POST(jsonReq({ reason: 'UAT test refund' }), ctx as any)

        expect(res.status).toBe(502)
        const texts = mockDrizzleExecute.mock.calls.map(sqlText)
        expect(texts.some((text) => /refund_reason\s*=\s*NULL/.test(text))).toBe(true)
        expect(mockSendEmail).not.toHaveBeenCalled()
    })
})
