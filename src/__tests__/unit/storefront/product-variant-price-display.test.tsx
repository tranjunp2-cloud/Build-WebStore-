// @vitest-environment jsdom
/**
 * TC-F09.265–273: variant product price display + labels (GH-2082)
 * Before a variant is picked the price comes from the variants ("From RM 59"), never the base price (may be 0);
 * labels follow the storefront locale instead of hard-coded Vietnamese.
 */
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { I18nProvider, type Locale } from '@/i18n'
import { ProductVariantSelector } from '@/components/storefront/ProductVariantSelector'
import { buildProductOffers, listingPrice, variantPriceRange } from '@/lib/storefront/variant-price-range'
import { ProductCard } from '@/blocks/products-grid/ProductCard'

const SIZES = [
    { name: '100ml', price: 59, stock: 10 },
    { name: '200ml', price: 99, stock: 3 },
]

function renderSelector(variants = SIZES, locale: Locale = 'en', basePrice = 0) {
    return render(
        <I18nProvider defaultLocale={locale}>
            <ProductVariantSelector variants={variants} currency="MYR" primaryColor="#000" basePrice={basePrice} />
        </I18nProvider>,
    )
}

describe('variantPriceRange', () => {
    it('TC-F09.265: returns lowest and highest variant price, null when no priced variant', () => {
        // Arrange + Act + Assert
        expect(variantPriceRange(SIZES)).toEqual({ min: 59, max: 99 })
        expect(variantPriceRange([{ price: 20 }])).toEqual({ min: 20, max: 20 })
        expect(variantPriceRange([])).toBeNull()
        expect(variantPriceRange(undefined)).toBeNull()
        expect(variantPriceRange([{ price: null }])).toBeNull()
    })
})

describe('ProductVariantSelector price + labels', () => {
    it('TC-F09.266: base price 0 + different variant prices → "From RM 59.00", not RM 0.00', () => {
        // Arrange + Act
        renderSelector()
        // Assert
        expect(screen.getByText('From RM 59.00')).toBeInTheDocument()
        expect(screen.queryByText('RM 0.00')).not.toBeInTheDocument()
    })

    it('TC-F09.267: same price on every variant → that price without "From"', () => {
        // Arrange + Act
        renderSelector([{ name: 'S', price: 17, stock: 5 }, { name: 'M', price: 17, stock: 5 }])
        // Assert
        expect(screen.getByText('RM 17.00')).toBeInTheDocument()
        expect(screen.queryByText(/From/)).not.toBeInTheDocument()
    })

    it('TC-F09.268: picking a variant shows its own price and an EN stock label', () => {
        // Arrange
        renderSelector()
        // Act
        fireEvent.click(screen.getByRole('button', { name: '200ml' }))
        // Assert
        expect(screen.getByText('RM 99.00')).toBeInTheDocument()
        expect(screen.getByText('3 left')).toBeInTheDocument()
        expect(screen.getByText('Variant')).toBeInTheDocument()
        expect(screen.queryByText(/Phân loại|Còn/)).not.toBeInTheDocument()
    })

    it('TC-F09.269: BM locale uses Malay labels', () => {
        // Arrange
        renderSelector(SIZES, 'ms')
        // Act
        fireEvent.click(screen.getByRole('button', { name: '100ml' }))
        // Assert
        expect(screen.getByText('Varian')).toBeInTheDocument()
        expect(screen.getByText('Tinggal 10')).toBeInTheDocument()
    })
})

describe('product cards (grid / featured / quick view)', () => {
    it('TC-F09.270: listingPrice uses the lowest variant price and drops the base compare-at', () => {
        // Arrange
        const variantDoc = { price: 0, compareAtPrice: 120, hasVariants: true, variants: SIZES }
        const plainDoc = { price: 25, compareAtPrice: 30, hasVariants: false, variants: [] }
        // Act + Assert
        expect(listingPrice(variantDoc)).toEqual({ amount: 59, isFrom: true, compareAtPrice: undefined })
        expect(listingPrice({ ...variantDoc, variants: [{ price: 17 }, { price: 17 }] })).toEqual({ amount: 17, isFrom: false, compareAtPrice: undefined })
        expect(listingPrice(plainDoc)).toEqual({ amount: 25, isFrom: false, compareAtPrice: 30 })
    })

    it('TC-F09.271: grid card of a variant product reads "From RM 59.00", not RM 0.00', () => {
        // Arrange
        const product = { id: '1', slug: 'serum', name: 'Serum', price: 'RM 59.00', priceRaw: 59, priceFrom: true, currency: 'MYR', inventory: 0, image: null }
        // Act
        render(
            <I18nProvider defaultLocale="en">
                <ProductCard product={product} variant="grid-3" theme={{} as never} siteBasePath="" />
            </I18nProvider>,
        )
        // Assert
        expect(screen.getByText('From RM 59.00')).toBeInTheDocument()
        expect(screen.queryByText('RM 0.00')).not.toBeInTheDocument()
    })
})

describe('buildProductOffers (product page JSON-LD)', () => {
    it('TC-F09.272: variant product gets an AggregateOffer over priced variants', () => {
        // Arrange
        const product = {
            price: 0,
            currency: 'MYR',
            inventory: 0,
            hasVariants: true,
            variants: [{ price: 59, stock: 0 }, { price: 189, stock: 2 }, { price: null, stock: 5 }],
        }
        // Act
        const offers = buildProductOffers(product)
        // Assert
        expect(offers).toEqual({
            '@type': 'AggregateOffer',
            lowPrice: 59,
            highPrice: 189,
            offerCount: 2,
            priceCurrency: 'MYR',
            availability: 'https://schema.org/InStock',
        })
    })

    it('TC-F09.273: simple product, or variants without prices, gets a single Offer from the base price', () => {
        // Arrange + Act
        const simple = buildProductOffers({ price: 25, currency: null, inventory: 0, hasVariants: false, variants: [] })
        const unpriced = buildProductOffers({ price: 30, currency: 'MYR', inventory: 4, hasVariants: true, variants: [{ price: null, stock: 1 }] })
        // Assert
        expect(simple).toEqual({ '@type': 'Offer', price: 25, priceCurrency: 'MYR', availability: 'https://schema.org/OutOfStock' })
        expect(unpriced).toEqual({ '@type': 'Offer', price: 30, priceCurrency: 'MYR', availability: 'https://schema.org/InStock' })
    })
})
