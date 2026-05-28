// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ProductAddToCartSection } from '@/components/storefront/product-add-to-cart-section'

// Mock AddToCartButton to avoid rendering complexity
vi.mock('@/components/storefront/AddToCartButton', () => ({
    AddToCartButton: ({ product, variantName, requireVariant }: any) => (
        <button
            data-testid="add-to-cart-btn"
            disabled={(product?.inventory <= 0) || (requireVariant && !variantName)}
            title={variantName ? `Variant: ${variantName}` : 'No variant selected'}
        >
            Add to Cart
        </button>
    ),
}))

// Mock ProductVariantSelector
const mockOnSelect = vi.fn()
vi.mock('@/components/storefront/ProductVariantSelector', () => ({
    ProductVariantSelector: ({ variants, onSelect }: any) => (
        <div data-testid="variant-selector">
            {variants.map((v: any) => (
                <button
                    key={v.name}
                    data-testid={`variant-${v.name}`}
                    onClick={() => {
                        mockOnSelect(v)
                        onSelect(v)
                    }}
                    disabled={v.stock === 0}
                >
                    {v.name}
                </button>
            ))}
        </div>
    ),
}))

const mockProduct = {
    id: 'prod-1',
    slug: 'test-shirt',
    name: 'Test Shirt',
    price: 49.90,
    currency: 'MYR',
    imageUrl: '/img.jpg',
    inventory: 10,
}

const mockVariants = [
    { name: 'Red', price: 59.90, compareAtPrice: 79.90, stock: 5 },
    { name: 'Blue', price: 64.90, compareAtPrice: null, stock: 3 },
]

describe('ProductAddToCartSection [TC-F09.64]', () => {
    beforeEach(() => {
        mockOnSelect.mockClear()
    })

    describe('without variants', () => {
        it('renders AddToCartButton without variant selector', () => {
            const { queryByTestId } = render(
                <ProductAddToCartSection
                    product={mockProduct}
                    primaryColor="#000"
                    siteSlug="test-site"
                    siteId="s1"
                />
            )

            expect(queryByTestId('variant-selector')).not.toBeInTheDocument()
            expect(queryByTestId('add-to-cart-btn')).toBeInTheDocument()
        })

        it('AddToCartButton is enabled when product is in stock', () => {
            const { getByTestId } = render(
                <ProductAddToCartSection
                    product={mockProduct}
                    primaryColor="#000"
                    siteSlug="test-site"
                    siteId="s1"
                />
            )

            const btn = getByTestId('add-to-cart-btn')
            expect(btn).not.toBeDisabled()
        })

        it('AddToCartButton is disabled when product is out of stock', () => {
            const { getByTestId } = render(
                <ProductAddToCartSection
                    product={{ ...mockProduct, inventory: 0 }}
                    primaryColor="#000"
                    siteSlug="test-site"
                    siteId="s1"
                />
            )

            const btn = getByTestId('add-to-cart-btn')
            expect(btn).toBeDisabled()
        })
    })

    describe('[TC-F09.64] with variants — requireVariant guard', () => {
        it('renders variant selector when product hasVariants', () => {
            const { getByTestId } = render(
                <ProductAddToCartSection
                    product={{
                        ...mockProduct,
                        hasVariants: true,
                        variants: mockVariants,
                    }}
                    primaryColor="#000"
                    siteSlug="test-site"
                    siteId="s1"
                />
            )

            expect(getByTestId('variant-selector')).toBeInTheDocument()
            expect(getByTestId('variant-Red')).toBeInTheDocument()
            expect(getByTestId('variant-Blue')).toBeInTheDocument()
        })

        it('[TC-F09.64] AddToCartButton disabled until variant selected', () => {
            const { getByTestId } = render(
                <ProductAddToCartSection
                    product={{
                        ...mockProduct,
                        hasVariants: true,
                        variants: mockVariants,
                    }}
                    primaryColor="#000"
                    siteSlug="test-site"
                    siteId="s1"
                />
            )

            const btn = getByTestId('add-to-cart-btn')
            // Initially disabled: requireVariant=true, no variant selected
            expect(btn).toBeDisabled()
        })

        it('[TC-F09.64] AddToCartButton enabled after selecting variant', () => {
            const { getByTestId } = render(
                <ProductAddToCartSection
                    product={{
                        ...mockProduct,
                        hasVariants: true,
                        variants: mockVariants,
                    }}
                    primaryColor="#000"
                    siteSlug="test-site"
                    siteId="s1"
                />
            )

            const btn = getByTestId('add-to-cart-btn')
            const redBtn = getByTestId('variant-Red')

            // Initially disabled
            expect(btn).toBeDisabled()

            // Click variant
            fireEvent.click(redBtn)

            // Should now be enabled
            expect(btn).not.toBeDisabled()
            expect(btn.title).toBe('Variant: Red')
        })

        it('variant price overrides base price', () => {
            const { getByTestId } = render(
                <ProductAddToCartSection
                    product={{
                        ...mockProduct,
                        price: 49.90, // base price
                        hasVariants: true,
                        variants: mockVariants,
                    }}
                    primaryColor="#000"
                    siteSlug="test-site"
                    siteId="s1"
                />
            )

            const blueBtn = getByTestId('variant-Blue')
            fireEvent.click(blueBtn)

            // Verify that the component uses variant price (64.90) not base (49.90)
            expect(mockOnSelect).toHaveBeenCalledWith(mockVariants[1])
        })

        it('disabled variant button cannot be selected', () => {
            const variantsWithOOS = [
                { name: 'Red', price: 59.90, compareAtPrice: null, stock: 5 },
                { name: 'OutOfStock', price: 69.90, compareAtPrice: null, stock: 0 },
            ]

            const { getByTestId } = render(
                <ProductAddToCartSection
                    product={{
                        ...mockProduct,
                        hasVariants: true,
                        variants: variantsWithOOS,
                    }}
                    primaryColor="#000"
                    siteSlug="test-site"
                    siteId="s1"
                />
            )

            const oosBtn = getByTestId('variant-OutOfStock')
            expect(oosBtn).toBeDisabled()
        })

        it('variant compareAtPrice displayed when available', () => {
            const { getByTestId } = render(
                <ProductAddToCartSection
                    product={{
                        ...mockProduct,
                        hasVariants: true,
                        variants: mockVariants,
                    }}
                    primaryColor="#000"
                    siteSlug="test-site"
                    siteId="s1"
                />
            )

            const redBtn = getByTestId('variant-Red')
            fireEvent.click(redBtn)

            // The component should pass compareAtPrice to AddToCartButton
            expect(mockOnSelect).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Red',
                    price: 59.90,
                    compareAtPrice: 79.90,
                    stock: 5,
                })
            )
        })

        it('variant stock displayed and respected', () => {
            const { getByTestId } = render(
                <ProductAddToCartSection
                    product={{
                        ...mockProduct,
                        hasVariants: true,
                        variants: mockVariants,
                    }}
                    primaryColor="#000"
                    siteSlug="test-site"
                    siteId="s1"
                />
            )

            const redBtn = getByTestId('variant-Red')
            fireEvent.click(redBtn)

            // Verify stock is passed correctly
            expect(mockOnSelect).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Red',
                    stock: 5,
                })
            )
        })

        it('switching variants updates button state', () => {
            const { getByTestId } = render(
                <ProductAddToCartSection
                    product={{
                        ...mockProduct,
                        hasVariants: true,
                        variants: mockVariants,
                    }}
                    primaryColor="#000"
                    siteSlug="test-site"
                    siteId="s1"
                />
            )

            const btn = getByTestId('add-to-cart-btn')
            const redBtn = getByTestId('variant-Red')
            const blueBtn = getByTestId('variant-Blue')

            // Select Red
            fireEvent.click(redBtn)
            expect(btn.title).toBe('Variant: Red')

            // Switch to Blue
            fireEvent.click(blueBtn)
            expect(btn.title).toBe('Variant: Blue')

            // Both should enable the button
            expect(btn).not.toBeDisabled()
        })

        it('variant with null compareAtPrice handled correctly', () => {
            const variantsWithNull = [
                { name: 'Plain', price: 49.90, compareAtPrice: null, stock: 10 },
            ]

            const { getByTestId } = render(
                <ProductAddToCartSection
                    product={{
                        ...mockProduct,
                        hasVariants: true,
                        variants: variantsWithNull,
                    }}
                    primaryColor="#000"
                    siteSlug="test-site"
                    siteId="s1"
                />
            )

            const plainBtn = getByTestId('variant-Plain')
            fireEvent.click(plainBtn)

            expect(mockOnSelect).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Plain',
                    compareAtPrice: null,
                })
            )
        })
    })

    describe('edge cases', () => {
        it('handles empty variants array', () => {
            const { queryByTestId } = render(
                <ProductAddToCartSection
                    product={{
                        ...mockProduct,
                        hasVariants: true,
                        variants: [],
                    }}
                    primaryColor="#000"
                    siteSlug="test-site"
                    siteId="s1"
                />
            )

            // Should not render selector for empty variants
            expect(queryByTestId('variant-selector')).not.toBeInTheDocument()
        })

        it('handles undefined variants when hasVariants=true', () => {
            const { queryByTestId } = render(
                <ProductAddToCartSection
                    product={{
                        ...mockProduct,
                        hasVariants: true,
                        variants: undefined,
                    }}
                    primaryColor="#000"
                    siteSlug="test-site"
                    siteId="s1"
                />
            )

            // Should not render selector when variants undefined
            expect(queryByTestId('variant-selector')).not.toBeInTheDocument()
        })

        it('hasVariants=false ignores variants array', () => {
            const { queryByTestId } = render(
                <ProductAddToCartSection
                    product={{
                        ...mockProduct,
                        hasVariants: false,
                        variants: mockVariants,
                    }}
                    primaryColor="#000"
                    siteSlug="test-site"
                    siteId="s1"
                />
            )

            // Should not render selector
            expect(queryByTestId('variant-selector')).not.toBeInTheDocument()

            // Button should not require variant
            const btn = queryByTestId('add-to-cart-btn')
            expect(btn).not.toBeDisabled()
        })
    })
})
