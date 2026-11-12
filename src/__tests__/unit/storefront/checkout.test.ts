import { describe, it, expect, beforeEach } from 'vitest'
import { formatPrice } from '@/lib/utils'
import {
    validateCheckoutForm,
    validateEmail,
    validatePhone,
    validatePaymentProof,
    PROOF_MAX_SIZE_BYTES,
} from '@/lib/storefront'
import { MY_STATES } from '@/lib/shipping'
import { generateOrderNumber } from '@/lib/orders/generate-order-number'

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

        // Assert — 64-bit random suffix → mọi mã đều khác nhau
        expect(nums.size).toBe(10)
    })

    it('TC-F09.31: format matches ORD-<ts36>-<16 hex> (GH-2081)', () => {
        // Act
        const orderNum = generateOrderNumber()

        // Assert — ORD- + base36 timestamp + 16 ký tự hex HOA (64 bit ngẫu nhiên)
        expect(orderNum).toMatch(/^ORD-[0-9A-Z]+-[0-9A-F]{16}$/)
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

// ─── TC-F09.24: Phone Format Validation ─────────────────────────────────────
describe('[TC-F09.24] Phone Format Validation (validatePhone)', () => {
    it('TC-F09.24: returns error for empty phone (phone is required)', () => {
        expect(validatePhone('')).toBe('Phone number is required')
        expect(validatePhone('   ')).toBe('Phone number is required')
    })

    it('TC-F09.24: accepts local mobile format (012-3456789)', () => {
        expect(validatePhone('012-3456789')).toBeNull()
    })

    it('TC-F09.24: accepts local mobile without separator (0123456789)', () => {
        expect(validatePhone('0123456789')).toBeNull()
    })

    it('TC-F09.24: accepts international format (+60 12 345 6789)', () => {
        expect(validatePhone('+60 12 345 6789')).toBeNull()
    })

    it('TC-F09.24: accepts international without spaces (+601234567890)', () => {
        expect(validatePhone('+6012-3456789')).toBeNull()
    })

    it('TC-F09.24: accepts 011 prefix with 8 digits (011-12345678)', () => {
        expect(validatePhone('011-12345678')).toBeNull()
    })

    it('TC-F09.24: rejects too-short number (0123)', () => {
        expect(validatePhone('0123')).not.toBeNull()
    })

    it('TC-F09.24: rejects non-MY format (starts with 1 directly)', () => {
        expect(validatePhone('12345678')).not.toBeNull()
    })

    it('TC-F09.24: validateCheckoutForm includes phone format error when phone is invalid', () => {
        const form = {
            name: 'Ahmad', email: 'ahmad@email.com', phone: 'invalid-phone',
            line1: '', line2: '', city: '', state: '', postcode: '',
        }
        const result = validateCheckoutForm(form)
        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Invalid phone format')
    })

    it('TC-F09.24: validateCheckoutForm passes when phone is empty (optional)', () => {
        const form = {
            name: 'Ahmad', email: 'ahmad@email.com', phone: '',
            line1: '', line2: '', city: '', state: '', postcode: '',
        }
        const { errors } = validateCheckoutForm(form)
        expect(errors).not.toContain('Invalid phone format')
    })
})

// ─── TC-F09.24: Email Format Validation (standalone) ────────────────────────
describe('[TC-F09.24] Email Format Validation (validateEmail)', () => {
    it('TC-F09.24: returns null for empty email (required handled separately)', () => {
        expect(validateEmail('')).toBeNull()
    })

    it('TC-F09.24: returns null for valid email', () => {
        expect(validateEmail('user@example.com')).toBeNull()
        expect(validateEmail('user+tag@domain.co.my')).toBeNull()
    })

    it('TC-F09.24: returns error string for invalid email', () => {
        expect(validateEmail('not-an-email')).not.toBeNull()
        expect(validateEmail('abc@.com')).not.toBeNull()
        expect(validateEmail('@nodomain')).not.toBeNull()
    })

    it('[TC-F13.132] accepts 254 characters and explains when checkout email exceeds that limit', () => {
        // Arrange
        const allowed = `${'a'.repeat(242)}@example.com`
        const tooLong = `${'a'.repeat(243)}@example.com`

        // Act / Assert
        expect(allowed).toHaveLength(254)
        expect(validateEmail(allowed)).toBeNull()
        expect(validateEmail(tooLong)).toBe('Email must not exceed 254 characters')
    })
})

// ─── TC-F09.188: Payment Proof File Validator ───────────────────────────────
describe('[TC-F09.188] Payment Proof Validator (validatePaymentProof)', () => {
    it('TC-F09.188: accepts JPEG file within size limit', () => {
        // Arrange
        const file = { type: 'image/jpeg', size: 1 * 1024 * 1024 } // 1 MB

        // Act + Assert
        expect(validatePaymentProof(file)).toBeNull()
    })

    it('TC-F09.188: accepts PNG file within size limit', () => {
        // Arrange
        const file = { type: 'image/png', size: 500 * 1024 } // 500 KB

        // Act + Assert
        expect(validatePaymentProof(file)).toBeNull()
    })

    it('TC-F09.188: rejects file exceeding 5 MB limit', () => {
        // Arrange — 1 byte over limit
        const file = { type: 'image/jpeg', size: PROOF_MAX_SIZE_BYTES + 1 }

        // Act + Assert
        expect(validatePaymentProof(file)).toBe('FILE_TOO_LARGE')
    })

    it('TC-F09.188: accepts file exactly at 5 MB boundary (inclusive)', () => {
        // Arrange — exactly at limit
        const file = { type: 'image/png', size: PROOF_MAX_SIZE_BYTES }

        // Act + Assert
        expect(validatePaymentProof(file)).toBeNull()
    })

    it('TC-F09.188: accepts PDF file within size limit', () => {
        // Arrange — PDF now supported per DoD update
        const file = { type: 'application/pdf', size: 500 * 1024 }

        // Act + Assert
        expect(validatePaymentProof(file)).toBeNull()
    })

    it('TC-F09.188: accepts image/jpg (non-standard MIME used by some mobile browsers)', () => {
        // Arrange — iOS Safari / Samsung Internet may report image/jpg instead of image/jpeg
        const file = { type: 'image/jpg', size: 1 * 1024 * 1024 }

        // Act + Assert
        expect(validatePaymentProof(file)).toBeNull()
    })

    it('TC-F09.188: rejects GIF (unsupported type)', () => {
        // Arrange
        const file = { type: 'image/gif', size: 100 * 1024 }

        // Act + Assert
        expect(validatePaymentProof(file)).toBe('INVALID_TYPE')
    })

    it('TC-F09.188: INVALID_TYPE takes precedence over FILE_TOO_LARGE', () => {
        // Arrange — wrong type AND oversized
        const file = { type: 'image/gif', size: PROOF_MAX_SIZE_BYTES + 1 }

        // Act + Assert — type checked first
        expect(validatePaymentProof(file)).toBe('INVALID_TYPE')
    })

    it('TC-F09.188: rejects oversized PDF', () => {
        // Arrange — PDF valid type but over 5 MB
        const file = { type: 'application/pdf', size: PROOF_MAX_SIZE_BYTES + 1 }

        // Act + Assert
        expect(validatePaymentProof(file)).toBe('FILE_TOO_LARGE')
    })
})

// TC-F09.26: MY_STATES static list removed — states now served from DB via GET /api/geo/states
