import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)),
}))

const mockFindByID = vi.fn()
const mockUpdate = vi.fn()
const mockSendEmail = vi.fn().mockResolvedValue(undefined)
const mockDrizzleExecute = vi.fn()
const mockLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() }
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

import { POST } from '@/app/api/orders/[id]/cancel/route'

// ─── TC-F10.16: Order cancellation ───────────────────────────────────

describe('POST /api/orders/[id]/cancel [TC-F10.16]', () => {
    const ctx = { params: Promise.resolve({ id: 'order-1' }) }

    beforeEach(() => {
        vi.clearAllMocks()
        // mockReset clears queued mockResolvedValueOnce values that vi.clearAllMocks() leaves behind
        mockFindByID.mockReset()
        mockUpdate.mockReset()
        mockDrizzleExecute.mockReset()
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
            .mockResolvedValueOnce({ id: 'order-1', status: 'pending', items: [], customerEmail: 'test@example.com', customerName: 'John Doe' })
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
                customerName: 'QR Customer'
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
})
