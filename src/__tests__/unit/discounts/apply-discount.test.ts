/**
 * Unit tests for applyDiscount engine (src/lib/discounts/apply-discount.ts).
 * Pure function, no I/O, deterministic.
 *
 * TC-F33-01..09: discount validity, expiry, tenant isolation, clamping, math
 */
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { applyDiscount, type DiscountRow } from '@/lib/discounts/apply-discount'

// ── TC-F33-01: Valid percentage discount ────────────────────────────────────
describe('applyDiscount — TC-F33-01: Valid percentage discount', () => {
    it('returns ok:true with correct discount for percentage type', () => {
        // Arrange
        const row: DiscountRow = {
            id: '1',
            code: 'SUMMER20',
            type: 'percentage',
            value: 20,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: null,
            tenant: '123',
        }
        const ctx = { subtotalSen: 100000, tenantId: '123', now: new Date() }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.discountSen).toBe(20000) // 20% of 100,000
            expect(result.discount).toEqual({
                id: '1',
                code: 'SUMMER20',
                type: 'percentage',
                value: 20,
            })
        }
    })

    it('rounds percentage discount correctly', () => {
        // Arrange
        const row: DiscountRow = {
            id: '1',
            code: 'THIRD',
            type: 'percentage',
            value: 33.333,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: null,
            tenant: '456',
        }
        const ctx = { subtotalSen: 100000, tenantId: '456', now: new Date() }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(true)
        if (result.ok) {
            // Math.round(100000 * 33.333 / 100) = Math.round(33333) = 33333
            expect(result.discountSen).toBe(33333)
        }
    })
})

// ── TC-F33-02: Valid fixed-amount discount ─────────────────────────────────
describe('applyDiscount — TC-F33-02: Valid fixed-amount discount', () => {
    it('returns ok:true with fixed discount amount', () => {
        // Arrange
        const row: DiscountRow = {
            id: '2',
            code: 'FLAT5000',
            type: 'fixed',
            value: 5000,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: null,
            tenant: 'abc',
        }
        const ctx = { subtotalSen: 100000, tenantId: 'abc', now: new Date() }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.discountSen).toBe(5000)
            expect(result.discount.type).toBe('fixed')
        }
    })

    it('rounds fixed discount (value is in sen)', () => {
        // Arrange
        const row: DiscountRow = {
            id: '2',
            code: 'FIXED',
            type: 'fixed',
            value: 1234.56,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: null,
            tenant: 'xyz',
        }
        const ctx = { subtotalSen: 100000, tenantId: 'xyz', now: new Date() }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.discountSen).toBe(1235) // Math.round(1234.56)
        }
    })
})

// ── TC-F33-03: Clamp discount to subtotal ──────────────────────────────────
describe('applyDiscount — TC-F33-03: Clamp discount to subtotal', () => {
    it('clamps large percentage discount to subtotal', () => {
        // Arrange
        const row: DiscountRow = {
            id: '3',
            code: 'HUGE',
            type: 'percentage',
            value: 150, // 150% discount (invalid value, but engine still clamps)
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: null,
            tenant: '789',
        }
        const ctx = { subtotalSen: 10000, tenantId: '789', now: new Date() }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(true)
        if (result.ok) {
            // Computed: 150% of 10000 = 15000; clamped to min(15000, 10000) = 10000
            expect(result.discountSen).toBe(10000)
        }
    })

    it('clamps large fixed discount to subtotal', () => {
        // Arrange
        const row: DiscountRow = {
            id: '3',
            code: 'MEGA',
            type: 'fixed',
            value: 999999,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: null,
            tenant: '999',
        }
        const ctx = { subtotalSen: 5000, tenantId: '999', now: new Date() }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.discountSen).toBe(5000) // clamped to subtotal
        }
    })

    it('ensures discount is never negative', () => {
        // Arrange
        const row: DiscountRow = {
            id: '3',
            code: 'ZERO',
            type: 'percentage',
            value: 0,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: null,
            tenant: 'zero',
        }
        const ctx = { subtotalSen: 10000, tenantId: 'zero', now: new Date() }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.discountSen).toBeGreaterThanOrEqual(0)
            expect(result.discountSen).toBe(0)
        }
    })
})

// ── TC-F33-04: Discount not yet started ────────────────────────────────────
describe('applyDiscount — TC-F33-04: Discount not yet started', () => {
    it('rejects discount with future startsAt', () => {
        // Arrange
        const futureDate = new Date(Date.now() + 86400000) // 1 day from now
        const row: DiscountRow = {
            id: '4',
            code: 'FUTURE',
            type: 'percentage',
            value: 10,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: futureDate.toISOString(),
            expiresAt: null,
            tenant: 'future',
        }
        const ctx = { subtotalSen: 10000, tenantId: 'future', now: new Date() }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toBe('not-started')
        }
    })

    it('accepts discount when startsAt is now or past', () => {
        // Arrange
        const pastDate = new Date(Date.now() - 3600000) // 1 hour ago
        const row: DiscountRow = {
            id: '4',
            code: 'NOW',
            type: 'percentage',
            value: 10,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: pastDate.toISOString(),
            expiresAt: null,
            tenant: 'now',
        }
        const ctx = { subtotalSen: 10000, tenantId: 'now', now: new Date() }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(true)
    })

    it('accepts discount with null/undefined startsAt', () => {
        // Arrange
        const row: DiscountRow = {
            id: '4',
            code: 'NOSTART',
            type: 'percentage',
            value: 10,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: null,
            tenant: 'nostart',
        }
        const ctx = { subtotalSen: 10000, tenantId: 'nostart', now: new Date() }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(true)
    })
})

// ── TC-F33-05: Discount expired ────────────────────────────────────────────
describe('applyDiscount — TC-F33-05: Discount expired', () => {
    it('rejects discount with past expiresAt', () => {
        // Arrange
        const pastDate = new Date(Date.now() - 86400000) // 1 day ago
        const row: DiscountRow = {
            id: '5',
            code: 'EXPIRED',
            type: 'percentage',
            value: 10,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: pastDate.toISOString(),
            tenant: 'expired',
        }
        const ctx = { subtotalSen: 10000, tenantId: 'expired', now: new Date() }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toBe('expired')
        }
    })

    it('accepts discount when expiresAt is in future', () => {
        // Arrange
        const futureDate = new Date(Date.now() + 86400000) // 1 day from now
        const row: DiscountRow = {
            id: '5',
            code: 'VALID',
            type: 'percentage',
            value: 10,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: futureDate.toISOString(),
            tenant: 'valid',
        }
        const ctx = { subtotalSen: 10000, tenantId: 'valid', now: new Date() }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(true)
    })

    it('accepts discount exactly at expiry time (not yet expired)', () => {
        // Arrange
        const now = new Date('2026-06-01T12:00:00Z')
        const expiresAt = new Date('2026-06-01T12:00:00Z') // same time (expires < now is false)
        const row: DiscountRow = {
            id: '5',
            code: 'EXACT',
            type: 'percentage',
            value: 10,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: expiresAt.toISOString(),
            tenant: 'exact',
        }
        const ctx = { subtotalSen: 10000, tenantId: 'exact', now }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        // Engine uses: expires < now (strict less than), so expires === now is NOT expired yet
        expect(result.ok).toBe(true)
    })

    it('accepts discount with null/undefined expiresAt', () => {
        // Arrange
        const row: DiscountRow = {
            id: '5',
            code: 'NOEXP',
            type: 'percentage',
            value: 10,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: null,
            tenant: 'noexp',
        }
        const ctx = { subtotalSen: 10000, tenantId: 'noexp', now: new Date() }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(true)
    })
})

// ── TC-F33-06: Discount inactive ───────────────────────────────────────────
describe('applyDiscount — TC-F33-06: Discount inactive', () => {
    it('rejects discount with status=inactive', () => {
        // Arrange
        const row: DiscountRow = {
            id: '6',
            code: 'DISABLED',
            type: 'percentage',
            value: 10,
            status: 'inactive',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: null,
            tenant: 'inactive',
        }
        const ctx = { subtotalSen: 10000, tenantId: 'inactive', now: new Date() }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toBe('inactive')
        }
    })

    it('accepts discount with status=active', () => {
        // Arrange
        const row: DiscountRow = {
            id: '6',
            code: 'ENABLED',
            type: 'percentage',
            value: 10,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: null,
            tenant: 'active',
        }
        const ctx = { subtotalSen: 10000, tenantId: 'active', now: new Date() }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(true)
    })
})

// ── TC-F33-07: Usage limit reached ─────────────────────────────────────────
describe('applyDiscount — TC-F33-07: Usage limit reached', () => {
    it('rejects discount when usageCount >= usageLimit', () => {
        // Arrange
        const row: DiscountRow = {
            id: '7',
            code: 'LIMITED',
            type: 'percentage',
            value: 10,
            status: 'active',
            usageLimit: 10,
            usageCount: 10,
            startsAt: null,
            expiresAt: null,
            tenant: 'limited',
        }
        const ctx = { subtotalSen: 10000, tenantId: 'limited', now: new Date() }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toBe('at-limit')
        }
    })

    it('accepts discount when usageCount < usageLimit', () => {
        // Arrange
        const row: DiscountRow = {
            id: '7',
            code: 'REMAINING',
            type: 'percentage',
            value: 10,
            status: 'active',
            usageLimit: 10,
            usageCount: 9,
            startsAt: null,
            expiresAt: null,
            tenant: 'remaining',
        }
        const ctx = { subtotalSen: 10000, tenantId: 'remaining', now: new Date() }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(true)
    })

    it('accepts discount with null/undefined usageLimit (unlimited)', () => {
        // Arrange
        const row: DiscountRow = {
            id: '7',
            code: 'UNLIMITED',
            type: 'percentage',
            value: 10,
            status: 'active',
            usageLimit: null,
            usageCount: 10000,
            startsAt: null,
            expiresAt: null,
            tenant: 'unlimited',
        }
        const ctx = { subtotalSen: 10000, tenantId: 'unlimited', now: new Date() }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(true)
    })

    it('rejects discount when usageCount > usageLimit (overage)', () => {
        // Arrange
        const row: DiscountRow = {
            id: '7',
            code: 'OVERAGE',
            type: 'percentage',
            value: 10,
            status: 'active',
            usageLimit: 5,
            usageCount: 7,
            startsAt: null,
            expiresAt: null,
            tenant: 'overage',
        }
        const ctx = { subtotalSen: 10000, tenantId: 'overage', now: new Date() }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toBe('at-limit')
        }
    })
})

// ── TC-F33-08: Wrong tenant isolation ──────────────────────────────────────
describe('applyDiscount — TC-F33-08: Wrong tenant isolation', () => {
    it('rejects discount from different tenant (string ids)', () => {
        // Arrange
        const row: DiscountRow = {
            id: '8',
            code: 'WRONG',
            type: 'percentage',
            value: 10,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: null,
            tenant: '123', // discount belongs to tenant 123
        }
        const ctx = { subtotalSen: 10000, tenantId: '456', now: new Date() } // requester is tenant 456

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toBe('wrong-tenant')
        }
    })

    it('accepts discount from matching tenant', () => {
        // Arrange
        const row: DiscountRow = {
            id: '8',
            code: 'CORRECT',
            type: 'percentage',
            value: 10,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: null,
            tenant: '123',
        }
        const ctx = { subtotalSen: 10000, tenantId: '123', now: new Date() }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(true)
    })

    it('handles tenant as object with id property', () => {
        // Arrange
        const row: DiscountRow = {
            id: '8',
            code: 'OBJTEN',
            type: 'percentage',
            value: 10,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: null,
            tenant: { id: '789' }, // tenant as object
        }
        const ctx = { subtotalSen: 10000, tenantId: '789', now: new Date() }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(true)
    })

    it('normalizes numeric vs string tenant ids', () => {
        // Arrange
        const row: DiscountRow = {
            id: '8',
            code: 'NUMTEN',
            type: 'percentage',
            value: 10,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: null,
            tenant: 999, // numeric tenant
        }
        const ctx = { subtotalSen: 10000, tenantId: '999', now: new Date() } // string tenant

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        // Engine normalizes both to string: '999' === '999'
        expect(result.ok).toBe(true)
    })
})

// ── TC-F33-09: Discount not found ──────────────────────────────────────────
describe('applyDiscount — TC-F33-09: Discount not found', () => {
    it('returns ok:false with reason=not-found when row is null', () => {
        // Arrange
        const ctx = { subtotalSen: 10000, tenantId: '123', now: new Date() }

        // Act
        const result = applyDiscount(null, ctx)

        // Assert
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toBe('not-found')
        }
    })
})

// ── Combined tests: ordering of rejection reasons ─────────────────────────
describe('applyDiscount — Rejection priority', () => {
    it('checks not-found before tenant isolation', () => {
        // Arrange — row is null, so not-found takes priority
        const ctx = { subtotalSen: 10000, tenantId: 'wrong', now: new Date() }

        // Act
        const result = applyDiscount(null, ctx)

        // Assert
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toBe('not-found') // not 'wrong-tenant'
        }
    })

    it('checks tenant before status and expiry', () => {
        // Arrange
        const row: DiscountRow = {
            id: '999',
            code: 'EXPIRED_WRONG',
            type: 'percentage',
            value: 10,
            status: 'inactive',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: new Date(Date.now() - 86400000).toISOString(),
            tenant: 'correct-tenant',
        }
        const ctx = { subtotalSen: 10000, tenantId: 'wrong-tenant', now: new Date() }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toBe('wrong-tenant') // checked before status/expiry
        }
    })

    it('checks status before expiry/limit', () => {
        // Arrange
        const now = new Date()
        const row: DiscountRow = {
            id: '999',
            code: 'INACTIVE_EXPIRED',
            type: 'percentage',
            value: 10,
            status: 'inactive',
            usageLimit: 5,
            usageCount: 5,
            startsAt: null,
            expiresAt: new Date(now.getTime() - 86400000).toISOString(),
            tenant: 'same-tenant',
        }
        const ctx = { subtotalSen: 10000, tenantId: 'same-tenant', now }

        // Act
        const result = applyDiscount(row, ctx)

        // Assert
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toBe('inactive') // checked before expiry and limit
        }
    })
})
