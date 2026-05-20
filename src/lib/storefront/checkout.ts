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

// Matches Malaysian mobile (01X) and landline (02-09) with optional +60 prefix, separators allowed
const MY_PHONE_REGEX = /^(\+?60[\s-]?|0)(1[0-9]|[2-9]\d?)[\s-]?\d{3,4}[\s-]?\d{4}$/

/** Validates email format; returns null if valid, error string if invalid. Empty string → null (required checked separately). */
export function validateEmail(email: string): string | null {
    const v = email.trim()
    if (!v) return null
    if (!EMAIL_REGEX.test(v)) return 'Invalid email format'
    return null
}

/** Validates Malaysian phone format; returns null if valid or empty (phone is optional). */
export function validatePhone(phone: string): string | null {
    const v = phone.trim()
    if (!v) return null
    if (!MY_PHONE_REGEX.test(v)) return 'Invalid phone number (e.g. 012-345 6789)'
    return null
}

export function validateCheckoutForm(form: CheckoutForm): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    if (!form.name.trim()) errors.push('Name is required')
    if (!form.email.trim()) errors.push('Email is required')
    if (form.email && !EMAIL_REGEX.test(form.email)) errors.push('Invalid email format')
    if (form.phone && !MY_PHONE_REGEX.test(form.phone.trim())) errors.push('Invalid phone format')
    return { valid: errors.length === 0, errors }
}

const SST_RATE = 0.06

export function calculateOrderTotals(items: Array<{ price: number; quantity: number }>) {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const tax = Math.round(subtotal * SST_RATE * 100) / 100
    const total = subtotal + tax
    return { subtotal, tax, total }
}

export function generateOrderNumber(): string {
    return `ORD-${Date.now().toString(36).toUpperCase()}`
}

export const PROOF_ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png']
export const PROOF_MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB

export type ProofValidationError = 'INVALID_TYPE' | 'FILE_TOO_LARGE'

/** Validates QR Banking payment proof file. Returns null if valid, error code otherwise. */
export function validatePaymentProof(file: { type: string; size: number }): ProofValidationError | null {
    if (!PROOF_ACCEPTED_TYPES.includes(file.type)) return 'INVALID_TYPE'
    if (file.size > PROOF_MAX_SIZE_BYTES) return 'FILE_TOO_LARGE'
    return null
}
