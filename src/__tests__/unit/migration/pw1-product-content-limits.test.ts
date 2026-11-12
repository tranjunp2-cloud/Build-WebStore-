// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { getProductFormSchema } from '@/components/dashboard/product-form/schema'

describe('[TC-F42-076] Dashboard editing migrated galleries', () => {
  it('accepts all eight images on a valid simple Product without dropping relationships', () => {
    // Arrange
    const images = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, url: `https://example.com/${index}.jpg`, alt: `Image ${index}` }))
    const input = {
      name: 'Migrated product', categoryIds: [1], images, hasVariants: false,
      basePrice: 50, baseSku: 'SOURCE-SKU', baseInventory: 10, shippingWeight: 0.5,
      tiers: [], urlSlug: 'migrated-product',
    }
    // Act
    const parsed = getProductFormSchema({}, images).safeParse(input)
    // Assert
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.images).toEqual(images)
  })
})
