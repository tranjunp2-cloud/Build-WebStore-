import { describe, it, expect, vi, beforeEach } from 'vitest'

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
const mockFind = vi.fn()
const mockFindByID = vi.fn()
const mockDrizzleExecute = vi.fn()
const mockLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() }
const mockSendEmail = vi.fn().mockResolvedValue(undefined)

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        find: mockFind,
        findByID: mockFindByID,
        sendEmail: mockSendEmail,
        db: { drizzle: { execute: mockDrizzleExecute } },
        logger: mockLogger,
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

// ─── Email mocks ────────────────────────────────────────────────────────
vi.mock('@/lib/email/templates/order-refunded', () => ({
    orderRefundedEmail: vi.fn(() => ({ subject: 'Refunded', html: '<p>refunded</p>' })),
}))
vi.mock('@/lib/email/get-template-config', () => ({
    getTemplateConfig: vi.fn(() => Promise.resolve(null)),
}))

// ─── verifyConnectedAccountOwnership mock — always passes ──────────────
vi.mock('@/app/api/webhooks/stripe/handlers/verify-account-ownership', () => ({
    verifyConnectedAccountOwnership: vi.fn(() => Promise.resolve(true)),
}))

import { handleChargeRefunded } from '@/app/api/webhooks/stripe/handlers/charge-refunded'
import type { Payload } from 'payload'

// ─── Fixtures ──────────────────────────────────────────────────────────
const BASE_ORDER = {
    id: 'order-1',
    tenant: { id: 'tenant-1', stripeAccountId: 'acct_test', name: 'Test Shop', slug: 'test-shop' },
    status: 'shipped',
    paymentMethod: 'stripe',
    stripePaymentIntentId: 'pi_test_123',
    customerEmail: 'customer@test.com',
    customerName: 'John Doe',
    orderNumber: 'ORD-001',
    total: 10000,
    subtotal: 10000,
    shippingFee: 0,
    currency: 'MYR',
    items: [] as any[],
    createdAt: '2026-06-01T00:00:00Z',
}

const BASE_EVENT = {
    connectedAccountId: 'acct_test',
    data: {
        payment_intent: 'pi_test_123',
        amount_refunded: 10000,
    },
}

// ─── Helper ─────────────────────────────────────────────────────────────
function makePayload(): Payload {
    return {
        find: mockFind,
        findByID: mockFindByID,
        sendEmail: mockSendEmail,
        db: { drizzle: { execute: mockDrizzleExecute } } as any,
        logger: mockLogger,
    } as unknown as Payload
}

// ─── TC-F13.160–164: charge-refunded restock ────────────────────────────
describe('handleChargeRefunded — inventory restock [TC-F13.160–164]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFind.mockReset()
        mockDrizzleExecute.mockReset()
        mockRestockItem.mockReset()
        mockLogger.error.mockReset()
        mockLogger.warn.mockReset()
        mockLogger.info.mockReset()

        // Default: order found with 1 variant item
        mockFind.mockResolvedValue({
            docs: [{
                ...BASE_ORDER,
                items: [{ product: 'prod-1', variant: 'Size M', quantity: 2 }],
            }],
        })
        // Default: CAS succeeds — order not yet refunded
        mockDrizzleExecute.mockResolvedValue({ rows: [{ id: 'order-1' }] })
        // Default: restock succeeds
        mockRestockItem.mockResolvedValue({ productId: 'prod-1', restocked: 2 })
        // Default: findByID (for verifyConnectedAccountOwnership) returns tenant
        mockFindByID.mockResolvedValue({ stripeAccountId: 'acct_test' })
    })

    // ─── TC-F13.160: normal restock ─────────────────────────────────────

    it('[TC-F13.160] CAS success + variant item → restockItem called with correct productId, variant, qty', async () => {
        await handleChargeRefunded(makePayload(), BASE_EVENT as any)

        expect(mockRestockItem).toHaveBeenCalledOnce()
        expect(mockRestockItem).toHaveBeenCalledWith(
            expect.anything(), // payload
            'prod-1',
            'Size M',
            2,
        )
        expect(mockLogger.error).not.toHaveBeenCalled()
    })

    // ─── TC-F13.161: CAS miss → no restock ──────────────────────────────

    it('[TC-F13.161] CAS miss (order already refunded) → restockItem NOT called, early return', async () => {
        mockDrizzleExecute.mockResolvedValue({ rows: [] }) // CAS miss

        await handleChargeRefunded(makePayload(), BASE_EVENT as any)

        expect(mockRestockItem).not.toHaveBeenCalled()
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({ orderId: 'order-1' }),
            expect.stringContaining('already refunded'),
        )
    })

    // ─── TC-F13.162: null product → logger.error, no crash ──────────────

    it('[TC-F13.162] item with null product → logger.error fired, restockItem skipped, handler does not throw', async () => {
        mockFind.mockResolvedValue({
            docs: [{
                ...BASE_ORDER,
                items: [{ product: null, variant: 'Size M', quantity: 1 }],
            }],
        })

        await expect(handleChargeRefunded(makePayload(), BASE_EVENT as any)).resolves.toBeUndefined()

        expect(mockRestockItem).not.toHaveBeenCalled()
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ orderId: 'order-1', itemIndex: 0 }),
            expect.stringContaining('no product ID'),
        )
    })

    // ─── TC-F13.163: null_inventory → logger.warn only, no ops error ────

    it('[TC-F13.163] restockItem returns null_inventory → logger.warn only, NOT logger.error', async () => {
        mockRestockItem.mockResolvedValue({ productId: 'prod-1', restocked: 0, skipped: true, reason: 'null_inventory' })

        await handleChargeRefunded(makePayload(), BASE_EVENT as any)

        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.objectContaining({ orderId: 'order-1', productId: 'prod-1' }),
            expect.stringContaining('inventory tracking disabled'),
        )
        // null_inventory is warn-only — must NOT trigger ops alert
        const errorCalls = mockLogger.error.mock.calls.filter((c: any[]) =>
            String(c[1]).includes('Restock failed') || String(c[1]).includes('reconciliation'))
        expect(errorCalls).toHaveLength(0)
    })

    // ─── TC-F13.164: write_failed → logger.error (ops alert) ────────────

    it('[TC-F13.164] restockItem returns write_failed → logger.error ops alert fired', async () => {
        mockRestockItem.mockResolvedValue({ productId: 'prod-1', restocked: 0, skipped: true, reason: 'write_failed' })

        await handleChargeRefunded(makePayload(), BASE_EVENT as any)

        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ orderId: 'order-1', productId: 'prod-1', reason: 'write_failed' }),
            expect.stringContaining('manual inventory reconciliation'),
        )
    })
})
