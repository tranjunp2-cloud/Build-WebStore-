import { describe, expect, it } from 'vitest'
import { mapPageFilters, type FilterComponent } from '@/lib/migration/pw1-filter-mapping'
const component = (sourceId: string, type: string, criteria?: Record<string, number>): FilterComponent => ({ sourceId, type, enabled: true, config: { criteria } })
describe('[TC-F35.M60] PW1 page-wide filter mapping', () => {
    it('unions criteria across page controls and targets all matching listings regardless of position', () => {
        const page = { sourceId: 'p', components: [component('f1', 'product_filter', { category: 1, price: 0 }), component('a', 'product_listing'), component('blog', 'article_listing'), component('f2', 'product_filter', { price: 1 }), component('b', 'product_listing')] }
        const result = mapPageFilters(page)
        expect(result.product).toEqual({ category: true, price: true, search: false, attributes: false })
        expect(result.mappings.every(item => item.targetIds.join() === 'a,b')).toBe(true)
    })
    it('does not replace defaults without a source filter, but preserves explicitly disabled controls', () => {
        expect(mapPageFilters({ sourceId: 'p', components: [component('a', 'product_listing')] }).product).toBeUndefined()
        expect(mapPageFilters({ sourceId: 'p', components: [component('f', 'product_filter', { category: 0, price: 0 })] }).product).toEqual({ category: false, price: false, search: false, attributes: false })
    })
    it('reports unsupported brand separately and does not call sorting pending', () => {
        const result = mapPageFilters({ sourceId: 'p', components: [component('a', 'product_listing'), component('f', 'product_filter', { brand: 1, category: 1 }), component('s', 'product_sort')] })
        expect(result.product?.category).toBe(true)
        expect(result.mappings.map(m => m.status)).toEqual(['unsupported', 'skipped-intentionally'])
        expect(result.mappings[0].reason).toContain('brand')
    })
    it('does not confuse PW1 variant identities with PW2 attribute keys', () => {
        const result = mapPageFilters({ sourceId: 'p', components: [component('a', 'product_listing'), component('f', 'product_filter', { variant: 1 })] })
        expect(result.product?.attributes).toBe(false)
        expect(result.mappings[0]).toMatchObject({ status: 'unsupported' })
        expect(result.mappings[0].reason).toContain('variant')
    })
    it('reports malformed criteria and active filters without a listing', () => {
        const result = mapPageFilters({ sourceId: 'p', components: [component('f', 'article_filter'), component('orphan', 'product_filter', { category: 1 })] })
        expect(result.mappings.map(m => m.status)).toEqual(['invalid-data', 'unsupported'])
    })
    it('reads JSON source settings and isolates article filters from product listings', () => {
        const result = mapPageFilters({ sourceId: 'p', components: [{ sourceId: 'f', type: 'article_filter', enabled: true, config: { sourceSettings: { criteria: '{"category":1}' } } }, component('a', 'article_listing'), component('p', 'product_listing')] })
        expect(result.articleCategory).toBe(true)
        expect(result.product).toBeUndefined()
        expect(result.mappings[0]).toMatchObject({ status: 'mapped', targetIds: ['a'] })
    })
})
it('[TC-F35.M60] does not bind category controls to unsupported article selection modes', () => {
    const listing = component('a', 'article_listing')
    listing.config.sourceSettings = { list_type: 'fixed' }
    const result = mapPageFilters({ sourceId: 'p', components: [listing, component('f', 'article_filter', { category: 1 })] })
    expect(result.mappings[0]).toMatchObject({ status: 'unsupported', targetIds: [] })
    expect(result.mappings[0].reason).toContain('fixed/random')
})
