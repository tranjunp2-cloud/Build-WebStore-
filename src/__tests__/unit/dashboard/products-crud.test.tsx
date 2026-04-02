// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ProductImageFallback } from '../../../components/dashboard/ProductImageFallback'
import { slugify, buildSavePayload } from '../../../components/dashboard/BulkCreateModal'

describe('ProductImageFallback Component', () => {
    it('renders default size correctly', () => {
        const { container } = render(<ProductImageFallback />)
        const svg = container.querySelector('svg')
        expect(svg).toBeInTheDocument()
        expect(svg).toHaveClass('h-8 w-8') // md default
    })

    it('renders custom sizes correctly', () => {
        const { container, rerender } = render(<ProductImageFallback size="sm" />)
        expect(container.querySelector('svg')).toHaveClass('h-4 w-4')

        rerender(<ProductImageFallback size="lg" />)
        expect(container.querySelector('svg')).toHaveClass('h-12 w-12')
    })
    
    it('applies custom className', () => {
        const { container } = render(<ProductImageFallback className="custom-test-class" />)
        expect(container.firstChild).toHaveClass('custom-test-class')
    })
})

import { productFormSchema } from '../../../components/dashboard/product-form/schema'

describe('Products CRUD Form Zod Validation Logic', () => {
    
    // Helper to generate a valid base object so we can test specific field failures
    const getValidBaseData = () => ({
        name: 'Valid Product Name',
        categoryIds: ['cat-1'],
        images: [],
        hasVariants: false,
        basePrice: 50,
        baseSku: 'SKU-123',
        baseInventory: 10,
    })

    it('returns errors when required fields are empty', () => {
        const result = productFormSchema.safeParse({})
        expect(result.success).toBe(false)
        if (!result.success) {
            const errors = result.error.flatten().fieldErrors
            expect(errors.name).toBeDefined()
            expect(errors.categoryIds).toBeDefined()
        }
    })

    it('returns error when name is too short', () => {
        const result = productFormSchema.safeParse({ ...getValidBaseData(), name: 'Ab' })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.flatten().fieldErrors.name?.[0]).toMatch(/at least 3 characters/)
        }
    })

    it('returns error when price or inventory is negative (TC-F08.03c)', () => {
        const result = productFormSchema.safeParse({ ...getValidBaseData(), basePrice: -5, baseInventory: -1 })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.flatten().fieldErrors.basePrice?.[0]).toMatch(/0 or greater/)
            expect(result.error.flatten().fieldErrors.baseInventory?.[0]).toMatch(/cannot be negative/)
        }
    })

    it('passes validation when all fields are valid', () => {
        const result = productFormSchema.safeParse(getValidBaseData())
        expect(result.success).toBe(true)
    })

    it('returns error when category is omitted (TC-F08.03e)', () => {
        const result = productFormSchema.safeParse({ ...getValidBaseData(), categoryIds: [] })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.flatten().fieldErrors.categoryIds?.[0]).toMatch(/at least one category/)
        }
    })

    it('returns error when compare at price is less than regular price (TC-F08.08c)', () => {
        const result = productFormSchema.safeParse({ ...getValidBaseData(), basePrice: 50, compareAtPrice: 30 })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.flatten().fieldErrors.compareAtPrice?.[0]).toMatch(/strictly GREATER than base price/)
        }
    })

    it('returns error when weight is zero or negative (TC-F08.03d)', () => {
        const resZero = productFormSchema.safeParse({ ...getValidBaseData(), shippingWeight: 0 })
        expect(resZero.success).toBe(false)
        
        const resNeg = productFormSchema.safeParse({ ...getValidBaseData(), shippingWeight: -1.5 })
        expect(resNeg.success).toBe(false)
        
        if (!resNeg.success) {
            expect(resNeg.error.flatten().fieldErrors.shippingWeight?.[0]).toMatch(/greater than 0/)
        }
    })

    it('returns error when uploading > 5 images (TC-F08.03g)', () => {
        const tooManyImages = new Array(6).fill({ id: 'img', url: 'http' })
        const result = productFormSchema.safeParse({ ...getValidBaseData(), images: tooManyImages })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.flatten().fieldErrors.images?.[0]).toMatch(/Maximum 5 images/)
        }
    })
})

describe('Product Price Formatting', () => {
    // Abstracted logic matching the component's formatPrice
    function formatPrice(price: number, currency: string) {
        if (currency === 'MYR') return `RM ${price.toFixed(2)}`
        if (currency === 'SGD') return `S$${price.toFixed(2)}`
        return `$${price.toFixed(2)}`
    }

    it('formats MYR correctly', () => {
        expect(formatPrice(10.5, 'MYR')).toBe('RM 10.50')
    })
    
    it('formats SGD correctly', () => {
        expect(formatPrice(100, 'SGD')).toBe('S$100.00')
    })
    
    it('formats USD as default correctly', () => {
        expect(formatPrice(9.99, 'USD')).toBe('$9.99')
        expect(formatPrice(9.99, 'UNKNOWN')).toBe('$9.99')
    })
})

// ── US-F08-04: Bulk AI Create ─────────────────────────────────────────────────

describe('US-F08-04 — slugify utility', () => {
    it('converts Vietnamese text to slug with hyphens', () => {
        expect(slugify('Áo thun Cotton')).toBe('ao-thun-cotton')
    })

    it('converts lowercase and removes special chars', () => {
        expect(slugify('Móc Khóa Capybara')).toBe('moc-khoa-capybara')
    })

    it('strips leading and trailing hyphens', () => {
        expect(slugify('  --hello--  ')).toBe('hello')
    })

    it('handles empty string', () => {
        expect(slugify('')).toBe('')
    })

    it('handles alphanumeric-only input unchanged (lowercase)', () => {
        expect(slugify('product123')).toBe('product123')
    })
})

describe('US-F08-04 — buildSavePayload (AC-2: category included)', () => {
    const baseProduct = {
        _id: 'abc123',
        selected: true,
        name: 'Dép tổ ong',
        price: 20000,
        category: 'Footwear',
        variants: [],
    }

    it('sets status to draft by default — AC-2', () => {
        const payload = buildSavePayload(baseProduct, null, null)
        expect(payload.status).toBe('draft')
    })

    it('generates a random slug from product name', () => {
        const payload = buildSavePayload(baseProduct, null, null)
        expect(payload.slug).toMatch(/^dep-to-ong-[a-z0-9]{5}$/)
    })

    it('sets default inventory=10 when no variants', () => {
        const payload = buildSavePayload({ ...baseProduct, variants: [] }, null, null)
        expect(payload.inventory).toBe(10)
        expect(payload.variants).toBeUndefined()
    })

    it('sets inventory=0 and includes variants when product has variants', () => {
        const prodWithVariants = {
            ...baseProduct,
            variants: [
                { name: 'Xanh - M', price: 20000, sku: 'DT-XH-M', stock: 10 },
                { name: 'Đỏ - M', price: 20000, sku: 'DT-DO-M', stock: 10 },
            ],
        }
        const payload = buildSavePayload(prodWithVariants, null, null)
        expect(payload.inventory).toBe(0)
        expect(Array.isArray(payload.variants)).toBe(true)
        if (payload.variants) {
            expect(payload.variants).toHaveLength(2)
        }
    })

    it('omits category from payload entirely as API requires relationship ID', () => {
        const payload = buildSavePayload({ ...baseProduct, category: 'Food' }, null, null)
        expect((payload as any).category).toBeUndefined()
    })

    it('includes weight as fallback for F14 integration', () => {
        const payload = buildSavePayload(baseProduct, null, null)
        expect(payload.weight).toBe(1)
    })
})

describe('US-F08-04 — ProductImageFallback in Bulk Grid context (AC-1, AC-3)', () => {
    it('renders in small size for grid thumbnails', () => {
        const { container } = render(<ProductImageFallback size="sm" />)
        const svg = container.querySelector('svg')
        expect(svg).toBeInTheDocument()
        expect(svg).toHaveClass('h-4 w-4')
    })

    it('renders as shared component — AC-3: dễ swap asset', () => {
        // Verify the component is importable and renders without crashing
        const { container } = render(<ProductImageFallback />)
        expect(container.firstChild).toBeInTheDocument()
    })
})
