/**
 * Unit tests for discount validation (src/lib/validations/discounts.ts).
 * Zod schema validation tests.
 *
 * TC-F33-10: Code format, value bounds, date ordering, description length
 */

import { describe, it, expect } from 'vitest'
import { createDiscountSchema, updateDiscountSchema } from '@/lib/validations/discounts'
import { MAX_FIXED_DISCOUNT_SEN } from '@/lib/discounts/format'

// ── TC-F33-10: Discount code validation ────────────────────────────────────
describe('createDiscountSchema — TC-F33-10: Code validation', () => {
    it('accepts valid uppercase code', () => {
        // Arrange
        const data = {
            code: 'SUMMER20',
            type: 'percentage',
            value: 20,
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.code).toBe('SUMMER20')
        }
    })

    it('trims whitespace from code and uppercases', () => {
        // Arrange
        const data = {
            code: '  summer20  ',
            type: 'percentage',
            value: 20,
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.code).toBe('SUMMER20')
        }
    })

    it('accepts code with numbers and underscores', () => {
        // Arrange
        const data = {
            code: 'SALE_2026_50',
            type: 'percentage',
            value: 50,
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.code).toBe('SALE_2026_50')
        }
    })

    it('accepts code with hyphens', () => {
        // Arrange
        const data = {
            code: 'SUMMER-2026-SALE',
            type: 'percentage',
            value: 10,
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(true)
    })

    it('rejects code with invalid characters (spaces, @, etc.)', () => {
        // Arrange
        const data = {
            code: 'SUMMER 20',
            type: 'percentage',
            value: 20,
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(false)
        if (!result.success) {
            const codeError = result.error.issues.find((e) => e.path[0] === 'code')
            expect(codeError).toBeDefined()
        }
    })

    it('rejects code with special characters', () => {
        // Arrange
        const data = {
            code: 'SUMMER@20',
            type: 'percentage',
            value: 20,
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(false)
    })

    it('rejects empty code', () => {
        // Arrange
        const data = {
            code: '',
            type: 'percentage',
            value: 20,
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(false)
    })

    it('rejects code exceeding 32 characters', () => {
        // Arrange
        const data = {
            code: 'A'.repeat(33),
            type: 'percentage',
            value: 20,
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(false)
    })

    it('accepts code exactly 32 characters', () => {
        // Arrange
        const data = {
            code: 'A'.repeat(32),
            type: 'percentage',
            value: 20,
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(true)
    })
})

// ── TC-F33-10: Discount type and value validation ───────────────────────────
describe('createDiscountSchema — TC-F33-10: Type and value validation', () => {
    it('accepts percentage type with value 0–100', () => {
        // Arrange
        const data = {
            code: 'PERCENT',
            type: 'percentage',
            value: 50,
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(true)
    })

    it('rejects percentage type with value > 100', () => {
        // Arrange
        const data = {
            code: 'BADPERCENT',
            type: 'percentage',
            value: 150,
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(false)
        if (!result.success) {
            const valueError = result.error.issues.find((e) => e.path[0] === 'value')
            expect(valueError).toBeDefined()
        }
    })

    it('accepts percentage value = 100', () => {
        // Arrange
        const data = {
            code: 'MAX',
            type: 'percentage',
            value: 100,
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(true)
    })

    it('accepts percentage value = 0', () => {
        // Arrange
        const data = {
            code: 'ZERO',
            type: 'percentage',
            value: 0,
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(true)
    })

    it('rejects percentage with negative value', () => {
        // Arrange
        const data = {
            code: 'NEG',
            type: 'percentage',
            value: -10,
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(false)
    })

    it('accepts fixed type with any non-negative value', () => {
        // Arrange
        const data = {
            code: 'FIXED',
            type: 'fixed',
            value: 9999999,
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(true)
    })

    it('accepts fixed value at the cap (MAX_FIXED_DISCOUNT_SEN)', () => {
        // Arrange — value is in sen; the cap is the boundary, still valid
        const data = {
            code: 'FIXED_MAX',
            type: 'fixed',
            value: MAX_FIXED_DISCOUNT_SEN,
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(true)
    })

    it('rejects fixed value above the cap (prevents 1e+ overflow in preview)', () => {
        // Arrange — one sen over the cap
        const data = {
            code: 'FIXED_TOOBIG',
            type: 'fixed',
            value: MAX_FIXED_DISCOUNT_SEN + 1,
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues.find((e) => e.path[0] === 'value')).toBeDefined()
        }
    })

    it('rejects invalid type', () => {
        // Arrange
        const data = {
            code: 'BADTYPE',
            type: 'unknown',
            value: 10,
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(false)
    })
})

// ── TC-F33-10: Description validation ──────────────────────────────────────
describe('createDiscountSchema — TC-F33-10: Description validation', () => {
    it('accepts null or undefined description', () => {
        // Arrange
        const data1 = { code: 'CODE1', type: 'percentage', value: 10, description: null }
        const data2 = { code: 'CODE2', type: 'percentage', value: 10, description: undefined }

        // Act
        const result1 = createDiscountSchema.safeParse(data1)
        const result2 = createDiscountSchema.safeParse(data2)

        // Assert
        expect(result1.success).toBe(true)
        expect(result2.success).toBe(true)
    })

    it('accepts description up to 500 characters', () => {
        // Arrange
        const data = {
            code: 'LONGDESC',
            type: 'percentage',
            value: 10,
            description: 'A'.repeat(500),
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(true)
    })

    it('rejects description exceeding 500 characters', () => {
        // Arrange
        const data = {
            code: 'TOOLONG',
            type: 'percentage',
            value: 10,
            description: 'A'.repeat(501),
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(false)
    })

    it('accepts empty string description', () => {
        // Arrange
        const data = {
            code: 'EMPTY',
            type: 'percentage',
            value: 10,
            description: '',
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(true)
    })
})

// ── TC-F33-10: Date range validation ───────────────────────────────────────
describe('createDiscountSchema — TC-F33-10: Date range validation', () => {
    it('accepts expiresAt after startsAt', () => {
        // Arrange
        const data = {
            code: 'DATERANGE',
            type: 'percentage',
            value: 10,
            startsAt: '2026-06-01T00:00:00Z',
            expiresAt: '2026-12-31T23:59:59Z',
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(true)
    })

    it('rejects expiresAt before startsAt', () => {
        // Arrange
        const data = {
            code: 'BADRANGE',
            type: 'percentage',
            value: 10,
            startsAt: '2026-12-31T23:59:59Z',
            expiresAt: '2026-06-01T00:00:00Z',
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(false)
        if (!result.success) {
            const dateError = result.error.issues.find((e) => e.path[0] === 'expiresAt')
            expect(dateError).toBeDefined()
        }
    })

    it('rejects expiresAt equal to startsAt (must be strictly after)', () => {
        // Arrange
        const sameTime = '2026-06-01T12:00:00Z'
        const data = {
            code: 'SAMETIME',
            type: 'percentage',
            value: 10,
            startsAt: sameTime,
            expiresAt: sameTime,
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(false)
    })

    it('accepts null/undefined dates', () => {
        // Arrange
        const data = {
            code: 'NODATES',
            type: 'percentage',
            value: 10,
            startsAt: null,
            expiresAt: null,
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(true)
    })

    it('accepts only startsAt without expiresAt', () => {
        // Arrange
        const data = {
            code: 'STARTONLY',
            type: 'percentage',
            value: 10,
            startsAt: '2026-06-01T00:00:00Z',
            expiresAt: null,
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(true)
    })

    it('accepts only expiresAt without startsAt', () => {
        // Arrange
        const data = {
            code: 'EXPONLY',
            type: 'percentage',
            value: 10,
            startsAt: null,
            expiresAt: '2026-12-31T23:59:59Z',
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(true)
    })

    it('allows invalid date strings without throwing (date parsing is lax in schema)', () => {
        // Arrange
        const data = {
            code: 'BADDATE',
            type: 'percentage',
            value: 10,
            startsAt: 'not-a-date',
            expiresAt: 'also-bad',
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        // Schema stores strings as-is; date validation happens at engine level
        // The schema accepts any string for startsAt/expiresAt
        expect(result.success).toBe(true)
    })
})

// ── TC-F33-10: Combined validation ─────────────────────────────────────────
// ── TC-F33-10-16: usageLimit bounds (Q10 — min 1, null = unlimited) ─────────
// Spec §9: usageLimit Optional (null = unlimited); min 1. `0` is rejected because a
// discount with usageLimit=0 is born "at-limit" (usageCount 0 >= limit 0 → silent reject),
// i.e. a dead code. All four layers (UI input, client validate, this zod schema, Payload
// collection) now agree on min 1.
describe('createDiscountSchema — TC-F33-10-16: usageLimit bounds', () => {
    const base = { code: 'LIMIT', type: 'percentage' as const, value: 10 }

    it('rejects usageLimit = 0 (born at-limit → dead code)', () => {
        // Act
        const result = createDiscountSchema.safeParse({ ...base, usageLimit: 0 })

        // Assert
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues.find((e) => e.path[0] === 'usageLimit')).toBeDefined()
        }
    })

    it('rejects negative usageLimit', () => {
        // Act
        const result = createDiscountSchema.safeParse({ ...base, usageLimit: -5 })

        // Assert
        expect(result.success).toBe(false)
    })

    it('rejects non-integer usageLimit', () => {
        // Act
        const result = createDiscountSchema.safeParse({ ...base, usageLimit: 1.5 })

        // Assert
        expect(result.success).toBe(false)
    })

    it('accepts usageLimit = 1 (minimum valid)', () => {
        // Act
        const result = createDiscountSchema.safeParse({ ...base, usageLimit: 1 })

        // Assert
        expect(result.success).toBe(true)
    })

    it('accepts large usageLimit', () => {
        // Act
        const result = createDiscountSchema.safeParse({ ...base, usageLimit: 100000 })

        // Assert
        expect(result.success).toBe(true)
    })

    it('accepts null usageLimit (unlimited)', () => {
        // Act
        const result = createDiscountSchema.safeParse({ ...base, usageLimit: null })

        // Assert
        expect(result.success).toBe(true)
    })

    it('accepts omitted usageLimit (unlimited)', () => {
        // Act
        const result = createDiscountSchema.safeParse({ ...base })

        // Assert
        expect(result.success).toBe(true)
    })

    it('applies the same min-1 rule on updates (rejects 0)', () => {
        // Act
        const result = updateDiscountSchema.safeParse({ usageLimit: 0 })

        // Assert
        expect(result.success).toBe(false)
    })
})

describe('createDiscountSchema — TC-F33-10: Combined validation', () => {
    it('accepts fully valid discount', () => {
        // Arrange
        const data = {
            code: '  summer20  ',
            description: 'Summer sale 2026',
            type: 'percentage',
            value: 20,
            usageLimit: 1000,
            startsAt: '2026-06-01T00:00:00Z',
            expiresAt: '2026-08-31T23:59:59Z',
            status: 'active',
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.code).toBe('SUMMER20')
            expect(result.data.description).toBe('Summer sale 2026')
            expect(result.data.value).toBe(20)
        }
    })

    it('rejects discount with multiple validation errors', () => {
        // Arrange
        const data = {
            code: 'bad code@',
            description: 'A'.repeat(501),
            type: 'percentage',
            value: 150, // > 100 for percentage
            startsAt: '2026-12-31T00:00:00Z',
            expiresAt: '2026-06-01T00:00:00Z', // before startsAt
        }

        // Act
        const result = createDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(false)
        if (!result.success) {
            // Multiple errors
            expect(result.error.issues.length).toBeGreaterThan(1)
        }
    })
})

// ── updateDiscountSchema tests ─────────────────────────────────────────────
describe('updateDiscountSchema — TC-F33-10: Partial updates', () => {
    it('accepts partial update with just value change', () => {
        // Arrange
        const data = {
            value: 25,
        }

        // Act
        const result = updateDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(true)
    })

    it('accepts partial update with just status change', () => {
        // Arrange
        const data = {
            status: 'inactive',
        }

        // Act
        const result = updateDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(true)
    })

    it('rejects update with invalid percentage value', () => {
        // Arrange
        const data = {
            type: 'percentage',
            value: 120,
        }

        // Act
        const result = updateDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(false)
    })

    it('accepts update with empty object (no changes)', () => {
        // Arrange
        const data = {}

        // Act
        const result = updateDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(true)
    })

    it('applies same code/value validation to updates', () => {
        // Arrange
        const data = {
            code: '  UPDATED_CODE  ',
            value: 10,
        }

        // Act
        const result = updateDiscountSchema.safeParse(data)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.code).toBe('UPDATED_CODE')
        }
    })
})
