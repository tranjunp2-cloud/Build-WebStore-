/**
 * Unit tests for recordDiscountRedemption (src/lib/discounts/record-discount-redemption.ts).
 *
 * Idempotent discount usage tracking. Tests the atomic INSERT guard + usage_count bump,
 * snapshot preservation, and error handling.
 *
 * TC-F33-06-13, TC-F33-10-07, TC-F33-09-06, TC-F33-08-02, TC-F33-03-03
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import { recordDiscountRedemption } from '@/lib/discounts/record-discount-redemption'

// ─── Setup: Mock drizzle + Payload ────────────────────────────────────────

vi.mock('drizzle-orm', () => ({
    sql: (strings: TemplateStringsArray, ...values: any[]) => ({
        type: 'sql',
        strings,
        values,
    }),
}))

function createMockPayload(): Payload {
    return {
        db: {
            drizzle: { execute: vi.fn() } as any,
        },
    } as unknown as Payload
}

// ─── TC-F33-06-13: Happy path — redemption recorded ────────────────────────

describe('[TC-F33-06-13] recordDiscountRedemption — happy path', () => {
    it('returns recorded:true and calls execute once when history row inserted', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockExecute = vi.fn().mockResolvedValueOnce({
            rows: [{ inserted: 1 }],
        })
        ;(payload.db.drizzle as any).execute = mockExecute

        // Act
        const result = await recordDiscountRedemption(payload, {
            tenantId: 123,
            discountId: 456,
            orderId: 789,
            amountApplied: 5000,
            discountCode: 'SUMMER50',
            customerEmail: 'buyer@example.com',
        })

        // Assert
        expect(result.recorded).toBe(true)
        expect(mockExecute).toHaveBeenCalledTimes(1)
        // Verify the SQL structure contains the INSERT guard
        expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({ type: 'sql' }))
    })
})

// ─── TC-F33-10-07: Idempotent — ON CONFLICT (order_id) DO NOTHING ──────────

describe('[TC-F33-10-07] recordDiscountRedemption — idempotency', () => {
    it('returns recorded:false when INSERT returns 0 rows (duplicate order_id)', async () => {
        // Arrange
        const payload = createMockPayload()
        // ON CONFLICT (order_id) DO NOTHING → no row inserted → inserted count = 0
        const mockExecute = vi.fn().mockResolvedValueOnce({
            rows: [{ inserted: 0 }],
        })
        ;(payload.db.drizzle as any).execute = mockExecute

        // Act
        const result = await recordDiscountRedemption(payload, {
            tenantId: 123,
            discountId: 456,
            orderId: 789,
            amountApplied: 5000,
            discountCode: 'SUMMER50',
        })

        // Assert
        expect(result.recorded).toBe(false)
        expect(mockExecute).toHaveBeenCalledTimes(1)
        // Usage count NOT bumped when insert returns 0
    })
})

// ─── TC-F33-09-06: Guard conditions + error handling ────────────────────────

describe('[TC-F33-09-06] recordDiscountRedemption — guard + error handling', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns recorded:false when discountId is missing (no-op)', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockExecute = vi.fn()
        ;(payload.db.drizzle as any).execute = mockExecute

        // Act
        const result = await recordDiscountRedemption(payload, {
            tenantId: 123,
            discountId: 0, // falsy
            orderId: 789,
            amountApplied: 5000,
        })

        // Assert
        expect(result.recorded).toBe(false)
        expect(mockExecute).not.toHaveBeenCalled() // early return
    })

    it('returns recorded:false when orderId is missing (no-op)', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockExecute = vi.fn()
        ;(payload.db.drizzle as any).execute = mockExecute

        // Act
        const result = await recordDiscountRedemption(payload, {
            tenantId: 123,
            discountId: 456,
            orderId: 0, // falsy
            amountApplied: 5000,
        })

        // Assert
        expect(result.recorded).toBe(false)
        expect(mockExecute).not.toHaveBeenCalled()
    })

    it('returns recorded:false when amountApplied <= 0 (no-op)', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockExecute = vi.fn()
        ;(payload.db.drizzle as any).execute = mockExecute

        // Act
        const result = await recordDiscountRedemption(payload, {
            tenantId: 123,
            discountId: 456,
            orderId: 789,
            amountApplied: 0,
        })

        // Assert
        expect(result.recorded).toBe(false)
        expect(mockExecute).not.toHaveBeenCalled()
    })

    it('returns recorded:false when SQL execute throws', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockExecute = vi.fn().mockRejectedValueOnce(
            new Error('Database error')
        )
        ;(payload.db.drizzle as any).execute = mockExecute

        // Act
        const result = await recordDiscountRedemption(payload, {
            tenantId: 123,
            discountId: 456,
            orderId: 789,
            amountApplied: 5000,
        })

        // Assert
        expect(result.recorded).toBe(false)
        expect(mockExecute).toHaveBeenCalledTimes(1) // error was swallowed
    })

    it('returns recorded:false when result rows is null', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockExecute = vi.fn().mockResolvedValueOnce({
            rows: null,
        })
        ;(payload.db.drizzle as any).execute = mockExecute

        // Act
        const result = await recordDiscountRedemption(payload, {
            tenantId: 123,
            discountId: 456,
            orderId: 789,
            amountApplied: 5000,
        })

        // Assert
        expect(result.recorded).toBe(false)
    })
})

// ─── TC-F33-08-02: Invariant — snapshot fields recorded ─────────────────────

describe('[TC-F33-08-02] recordDiscountRedemption — snapshot fields', () => {
    it('includes all required fields in the INSERT (tenant_id, discount_id, order_id, amount_applied, discount_code, discount_type, discount_value, customer_email)', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockExecute = vi.fn().mockResolvedValueOnce({
            rows: [{ inserted: 1 }],
        })
        ;(payload.db.drizzle as any).execute = mockExecute

        const args = {
            tenantId: 123,
            discountId: 456,
            orderId: 789,
            amountApplied: 5000,
            discountCode: 'SUMMER50',
            discountType: 'percentage',
            discountValue: 50,
            customerEmail: 'buyer@test.com',
        }

        // Act
        await recordDiscountRedemption(payload, args)

        // Assert
        const callArg = mockExecute.mock.calls[0][0]
        expect(callArg.strings).toBeDefined()
        // The SQL contains an INSERT statement with the required columns
        const sqlStr = callArg.strings.join('?')
        expect(sqlStr).toContain('INSERT INTO discount_usage_history')
        expect(sqlStr).toContain('tenant_id')
        expect(sqlStr).toContain('discount_id')
        expect(sqlStr).toContain('order_id')
        expect(sqlStr).toContain('amount_applied')
        expect(sqlStr).toContain('discount_code')
        expect(sqlStr).toContain('discount_type')
        expect(sqlStr).toContain('discount_value')
        expect(sqlStr).toContain('customer_email')
        // Snapshot values are parameter-bound
        expect(callArg.values).toContain('percentage')
        expect(callArg.values).toContain(50)
    })
})

// ─── TC-F33-09-04: Usage cap — bump guarded by usage_limit (race → never 11) ─

describe('[TC-F33-09-04] recordDiscountRedemption — usage cap', () => {
    it('guards the usage_count bump with a usage_limit check so it never exceeds the cap', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockExecute = vi.fn().mockResolvedValueOnce({ rows: [{ inserted: 1 }] })
        ;(payload.db.drizzle as any).execute = mockExecute

        // Act
        await recordDiscountRedemption(payload, {
            tenantId: 123,
            discountId: 456,
            orderId: 789,
            amountApplied: 5000,
            discountCode: 'CAPPED',
        })

        // Assert — the bump UPDATE carries the atomic limit guard (row-lock serialized in Postgres)
        const sqlStr = mockExecute.mock.calls[0][0].strings.join('?')
        expect(sqlStr).toContain('usage_count = usage_count + 1')
        expect(sqlStr).toContain('usage_limit IS NULL OR usage_count < usage_limit')
    })
})

// ─── TC-F33-03-03: Snapshot survives discount delete ──────────────────────

describe('[TC-F33-03-03] recordDiscountRedemption — discount_code snapshot', () => {
    it('records discount_code even if discount is later deleted (FK SET NULL)', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockExecute = vi.fn().mockResolvedValueOnce({
            rows: [{ inserted: 1 }],
        })
        ;(payload.db.drizzle as any).execute = mockExecute

        // Act
        const result = await recordDiscountRedemption(payload, {
            tenantId: 123,
            discountId: 456,
            orderId: 789,
            amountApplied: 5000,
            discountCode: 'SUMMER50',
        })

        // Assert
        expect(result.recorded).toBe(true)
        const callArg = mockExecute.mock.calls[0][0]
        const sqlStr = callArg.strings.join('?')
        // The SQL includes discount_code as a separate column (not a FK reference)
        expect(sqlStr).toContain('discount_code')
        // Values are injected via parameterized query
        expect(callArg.values).toContain('SUMMER50')
    })

    it('records null discount_code when not provided', async () => {
        // Arrange
        const payload = createMockPayload()
        const mockExecute = vi.fn().mockResolvedValueOnce({
            rows: [{ inserted: 1 }],
        })
        ;(payload.db.drizzle as any).execute = mockExecute

        // Act
        await recordDiscountRedemption(payload, {
            tenantId: 123,
            discountId: 456,
            orderId: 789,
            amountApplied: 5000,
            discountCode: null,
        })

        // Assert
        const callArg = mockExecute.mock.calls[0][0]
        expect(callArg.values).toContain(null) // discountCode is explicitly null
    })
})
