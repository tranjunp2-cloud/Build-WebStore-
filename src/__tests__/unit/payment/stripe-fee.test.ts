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

// ─── TC-F13: Application fee calculation ──────────────────────────────

describe('createStripeCheckoutSession — application fee calculation', () => {
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

    // TC-F13.04: 3% platform fee on RM100 = 300 sen
    it('[TC-F13.04] application fee 3% on RM100 total = 300 sen', async () => {
        // Arrange — 1 item at 10000 sen = RM100
        await createStripeCheckoutSession({
            ...BASE_PARAMS,
            items: [{ name: 'Product', price: 10000, quantity: 1 }],
        })

        // Assert
        const args = mockCreate.mock.calls[0][0]
        expect(args.payment_intent_data.application_fee_amount).toBe(300)
    })

    // TC-F13.05: rounding — 3333 sen × 3% = 99.99 sen → rounds to 100 sen
    it('[TC-F13.05] rounds 99.99 sen → 100 sen (RM33.33 × 3%)', async () => {
        // Arrange — 3333 sen × 3% = 99.99 sen
        await createStripeCheckoutSession({
            ...BASE_PARAMS,
            items: [{ name: 'Product', price: 3333, quantity: 1 }],
        })

        // Assert — Math.round(99.99) = 100
        const args = mockCreate.mock.calls[0][0]
        expect(args.payment_intent_data.application_fee_amount).toBe(100)
    })

    // TC-F13.63: Fee rounding and MYR sen — multiple edge amounts are integer
    it('[TC-F13.63] honors custom applicationFeePercent (5% of RM100 = 500 sen)', async () => {
        await createStripeCheckoutSession({
            ...BASE_PARAMS,
            items: [{ name: 'Product', price: 10000, quantity: 1 }],
            applicationFeePercent: 5,
        })

        const args = mockCreate.mock.calls[0][0]
        expect(args.payment_intent_data.application_fee_amount).toBe(500)
    })

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

    // TC-F13.92: Max order total RM 99,999.99 — JS Number safe, Stripe accepts integer
    it('[TC-F13.92] max order RM 99,999.99 (9999999 sen) fee = 300000 sen — no overflow', async () => {
        // Arrange — 9999999 sen = RM 99,999.99
        await createStripeCheckoutSession({
            ...BASE_PARAMS,
            items: [{ name: 'Product', price: 9999999, quantity: 1 }],
        })

        // Assert — Math.round(9999999 * 0.03) = 300000
        const args = mockCreate.mock.calls[0][0]
        expect(args.payment_intent_data.application_fee_amount).toBe(300000)
        expect(Number.isSafeInteger(args.payment_intent_data.application_fee_amount)).toBe(true)
    })

    // TC-F13.130: Fee precision edge — RM 0.33 (33 sen) → fee 1 sen (Math.round(0.99) = 1)
    it('[TC-F13.130] micro-order RM 0.33 (33 sen) × 3% = 0.99 → rounds to 1 sen', async () => {
        // Arrange
        await createStripeCheckoutSession({
            ...BASE_PARAMS,
            items: [{ name: 'Product', price: 33, quantity: 1 }],
        })

        // Assert — Math.round(33 * 0.03) = Math.round(0.99) = 1
        const args = mockCreate.mock.calls[0][0]
        expect(args.payment_intent_data.application_fee_amount).toBe(1)
    })

    // TC-F13.131: Fee = 0 for micro-order RM 0.10 (10 sen) — platform takes nothing
    it('[TC-F13.131] micro-order RM 0.10 (10 sen) × 3% = 0.3 → rounds to 0 sen', async () => {
        // Arrange
        await createStripeCheckoutSession({
            ...BASE_PARAMS,
            items: [{ name: 'Product', price: 10, quantity: 1 }],
        })

        // Assert — Math.round(10 * 0.03) = Math.round(0.3) = 0
        const args = mockCreate.mock.calls[0][0]
        expect(args.payment_intent_data.application_fee_amount).toBe(0)
    })

    it('fee orderId appears in payment_intent_data metadata', async () => {
        await createStripeCheckoutSession({
            ...BASE_PARAMS,
            orderId: 'order-xyz',
            items: [{ name: 'Product', price: 5000, quantity: 1 }],
        })

        const args = mockCreate.mock.calls[0][0]
        expect(args.payment_intent_data.metadata.orderId).toBe('order-xyz')
    })
})
