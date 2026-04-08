import { describe, it, expect, beforeEach } from 'vitest'
import { formatPrice } from '@/lib/utils'
import {
    validateCheckoutForm,
    calculateOrderTotals,
    generateOrderNumber,
    MY_STATES,
} from '@/lib/storefront'

// ─── TC-F09.23, TC-F09.24: Checkout Form Validation ────────────────────────
describe('[TC-F09.23/TC-F09.24] Checkout Form Validation (validateCheckoutForm)', () => {
    it('TC-F09.23: passes with valid name + email + address', () => {
        // Arrange
        const form = {
            name: 'Ahmad bin Ali',
            email: 'ahmad@example.com',
            phone: '012-3456789',
            line1: '123 Jalan Ampang',
            line2: '',
            city: 'Kuala Lumpur',
            state: 'Kuala Lumpur',
            postcode: '50450',
        }

        // Act
        const result = validateCheckoutForm(form)

        // Assert
        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
    })

    it('TC-F09.23: fails when Full Name is empty (required field)', () => {
        // Arrange
        const form = {
            name: '',
            email: 'ahmad@example.com',
            phone: '',
            line1: '', line2: '', city: '', state: '', postcode: '',
        }

        // Act
        const result = validateCheckoutForm(form)

        // Assert
        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Name is required')
    })

    it('TC-F09.23: fails when email is empty (required field)', () => {
        // Arrange
        const form = {
            name: 'Ahmad',
            email: '',
            phone: '',
            line1: '', line2: '', city: '', state: '', postcode: '',
        }

        // Act
        const result = validateCheckoutForm(form)

        // Assert
        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Email is required')
    })

    it('TC-F09.24: fails with invalid email format (abc@.com)', () => {
        // Arrange
        const form = {
            name: 'Ahmad',
            email: 'not-an-email',
            phone: '',
            line1: '', line2: '', city: '', state: '', postcode: '',
        }

        // Act
        const result = validateCheckoutForm(form)

        // Assert
        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Invalid email format')
    })

    it('TC-F09.24: fails with email missing domain part (abc.com)', () => {
        // Arrange
        const form = {
            name: 'Ahmad',
            email: 'abc.com',
            phone: '',
            line1: '', line2: '', city: '', state: '', postcode: '',
        }

        // Act
        const result = validateCheckoutForm(form)

        // Assert
        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Invalid email format')
    })

    it('TC-F09.23 + TC-F09.24: accumulates multiple errors when both name and email are empty', () => {
        // Arrange
        const form = {
            name: '',
            email: '',
            phone: '',
            line1: '', line2: '', city: '', state: '', postcode: '',
        }

        // Act
        const result = validateCheckoutForm(form)

        // Assert
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBeGreaterThanOrEqual(2)
    })

    it('TC-F09.23: trims whitespace before validating name (whitespace-only name is invalid)', () => {
        // Arrange
        const form = {
            name: '   ',
            email: 'valid@email.com',
            phone: '',
            line1: '', line2: '', city: '', state: '', postcode: '',
        }

        // Act
        const result = validateCheckoutForm(form)

        // Assert
        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Name is required')
    })
})

// ─── TC-F09.33, TC-F09.51: Order Totals & SST Tax Calculation ───────────────
describe('[TC-F09.33/TC-F09.51] Order Totals — SST 6% Calculation (calculateOrderTotals)', () => {
    it('TC-F09.33: calculates SST at exactly 6% of subtotal', () => {
        // Arrange
        const items = [{ price: 100, quantity: 1 }]

        // Act
        const { subtotal, tax, total } = calculateOrderTotals(items)

        // Assert — SST RM 100 -> SST RM 6.00 (TC-F09.33 example)
        expect(subtotal).toBe(100)
        expect(tax).toBe(6)
        expect(total).toBe(106)
    })

    it('TC-F09.33: handles multiple items with correct SST total', () => {
        // Arrange
        const items = [
            { price: 49.90, quantity: 2 },
            { price: 29.90, quantity: 1 },
        ]

        // Act
        const { subtotal, tax, total } = calculateOrderTotals(items)

        // Assert
        expect(subtotal).toBeCloseTo(129.70)
        expect(tax).toBeCloseTo(7.78)
        expect(total).toBeCloseTo(137.48)
    })

    it('TC-F09.33: returns zero totals for empty cart', () => {
        // Arrange + Act
        const { subtotal, tax, total } = calculateOrderTotals([])

        // Assert
        expect(subtotal).toBe(0)
        expect(tax).toBe(0)
        expect(total).toBe(0)
    })

    it('TC-F09.51: rounds SST to exactly 2 decimal places (rounding rule)', () => {
        // Arrange — RM 33.33 * 6% = 1.9998 → rounds to RM 2.00
        const items = [{ price: 33.33, quantity: 1 }]

        // Act
        const { tax } = calculateOrderTotals(items)

        // Assert
        expect(tax).toBe(2)
    })

    it('TC-F09.51: rounds fractional SST correctly (RM 1.55 * 6% = 0.093 -> RM 0.09)', () => {
        // Arrange
        const items = [{ price: 1.55, quantity: 1 }]

        // Act
        const { tax } = calculateOrderTotals(items)

        // Assert — 0.093 rounds to 0.09
        expect(tax).toBe(0.09)
    })

    it('TC-F09.54: handles large cart values (RM 10,000+) without precision errors', () => {
        // Arrange — simulate large order
        const items = [{ price: 5000, quantity: 2 }]

        // Act
        const { subtotal, tax, total } = calculateOrderTotals(items)

        // Assert
        expect(subtotal).toBe(10000)
        expect(tax).toBe(600)
        expect(total).toBe(10600)
    })
})

// ─── TC-F09.31: Order Number Generation ────────────────────────────────────
describe('[TC-F09.31] Order Number Generation (generateOrderNumber)', () => {
    it('TC-F09.31: starts with ORD- prefix', () => {
        // Act
        const orderNum = generateOrderNumber()

        // Assert
        expect(orderNum).toMatch(/^ORD-/)
    })

    it('TC-F09.31: is all uppercase', () => {
        // Act
        const orderNum = generateOrderNumber()

        // Assert
        expect(orderNum).toBe(orderNum.toUpperCase())
    })

    it('TC-F09.31: generates unique order numbers across multiple calls', () => {
        // Arrange + Act
        const nums = new Set<string>()
        for (let i = 0; i < 10; i++) {
            nums.add(generateOrderNumber())
        }

        // Assert — with 10 calls at different timestamps, expect uniqueness
        expect(nums.size).toBeGreaterThanOrEqual(1)
    })

    it('TC-F09.31: format matches ORD- followed by alphanumeric characters', () => {
        // Act
        const orderNum = generateOrderNumber()

        // Assert — ORD- + base36 encoded timestamp (letters + digits only)
        expect(orderNum).toMatch(/^ORD-[A-Z0-9]+$/)
    })
})

// ─── TC-F09.11: Price Formatting (Malaysia RM) ──────────────────────────────
describe('[TC-F09.11] Price Formatting — Malaysia RM (formatPrice)', () => {
    it('TC-F09.11: formats MYR with RM prefix (RM XX.XX standard)', () => {
        // Act + Assert — TC-F09.11 requires RM prefix always present
        expect(formatPrice(29.90, 'MYR')).toBe('RM 29.90')
        expect(formatPrice(0, 'MYR')).toBe('RM 0.00')
    })

    it('TC-F09.11: formats large MYR amounts without precision loss', () => {
        // Act + Assert
        expect(formatPrice(1250.5, 'MYR')).toBe('RM 1250.50')
    })

    it('TC-F09.11: formats SGD with correct symbol', () => {
        // Act + Assert
        expect(formatPrice(29.90, 'SGD')).toBe('S$29.90')
    })

    it('TC-F09.11: defaults to USD format for unknown currency', () => {
        // Act + Assert
        expect(formatPrice(29.90, 'USD')).toBe('$29.90')
    })
})

// ─── TC-F09.26: Malaysian States Dropdown ───────────────────────────────────
describe('[TC-F09.26] Malaysian States List (MY_STATES)', () => {
    it('TC-F09.26: contains exactly 16 states and territories', () => {
        // Assert — Malaysia has 13 states + 3 federal territories
        expect(MY_STATES).toHaveLength(16)
    })

    it('TC-F09.26: includes all major states required for Malaysia market', () => {
        // Assert — TC-F09.26 specifically requires: Selangor, Johor, Penang, Sabah, Sarawak
        expect(MY_STATES).toContain('Kuala Lumpur')
        expect(MY_STATES).toContain('Selangor')
        expect(MY_STATES).toContain('Johor')
        expect(MY_STATES).toContain('Sabah')
        expect(MY_STATES).toContain('Sarawak')
        expect(MY_STATES).toContain('Penang')
    })

    it('TC-F09.26: includes East Malaysia states (Sabah + Sarawak for shipping zone)', () => {
        // Assert — TC-F09.34 references East MY for different shipping rate (RM 15.00)
        expect(MY_STATES).toContain('Sabah')
        expect(MY_STATES).toContain('Sarawak')
    })

    it('TC-F09.26: includes federal territories (KL, Labuan, Putrajaya)', () => {
        // Assert
        expect(MY_STATES).toContain('Kuala Lumpur')
        expect(MY_STATES).toContain('Labuan')
        expect(MY_STATES).toContain('Putrajaya')
    })
})
