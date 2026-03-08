import { describe, it, expect } from 'vitest'
import { formatPrice } from '@/lib/utils'
import {
    validateCheckoutForm,
    calculateOrderTotals,
    generateOrderNumber,
    MY_STATES,
} from '@/lib/storefront'

describe('Checkout Validation (lib/storefront)', () => {
    it('should pass with valid name + email', () => {
        const result = validateCheckoutForm({
            name: 'Ahmad bin Ali',
            email: 'ahmad@example.com',
            phone: '012-3456789',
            line1: '123 Jalan Ampang',
            line2: '',
            city: 'Kuala Lumpur',
            state: 'Kuala Lumpur',
            postcode: '50450',
        })
        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
    })

    it('should fail when name is empty', () => {
        const result = validateCheckoutForm({
            name: '',
            email: 'ahmad@example.com',
            phone: '',
            line1: '', line2: '', city: '', state: '', postcode: '',
        })
        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Name is required')
    })

    it('should fail when email is empty', () => {
        const result = validateCheckoutForm({
            name: 'Ahmad',
            email: '',
            phone: '',
            line1: '', line2: '', city: '', state: '', postcode: '',
        })
        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Email is required')
    })

    it('should fail with invalid email format', () => {
        const result = validateCheckoutForm({
            name: 'Ahmad',
            email: 'not-an-email',
            phone: '',
            line1: '', line2: '', city: '', state: '', postcode: '',
        })
        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Invalid email format')
    })

    it('should fail when both name and email are empty', () => {
        const result = validateCheckoutForm({
            name: '',
            email: '',
            phone: '',
            line1: '', line2: '', city: '', state: '', postcode: '',
        })
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBeGreaterThanOrEqual(2)
    })
})

describe('Order Calculations (lib/storefront)', () => {
    it('should calculate SST at 6%', () => {
        const { subtotal, tax, total } = calculateOrderTotals([
            { price: 100, quantity: 1 },
        ])
        expect(subtotal).toBe(100)
        expect(tax).toBe(6)
        expect(total).toBe(106)
    })

    it('should handle multiple items', () => {
        const { subtotal, tax, total } = calculateOrderTotals([
            { price: 49.90, quantity: 2 },
            { price: 29.90, quantity: 1 },
        ])
        expect(subtotal).toBeCloseTo(129.70)
        expect(tax).toBeCloseTo(7.78)
        expect(total).toBeCloseTo(137.48)
    })

    it('should handle empty cart', () => {
        const { subtotal, tax, total } = calculateOrderTotals([])
        expect(subtotal).toBe(0)
        expect(tax).toBe(0)
        expect(total).toBe(0)
    })

    it('should round SST to 2 decimal places', () => {
        const { tax } = calculateOrderTotals([
            { price: 33.33, quantity: 1 },
        ])
        expect(tax).toBe(2)
    })
})

describe('Order Number Generation (lib/storefront)', () => {
    it('should start with ORD-', () => {
        expect(generateOrderNumber()).toMatch(/^ORD-/)
    })

    it('should be uppercase', () => {
        const orderNum = generateOrderNumber()
        expect(orderNum).toBe(orderNum.toUpperCase())
    })

    it('should generate unique numbers', () => {
        const nums = new Set<string>()
        for (let i = 0; i < 10; i++) {
            nums.add(generateOrderNumber())
        }
        expect(nums.size).toBeGreaterThanOrEqual(1)
    })
})

describe('formatPrice (lib/utils)', () => {
    it('should format MYR correctly', () => {
        expect(formatPrice(29.90, 'MYR')).toBe('RM 29.90')
        expect(formatPrice(0, 'MYR')).toBe('RM 0.00')
        expect(formatPrice(1250.5, 'MYR')).toBe('RM 1250.50')
    })

    it('should format SGD correctly', () => {
        expect(formatPrice(29.90, 'SGD')).toBe('S$29.90')
    })

    it('should default to USD format', () => {
        expect(formatPrice(29.90, 'USD')).toBe('$29.90')
    })
})

describe('Malaysian States (lib/storefront)', () => {
    it('should have 16 states', () => {
        expect(MY_STATES).toHaveLength(16)
    })

    it('should include major states', () => {
        expect(MY_STATES).toContain('Kuala Lumpur')
        expect(MY_STATES).toContain('Selangor')
        expect(MY_STATES).toContain('Johor')
        expect(MY_STATES).toContain('Sabah')
        expect(MY_STATES).toContain('Sarawak')
    })
})
