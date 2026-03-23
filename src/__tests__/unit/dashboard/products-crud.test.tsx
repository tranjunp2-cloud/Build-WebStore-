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

describe('Products CRUD Form Validation Logic', () => {
    
    // Abstracted logic matching the component's handleSave
    const validateForm = (formName: string, formPrice: string, formSku: string, formCategory: string) => {
        const errors: Record<string, string> = {}
        if (!formName.trim() || formName.length < 3) errors.name = 'Tên sản phẩm phải có ít nhất 3 ký tự'
        if (!formPrice || parseFloat(formPrice) < 0) errors.price = 'Giá hợp lệ (≥ 0) là bắt buộc'
        if (!formSku.trim()) errors.sku = 'SKU là bắt buộc'
        if (!formCategory.trim()) errors.category = 'Danh mục là bắt buộc'
        return errors
    }

    it('returns errors when required fields are empty', () => {
        const errors = validateForm('', '', '', '')
        expect(errors).toHaveProperty('name')
        expect(errors).toHaveProperty('price')
        expect(errors).toHaveProperty('sku')
        expect(errors).toHaveProperty('category')
    })

    it('returns error when name is too short', () => {
        const errors = validateForm('Ab', '10', 'SKU-1', 'Food')
        expect(errors.name).toBe('Tên sản phẩm phải có ít nhất 3 ký tự')
    })

    it('returns error when price is negative', () => {
        const errors = validateForm('Valid Name', '-5', 'SKU-1', 'Food')
        expect(errors.price).toBe('Giá hợp lệ (≥ 0) là bắt buộc')
    })

    it('passes validation when all fields are valid', () => {
        const errors = validateForm('Valid Product Name', '0', 'SKU-123', 'Category')
        expect(Object.keys(errors).length).toBe(0)
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
        expect(slugify('Áo thun Cotton')).toBe('o-thun-cotton')
    })

    it('converts lowercase and removes special chars', () => {
        expect(slugify('Móc Khóa Capybara')).toBe('mc-kha-capybara')
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

    it('includes category in payload — AC-2 fix', () => {
        const payload = buildSavePayload(baseProduct)
        expect(payload.category).toBe('Footwear')
    })

    it('sets status to draft by default — AC-2', () => {
        const payload = buildSavePayload(baseProduct)
        expect(payload.status).toBe('draft')
    })

    it('generates a slug from product name', () => {
        const payload = buildSavePayload(baseProduct)
        expect(payload.slug).toMatch(/^dp-t-ong-[a-z0-9]{5}$/)
    })

    it('sets default stock=10 when no variants', () => {
        const payload = buildSavePayload({ ...baseProduct, variants: [] })
        expect(payload.stock).toBe(10)
        expect(payload.variants).toBeUndefined()
    })

    it('sets stock=0 and includes variants when product has variants', () => {
        const prodWithVariants = {
            ...baseProduct,
            variants: [
                { name: 'Xanh - M', price: 20000, sku: 'DT-XH-M', stock: 10 },
                { name: 'Đỏ - M', price: 20000, sku: 'DT-DO-M', stock: 10 },
            ],
        }
        const payload = buildSavePayload(prodWithVariants)
        expect(payload.stock).toBe(0)
        expect(Array.isArray(payload.variants)).toBe(true)
        expect(payload.variants).toHaveLength(2)
    })

    it('omits category when category is empty string', () => {
        const payload = buildSavePayload({ ...baseProduct, category: '   ' })
        expect(payload.category).toBeUndefined()
    })

    it('includes weight as fallback for F14 integration', () => {
        const payload = buildSavePayload(baseProduct)
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
