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

// GH-2258: the Sort menu had no name order and no stock high → low.
describe('[TC-F08-01-13] Sort products by name and by stock high to low', () => {
    const named = [
        { id: 1, name: 'banana', status: 'active', createdAt: '2026-09-18T00:00:00Z', inventory: 5 },
        { id: 2, name: 'Apple', status: 'active', createdAt: '2026-09-19T00:00:00Z', inventory: 0 },
        { id: 3, name: 'Item 10', status: 'active', createdAt: '2026-09-20T00:00:00Z', inventory: 30 },
        { id: 4, name: 'Item 2', status: 'active', createdAt: '2026-09-21T00:00:00Z', inventory: null },
        { id: 5, name: 'cherry', status: 'active', createdAt: '2026-09-22T00:00:00Z', inventory: 12 },
    ]
    const sorted = (sort: string, extra: Record<string, unknown> = {}) =>
        selectProductPage(named, productPageInputSchema.parse({ sort, ...extra })).ids

    it('Name: A > Z ignores letter case and orders numbers naturally', () => {
        // Arrange / Act
        const ids = sorted('Name: A > Z')
        // Assert — Apple, banana, cherry, Item 2, Item 10
        expect(ids).toEqual([2, 1, 5, 4, 3])
    })

    it('Name: Z > A is the exact reverse', () => {
        // Arrange / Act
        const ids = sorted('Name: Z > A')
        // Assert
        expect(ids).toEqual([3, 4, 5, 1, 2])
    })

    it('Inventory: High > Low puts the largest stock first, missing stock counts as 0', () => {
        // Arrange / Act
        const ids = sorted('Inventory: High > Low')
        // Assert — 30, 12, 5, then the two zero-stock rows by newest id first
        expect(ids).toEqual([3, 5, 1, 4, 2])
    })

    it('sorts across the whole catalog before paging', () => {
        // Arrange / Act
        const bigCatalog = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `P${String(25 - i).padStart(2, '0')}`, status: 'active', createdAt: '2026-09-18T00:00:00Z' }))
        const firstPage = selectProductPage(bigCatalog, productPageInputSchema.parse({ sort: 'Name: A > Z', page: 1, limit: 10 }))
        // Assert — P01 (id 25) leads page 1 even though it was the last record
        expect(firstPage.ids[0]).toBe(25)
        expect(firstPage.totalDocs).toBe(25)
    })

    it('rejects sort values the server does not know', () => {
        // Arrange / Act / Assert
        expect(() => productPageInputSchema.parse({ sort: 'Name' })).toThrow()
    })
})
