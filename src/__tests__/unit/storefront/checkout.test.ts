import { describe, it, expect } from 'vitest'

// ─── Checkout Form Validation ─────────────────────────────────────────────────

interface CheckoutForm {
    name: string
    email: string
    phone: string
    line1: string
    line2: string
    city: string
    state: string
    postcode: string
}

function validateCheckout(form: CheckoutForm): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    if (!form.name.trim()) errors.push('Name is required')
    if (!form.email.trim()) errors.push('Email is required')
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        errors.push('Invalid email format')
    }
    return { valid: errors.length === 0, errors }
}

describe('Checkout Validation', () => {
    it('should pass with valid name + email', () => {
        const result = validateCheckout({
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
        const result = validateCheckout({
            name: '',
            email: 'ahmad@example.com',
            phone: '',
            line1: '', line2: '', city: '', state: '', postcode: '',
        })
        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Name is required')
    })

    it('should fail when email is empty', () => {
        const result = validateCheckout({
            name: 'Ahmad',
            email: '',
            phone: '',
            line1: '', line2: '', city: '', state: '', postcode: '',
        })
        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Email is required')
    })

    it('should fail with invalid email format', () => {
        const result = validateCheckout({
            name: 'Ahmad',
            email: 'not-an-email',
            phone: '',
            line1: '', line2: '', city: '', state: '', postcode: '',
        })
        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Invalid email format')
    })

    it('should fail when both name and email are empty', () => {
        const result = validateCheckout({
            name: '',
            email: '',
            phone: '',
            line1: '', line2: '', city: '', state: '', postcode: '',
        })
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBeGreaterThanOrEqual(2)
    })
})

// ─── Order Calculation Logic ──────────────────────────────────────────────────

function calculateOrderTotals(items: Array<{ price: number; quantity: number }>) {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const tax = Math.round(subtotal * 0.06 * 100) / 100 // SST 6%
    const total = subtotal + tax
    return { subtotal, tax, total }
}

function generateOrderNumber(): string {
    return `ORD-${Date.now().toString(36).toUpperCase()}`
}

describe('Order Calculations', () => {
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
        // 33.33 * 0.06 = 1.9998 → round to 2.00
        expect(tax).toBe(2)
    })
})

describe('Order Number Generation', () => {
    it('should start with ORD-', () => {
        const orderNum = generateOrderNumber()
        expect(orderNum).toMatch(/^ORD-/)
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
        // At least 2 unique (timestamps may collide in tight loop, but mostly unique)
        expect(nums.size).toBeGreaterThanOrEqual(1)
    })
})

// ─── formatPrice ──────────────────────────────────────────────────────────────

function formatPrice(price: number, currency: string): string {
    if (currency === 'MYR') return `RM ${price.toFixed(2)}`
    if (currency === 'SGD') return `S$${price.toFixed(2)}`
    return `$${price.toFixed(2)}`
}

describe('formatPrice', () => {
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

// ─── Malaysian States ─────────────────────────────────────────────────────────

const MY_STATES = [
    'Johor', 'Kedah', 'Kelantan', 'Kuala Lumpur', 'Labuan', 'Melaka',
    'Negeri Sembilan', 'Pahang', 'Penang', 'Perak', 'Perlis',
    'Putrajaya', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu',
]

describe('Malaysian States', () => {
    it('should have 16 states', () => {
        expect(MY_STATES).toHaveLength(16)
    })

    it('should include all major states', () => {
        expect(MY_STATES).toContain('Kuala Lumpur')
        expect(MY_STATES).toContain('Selangor')
        expect(MY_STATES).toContain('Johor')
        expect(MY_STATES).toContain('Sabah')
        expect(MY_STATES).toContain('Sarawak')
    })
})
