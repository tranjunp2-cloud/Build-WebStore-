import { describe, it, expect } from 'vitest'
import { isNonEmptyTier, computeDuplicateIndicesForOptions } from '../../../components/dashboard/product-form/variant-utils'

// ── isNonEmptyTier ─────────────────────────────────────────────────────────────
// Covers the ProductForm.onSubmit payload filter: empty tiers must be stripped
// before the API call so the backend never receives half-started tier rows.

describe('TC-F08-VAR-UTILS: isNonEmptyTier', () => {
    it('TC-F08-VAR-UTILS-01: returns false for fully empty tier (no name, no options)', () => {
        expect(isNonEmptyTier({ name: '', options: [] })).toBe(false)
    })

    it('TC-F08-VAR-UTILS-02: returns false when name and options are all whitespace', () => {
        expect(isNonEmptyTier({ name: '   ', options: ['  ', ''] })).toBe(false)
    })

    it('TC-F08-VAR-UTILS-03: returns true when tier has a non-empty name only', () => {
        expect(isNonEmptyTier({ name: 'Color', options: [] })).toBe(true)
    })

    it('TC-F08-VAR-UTILS-04: returns true when tier has at least one non-empty option', () => {
        expect(isNonEmptyTier({ name: '', options: ['Red'] })).toBe(true)
    })

    it('TC-F08-VAR-UTILS-05: returns true when tier has both name and options', () => {
        expect(isNonEmptyTier({ name: 'Size', options: ['S', 'M'] })).toBe(true)
    })

    it('TC-F08-VAR-UTILS-06: handles undefined options gracefully', () => {
        expect(isNonEmptyTier({ name: '' })).toBe(false)
        expect(isNonEmptyTier({ name: 'Color' })).toBe(true)
    })
})

// ── computeDuplicateIndicesForOptions ──────────────────────────────────────────
// Covers the duplicate-value highlight logic in VariantsInventorySection.
// Critical: BOTH the first and subsequent occurrences must be included in the
// returned Set so every conflicting input gets a red border, not just the second.

describe('TC-F08-VAR-UTILS: computeDuplicateIndicesForOptions', () => {
    it('TC-F08-VAR-UTILS-07: returns empty set when no duplicates', () => {
        const result = computeDuplicateIndicesForOptions(['Red', 'Blue', 'Green'])
        expect(result.size).toBe(0)
    })

    it('TC-F08-VAR-UTILS-08: returns empty set for empty array', () => {
        expect(computeDuplicateIndicesForOptions([]).size).toBe(0)
    })

    it('TC-F08-VAR-UTILS-09: marks BOTH first and second occurrence of a duplicate (regression guard)', () => {
        // Bug that was fixed: only the second occurrence was being added to dups
        const result = computeDuplicateIndicesForOptions(['Red', 'Blue', 'Red'])
        expect(result.has(0)).toBe(true)  // first "Red"
        expect(result.has(2)).toBe(true)  // second "Red"
        expect(result.has(1)).toBe(false) // "Blue" is not a duplicate
    })

    it('TC-F08-VAR-UTILS-10: duplicate detection is case-insensitive', () => {
        const result = computeDuplicateIndicesForOptions(['Red', 'red'])
        expect(result.has(0)).toBe(true)
        expect(result.has(1)).toBe(true)
    })

    it('TC-F08-VAR-UTILS-11: ignores blank/whitespace-only entries (not treated as duplicates)', () => {
        const result = computeDuplicateIndicesForOptions(['', '  ', 'Red'])
        expect(result.size).toBe(0)
    })

    it('TC-F08-VAR-UTILS-12: handles two blank entries without marking them as duplicates', () => {
        const result = computeDuplicateIndicesForOptions(['', ''])
        expect(result.size).toBe(0)
    })

    it('TC-F08-VAR-UTILS-13: marks all occurrences when same value appears 3 times', () => {
        const result = computeDuplicateIndicesForOptions(['Red', 'Red', 'Red'])
        expect(result.has(0)).toBe(true)
        expect(result.has(1)).toBe(true)
        expect(result.has(2)).toBe(true)
    })
})
