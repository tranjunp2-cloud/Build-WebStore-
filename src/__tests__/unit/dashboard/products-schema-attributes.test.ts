import { describe, expect, it } from 'vitest'
import { getProductFormSchema } from '@/components/dashboard/product-form/schema'
import { DUPLICATE_ATTRIBUTE_MESSAGE, findDuplicateAttributeIndexes } from '@/lib/products/attribute-names'

const product = {
    name: 'Test product', categoryIds: ['1'], images: [], hasVariants: false,
    basePrice: 50, baseSku: 'SKU-123', baseInventory: 10, shippingWeight: 0.5,
    urlSlug: 'test-product',
}

describe('[TC-F08-04-148] product form duplicate attribute validation', () => {
    it.each([undefined, 'Tên thuộc tính phải duy nhất.'])('rejects duplicates at each repeated row, message=%s', (translation) => {
        // Arrange
        const schema = getProductFormSchema({ dashboard: { products: { form: {
            attributes: { errorDuplicate: translation },
        } } } })
        const attributes = ['Material', ' material ', 'MATERIAL', 'Brand', ' brand ']
            .map(key => ({ key, value: 'Cotton' }))

        // Act
        const result = schema.safeParse({ ...product, attributes })

        // Assert
        expect(result.success).toBe(false)
        if (result.success) throw new Error('Expected duplicate attribute validation failure')
        expect(result.error.issues).toEqual([1, 2, 4].map(index => ({
            code: 'custom', path: ['attributes', index, 'key'],
            message: translation || DUPLICATE_ATTRIBUTE_MESSAGE,
        })))
        expect(result.error.issues.map(issue => issue.path[1])).toEqual(findDuplicateAttributeIndexes(attributes))
    })

    it.each([
        { attributes: undefined },
        { attributes: [] },
        { attributes: [{ key: 'Material', value: 'Cotton' }, { key: ' Brand ', value: 'Prime' }] },
    ])(
        'accepts omitted, empty, or distinct attributes: $attributes', ({ attributes }) => {
            // Arrange
            const schema = getProductFormSchema({})

            // Act
            const result = schema.safeParse({ ...product, attributes })

            // Assert
            expect(result.success).toBe(true)
            expect(findDuplicateAttributeIndexes(attributes ?? [])).toEqual([])
        },
    )
})

const legacyAttributes = [{ key: 'Material', value: 'Cotton' }, { key: ' material ', value: 'Linen' }]

describe('[TC-F08-04-149] legacy duplicate attributes on edit', () => {
    it.each([{ name: 'Renamed product' }, { basePrice: 75 }])('accepts unrelated edits: %j', (edit) => {
        // Arrange
        const schema = getProductFormSchema({}, [], { isEdit: true, attributes: legacyAttributes })
        // Act
        const result = schema.safeParse({ ...product, ...edit, attributes: legacyAttributes })
        // Assert
        expect(result.success).toBe(true)
    })

    it.each([
        [{ key: 'Brand', value: 'Cotton' }, { key: 'brand', value: 'Linen' }],
        [{ key: 'Material', value: 'Silk' }, legacyAttributes[1]],
        [...legacyAttributes].reverse(),
    ])('rejects changed attributes that still duplicate: %j', (...attributes) => {
        // Arrange
        const schema = getProductFormSchema({}, [], { isEdit: true, attributes: legacyAttributes })
        // Act
        const result = schema.safeParse({ ...product, attributes })
        // Assert
        expect(result.success).toBe(false)
        if (result.success) throw new Error('Expected duplicate validation failure')
        expect(result.error.issues[0].path).toEqual(['attributes', 1, 'key'])
    })

    it.each([true, false])('accepts repaired attributes; create still rejects duplicates (edit=%s)', (isEdit) => {
        // Arrange
        const schema = getProductFormSchema({}, [], { isEdit, attributes: legacyAttributes })
        const attributes = [legacyAttributes[0], { key: 'Brand', value: 'Prime' }]
        // Act
        const repaired = schema.safeParse({ ...product, attributes })
        const duplicate = schema.safeParse({ ...product, attributes: legacyAttributes })
        // Assert
        expect(repaired.success).toBe(true)
        expect(duplicate.success).toBe(isEdit)
    })
})
