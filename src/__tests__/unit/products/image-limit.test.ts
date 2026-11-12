import { describe, expect, it } from 'vitest'
import { allowsProductImages } from '@/lib/products/image-limit'
import { validateProductImages } from '@/lib/products/image-limit-validation'
import { migrationContext } from '@/lib/migration/pw1-json/runtime'
import { getProductFormSchema } from '@/components/dashboard/product-form/schema'

const ids = [1, 2, 3, 4, 5, 6, 7, 8]
const rows = (values: number[]) => values.map(image => ({ image }))
const options = (operation: 'create' | 'update', previous: number[], context = {}) => ({
    operation, previousValue: rows(previous), req: { context, t: () => 'Maximum 5 images' },
}) as Parameters<typeof validateProductImages>[1]

describe('[TC-F42-076] Five-image limit with historical preservation', () => {
    it('rejects a sixth image on normal creation and edits of a five-image product', () => {
        // Arrange / Act / Assert
        expect(allowsProductImages(ids)).toBe(false)
        expect(allowsProductImages(ids.slice(0, 6), ids.slice(0, 5))).toBe(false)
        expect(validateProductImages(rows(ids), options('create', []))).toBe('Maximum 5 images')
    })
    it('preserves, reorders and removes historical images including populated relationship IDs', () => {
        // Arrange / Act / Assert
        expect(allowsProductImages([...ids].reverse(), ids.map(id => ({ id })))).toBe(true)
        expect(allowsProductImages(ids.slice(1), ids)).toBe(true)
        expect(validateProductImages(rows(ids), options('update', ids))).toBe(true)
    })
    it('rejects new media, extra occurrences and client-forged original data above five', () => {
        // Arrange / Act / Assert
        expect(allowsProductImages([9, ...ids.slice(1)], ids)).toBe(false)
        expect(allowsProductImages([1, ...ids.slice(0, 7)], ids)).toBe(false)
        expect(validateProductImages(rows(ids), options('create', ids))).toBe('Maximum 5 images')
        expect(validateProductImages(rows(ids), options('update', [], { migrationProfile: 'pw1-json-v1' }))).toBe('Maximum 5 images')
    })
    it('permits replacements only after reducing the submitted gallery to five or fewer', () => {
        // Arrange / Act / Assert
        expect(allowsProductImages([20, 21, 22, 23, 24], ids)).toBe(true)
        expect(allowsProductImages(ids.slice(0, 6), ids.slice(0, 5))).toBe(false)
    })
    it('allows import only through the private capability', () => {
        // Arrange / Act / Assert
        expect(validateProductImages(rows(ids), options('create', [], migrationContext()))).toBe(true)
    })
    it('uses the same rule in the form and leaves historical input untouched', () => {
        // Arrange
        const images = ids.map(id => ({ id, url: `https://example.invalid/${id}.jpg` }))
        const input = { name: 'Historical product', categoryIds: [1], images, hasVariants: false, basePrice: 10, baseSku: 'TEST', baseInventory: 1, shippingWeight: 1, tiers: [], urlSlug: 'historical' }
        // Act / Assert
        expect(getProductFormSchema({}).safeParse(input).success).toBe(false)
        const result = getProductFormSchema({}, images).safeParse(input)
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.images).toEqual(images)
        expect(getProductFormSchema({}, images).safeParse({ ...input, images: [{ id: 99, url: 'https://example.invalid/new.jpg' }, ...images.slice(1)] }).success).toBe(false)
    })
})
