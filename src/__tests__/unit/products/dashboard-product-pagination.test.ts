import { describe, it, expect } from 'vitest'
import { selectProductPage, productPageInputSchema } from '@/lib/products/dashboard-product-pagination'

const products = Array.from({ length: 307 }, (_, index) => ({ id: index + 1, name: `Product ${index + 1}`, sku: `sku-${index + 1}`, status: 'draft', createdAt: '2026-09-18T00:00:00Z', price: index + 1, inventory: 10 }))
describe('[TC-F42-PRODUCT-PAGING] Complete tenant inventory pagination', () => {
    it('reaches the final seven of 307 records without duplicates across 100-row pages', () => {
        // Arrange / Act
        const pages = [1, 2, 3, 4].map(page => selectProductPage(products, productPageInputSchema.parse({ page, limit: 100 })))
        // Assert
        expect(pages.map(page => page.ids.length)).toEqual([100, 100, 100, 7])
        expect(new Set(pages.flatMap(page => page.ids)).size).toBe(307)
        expect(pages[3].counts).toEqual({ all: 307, draft: 307, active: 0, archived: 0 })
    })
    it('searches outside the initial 100, clamps empty pages and retains global counts', () => {
        // Arrange / Act
        const result = selectProductPage(products, productPageInputSchema.parse({ search: 'sku-1', page: 99 }))
        // Assert
        expect(result.totalDocs).toBe(111)
        expect(result.page).toBe(12)
        expect(result.counts.all).toBe(307)
        expect(selectProductPage(products, productPageInputSchema.parse({ search: 'absent' })).ids).toEqual([])
    })
    it('applies variant-price sorting and combined category, sale and stock filters before slicing', () => {
        // Arrange
        const candidates = [{ ...products[0], inventory: 0, compareAtPrice: 20, category: [{ name: 'A' }] }, { ...products[1], hasVariants: true, variants: [{ price: 0.5 }] }]
        // Act / Assert
        expect(selectProductPage(candidates, productPageInputSchema.parse({ sort: 'Price: Low > High' })).ids).toEqual([2, 1])
        expect(selectProductPage(candidates, productPageInputSchema.parse({ lowStock: true, sale: 'On Sale', categories: ['A'] })).ids).toEqual([1])
        expect(selectProductPage(candidates, productPageInputSchema.parse({ status: 'active' })).totalDocs).toBe(0)
    })
    it('rejects invalid limits and unrecognized query fields', () => {
        // Arrange / Act / Assert
        expect(() => productPageInputSchema.parse({ limit: 10000 })).toThrow()
        expect(() => productPageInputSchema.parse({ tenant: 1282 })).toThrow()
    })
})
