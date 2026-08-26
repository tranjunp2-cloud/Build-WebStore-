import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Stripe SDK BEFORE importing the module under test
const mockCreate = vi.fn()
vi.mock('stripe', () => ({
    default: vi.fn().mockImplementation(() => ({
        checkout: { sessions: { create: mockCreate } },
        accounts: { create: vi.fn(), retrieve: vi.fn() },
        accountLinks: { create: vi.fn() },
        webhooks: { constructEvent: vi.fn() },
    })),
}))

import { createStripeCheckoutSession } from '@/lib/payment/stripe'

// ─── TC-F13: Checkout session creation ────────────────────────────────

describe('createStripeCheckoutSession — checkout params', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_xxx')
        mockCreate.mockResolvedValue({ id: 'cs_test_123', url: 'https://stripe/x' })
    })

    const BASE_PARAMS = {
        orderId: 'o1',
        currency: 'MYR' as const,
        customerEmail: 'x@x.com',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        stripeAccountId: 'acct_x',
        paymentMethodTypes: ['card'] as ['card'],
    }

    it('passes paymentMethodTypes through to Stripe without hardcoding', async () => {
        await createStripeCheckoutSession({
            ...BASE_PARAMS,
            items: [{ name: 'Product', price: 1000, quantity: 1 }],
            paymentMethodTypes: ['fpx'],
        })

        const args = mockCreate.mock.calls[0][0]
        expect(args.payment_method_types).toEqual(['fpx'])
    })

    it('supports multi-method array [card, fpx] through to Stripe', async () => {
        await createStripeCheckoutSession({
            ...BASE_PARAMS,
            items: [{ name: 'Product', price: 1000, quantity: 1 }],
            paymentMethodTypes: ['card', 'fpx'],
        })

        const args = mockCreate.mock.calls[0][0]
        expect(args.payment_method_types).toEqual(['card', 'fpx'])
    })

    it('throws when paymentMethodTypes is empty — developer guard', async () => {
        await expect(
            createStripeCheckoutSession({
                ...BASE_PARAMS,
                items: [{ name: 'Product', price: 1000, quantity: 1 }],
                paymentMethodTypes: [],
            }),
        ).rejects.toThrow(/paymentMethodTypes must contain/)
    })

    it('orderId appears in payment_intent_data metadata', async () => {
        await createStripeCheckoutSession({
            ...BASE_PARAMS,
            orderId: 'order-xyz',
            items: [{ name: 'Product', price: 5000, quantity: 1 }],
        })

        const args = mockCreate.mock.calls[0][0]
        expect(args.payment_intent_data.metadata.orderId).toBe('order-xyz')
    })

    it('[TC-F13.92] max order RM 99,999.99 (9999999 sen) — no overflow, no platform fee', async () => {
        await createStripeCheckoutSession({
            ...BASE_PARAMS,
            items: [{ name: 'Product', price: 9999999, quantity: 1 }],
        })

        const args = mockCreate.mock.calls[0][0]
        expect(args.payment_intent_data.application_fee_amount).toBeUndefined()
        expect(args.mode).toBe('payment')
    })
})
