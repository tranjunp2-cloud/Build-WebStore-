import { describe, it, expect } from 'vitest'
import { getDisplayPrice } from '../../../lib/products/display-price'

// F08-bug-1032-06: getDisplayPrice correctly resolves "From RM X" for variant products.
// Dashboard listing must show min variant price (not root price=0) for hasVariants products.

describe('F08-bug-1032-06: getDisplayPrice', () => {
    it('F08-bug-1032-06a: variant product returns min variant price with isVariant=true', () => {
        // TC-F08-bug-1032-06
        const p = { price: 0, hasVariants: true, variants: [{ price: 10 }, { price: 5 }, { price: 20 }] }
        const { value, isVariant } = getDisplayPrice(p)
        expect(value).toBe(5)
        expect(isVariant).toBe(true)
    })

    it('F08-bug-1032-06b: variant product with empty variants falls back to root price', () => {
        // TC-F08-bug-1032-06
        const p = { price: 15, hasVariants: true, variants: [] }
        const { value, isVariant } = getDisplayPrice(p)
        expect(value).toBe(15)
        expect(isVariant).toBe(false)
    })

    it('F08-bug-1032-06c: non-variant product returns root price with isVariant=false', () => {
        // TC-F08-bug-1032-06
        const p = { price: 25, hasVariants: false }
        const { value, isVariant } = getDisplayPrice(p)
        expect(value).toBe(25)
        expect(isVariant).toBe(false)
    })

    it('F08-bug-1032-06d: variant with price=0 preserved — not coerced by || 0 (zero-cost variant)', () => {
        // TC-F08-bug-1032-06
        // Regression guard for the null-check fix (price != null, not truthy):
        // a free variant (price=0) must contribute 0 to the min calculation, not be ignored.
        const p = { price: 0, hasVariants: true, variants: [{ price: 0 }, { price: 5 }] }
        const { value, isVariant } = getDisplayPrice(p)
        expect(value).toBe(0)
        expect(isVariant).toBe(true)
    })
})
