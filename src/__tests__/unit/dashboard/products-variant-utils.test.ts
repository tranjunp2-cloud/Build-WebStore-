import { describe, it, expect } from 'vitest'
import { isNonEmptyTier, computeDuplicateIndicesForOptions, buildVariantMatrix, cartesianProductOfTiers } from '../../../components/dashboard/product-form/variant-utils'

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

    it('TC-F08-VAR-UTILS-03: returns false when tier has name but no options (Bug #1032 fix: AND not OR)', () => {
        expect(isNonEmptyTier({ name: 'Color', options: [] })).toBe(false)
    })

    it('TC-F08-VAR-UTILS-04: returns false when tier has options but no name (Bug #1032 fix: AND not OR)', () => {
        expect(isNonEmptyTier({ name: '', options: ['Red'] })).toBe(false)
    })

    it('TC-F08-VAR-UTILS-05: returns true when tier has both name and options', () => {
        expect(isNonEmptyTier({ name: 'Size', options: ['S', 'M'] })).toBe(true)
    })

    it('TC-F08-VAR-UTILS-06: handles undefined options gracefully — name alone insufficient', () => {
        expect(isNonEmptyTier({ name: '' })).toBe(false)
        expect(isNonEmptyTier({ name: 'Color' })).toBe(false)  // no options → false (AND logic)
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

// ── F08-bug-1032-03: isNonEmptyTier AND behavior ──────────────────────────────
// Bug #1032 fix: matrix cleared when option list is empty but tier name present.
// isNonEmptyTier now requires BOTH name AND at least one non-whitespace option.

describe('F08-bug-1032-03: isNonEmptyTier AND-logic regression guard', () => {
    it('F08-bug-1032-03a: name present, all options empty string → false', () => {
        // TC-F08-bug-1032-03
        expect(isNonEmptyTier({ name: 'Color', options: [''] })).toBe(false)
    })

    it('F08-bug-1032-03b: name present + non-empty option → true', () => {
        // TC-F08-bug-1032-03
        expect(isNonEmptyTier({ name: 'Color', options: ['red'] })).toBe(true)
    })

    it('F08-bug-1032-03c: name absent, non-empty option present → false', () => {
        // TC-F08-bug-1032-03
        expect(isNonEmptyTier({ name: '', options: ['red'] })).toBe(false)
    })
})

// ── F08-bug-1032-04: buildVariantMatrix preserve logic ────────────────────────
// Bug #1032 fix: re-generating matrix preserves rows where user customized price,
// and replaces rows that still match the last-generated base price.

describe('F08-bug-1032-04: buildVariantMatrix preserve logic', () => {
    const base = { price: 20, inventory: 5, sku: 'SKU' }
    const combos = [['Red', 'S'], ['Red', 'M']]

    it('F08-bug-1032-04a: row with user-customized price is preserved on re-generate', () => {
        // TC-F08-bug-1032-04
        // prevBase was 10, user changed "Red - S" price to 15 → should be kept
        const current = [
            { variantName: 'Red - S', price: 15, skuCode: 'SKU-RED-S', stock: 3 },
            { variantName: 'Red - M', price: 10, skuCode: 'SKU-RED-M', stock: 5 },
        ]
        const result = buildVariantMatrix(combos, base, current, 10)
        const redS = result.find(r => r.variantName === 'Red - S')!
        expect(redS.price).toBe(15)  // preserved: differs from prevBase (10)
    })

    it('F08-bug-1032-04b: row at prevBase price is replaced with new basePrice', () => {
        // TC-F08-bug-1032-04
        // prevBase was 10, "Red - M" still at 10 → should be updated to new base (20)
        const current = [
            { variantName: 'Red - S', price: 15, skuCode: 'SKU-RED-S', stock: 3 },
            { variantName: 'Red - M', price: 10, skuCode: 'SKU-RED-M', stock: 5 },
        ]
        const result = buildVariantMatrix(combos, base, current, 10)
        const redM = result.find(r => r.variantName === 'Red - M')!
        expect(redM.price).toBe(20)  // replaced: matched prevBase (10)
    })

    it('F08-bug-1032-04c: new combinations with no existing row get base price', () => {
        // TC-F08-bug-1032-04
        const result = buildVariantMatrix([['Blue', 'L']], base, [], null)
        expect(result[0].price).toBe(20)
        expect(result[0].variantName).toBe('Blue - L')
    })

    it('F08-bug-1032-04d: prevBasePrice=null with existing variants → rows preserved (CRITICAL-1 fix)', () => {
        // TC-F08-bug-1032-04
        // On first Generate after loading an existing product, prevBase is null.
        // CRITICAL-1 fix: (prevBasePrice === null || price !== prevBase) → null means ALWAYS preserve.
        // This prevents wiping user-customized variant prices on the first Generate in an edit session.
        const current = [
            { variantName: 'Red - S', price: 99, skuCode: 'CUSTOM', stock: 1 },
        ]
        const result = buildVariantMatrix(combos, base, current, null)
        const redS = result.find(r => r.variantName === 'Red - S')!
        expect(redS.price).toBe(99)  // preserved — prevBase=null means always keep existing price
    })

    it('F08-bug-1032-04e: existing row with missing id gets a generated UUID when preserved', () => {
        // TC-F08-bug-1032-04
        // Verify the safe construction path (no `as VariantRow` cast) handles missing id.
        const current = [
            { variantName: 'Red - S', price: 15, skuCode: 'CUSTOM', stock: 3 },  // id omitted
        ]
        const result = buildVariantMatrix(combos, base, current, 10)
        const redS = result.find(r => r.variantName === 'Red - S')!
        expect(redS.id).toBeTruthy()   // generated UUID, not undefined
        expect(redS.price).toBe(15)    // still preserved
    })
})

// ── F08-bug-1032-07: cartesianProductOfTiers ──────────────────────────────────
// Pure helper extracted from generateSkuTable to power both the manual Generate
// button and the auto-regenerate-on-delete path.

describe('TC-F08-bug-1032-07: cartesianProductOfTiers', () => {
    it('TC-F08-bug-1032-07a: empty tiers → empty array', () => {
        expect(cartesianProductOfTiers([])).toEqual([])
    })

    it('TC-F08-bug-1032-07b: one tier with one option → single-element combination', () => {
        const result = cartesianProductOfTiers([{ name: 'Color', options: ['Red'] }])
        expect(result).toEqual([['Red']])
    })

    it('TC-F08-bug-1032-07c: one tier with two options → two combinations', () => {
        const result = cartesianProductOfTiers([{ name: 'Color', options: ['Red', 'Blue'] }])
        expect(result).toEqual([['Red'], ['Blue']])
    })

    it('TC-F08-bug-1032-07d: two tiers 2×3 options → 6 combinations', () => {
        const result = cartesianProductOfTiers([
            { name: 'Color', options: ['Red', 'Blue'] },
            { name: 'Size', options: ['S', 'M', 'L'] },
        ])
        expect(result).toHaveLength(6)
        expect(result[0]).toEqual(['Red', 'S'])
        expect(result[5]).toEqual(['Blue', 'L'])
    })

    it('TC-F08-bug-1032-07e: tier with empty name is excluded', () => {
        const result = cartesianProductOfTiers([
            { name: '', options: ['Red', 'Blue'] },
            { name: 'Size', options: ['S'] },
        ])
        expect(result).toEqual([['S']])
    })

    it('TC-F08-bug-1032-07f: tier with all-blank options is excluded', () => {
        const result = cartesianProductOfTiers([
            { name: 'Color', options: ['  ', ''] },
            { name: 'Size', options: ['M'] },
        ])
        expect(result).toEqual([['M']])
    })
})

// ── F08-bug-1032-08: buildVariantMatrix prevBaseSku replacement ───────────────

describe('F08-bug-1032-08: buildVariantMatrix prevBaseSku replacement', () => {
    const base = { price: 20, inventory: 5, sku: 'NEW' }
    const combos = [['Red', 'S']]

    it('F08-bug-1032-08a: auto-generated SKU matching prevBaseSku pattern is replaced with new prefix', () => {
        // Arrange — existing SKU was auto-generated from old base 'OLD'
        const current = [{ variantName: 'Red - S', price: 15, skuCode: 'OLD-RED-S', stock: 1 }]

        // Act
        const result = buildVariantMatrix(combos, base, current, 10, 'OLD')

        // Assert — prefix updated to new base
        expect(result[0].skuCode).toBe('NEW-RED-S')
    })

    it('F08-bug-1032-08b: user-customized SKU (not matching prevBase pattern) is preserved', () => {
        // Arrange — user manually typed their own SKU
        const current = [{ variantName: 'Red - S', price: 15, skuCode: 'MY-CUSTOM-001', stock: 1 }]

        // Act
        const result = buildVariantMatrix(combos, base, current, 10, 'OLD')

        // Assert — custom SKU untouched
        expect(result[0].skuCode).toBe('MY-CUSTOM-001')
    })

    it('F08-bug-1032-08c: prevBaseSku undefined → existing SKU always preserved (no replacement attempt)', () => {
        // Arrange — no prevBaseSku provided (old call sites)
        const current = [{ variantName: 'Red - S', price: 15, skuCode: 'OLD-RED-S', stock: 1 }]

        // Act
        const result = buildVariantMatrix(combos, base, current, 10)

        // Assert — backwards compat: existing SKU preserved
        expect(result[0].skuCode).toBe('OLD-RED-S')
    })

    it('F08-bug-1032-08d: empty existing skuCode → fresh auto-generation with new baseSku', () => {
        // Arrange — skuCode is empty string (unset)
        const current = [{ variantName: 'Red - S', price: 15, skuCode: '', stock: 1 }]

        // Act
        const result = buildVariantMatrix(combos, base, current, 10, 'OLD')

        // Assert — generates new SKU from current base
        expect(result[0].skuCode).toBe('NEW-RED-S')
    })

    it('F08-bug-1032-08e: prevBaseSku equals base.sku → no-op, SKU preserved unchanged', () => {
        // Arrange — base SKU did not change
        const current = [{ variantName: 'Red - S', price: 15, skuCode: 'NEW-RED-S', stock: 1 }]

        // Act
        const result = buildVariantMatrix(combos, base, current, 10, 'NEW')

        // Assert — same prefix: existing value preserved as-is
        expect(result[0].skuCode).toBe('NEW-RED-S')
    })
})
