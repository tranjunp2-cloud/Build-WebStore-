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
// Covers the duplicate-value highlight logic in VariantOptionsSection.
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
    const base = { price: 20, inventory: 5, sku: 'SKU', compareAtPrice: 39 }
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

    // ── TC-F08-1525-50..52: compareAtPrice tracked independently from price ───
    // Reported bug: regenerating silently reset a row's manually-edited compareAtPrice
    // back to the master value whenever that row's PRICE happened to be unchanged —
    // compareAtPrice customization piggybacked on the price-customized check instead
    // of being tracked on its own.

    it('TC-F08-1525-50: row compareAtPrice customized (differs from prevBaseCompareAtPrice) is preserved even when price is unchanged', () => {
        // Arrange: "Red - M" price still matches prevBase(10) — falls into the
        // "price not customized" path — but its compareAtPrice (35) differs from
        // prevBaseCompareAtPrice (39), meaning the USER edited it independently.
        const current = [
            { variantName: 'Red - S', price: 10, compareAtPrice: 39, skuCode: 'SKU-RED-S', stock: 3 },
            { variantName: 'Red - M', price: 10, compareAtPrice: 35, skuCode: 'SKU-RED-M', stock: 5 },
        ]
        const result = buildVariantMatrix(combos, base, current, 10, undefined, 39)

        const redM = result.find(r => r.variantName === 'Red - M')!
        const redS = result.find(r => r.variantName === 'Red - S')!
        expect(redM.compareAtPrice).toBe(35)  // preserved — differs from prevBaseCompareAtPrice
        expect(redS.compareAtPrice).toBe(base.compareAtPrice ?? undefined)  // unchanged → synced to base
    })

    it('TC-F08-1525-51: prevBaseCompareAtPrice=null (unknown baseline) → always preserves existing compareAtPrice', () => {
        // Mirrors F08-bug-1032-04d's price behavior: first generate in an edit session
        // (prevBaseCompareAtPrice unknown) must never wipe pre-existing customized data.
        const current = [
            { variantName: 'Red - S', price: 10, compareAtPrice: 99, skuCode: 'CUSTOM', stock: 1 },
        ]
        const result = buildVariantMatrix(combos, base, current, 10, undefined, null)
        const redS = result.find(r => r.variantName === 'Red - S')!
        expect(redS.compareAtPrice).toBe(99)
    })

    it('TC-F08-1525-52: new combo (no existing row) seeds compareAtPrice from base, independent of price-customization state', () => {
        const result = buildVariantMatrix([['Blue', 'L']], base, [], 10, undefined, 39)
        expect(result[0].compareAtPrice).toBe(base.compareAtPrice)
    })

    // ── TC-F08-1525-32: stock compounding regression (GH-1525 follow-up) ──────
    // Reported: clicking "Generate variants" a 2nd time multiplied total stock by
    // the variant count (32 → 128 → ...). Root cause: an existing row's price
    // matching prevBasePrice took the "reset" branch, which used to reset `stock`
    // to `base.inventory` too — and `base.inventory` is itself kept in sync as the
    // SUM of all variant stocks by a separate effect in VariantOptionsSection, so
    // every regenerate multiplied the total by the row count.

    it('TC-F08-1525-32a: existing row stock is preserved on regenerate even when price matches prevBasePrice (reset branch)', () => {
        // Arrange: base.inventory=32 mirrors a baseInventory field already inflated
        // by the sum-sync effect after a prior generate; existing rows sit at 8 each
        // (their real, user-visible stock) and price is unchanged from prevBase.
        const inflatedBase = { price: 20, inventory: 32, sku: 'SKU' }
        const current = [
            { variantName: 'Red - S', price: 20, skuCode: 'SKU-RED-S', stock: 8 },
            { variantName: 'Red - M', price: 20, skuCode: 'SKU-RED-M', stock: 8 },
        ]

        // Act: regenerate with prevBasePrice matching every row's price (reset branch)
        const result = buildVariantMatrix(combos, inflatedBase, current, 20)

        // Assert: stock stays at each row's own value — never overwritten by base.inventory
        expect(result.find(r => r.variantName === 'Red - S')!.stock).toBe(8)
        expect(result.find(r => r.variantName === 'Red - M')!.stock).toBe(8)
    })

    it('TC-F08-1525-32b: 4-row compounding scenario from GH-1525 bug report — sum stays stable across repeated regenerate', () => {
        // Arrange: 4 variants at stock=8 each (sum=32, matches base.inventory after
        // the sum-sync effect ran once) — mirrors the exact reported repro.
        const fourCombos = [['Red', 'S'], ['Red', 'M'], ['Blue', 'S'], ['Blue', 'M']]
        const base32 = { price: 100, inventory: 32, sku: 'KSU' }
        const current = fourCombos.map(combo => ({
            variantName: combo.join(' - '),
            price: 100,
            skuCode: `KSU-${combo.map(c => c.slice(0, 3).toUpperCase()).join('-')}`,
            stock: 8,
        }))

        // Act: click "Generate variants" again (prevBasePrice=100 matches every row → reset branch)
        const result = buildVariantMatrix(fourCombos, base32, current, 100)

        // Assert: total stays 32 (8×4), not 128 (32×4) — no compounding
        const total = result.reduce((sum, r) => sum + r.stock, 0)
        expect(total).toBe(32)
        result.forEach(r => expect(r.stock).toBe(8))
    })

    // ── TC-F08-1525-60..61: new-row stock default depends on first-generate vs. later ──
    // Reported: "nếu product đã có variant và user muốn generate variant mới, stock của
    // các variant mới phải là 0" — seeding a brand-new row from base.inventory is only
    // correct on the very first generate (base.inventory is the user's typed seed value);
    // once variants already exist, base.inventory is the auto-synced SUM of all variant
    // stocks, so a new row inheriting it would be wildly inflated.

    it('TC-F08-1525-60: first-ever generate (no prior variants) → new rows seed from base.inventory', () => {
        const result = buildVariantMatrix([['Red', 'S'], ['Red', 'M']], base, [], null)
        expect(result[0].stock).toBe(base.inventory)
        expect(result[1].stock).toBe(base.inventory)
    })

    it('TC-F08-1525-61: product already has variants → a genuinely new combo defaults to stock=0, not base.inventory', () => {
        // Arrange: product already has 2 variants (Red-S, Red-M) — base.inventory=32
        // mirrors the auto-synced SUM after those were generated, not a real seed value.
        const inflatedBase = { price: 20, inventory: 32, sku: 'SKU' }
        const current = [
            { variantName: 'Red - S', price: 20, skuCode: 'SKU-RED-S', stock: 16 },
            { variantName: 'Red - M', price: 20, skuCode: 'SKU-RED-M', stock: 16 },
        ]

        // Act: user adds a new "L" combo and regenerates
        const result = buildVariantMatrix([['Red', 'S'], ['Red', 'M'], ['Red', 'L']], inflatedBase, current, 20)

        // Assert: existing rows keep their own stock; the new "Red - L" row starts at 0
        expect(result.find(r => r.variantName === 'Red - S')!.stock).toBe(16)
        expect(result.find(r => r.variantName === 'Red - M')!.stock).toBe(16)
        expect(result.find(r => r.variantName === 'Red - L')!.stock).toBe(0)
    })
})

// ── TC-F08-1525-65..67: cleared existing-row numeric fields must not freeze at 0 ──
// Code-review finding L4: `existing.field != null` treated a user-cleared input
// (runtime value '' from RHF's plain `type="number"` registration) as a real value —
// `Number('') === 0` — so any regenerate-triggering action (unrelated tier edit,
// debounced baseSku change, etc.) silently baked the cleared field to a permanent 0
// instead of falling back to "not customized" / the master value.

describe('TC-F08-1525-65..67: buildVariantMatrix treats a cleared (\'\') existing field as no-value, not 0', () => {
    const base = { price: 20, inventory: 5, sku: 'SKU', compareAtPrice: 39 }
    const combos = [['Red', 'S']]

    it('TC-F08-1525-65: existing row with price cleared (\'\') falls back to base.price on regenerate, not frozen at 0', () => {
        const current = [
            { variantName: 'Red - S', price: '' as unknown as number, skuCode: 'SKU-RED-S', stock: 3 },
        ]
        const result = buildVariantMatrix(combos, base, current, 10)
        const redS = result.find(r => r.variantName === 'Red - S')!
        expect(redS.price).toBe(base.price)
        expect(redS.price).not.toBe(0)
    })

    it('TC-F08-1525-66: existing row with compareAtPrice cleared (\'\') resolves to undefined, not 0', () => {
        const current = [
            { variantName: 'Red - S', price: 10, compareAtPrice: '' as unknown as number, skuCode: 'SKU-RED-S', stock: 3 },
        ]
        // prevBaseCompareAtPrice=null → "unknown baseline, always preserve existing" path
        const result = buildVariantMatrix(combos, base, current, 10, undefined, null)
        const redS = result.find(r => r.variantName === 'Red - S')!
        expect(redS.compareAtPrice).toBeUndefined()
    })

    it('TC-F08-1525-67: existing row with stock cleared (\'\') resolves to 0 (out-of-stock default), same as before — no regression', () => {
        const current = [
            { variantName: 'Red - S', price: 20, skuCode: 'SKU-RED-S', stock: '' as unknown as number },
        ]
        const result = buildVariantMatrix(combos, base, current, 20)
        const redS = result.find(r => r.variantName === 'Red - S')!
        expect(redS.stock).toBe(0)
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
