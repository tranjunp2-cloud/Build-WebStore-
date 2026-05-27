import { describe, it, expect } from 'vitest'
import { stripeCheckoutSchema } from '@/lib/validations/orders'

// TC-F13-VAL: Zod schema validation for stripe checkout (real schema — no mock)
describe('stripeCheckoutSchema [TC-F13-VAL]', () => {
    const VALID_BODY = {
        siteId: 1,
        items: [{ productId: 'prod-1', quantity: 1 }],
        customer: {
            name: 'Test User',
            email: 'test@example.com',
            phone: '+60123456789',
            address: { line1: '123 Main St', city: 'KL', state: 'KL', postcode: '50000', country: 'Malaysia' },
        },
    }

    it('accepts valid checkout body', () => {
        const result = stripeCheckoutSchema.safeParse(VALID_BODY)
        expect(result.success).toBe(true)
    })

    it('rejects empty items array', () => {
        const result = stripeCheckoutSchema.safeParse({ ...VALID_BODY, items: [] })
        expect(result.success).toBe(false)
    })

    it('rejects items array exceeding 50 items', () => {
        const tooMany = Array.from({ length: 51 }, (_, i) => ({ productId: `prod-${i}`, quantity: 1 }))
        const result = stripeCheckoutSchema.safeParse({ ...VALID_BODY, items: tooMany })
        expect(result.success).toBe(false)
    })

    it('rejects quantity > 100', () => {
        const result = stripeCheckoutSchema.safeParse({
            ...VALID_BODY,
            items: [{ productId: 'prod-1', quantity: 101 }],
        })
        expect(result.success).toBe(false)
    })

    it('rejects quantity < 1', () => {
        const result = stripeCheckoutSchema.safeParse({
            ...VALID_BODY,
            items: [{ productId: 'prod-1', quantity: 0 }],
        })
        expect(result.success).toBe(false)
    })

    it('rejects missing customer.name', () => {
        const result = stripeCheckoutSchema.safeParse({
            ...VALID_BODY,
            customer: { ...VALID_BODY.customer, name: '' },
        })
        expect(result.success).toBe(false)
    })

    it('rejects customer.name exceeding 150 chars', () => {
        const result = stripeCheckoutSchema.safeParse({
            ...VALID_BODY,
            customer: { ...VALID_BODY.customer, name: 'a'.repeat(151) },
        })
        expect(result.success).toBe(false)
    })

    it('rejects invalid customer.email', () => {
        const result = stripeCheckoutSchema.safeParse({
            ...VALID_BODY,
            customer: { ...VALID_BODY.customer, email: 'not-an-email' },
        })
        expect(result.success).toBe(false)
    })

    it('rejects customer.phone exceeding 30 chars', () => {
        const result = stripeCheckoutSchema.safeParse({
            ...VALID_BODY,
            customer: { ...VALID_BODY.customer, phone: '+60'.padEnd(31, '1') },
        })
        expect(result.success).toBe(false)
    })

    it('allows customer.phone to be omitted', () => {
        const { phone: _, ...customerNoPhone } = VALID_BODY.customer
        const result = stripeCheckoutSchema.safeParse({ ...VALID_BODY, customer: customerNoPhone })
        expect(result.success).toBe(true)
    })

    it('rejects missing siteId', () => {
        const { siteId: _, ...noSiteId } = VALID_BODY
        const result = stripeCheckoutSchema.safeParse(noSiteId)
        expect(result.success).toBe(false)
    })
})
