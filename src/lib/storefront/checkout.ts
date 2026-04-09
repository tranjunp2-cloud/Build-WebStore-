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

export function validateCheckoutForm(form: CheckoutForm): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    if (!form.name.trim()) errors.push('Name is required')
    if (!form.email.trim()) errors.push('Email is required')
    if (form.email && !EMAIL_REGEX.test(form.email)) {
        errors.push('Invalid email format')
    }
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

export const MY_STATES = [
    'Johor', 'Kedah', 'Kelantan', 'Kuala Lumpur', 'Labuan', 'Melaka',
    'Negeri Sembilan', 'Pahang', 'Penang', 'Perak', 'Perlis',
    'Putrajaya', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu',
] as const
