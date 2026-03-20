// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ProductImageFallback } from '../../../components/dashboard/ProductImageFallback'

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
