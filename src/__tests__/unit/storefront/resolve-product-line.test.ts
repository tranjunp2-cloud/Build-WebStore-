import { describe, expect, it } from 'vitest'
import { resolveProductLine } from '@/lib/products/resolve-product-line'

const baseProduct = {
    id: 1,
    name: 'Updated Shirt',
    price: 50,
    compareAtPrice: 70,
    inventory: 3,
    hasVariants: false,
    images: [{ url: 'https://cdn.example/shirt.jpg' }],
}

describe('[TC-F09.57] resolveProductLine canonical cart values', () => {
    it('returns current base price, stock, and image for an available line', () => {
        // Arrange
        const product = { ...baseProduct, price: 42 }

        // Act
        const result = resolveProductLine(product, { quantity: 2 })

        // Assert
        expect(result).toMatchObject({ ok: true, unitPrice: 42, stock: 3, quantity: 2, imageUrl: 'https://cdn.example/shirt.jpg' })
    })

    it('uses selected variant price and stock instead of the base product snapshot', () => {
        // Arrange
        const product = { ...baseProduct, hasVariants: true, variants: [{ name: 'Blue', price: 65, stock: 2 }] }

        // Act
        const result = resolveProductLine(product, { variant: 'Blue', quantity: 1 })

        // Assert
        expect(result).toMatchObject({ ok: true, unitPrice: 65, stock: 2, quantity: 1, variant: { name: 'Blue' } })
    })

    it('rejects unavailable or over-stock checkout quantities but clamps cart reconciliation quantities', () => {
        // Arrange
        const request = { quantity: 5 }

        // Act
        const rejected = resolveProductLine(baseProduct, request, { stockPolicy: 'reject' })
        const clamped = resolveProductLine(baseProduct, request, { stockPolicy: 'clamp' })
        const ignored = resolveProductLine(baseProduct, request, { stockPolicy: 'ignore' })

        // Assert
        expect(rejected).toMatchObject({ ok: false, code: 'OUT_OF_STOCK', available: 3 })
        expect(clamped).toMatchObject({ ok: true, quantity: 3 })
        expect(ignored).toMatchObject({ ok: true, quantity: 5 })
    })
})
