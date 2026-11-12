// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
vi.mock('@/i18n', () => ({ useI18n: () => ({ t: { storefront: { products: { quantity: 'Quantity' } } } }) }))
import { ProductAddToCartSection } from '@/components/storefront/product-add-to-cart-section'

// Mock AddToCartButton — data-inventory exposes the received inventory prop for TC-F09.237
vi.mock('@/components/storefront/AddToCartButton', () => ({
    AddToCartButton: ({ product, variantName, requireVariant, quantity, variant, onSelectVariant }: any) => (
        <button
            data-testid={variant === 'sticky' ? 'sticky-add-to-cart-btn' : 'add-to-cart-btn'}
            data-quantity={quantity}
            onClick={variant === 'sticky' && requireVariant && !variantName ? onSelectVariant : undefined}
            data-inventory={product?.inventory}
            disabled={(product?.inventory <= 0) || (variant !== 'sticky' && requireVariant && !variantName)}
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

    // ─── TC-F09.237: Variant stock propagation fix (#1179) ───────────────────

    describe('[TC-F09.237] variant stock propagation (#1179)', () => {
        it('[TC-F09.237] selected variant.stock overrides aggregate product.inventory', () => {
            // Arrange: product aggregate inventory=10; Red variant stock=5
            const { getByTestId } = render(
                <ProductAddToCartSection
                    product={{ ...mockProduct, hasVariants: true, variants: mockVariants }}
                    primaryColor="#000"
                    siteSlug="test-site"
                    siteId="s1"
                />
            )

            // Act: select Red variant (stock=5, not aggregate 10)
            fireEvent.click(getByTestId('variant-Red'))

            // Assert: AddToCartButton receives variant stock (5), NOT aggregate (10)
            expect(Number(getByTestId('add-to-cart-btn').getAttribute('data-inventory'))).toBe(5)
        })

        it('[TC-F09.237b] switching variants updates propagated inventory Red(5)→Blue(3)', () => {
            // Arrange
            const { getByTestId } = render(
                <ProductAddToCartSection
                    product={{ ...mockProduct, hasVariants: true, variants: mockVariants }}
                    primaryColor="#000"
                    siteSlug="test-site"
                    siteId="s1"
                />
            )

            // Act: Red → Blue
            fireEvent.click(getByTestId('variant-Red'))
            expect(Number(getByTestId('add-to-cart-btn').getAttribute('data-inventory'))).toBe(5)

            fireEvent.click(getByTestId('variant-Blue'))
            expect(Number(getByTestId('add-to-cart-btn').getAttribute('data-inventory'))).toBe(3)
        })

        it('[TC-F09.237c] non-variant product: inventory = product.inventory (fallback guard)', () => {
            // Arrange: no variants selected, product.inventory=10
            const { getByTestId } = render(
                <ProductAddToCartSection
                    product={mockProduct}
                    primaryColor="#000"
                    siteSlug="test-site"
                    siteId="s1"
                />
            )

            // Assert: falls back to aggregate for non-variant product
            expect(Number(getByTestId('add-to-cart-btn').getAttribute('data-inventory'))).toBe(10)
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

    describe('[TC-F09.293] quantity stepper (GH-2100)', () => {
        const renderSection = (inventory = 3, extra = {}) =>
            render(<ProductAddToCartSection product={{ ...mockProduct, inventory, ...extra }} primaryColor="#000" siteSlug="s" siteId="s1" />)

        it('clamps to [1, stock] and passes quantity to AddToCartButton', () => {
            const { getByTestId } = renderSection(3)
            const plus = screen.getByRole('button', { name: 'Quantity +' })
            const minus = screen.getByRole('button', { name: 'Quantity −' })
            expect(minus).toBeDisabled()
            fireEvent.click(plus)
            fireEvent.click(plus)
            expect(getByTestId('add-to-cart-btn')).toHaveAttribute('data-quantity', '3')
            expect(plus).toBeDisabled()
            fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '99' } })
            expect(getByTestId('add-to-cart-btn')).toHaveAttribute('data-quantity', '3')
            // Field shows the clamped value immediately, not 99 until blur
            expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('3')
            // Invalid/empty input keeps the last valid quantity; blur restores the field to it
            const input = screen.getByRole('spinbutton') as HTMLInputElement
            fireEvent.change(input, { target: { value: '0' } })
            expect(getByTestId('add-to-cart-btn')).toHaveAttribute('data-quantity', '3')
            fireEvent.blur(input)
            expect(input.value).toBe('3')
        })

        it('lets the field be cleared while typing a new value', () => {
            const { getByTestId } = renderSection(10)
            const input = screen.getByRole('spinbutton') as HTMLInputElement
            fireEvent.change(input, { target: { value: '' } })
            expect(input.value).toBe('')
            fireEvent.change(input, { target: { value: '4' } })
            expect(input.value).toBe('4')
            expect(getByTestId('add-to-cart-btn')).toHaveAttribute('data-quantity', '4')
        })

        it('resets to 1 when the variant changes', () => {
            const { getByTestId } = renderSection(10, { hasVariants: true, variants: mockVariants })
            fireEvent.click(getByTestId('variant-Red'))
            fireEvent.click(screen.getByRole('button', { name: 'Quantity +' }))
            expect(getByTestId('add-to-cart-btn')).toHaveAttribute('data-quantity', '2')
            fireEvent.click(getByTestId('variant-Blue'))
            expect(getByTestId('add-to-cart-btn')).toHaveAttribute('data-quantity', '1')
        })

        it('disables the stepper when out of stock', () => {
            renderSection(0)
            expect(screen.getByRole('button', { name: 'Quantity +' })).toBeDisabled()
        })
    })
})


describe('[TC-F09.38] mobile sticky add-to-cart bar', () => {
    let ioCallback: IntersectionObserverCallback | null = null

    beforeEach(() => {
        ioCallback = null
        class MockIO {
            constructor(cb: IntersectionObserverCallback) { ioCallback = cb }
            observe() {}
            disconnect() {}
            unobserve() {}
        }
        vi.stubGlobal('IntersectionObserver', MockIO)
        Element.prototype.scrollIntoView = vi.fn()
    })

    const setInlineVisible = (isIntersecting: boolean) =>
        act(() => { ioCallback?.([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver) })

    const renderSection = (product: any = mockProduct) =>
        render(<ProductAddToCartSection product={product} primaryColor="#000" siteSlug="s" siteId="s1" />)

    it('hides the bar while the inline button is in the viewport', () => {
        const { getByTestId } = renderSection()
        expect(getByTestId('pd-sticky-add-to-cart')).toHaveAttribute('aria-hidden', 'true')
        expect(getByTestId('pd-sticky-add-to-cart').style.visibility).toBe('hidden')
    })

    it('shows a fixed-bottom bar with price once the inline button scrolls out', () => {
        const { getByTestId } = renderSection()
        setInlineVisible(false)
        const bar = getByTestId('pd-sticky-add-to-cart')
        expect(bar).toHaveAttribute('aria-hidden', 'false')
        expect(bar.style.position).toBe('fixed')
        expect(bar.style.bottom).toBe('0px')
        expect(bar).toHaveTextContent('RM 49.90')
    })

    it('mobile-only: CSS hides the bar at >=768px', () => {
        const { container } = renderSection()
        expect(container.querySelector('style')?.textContent).toMatch(/\.pd-sticky-bar\s*{\s*display:\s*none/)
        expect(container.querySelector('style')?.textContent).toMatch(/max-width:\s*767px/)
    })

    it('syncs price from the selected variant', () => {
        const { getByTestId } = renderSection({ ...mockProduct, hasVariants: true, variants: [{ name: 'Big', price: 70, stock: 2 }] })
        fireEvent.click(getByTestId('variant-Big'))
        expect(getByTestId('pd-sticky-add-to-cart')).toHaveTextContent('RM 70.00')
    })

    it('sticky button is disabled when the product is out of stock', () => {
        const { getByTestId } = renderSection({ ...mockProduct, inventory: 0 })
        expect(getByTestId('sticky-add-to-cart-btn')).toBeDisabled()
    })

    it('scrolls to the variant selector when no variant is chosen', () => {
        const { getByTestId } = renderSection({ ...mockProduct, hasVariants: true, variants: mockVariants })
        const stickyBtn = getByTestId('sticky-add-to-cart-btn')
        expect(stickyBtn).not.toBeDisabled()
        fireEvent.click(stickyBtn)
        expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
    })
})
