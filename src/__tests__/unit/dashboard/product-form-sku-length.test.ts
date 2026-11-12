import { describe, it, expect } from 'vitest'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'
import { getProductFormSchema } from '@/components/dashboard/product-form/schema'

// GH-2259: the product SKU limit is 50, but the error said "under 100" because it
// reused the variant SKU message (variant SKU limit is 100).

const baseProduct = (overrides: Record<string, unknown> = {}) => ({
    name: 'QA-TEST product',
    categoryIds: [1],
    images: [],
    hasVariants: false,
    basePrice: 10,
    baseInventory: 5,
    baseSku: 'SKU-1',
    tiers: [],
    variants: [],
    ...overrides,
})

const issuesAt = (result: { success: boolean; error?: { issues: { path: (string | number)[]; message: string }[] } }, path: string) =>
    result.success ? [] : (result.error?.issues ?? []).filter((i) => i.path.join('.') === path).map((i) => i.message)

describe('[TC-F08.152 / TC-F08.153] Product SKU max 50 characters with a matching message', () => {
    it.each([
        ['en', en, 'SKU is too long. Keep it under 50 characters.'],
        ['ms', ms, 'SKU terlalu panjang. Pastikan kurang daripada 50 aksara.'],
    ])('%s: 50 characters is accepted, 51 is rejected with the 50-character message', (_locale, dict, expected) => {
        // Arrange
        const schema = getProductFormSchema(dict)

        // Act
        const at50 = schema.safeParse(baseProduct({ baseSku: 'A'.repeat(50) }))
        const at51 = schema.safeParse(baseProduct({ baseSku: 'A'.repeat(51) }))

        // Assert
        expect(issuesAt(at50, 'baseSku')).toEqual([])
        expect(issuesAt(at51, 'baseSku')).toEqual([expected])
    })

    it('GH-2259 regression guard: variant SKU keeps its own 100-character limit and message', () => {
        // Arrange
        const schema = getProductFormSchema(en)
        const variant = (skuCode: string) => ({ id: 'v1', variantName: 'Red', skuCode, price: 10, stock: 1 })

        // Act
        const at100 = schema.safeParse(baseProduct({ hasVariants: true, variants: [variant('B'.repeat(100))] }))
        const at101 = schema.safeParse(baseProduct({ hasVariants: true, variants: [variant('B'.repeat(101))] }))

        // Assert
        expect(issuesAt(at100, 'variants.0.skuCode')).toEqual([])
        expect(issuesAt(at101, 'variants.0.skuCode')).toEqual([en.dashboard.products.form.errors.skuLong])
    })
})
