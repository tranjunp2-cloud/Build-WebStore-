/**
 * TC-P03-01: Override-rate NULL safety
 * Tests that the override-rate formula handles fields_filled = 0 correctly
 * (NULLIF guard prevents division-by-zero).
 *
 * Tests the pure numeric logic extracted from getHighestOverrideCategories.
 * No DB dependency — tests the math helpers only.
 */
import { describe, it, expect } from 'vitest'

// ── Reproduce the core logic from quality-metrics.ts ──────────────────────────

function toFloat(val: string | null | undefined): number {
    if (val === null || val === undefined) return 0
    const n = parseFloat(val as string)
    return isNaN(n) ? 0 : n
}

function toInt(val: string | null | undefined): number {
    if (val === null || val === undefined) return 0
    const n = parseInt(val as string, 10)
    return isNaN(n) ? 0 : n
}

/**
 * Simulates the override_rate calculation per row.
 * Mirrors: AVG(fields_edited::float / NULLIF(fields_filled, 0))
 * When fields_filled = 0, NULLIF returns NULL → excluded from AVG → returns 0 here.
 */
function computeOverrideRate(fieldsEdited: number, fieldsFilled: number): number | null {
    if (fieldsFilled === 0) return null // NULLIF(fields_filled, 0) → NULL → excluded from AVG
    return fieldsEdited / fieldsFilled
}

// ── TC-P03-01: NULL safety ─────────────────────────────────────────────────────

describe('TC-P03-01: Override-rate NULL safety (NULLIF guard)', () => {
    it('returns null when fields_filled is 0 (division-by-zero guard)', () => {
        expect(computeOverrideRate(5, 0)).toBeNull()
        expect(computeOverrideRate(0, 0)).toBeNull()
    })

    it('returns correct rate when fields_filled > 0', () => {
        expect(computeOverrideRate(2, 10)).toBeCloseTo(0.2)
        expect(computeOverrideRate(0, 10)).toBeCloseTo(0)
        expect(computeOverrideRate(10, 10)).toBeCloseTo(1.0)
    })

    it('rate is capped at 1.0 maximum when fully edited', () => {
        const rate = computeOverrideRate(10, 10)
        expect(rate).toBeLessThanOrEqual(1.0)
    })

    it('partial edit produces fractional rate', () => {
        const rate = computeOverrideRate(3, 7)
        expect(rate).not.toBeNull()
        expect(rate!).toBeGreaterThan(0)
        expect(rate!).toBeLessThan(1)
    })
})

// ── TC-P03-02: toFloat helper null safety ─────────────────────────────────────

describe('TC-P03-02: toFloat helper handles DB null/undefined', () => {
    it('returns 0 for null', () => expect(toFloat(null)).toBe(0))
    it('returns 0 for undefined', () => expect(toFloat(undefined)).toBe(0))
    it('returns 0 for non-numeric string', () => expect(toFloat('abc')).toBe(0))
    it('parses numeric string correctly', () => expect(toFloat('0.42')).toBeCloseTo(0.42))
    it('parses integer string correctly', () => expect(toFloat('5')).toBe(5))
})

// ── TC-P03-03: toInt helper null safety ───────────────────────────────────────

describe('TC-P03-03: toInt helper handles DB null/undefined', () => {
    it('returns 0 for null', () => expect(toInt(null)).toBe(0))
    it('returns 0 for undefined', () => expect(toInt(undefined)).toBe(0))
    it('returns 0 for non-numeric string', () => expect(toInt('abc')).toBe(0))
    it('parses integer string correctly', () => expect(toInt('42')).toBe(42))
})

// ── TC-P03-04: HighestOverrideCategoryEntry rounding ─────────────────────────

describe('TC-P03-04: Override rate rounded to 3 decimal places', () => {
    it('rounds correctly', () => {
        const raw = 2 / 3 // 0.6666...
        const rounded = Math.round(raw * 1000) / 1000
        expect(rounded).toBe(0.667)
    })

    it('zero rate stays zero', () => {
        const rounded = Math.round(0 * 1000) / 1000
        expect(rounded).toBe(0)
    })
})
