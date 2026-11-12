import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
const mockFindByID = vi.fn()
const mockUpdate = vi.fn()
const mockSendEmail = vi.fn().mockResolvedValue(undefined)
const mockDrizzleExecute = vi.fn()
const mockLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() }
const mockStripeRefundsCreate = vi.fn()
const mockStripeSessionsRetrieve = vi.fn()

vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)),
}))
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        findByID: mockFindByID, update: mockUpdate, sendEmail: mockSendEmail,
        db: { drizzle: { execute: mockDrizzleExecute } },
        logger: mockLogger,
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/email/templates/order-cancelled', () => ({
    orderCancelledEmail: vi.fn(() => ({ subject: 'Order cancelled', html: '<p>cancelled</p>' })),
}))
vi.mock('@/lib/email/templates/order-refunded', () => ({
    orderRefundedEmail: vi.fn(() => ({ subject: 'Order refunded', html: '<p>refunded</p>' })),
}))
vi.mock('@/lib/payment/stripe', () => ({
    getStripeClient: vi.fn(() => ({
        refunds: { create: mockStripeRefundsCreate },
        checkout: { sessions: { retrieve: mockStripeSessionsRetrieve } },
    })),
}))
vi.mock('@/lib/payment/xendit', () => ({
    createRefund: vi.fn(),
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

import { POST } from '@/app/api/orders/[id]/cancel/route'
import { orderCancelledEmail } from '@/lib/email/templates/order-cancelled'
import { orderRefundedEmail } from '@/lib/email/templates/order-refunded'
import { createRefund as xenditCreateRefund } from '@/lib/payment/xendit'

// ─── TC-F10.16: Order cancellation ───────────────────────────────────

describe('POST /api/orders/[id]/cancel [TC-F10.16]', () => {
    const ctx = { params: Promise.resolve({ id: 'order-1' }) }

    beforeEach(() => {
        vi.clearAllMocks()
        // mockReset clears queued mockResolvedValueOnce values that vi.clearAllMocks() leaves behind
        mockFindByID.mockReset()
        mockUpdate.mockReset()
        mockDrizzleExecute.mockReset()
        mockStripeRefundsCreate.mockReset()
        mockStripeSessionsRetrieve.mockReset()
        // Default: Stripe/Xendit refunds.create succeeds (overridden per-test as needed)
        mockStripeRefundsCreate.mockResolvedValue({ id: undefined })
        vi.mocked(xenditCreateRefund).mockResolvedValue({ id: undefined } as any)
        // Default: CAS succeeds (returns 1 row) + restockItem SQL calls succeed (non-variant path).
        // Tests that use mockResolvedValueOnce sequences MUST prepend a CAS row first.
        mockDrizzleExecute.mockResolvedValue({ rows: [{ id: 1 }] })
    })

    it('[TC-F10-03-01] cancels order with valid reason', async () => {
        mockFindByID
            .mockResolvedValueOnce({ id: 'order-1', status: 'pending', items: [] }) // order
        // CAS uses default (success). No mockUpdate needed — CAS replaced payload.update.

        const req = { json: () => Promise.resolve({ reason: 'Customer request' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
    })

    it('[TC-F10-03-04] rejects cancellation from terminal state', async () => {
        mockFindByID.mockResolvedValue({ id: 'order-1', status: 'completed', items: [] })

        const req = { json: () => Promise.resolve({ reason: 'Too late' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(422)
        expect(body.error.code).toBe('INVALID_TRANSITION')
    })

    // BR-Cancel-02 (chốt 2026-07-07): đơn đã mua label (ready_to_ship) KHÔNG hủy qua
    // /cancel — trước đây transitions còn cho phép; giờ chặn cả server lẫn UI.
    it('[TC-F10-03-04b] rejects cancellation at ready_to_ship (label bought — BR-Cancel-02)', async () => {
        mockFindByID.mockResolvedValue({ id: 'order-1', status: 'ready_to_ship', awbNo: 'EP123', items: [] })

        const req = { json: () => Promise.resolve({ reason: 'Changed my mind' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(422)
        expect(body.error.code).toBe('INVALID_TRANSITION')
    })

    it('[TC-F10-03-03] rejects empty reason', async () => {
        const req = { json: () => Promise.resolve({ reason: '' }) } as unknown as Request
        const res = await POST(req, ctx as any)

        expect(res.status).toBe(400)
    })

    it('[TC-F10-03-03] Rejects whitespace-only reason', async () => {
        const req = { json: () => Promise.resolve({ reason: '   ' }) } as unknown as Request
        const res = await POST(req, ctx as any)

        expect(res.status).toBe(400)
    })

    it('[TC-F10-03-25] returns 404 when order not found', async () => {
        mockFindByID.mockResolvedValue(null)

        const req = { json: () => Promise.resolve({ reason: 'Cancel' }) } as unknown as Request
        const res = await POST(req, ctx as any)

        expect(res.status).toBe(404)
    })

    it('[TC-F10-03-05] restocks inventory on cancellation', async () => {
        // CAS + restockItem SQL calls all use the default mock (non-variant path succeeds).
        mockFindByID.mockResolvedValueOnce({ id: 'order-1', status: 'confirmed', items: [{ product: 'prod-1', quantity: 3 }] }) // order

        const req = { json: () => Promise.resolve({ reason: 'Test' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(body.success).toBe(true)
        expect(body.restock).toBeDefined()
    })

    it('[TC-F10.16-FIX-1] Cancellation email sent to customerEmail field', async () => {
        // updated is constructed from the pre-fetched order (no extra findByID after CAS).
        mockFindByID
            .mockResolvedValueOnce({ id: 'order-1', status: 'pending', items: [], customerEmail: 'test@example.com', customerName: 'John Doe', locale: 'ms' })
        // CAS uses default (success). No mockUpdate — replaced by CAS.

        const req = { json: () => Promise.resolve({ reason: 'Customer request' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        // Verify email sent via payload.sendEmail to customerEmail field (fire-and-forget)
        expect(mockSendEmail).toHaveBeenCalledWith(
            expect.objectContaining({ to: 'test@example.com' })
        )
    })

    it('[TC-F10-03-05 regression] Non-variant restock uses atomic SQL inventory increment', async () => {
        // Non-variant restockItem: UPDATE products SET inventory = inventory + qty WHERE id = ?
        // Atomic SQL avoids read-modify-write race; no ORM update call for stock.
        // CAS is first SQL call (default: success), then restockItem SQL uses default.
        mockFindByID.mockResolvedValueOnce({ id: 'order-1', status: 'confirmed', items: [{ product: 'prod-2', quantity: 2 }] })
        // mockDrizzleExecute default handles: CAS + product check (has_variants=false) + inventory increment

        const req = { json: () => Promise.resolve({ reason: 'Test' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.restock[0].restocked).toBe(2)
        // SQL path used — ORM update not called at all (CAS replaced status update)
        expect(mockUpdate).not.toHaveBeenCalled()
        expect(mockDrizzleExecute).toHaveBeenCalled()
    })

    it('[TC-F10-03-01b] Cancel QR Banking order in pending status succeeds', async () => {
        mockFindByID
            .mockResolvedValueOnce({
                id: 'order-3',
                status: 'pending',
                items: [],
                paymentMethod: 'qr_banking',
                paymentStatus: 'unpaid',
                customerEmail: 'qr@test.com',
                customerName: 'QR Customer',
                locale: 'ms',
            })
        // CAS uses default (success). updated constructed from order.

        const req = { json: () => Promise.resolve({ reason: 'Customer changed mind' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        // Status update goes through atomic CAS SQL (not payload.update)
        expect(mockUpdate).not.toHaveBeenCalled()
        expect(mockDrizzleExecute).toHaveBeenCalled() // CAS SQL executed
        expect(body.data.cancelReason).toBe('Customer changed mind')
    })

    it('[TC-PERF-135] cancel answers with the new state only: no tenant row, magicLinkSecret or buyer details', async () => {
        // Arrange: the order read carries the populated tenant (payment secrets) and the buyer's magic-link secret
        mockFindByID.mockResolvedValueOnce({
            id: 'order-9',
            status: 'pending',
            items: [],
            paymentMethod: 'qr_banking',
            paymentStatus: 'unpaid',
            customerEmail: 'buyer@test.com',
            magicLinkSecret: 'mls-secret',
            tenant: { id: 'tenant-1', xenditSecretKey: 'xnd_secret', easyParcelIntegration: { apiKey: 'ep-key' } },
        })

        // Act
        const req = { json: () => Promise.resolve({ reason: 'Out of stock' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.data).toEqual({ id: 'order-9', status: 'cancelled', paymentStatus: 'cancelled', cancelReason: 'Out of stock' })
        const text = JSON.stringify(body)
        for (const secret of ['mls-secret', 'xnd_secret', 'ep-key', 'buyer@test.com']) expect(text).not.toContain(secret)
    })

    it('[TC-F10-03-07] Idempotency: already-cancelled order returns success without re-restocking', async () => {
        mockFindByID.mockResolvedValueOnce({ id: 'order-4', status: 'cancelled', items: [{ product: 'prod-1', quantity: 1 }] })

        const req = { json: () => Promise.resolve({ reason: 'Duplicate request' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        // Early return before CAS — no update or restock
        expect(mockUpdate).not.toHaveBeenCalled()
        expect(mockDrizzleExecute).not.toHaveBeenCalled()
        expect(body.restock).toEqual([])
    })

    it('[TC-F10-03-11] Rejects cancel reason exceeding 500 characters', async () => {
        const longReason = 'a'.repeat(501)
        const req = { json: () => Promise.resolve({ reason: longReason }) } as unknown as Request
        const res = await POST(req, ctx as any)

        expect(res.status).toBe(400)
    })

    // ─── TC-F10-03-12 through TC-F10-03-15: Variant restock tests (Bug #1082) ────────

    it('[TC-F10-03-12] Variant restock increments products_variants.stock via SQL UPDATE', async () => {
        // SQL path: CAS → SELECT has_variants → UPDATE products_variants SET stock = stock + qty → UPDATE products.inventory
        mockFindByID.mockResolvedValueOnce({ id: 'order-1', status: 'confirmed', items: [{ product: 'prod-v', variant: 'Red - M', quantity: 3 }] })

        mockDrizzleExecute
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })                             // CAS succeeds
            .mockResolvedValueOnce({ rows: [{ id: 'prod-v', has_variants: true }] }) // product check
            .mockResolvedValueOnce({ rows: [{ id: 'uuid-v' }] })                     // restock SQL → variant found
            .mockResolvedValueOnce({ rows: [] })                                      // inventory recompute

        const req = { json: () => Promise.resolve({ reason: 'Test' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.restock[0].restocked).toBe(3)
        expect(body.restock[0].skipped).toBeUndefined()
        // SQL path used — ORM update not called (CAS replaced status update)
        expect(mockUpdate).not.toHaveBeenCalled()
        expect(mockDrizzleExecute).toHaveBeenCalledTimes(4)
    })

    it('[TC-F10-03-13] Variant name not found in product → skipped without crash', async () => {
        // SQL: CAS → product check succeeds, but UPDATE products_variants WHERE name = 'Yellow - S' finds no row → variant_not_found
        mockFindByID.mockResolvedValueOnce({
            id: 'order-1', status: 'confirmed',
            items: [{ product: 'prod-v', variant: 'Yellow - S', quantity: 2 }],
        })

        mockDrizzleExecute
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })                             // CAS succeeds
            .mockResolvedValueOnce({ rows: [{ id: 'prod-v', has_variants: true }] }) // product check
            .mockResolvedValueOnce({ rows: [] })                                      // restock UPDATE → 0 rows
            .mockResolvedValueOnce({ rows: [] })                                      // discriminating SELECT → variant truly missing

        const req = { json: () => Promise.resolve({ reason: 'Test' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.restock[0].skipped).toBe(true)
        expect(body.restock[0].reason).toBe('variant_not_found')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('[TC-F10-03-14] Mixed cart: variant + non-variant both restock via SQL correctly', async () => {
        // CAS (1) + variant: product check (1) + restock SQL (1) + inventory recompute (1) = 4
        // non-variant: product check (1) + inventory increment (1) = 2 → total 6 SQL calls
        mockFindByID.mockResolvedValueOnce({
            id: 'order-1', status: 'confirmed',
            items: [
                { product: 'prod-v', variant: 'Red - M', quantity: 2 },
                { product: 'prod-n', quantity: 1 },
            ],
        })

        mockDrizzleExecute
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })                             // CAS succeeds
            .mockResolvedValueOnce({ rows: [{ id: 'prod-v', has_variants: true }] })  // variant: product check
            .mockResolvedValueOnce({ rows: [{ id: 'uuid-v' }] })                      // variant: restock SQL
            .mockResolvedValueOnce({ rows: [] })                                       // variant: inventory recompute
            .mockResolvedValueOnce({ rows: [{ id: 'prod-n', has_variants: false }] }) // non-variant: product check
            .mockResolvedValueOnce({ rows: [{ id: 'prod-n' }] })                      // non-variant: inventory increment

        const req = { json: () => Promise.resolve({ reason: 'Test' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.restock).toHaveLength(2)
        expect(body.restock[0].restocked).toBe(2) // variant
        expect(body.restock[1].restocked).toBe(1) // non-variant
        // All stock ops via SQL — ORM update not called
        expect(mockUpdate).not.toHaveBeenCalled()
        expect(mockDrizzleExecute).toHaveBeenCalledTimes(6)
    })

    it('[TC-F10-03-16] bank_transfer awaiting_payment cancel → restocks products_variants.stock', async () => {
        // bank_transfer now decrements stock at checkout — cancel must always restock.
        mockFindByID.mockResolvedValueOnce({
            id: 'order-bt-1', status: 'pending', paymentMethod: 'bank_transfer', paymentStatus: 'awaiting_payment',
            items: [{ product: 'prod-v', variant: 'Red - M', quantity: 2 }],
        })
        // CAS + restockItem variant path: product check + variant stock increment + inventory recompute
        mockDrizzleExecute
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })                             // CAS succeeds
            .mockResolvedValueOnce({ rows: [{ id: 'prod-v', has_variants: true }] }) // product check
            .mockResolvedValueOnce({ rows: [{ id: 'uuid-v' }] })                     // variant stock increment
            .mockResolvedValueOnce({ rows: [] })                                      // inventory recompute

        const req = { json: () => Promise.resolve({ reason: 'Customer changed mind' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        // CAS + 3 restock SQL calls
        expect(mockDrizzleExecute).toHaveBeenCalledTimes(4)
        expect(mockUpdate).not.toHaveBeenCalled()
        expect(body.restock[0].restocked).toBe(2)
    })

    it('[TC-F10-03-17] NULL stock variant restock → skipped with null_inventory (no false ops alert)', async () => {
        // AND stock IS NOT NULL guard causes UPDATE to return 0 rows when variant has NULL stock.
        // Discriminating SELECT reveals variant exists but stock=null → reason: 'null_inventory'.
        // alertableRestocks filter excludes null_inventory → no ops alert fired.
        mockFindByID.mockResolvedValueOnce({ id: 'order-1', status: 'confirmed', items: [{ product: 'prod-v', variant: 'Red - M', quantity: 2 }] })

        mockDrizzleExecute
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })                              // CAS succeeds
            .mockResolvedValueOnce({ rows: [{ id: 'prod-v', has_variants: true }] })  // product check
            .mockResolvedValueOnce({ rows: [] })                                       // restock UPDATE → 0 rows (NULL stock)
            .mockResolvedValueOnce({ rows: [{ stock: null }] })                        // discriminating SELECT → variant exists, stock=null

        const req = { json: () => Promise.resolve({ reason: 'Test' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.restock[0].skipped).toBe(true)
        expect(body.restock[0].reason).toBe('null_inventory')
        expect(mockDrizzleExecute).toHaveBeenCalledTimes(4)
        // Critical: null_inventory is not alertable — ops alert must NOT be raised
        expect(mockLogger.error).not.toHaveBeenCalled()
    })

    it('[TC-F10-03-18] Inventory recompute throws after variant restock → restocked qty returned (BUG-1b guard)', async () => {
        // Restock UPDATE succeeds; inventory recompute throws.
        // restockItem must return { restocked: qty } — recompute isolated in inner try/catch.
        mockFindByID.mockResolvedValueOnce({ id: 'order-1', status: 'confirmed', items: [{ product: 'prod-v', variant: 'Red - M', quantity: 3 }] })

        mockDrizzleExecute
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })                             // CAS succeeds
            .mockResolvedValueOnce({ rows: [{ id: 'prod-v', has_variants: true }] }) // product check
            .mockResolvedValueOnce({ rows: [{ id: 'uuid-v' }] })                     // restock SQL → success
            .mockRejectedValueOnce(new Error('Recompute timeout'))                   // recompute throws

        const req = { json: () => Promise.resolve({ reason: 'Test' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.restock[0].restocked).toBe(3)
        expect(body.restock[0].skipped).toBeUndefined()
        // Recompute failure logged, not propagated
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.objectContaining({ productId: 'prod-v' }),
            expect.stringContaining('[Restock] Inventory recompute failed'),
        )
    })

    it('[TC-F10-03-19] Non-variant restock with NULL inventory → skipped with null_inventory', async () => {
        // UPDATE returns empty rows (inventory IS NULL guard) — product exists but doesn't track stock
        mockFindByID.mockResolvedValueOnce({ id: 'order-1', status: 'confirmed', items: [{ product: 'prod-n', quantity: 2 }] })

        mockDrizzleExecute
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })                              // CAS succeeds
            .mockResolvedValueOnce({ rows: [{ id: 'prod-n', has_variants: false }] }) // product check
            .mockResolvedValueOnce({ rows: [] })                                       // inventory UPDATE → 0 rows (NULL guard)

        const req = { json: () => Promise.resolve({ reason: 'Test' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.restock[0].skipped).toBe(true)
        expect(body.restock[0].reason).toBe('null_inventory')
        expect(body.restock[0].restocked).toBe(0)
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('[TC-F10-03-15] Variant SQL write failure → skipped with write_failed reason', async () => {
        // SQL path: no retry. If UPDATE products_variants throws, restockItem returns write_failed.
        mockFindByID.mockResolvedValueOnce({ id: 'order-1', status: 'confirmed', items: [{ product: 'prod-v', variant: 'Red - M', quantity: 1 }] })

        mockDrizzleExecute
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })                             // CAS succeeds
            .mockResolvedValueOnce({ rows: [{ id: 'prod-v', has_variants: true }] }) // product check
            .mockRejectedValueOnce(new Error('DB write error'))                       // restock SQL throws

        const req = { json: () => Promise.resolve({ reason: 'Test' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200) // cancellation succeeds even if restock fails
        expect(body.restock[0].skipped).toBe(true)
        expect(body.restock[0].reason).toBe('write_failed')
        // ORM update not called (CAS replaced status update, SQL error was caught internally)
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    // ─── TC-F10-03-20/21: Approved bank_transfer cancel → must restock ────────────

    it('[TC-F10-03-20] Approved BT non-variant cancel → restocks products.inventory via restockItem SQL', async () => {
        // paymentStatus=paid → stock was decremented at approve-payment → must restock on cancel
        mockFindByID.mockResolvedValueOnce({
            id: 'order-bt-paid', status: 'confirmed',
            paymentMethod: 'bank_transfer', paymentStatus: 'paid',
            items: [{ product: 'prod-n', quantity: 2 }],
        })
        // restockItem non-variant: CAS + product check (has_variants=false) + inventory increment
        mockDrizzleExecute
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })                              // CAS succeeds
            .mockResolvedValueOnce({ rows: [{ id: 'prod-n', has_variants: false }] }) // product check
            .mockResolvedValueOnce({ rows: [{ id: 'prod-n' }] })                      // inventory increment

        const req = { json: () => Promise.resolve({ reason: 'Customer request' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.restock[0].restocked).toBe(2)
        expect(mockDrizzleExecute).toHaveBeenCalledTimes(3)
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    // ─── TC-F10-03-22: Concurrent cancel idempotency (FINDING-1 guard) ──────────

    it('[TC-F10-03-22] Concurrent cancel — second request idempotent, no double-restock', async () => {
        // Simulates: Request A cancelled the order between Request B's transition validation and its CAS.
        // Request B's CAS returns 0 rows (A already committed status='cancelled').
        // Expected: B rechecks order (now cancelled) → returns 200 with restock:[] — no restock executed.
        mockFindByID
            .mockResolvedValueOnce({ id: 'order-1', status: 'confirmed', items: [{ product: 'prod-1', quantity: 3 }] }) // initial fetch (passes validation)
            .mockResolvedValueOnce({ id: 'order-1', status: 'cancelled', items: [{ product: 'prod-1', quantity: 3 }] }) // recheck after CAS miss

        // CAS returns 0 rows — concurrent request A already committed the cancellation
        mockDrizzleExecute.mockResolvedValueOnce({ rows: [] })

        const req = { json: () => Promise.resolve({ reason: 'Test' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        // No restock — second cancel must not double-increment stock
        expect(body.restock).toEqual([])
        // Only CAS SQL executed (no restock SQL calls)
        expect(mockDrizzleExecute).toHaveBeenCalledTimes(1)
        // No ORM update called
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('[TC-F10-03-22b] CAS miss + order moved to non-cancellable state → 422 INVALID_TRANSITION', async () => {
        // Edge case: between B's validation (confirmed → cancellable) and B's CAS,
        // order moved to ready_to_ship (not via cancel). CAS returns 0 rows.
        // Recheck finds ready_to_ship → INVALID_TRANSITION (not idempotent success).
        mockFindByID
            .mockResolvedValueOnce({ id: 'order-1', status: 'confirmed', items: [] }) // initial fetch
            .mockResolvedValueOnce({ id: 'order-1', status: 'ready_to_ship', items: [] }) // recheck: moved to non-cancellable

        mockDrizzleExecute.mockResolvedValueOnce({ rows: [] }) // CAS miss

        const req = { json: () => Promise.resolve({ reason: 'Test' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(422)
        expect(body.error.code).toBe('INVALID_TRANSITION')
        expect(mockDrizzleExecute).toHaveBeenCalledTimes(1)
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('[TC-F10-03-21] Approved BT variant cancel → restocks products_variants.stock via restockItem SQL', async () => {
        // paymentStatus=paid + item.variant → restockItem takes variant path
        mockFindByID.mockResolvedValueOnce({
            id: 'order-bt-paid-v', status: 'confirmed',
            paymentMethod: 'bank_transfer', paymentStatus: 'paid',
            items: [{ product: 'prod-v', variant: 'Red - M', quantity: 1 }],
        })
        // restockItem variant path: CAS + product check + UPDATE products_variants + inventory recompute
        mockDrizzleExecute
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })                             // CAS succeeds
            .mockResolvedValueOnce({ rows: [{ id: 'prod-v', has_variants: true }] }) // product check
            .mockResolvedValueOnce({ rows: [{ id: 'uuid-v' }] })                     // variant stock increment
            .mockResolvedValueOnce({ rows: [] })                                      // inventory recompute

        const req = { json: () => Promise.resolve({ reason: 'Customer request' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.restock[0].restocked).toBe(1)
        expect(mockDrizzleExecute).toHaveBeenCalledTimes(4)
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('[TC-F10-03-23] CAS SQL includes updated_at = NOW() to keep ORM timestamps coherent', async () => {
        // Orders collection has timestamps:true. Payload auto-sets updated_at via ORM only.
        // The CAS path uses raw SQL — must manually include updated_at = NOW() or the
        // order's updated_at is never refreshed on cancellation.
        mockFindByID.mockResolvedValueOnce({ id: 'order-1', status: 'pending', items: [] })
        const req = { json: () => Promise.resolve({ reason: 'audit-trail check' }) } as unknown as Request
        await POST(req, ctx as any)

        const casCall = mockDrizzleExecute.mock.calls[0][0]
        // drizzle sql template stores chunks as objects with a .value string property
        const sqlText = JSON.stringify(casCall)
        expect(sqlText).toMatch(/updated_at/)
        expect(sqlText).toMatch(/NOW\(\)/)
    })

    // ─── TC-F10-03-24: quantity guard (Bug #3 fix) ────────────────────────────────

    it('[TC-F10-03-24a] Restock with quantity = 0 → silent no-op, no restock SQL', async () => {
        // Guard short-circuits before any product-check SQL; only CAS SQL fires.
        // qty=0 is a silent no-op: restocked=0, no skipped flag (no data-integrity alert needed).
        mockFindByID.mockResolvedValueOnce({ id: 'order-1', status: 'confirmed', items: [{ product: 'prod-1', quantity: 0 }] })

        const req = { json: () => Promise.resolve({ reason: 'Test' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.restock[0].restocked).toBe(0)
        expect(body.restock[0].skipped).toBeUndefined()
        expect(mockDrizzleExecute).toHaveBeenCalledTimes(1) // only CAS
    })

    it('[TC-F10-03-24b] Restock with negative quantity → write_failed, no restock SQL, logs warn', async () => {
        // Negative qty would silently invert SQL without this guard.
        mockFindByID.mockResolvedValueOnce({ id: 'order-1', status: 'confirmed', items: [{ product: 'prod-1', quantity: -3 }] })

        const req = { json: () => Promise.resolve({ reason: 'Test' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.restock[0].skipped).toBe(true)
        expect(body.restock[0].reason).toBe('write_failed')
        expect(body.restock[0].restocked).toBe(0)
        expect(mockDrizzleExecute).toHaveBeenCalledTimes(1) // only CAS
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.objectContaining({ quantity: -3 }),
            expect.stringContaining('[Restock] Invalid quantity'),
        )
    })

    // ─── TC-F10-03-26–31: Stripe paid order cancel auto-refund (Issue #1326) ──────
    // Detection: paymentStatus='paid' + paymentMethod NOT in ['bank_transfer','cod'] + paymentProvider != 'xendit'

    it('[TC-F10-03-26] Stripe paid order cancel → CAS + auto-refund + cancel email (refund email sent by webhook)', async () => {
        const stripeCtx = { params: Promise.resolve({ id: 'stripe-order-1' }) }
        mockFindByID
            .mockResolvedValueOnce({
                id: 'stripe-order-1', status: 'confirmed',
                paymentMethod: 'stripe', paymentStatus: 'paid',
                stripePaymentIntentId: 'pi_test123',
                items: [], customerEmail: 'buyer@test.com',
                locale: 'ms',
            })
            .mockResolvedValueOnce({ id: 'tenant-s1', stripeAccountId: 'acct_test123' }) // tenant fetch

        mockStripeRefundsCreate.mockResolvedValue({ id: 'ref_test123' })
        // Stripe CAS — default mockResolvedValue({ rows: [{ id: 1 }] }) handles this

        const req = { json: () => Promise.resolve({ reason: 'Buyer request' }) } as unknown as Request
        const res = await POST(req, stripeCtx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.refundId).toBe('ref_test123')
        expect(body.data.paymentStatus).toBe('refunded')
        expect(mockStripeRefundsCreate).toHaveBeenCalledWith(
            { payment_intent: 'pi_test123' },
            expect.objectContaining({ stripeAccount: 'acct_test123', idempotencyKey: 'cancel-stripe-order-1' })
        )
        // Cancel email sent (not refund — charge.refunded webhook handles refund email)
        expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'buyer@test.com' }))
        expect(vi.mocked(orderCancelledEmail)).toHaveBeenCalled()
        expect(vi.mocked(orderRefundedEmail)).not.toHaveBeenCalled()
        // TC-F36.166: the Stripe forward CAS carries the label-race guard too (the plain-branch
        // SQL assertion alone would not catch the clause being dropped from this copy)
        expect(JSON.stringify(mockDrizzleExecute.mock.calls[0][0])).toMatch(/easy_parcel_order_no IS NULL/)
    })

    it('[TC-F10-03-27] Stripe cancel blocked when stripeAccountId missing → 422 STRIPE_NOT_REFUNDABLE', async () => {
        const stripeCtx = { params: Promise.resolve({ id: 'stripe-order-2' }) }
        mockFindByID
            .mockResolvedValueOnce({
                id: 'stripe-order-2', status: 'confirmed',
                paymentMethod: 'stripe', paymentStatus: 'paid',
                stripePaymentIntentId: 'pi_test456', items: [],
            })
            .mockResolvedValueOnce({ id: 'tenant-s2' }) // tenant with no stripeAccountId

        const req = { json: () => Promise.resolve({ reason: 'Cancel' }) } as unknown as Request
        const res = await POST(req, stripeCtx as any)
        const body = await res.json()

        expect(res.status).toBe(422)
        expect(body.error.code).toBe('STRIPE_NOT_REFUNDABLE')
        // No Stripe API called, no DB CAS
        expect(mockStripeRefundsCreate).not.toHaveBeenCalled()
        expect(mockDrizzleExecute).not.toHaveBeenCalled()
    })

    it('[TC-F10-03-28] Stripe cancel blocked when no payment intent and no session → 422 STRIPE_NOT_REFUNDABLE', async () => {
        const stripeCtx = { params: Promise.resolve({ id: 'stripe-order-3' }) }
        mockFindByID
            .mockResolvedValueOnce({
                id: 'stripe-order-3', status: 'confirmed',
                paymentMethod: 'stripe', paymentStatus: 'paid',
                // no stripePaymentIntentId, no stripeSessionId
                items: [],
            })
            .mockResolvedValueOnce({ id: 'tenant-s3', stripeAccountId: 'acct_test123' })

        const req = { json: () => Promise.resolve({ reason: 'Cancel' }) } as unknown as Request
        const res = await POST(req, stripeCtx as any)
        const body = await res.json()

        expect(res.status).toBe(422)
        expect(body.error.code).toBe('STRIPE_NOT_REFUNDABLE')
        expect(mockStripeRefundsCreate).not.toHaveBeenCalled()
        expect(mockDrizzleExecute).not.toHaveBeenCalled()
    })

    it('[TC-F10-03-29] Stripe refund fails → CAS rolled back, 502 STRIPE_REFUND_ERROR, order not cancelled', async () => {
        const stripeCtx = { params: Promise.resolve({ id: 'stripe-order-4' }) }
        mockFindByID
            .mockResolvedValueOnce({
                id: 'stripe-order-4', status: 'confirmed',
                paymentMethod: 'stripe', paymentStatus: 'paid',
                stripePaymentIntentId: 'pi_test789', items: [],
            })
            .mockResolvedValueOnce({ id: 'tenant-s4', stripeAccountId: 'acct_test123' })

        mockStripeRefundsCreate.mockRejectedValue(new Error('Stripe network error'))
        // Stripe CAS + rollback both use default mockResolvedValue

        const req = { json: () => Promise.resolve({ reason: 'Cancel' }) } as unknown as Request
        const res = await POST(req, stripeCtx as any)
        const body = await res.json()

        expect(res.status).toBe(502)
        expect(body.error.code).toBe('STRIPE_REFUND_ERROR')
        // Rollback SQL called (2nd drizzle call): restore status + payment_status='paid'
        expect(mockDrizzleExecute).toHaveBeenCalledTimes(2) // CAS + rollback
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ orderId: 'stripe-order-4' }),
            expect.stringContaining('[Order Cancel] Stripe refund failed'),
        )
        expect(mockSendEmail).not.toHaveBeenCalled()
    })

    it('[TC-F10-03-30] Stripe charge_already_refunded → idempotent success, CAS stands, refund email sent', async () => {
        const stripeCtx = { params: Promise.resolve({ id: 'stripe-order-5' }) }
        mockFindByID
            .mockResolvedValueOnce({
                id: 'stripe-order-5', status: 'confirmed',
                paymentMethod: 'stripe', paymentStatus: 'paid',
                stripePaymentIntentId: 'pi_already', items: [], customerEmail: 'buyer2@test.com',
                locale: 'ms',
            })
            .mockResolvedValueOnce({ id: 'tenant-s5', stripeAccountId: 'acct_test123' })

        const alreadyRefundedErr = Object.assign(new Error('Charge already refunded'), { code: 'charge_already_refunded' })
        mockStripeRefundsCreate.mockRejectedValue(alreadyRefundedErr)

        const req = { json: () => Promise.resolve({ reason: 'Retry cancel' }) } as unknown as Request
        const res = await POST(req, stripeCtx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        // No explicit refundId (charge_already_refunded path doesn't set stripeRefundId)
        // but CAS succeeded and order is cancelled
        expect(body.data.paymentStatus).toBe('refunded')
        // Rollback must NOT be called for charge_already_refunded
        expect(mockDrizzleExecute).toHaveBeenCalledTimes(1) // only Stripe CAS, no rollback
        // Cancel email sent — buyer notified of cancellation; refund email sent later by charge.refunded webhook
        expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'buyer2@test.com' }))
        expect(vi.mocked(orderCancelledEmail)).toHaveBeenCalled()
        expect(vi.mocked(orderRefundedEmail)).not.toHaveBeenCalled()
    })

    it('[TC-F10-03-31] Stripe cancel fetches stripePaymentIntentId fallback via session when not cached', async () => {
        const stripeCtx = { params: Promise.resolve({ id: 'stripe-order-6' }) }
        mockFindByID
            .mockResolvedValueOnce({
                id: 'stripe-order-6', status: 'confirmed',
                paymentMethod: 'stripe', paymentStatus: 'paid',
                stripeSessionId: 'cs_test_abc',
                // no stripePaymentIntentId
                items: [],
                locale: 'ms',
            })
            .mockResolvedValueOnce({ id: 'tenant-s6', stripeAccountId: 'acct_test123' }) // tenant fetch

        mockStripeSessionsRetrieve.mockResolvedValue({
            payment_intent: 'pi_from_session',
        })
        mockStripeRefundsCreate.mockResolvedValue({ id: 'ref_from_session' })
        mockUpdate.mockResolvedValue({}) // backfill stripePaymentIntentId

        const req = { json: () => Promise.resolve({ reason: 'Cancel' }) } as unknown as Request
        const res = await POST(req, stripeCtx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.refundId).toBe('ref_from_session')
        // Session retrieved to backfill payment intent
        expect(mockStripeSessionsRetrieve).toHaveBeenCalledWith(
            'cs_test_abc',
            { expand: ['payment_intent'] },
            { stripeAccount: 'acct_test123' },
        )
        // Refund called with the fetched payment intent
        expect(mockStripeRefundsCreate).toHaveBeenCalledWith(
            { payment_intent: 'pi_from_session' },
            expect.objectContaining({ stripeAccount: 'acct_test123' })
        )
    })

    // ─── TC-F10-03-33: Xendit paid order cancel sends 2 emails (cancel + refund) ────
    // No Xendit refund webhook exists — refund email must be sent synchronously from cancel route.

    it('[TC-F10-03-33] Xendit paid order cancel → sends cancel email then refund email (no Xendit refund webhook)', async () => {
        const xenditCtx = { params: Promise.resolve({ id: 'xendit-order-1' }) }
        mockFindByID
            .mockResolvedValueOnce({
                id: 'xendit-order-1', status: 'confirmed',
                paymentProvider: 'xendit', paymentStatus: 'paid',
                xenditPaymentRequestId: 'req_test123',
                items: [], customerEmail: 'buyer-x@test.com',
                locale: 'ms',
            })
            .mockResolvedValueOnce({ id: 'tenant-x1', xenditSecretKey: 'xnd_secret_key' }) // tenant for Xendit

        vi.mocked(xenditCreateRefund).mockResolvedValue({ id: 'xendit-refund-123' } as any)
        // Xendit CAS uses default mock ({ rows: [{ id: 1 }] })

        const req = { json: () => Promise.resolve({ reason: 'Buyer request' }) } as unknown as Request
        const res = await POST(req, xenditCtx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.refundId).toBe('xendit-refund-123')
        // Both emails sent in order: cancel first, then refund
        expect(mockSendEmail).toHaveBeenCalledTimes(2)
        expect(mockSendEmail).toHaveBeenNthCalledWith(1, expect.objectContaining({ subject: 'Order cancelled' }))
        expect(mockSendEmail).toHaveBeenNthCalledWith(2, expect.objectContaining({ subject: 'Order refunded' }))
        expect(vi.mocked(orderCancelledEmail)).toHaveBeenCalled()
        expect(vi.mocked(orderRefundedEmail)).toHaveBeenCalled()
    })

    it('[TC-F10-03-32] free-discount paid order bypasses Stripe block and cancels via generic CAS', async () => {
        // Regression: paymentMethod='free' was not in the exclusion list, causing free orders to
        // enter the Stripe block and return 422 STRIPE_NOT_REFUNDABLE (no Stripe charge exists).
        const freeCtx = { params: Promise.resolve({ id: 'free-order-1' }) }
        mockFindByID.mockResolvedValueOnce({
            id: 'free-order-1', status: 'confirmed',
            paymentMethod: 'free', paymentStatus: 'paid',
            paymentProvider: undefined, items: [],
            locale: 'ms',
        })
        mockUpdate.mockResolvedValue({ id: 'free-order-1', status: 'cancelled', paymentStatus: 'paid' })

        const req = { json: () => Promise.resolve({ reason: 'No longer needed' }) } as unknown as Request
        const res = await POST(req, freeCtx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(mockStripeRefundsCreate).not.toHaveBeenCalled()
        // Generic CAS only — 1 SQL call, no restock
        expect(mockDrizzleExecute).toHaveBeenCalledTimes(1)
        // No customerEmail on order → no email sent
        expect(mockSendEmail).not.toHaveBeenCalled()
    })

    // ── TC-F36.166: /cancel label guard (review #1582 round 2-3) ─────────────────

    it('[TC-F36.166] forward CAS requires easy_parcel_order_no IS NULL (label-race guard)', async () => {
        // A create-label claim/shipment means EP wallet money is (about to be) committed —
        // the forward CAS must refuse to cancel such rows (rollback CAS stays unguarded).
        mockFindByID.mockResolvedValueOnce({ id: 'order-1', status: 'pending', items: [] })
        const req = { json: () => Promise.resolve({ reason: 'label guard sql check' }) } as unknown as Request
        await POST(req, ctx as any)

        const casCall = mockDrizzleExecute.mock.calls[0][0]
        const sqlText = JSON.stringify(casCall)
        expect(sqlText).toMatch(/easy_parcel_order_no IS NULL/)
    })

    it('[TC-F36.166] CAS miss because order holds a shipment → 409 LABEL_EXISTS (not "status changed")', async () => {
        // Remnant/race: status still cancellable but easy_parcel_order_no is set — the
        // recheck must report the REAL reason instead of the misleading status message.
        mockFindByID
            .mockResolvedValueOnce({ id: 'order-1', status: 'confirmed', items: [] })
            .mockResolvedValueOnce({ id: 'order-1', status: 'confirmed', easyParcelOrderNo: 'EI-REMNANT-1' })
        mockDrizzleExecute.mockResolvedValueOnce({ rows: [] }) // CAS blocked by the label guard

        const req = { json: () => Promise.resolve({ reason: 'race with create-label' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error.code).toBe('LABEL_EXISTS')
        expect(mockUpdate).not.toHaveBeenCalled()
        expect(mockSendEmail).not.toHaveBeenCalled()
    })

    it('[TC-F36.166] CAS miss on a transient CLAIM: sentinel → 409 LABEL_IN_PROGRESS (retryable)', async () => {
        // In-flight create-label claim (TTL 120s): the right client action is retry —
        // distinct from a real shipment, which needs the EP-dashboard cancel first.
        mockFindByID
            .mockResolvedValueOnce({ id: 'order-1', status: 'confirmed', items: [] })
            .mockResolvedValueOnce({ id: 'order-1', status: 'confirmed', easyParcelOrderNo: 'CLAIM:1760000000000:ab12cd' })
        mockDrizzleExecute.mockResolvedValueOnce({ rows: [] })

        const req = { json: () => Promise.resolve({ reason: 'race with in-flight claim' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error.code).toBe('LABEL_IN_PROGRESS')
        expect(mockUpdate).not.toHaveBeenCalled()
    })
})
