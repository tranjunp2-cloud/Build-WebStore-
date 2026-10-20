import { describe, expect, it } from 'vitest'
import { hasDeliberateEmptySelection, repairProductGrid } from '@/lib/migration/pw1-product-grid-repair'

// TC-F35.M73: an empty fixed product list shows every active product, as on PW1
describe('pw1 product grid repair', () => {
    it('turns a fixed grid without products into all', () => {
        expect(repairProductGrid({ selectionMode: 'fixed', selectedProductIds: [] })).toEqual({ changed: true, from: 'fixed', to: 'all' })
        expect(repairProductGrid({ selectionMode: 'fixed', selectedProductIds: null })).toEqual({ changed: true, from: 'fixed', to: 'all' })
    })
    it('leaves fixed grids with products and other modes alone', () => {
        expect(repairProductGrid({ selectionMode: 'fixed', selectedProductIds: [1] })).toEqual({ changed: false })
        expect(repairProductGrid({ selectionMode: 'all', selectedProductIds: [] })).toEqual({ changed: false })
        expect(repairProductGrid({ selectionMode: 'random', selectedProductIds: [] })).toEqual({ changed: false })
    })
    it('flags stores whose empty selection was deliberate', () => {
        expect(hasDeliberateEmptySelection(['Component 5: source products 9 were not emitted by the BE export (x); removed from the fixed selection'])).toBe(true)
        expect(hasDeliberateEmptySelection(['Component 5: source category 6 is mapped outside this destination; listing left empty as on PW1'])).toBe(true)
        expect(hasDeliberateEmptySelection(['715: sourceSettings retained in adapter report only'])).toBe(false)
    })
})
