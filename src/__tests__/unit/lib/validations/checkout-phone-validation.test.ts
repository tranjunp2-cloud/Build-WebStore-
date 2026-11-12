import { describe, it, expect } from 'vitest'
import { orderCreateSchema, stripeCheckoutSchema, xenditCheckoutSchema } from '@/lib/validations/orders'

// GH-2208: server must reject phone numbers that are not Malaysian mobiles (same rule as storefront validatePhone).

const baseCustomer = {
    name: 'Ahmad',
    email: 'ahmad@example.com',
    address: { line1: 'No. 1 Jalan Test', city: 'Ampang', state: 'Selangor', postcode: '68000', country: 'MY' },
}
const items = [{ productId: 'prod-1', quantity: 1 }]

const codBody = (phone?: string) => ({ siteId: 'site-1', items, customer: { ...baseCustomer, phone }, paymentMethod: 'cod' as const })
const onlineBody = (phone?: string) => ({ siteId: 'site-1', items, customer: { ...baseCustomer, phone } })

const INVALID_PHONES = ['123456789', '12345678', '0123', 'abc0123456789', '+65 9123 4567']
const VALID_PHONES = ['0123456789', '012-345 6789', '+60 12 345 6789', '60123456789', '011-12345678']

// ─── TC-F09.300: COD / bank transfer schema rejects invalid MY phone ───
describe('[TC-F09.300] orderCreateSchema phone format', () => {
    it.each(INVALID_PHONES)('rejects invalid phone %s', (phone) => {
        // Act
        const result = orderCreateSchema.safeParse(codBody(phone))

        // Assert
        expect(result.success).toBe(false)
    })

    it.each(VALID_PHONES)('accepts valid MY mobile %s', (phone) => {
        // Act
        const result = orderCreateSchema.safeParse(codBody(phone))

        // Assert
        expect(result.success).toBe(true)
    })

    it('rejects missing phone', () => {
        // Act + Assert
        expect(orderCreateSchema.safeParse(codBody(undefined)).success).toBe(false)
        expect(orderCreateSchema.safeParse(codBody('   ')).success).toBe(false)
    })
})

// ─── TC-F09.301: Stripe / Xendit schemas require a valid MY phone ───
describe.each([
    ['stripeCheckoutSchema', stripeCheckoutSchema],
    ['xenditCheckoutSchema', xenditCheckoutSchema],
] as const)('[TC-F09.301] %s phone format', (_name, schema) => {
    it.each(INVALID_PHONES)('rejects invalid phone %s', (phone) => {
        // Act
        const result = schema.safeParse(onlineBody(phone))

        // Assert
        expect(result.success).toBe(false)
    })

    it.each(VALID_PHONES)('accepts valid MY mobile %s', (phone) => {
        // Act
        const result = schema.safeParse(onlineBody(phone))

        // Assert
        expect(result.success).toBe(true)
    })

    it('rejects missing phone', () => {
        // Act + Assert
        expect(schema.safeParse(onlineBody(undefined)).success).toBe(false)
        expect(schema.safeParse(onlineBody('')).success).toBe(false)
    })
})
