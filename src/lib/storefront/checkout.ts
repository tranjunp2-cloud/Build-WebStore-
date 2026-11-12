/**
 * Checkout & order helpers — shared logic for validation and totals.
 * Used by storefront checkout page and order creation; tested in __tests__.
 */

export interface CheckoutForm {
    name: string
    email: string
    phone: string
    line1: string
    line2: string
    city: string
    state: string
    postcode: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MAX_CUSTOMER_EMAIL_LENGTH = 254

// Matches Malaysian mobile only (01X-XXXXXXX/XXXXXXXX) with optional +60 prefix, separators allowed
export const MY_PHONE_REGEX = /^(\+?60[\s-]?|0)(1[0-9])[\s-]?\d{3,4}[\s-]?\d{4}$/

/** Validates email format; returns null if valid, error string if invalid. Empty string → null (required checked separately). */
export function validateEmail(email: string): string | null {
    const v = email.trim()
    if (!v) return null
    if (v.length > MAX_CUSTOMER_EMAIL_LENGTH) return `Email must not exceed ${MAX_CUSTOMER_EMAIL_LENGTH} characters`
    if (!EMAIL_REGEX.test(v)) return 'Invalid email format'
    return null
}

/** Validates Malaysian phone format; returns null if valid, error string if invalid or empty. */
export function validatePhone(phone: string): string | null {
    const v = phone.trim()
    if (!v) return 'Phone number is required'
    if (!MY_PHONE_REGEX.test(v)) return 'Invalid phone number (e.g. 012-345 6789)'
    return null
}

export function validateCheckoutForm(form: CheckoutForm): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    if (!form.name.trim()) errors.push('Name is required')
    if (!form.email.trim()) errors.push('Email is required')
    const emailError = validateEmail(form.email)
    if (emailError) errors.push(emailError)
    if (!form.phone.trim()) errors.push('Phone number is required')
    else if (!MY_PHONE_REGEX.test(form.phone.trim())) errors.push('Invalid phone format')
    if (!form.line1.trim()) errors.push('Address line 1 is required')
    return { valid: errors.length === 0, errors }
}

export const PROOF_ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
export const PROOF_MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

export type ProofValidationError = 'INVALID_TYPE' | 'FILE_TOO_LARGE'

/** Validates QR Banking payment proof file. Returns null if valid, error code otherwise. */
export function validatePaymentProof(file: { type: string; size: number }): ProofValidationError | null {
    if (!PROOF_ACCEPTED_TYPES.includes(file.type)) return 'INVALID_TYPE'
    if (file.size > PROOF_MAX_SIZE_BYTES) return 'FILE_TOO_LARGE'
    return null
}
