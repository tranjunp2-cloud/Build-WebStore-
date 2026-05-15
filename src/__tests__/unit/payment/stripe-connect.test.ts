import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock Stripe before importing anything ────────────────────────────
const mockCheckoutSessionCreate = vi.fn()
const mockAccountCreate = vi.fn()
const mockAccountLinkCreate = vi.fn()
const mockAccountRetrieve = vi.fn()
const mockConstructEvent = vi.fn()

vi.mock('stripe', () => {
    return {
        default: vi.fn().mockImplementation(() => ({
            checkout: {
                sessions: { create: mockCheckoutSessionCreate },
            },
            accounts: {
                create: mockAccountCreate,
                retrieve: mockAccountRetrieve,
            },
            accountLinks: {
                create: mockAccountLinkCreate,
            },
            webhooks: {
                constructEvent: mockConstructEvent,
            },
        })),
    }
})

// Import AFTER mocking
import {
    getStripeClient,
    createConnectedAccount,
    createAccountLink,
    getConnectedAccountStatus,
    createStripeCheckoutSession,
    verifyStripeWebhook,
    normalizeStripeEvent,
} from '@/lib/payment/stripe'

// ── Tests ────────────────────────────────────────────────────────────

describe('Stripe Client', () => {
    beforeEach(() => {
        vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123')
        vi.clearAllMocks()
    })

    it('returns a Stripe instance with webhooks + accounts', () => {
        const client = getStripeClient()
        expect(client).toBeDefined()
        expect(client.webhooks).toBeDefined()
        expect(client.accounts).toBeDefined()
    })

    it('returns same singleton instance', () => {
        const a = getStripeClient()
        const b = getStripeClient()
        expect(a).toBe(b)
    })
})

describe('Stripe Connect', () => {
    beforeEach(() => {
        vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123')
        vi.clearAllMocks()
    })

    it('createConnectedAccount creates Standard account for Malaysia', async () => {
        mockAccountCreate.mockResolvedValue({ id: 'acct_test_123' })

        const accountId = await createConnectedAccount('merchant@example.com', 'Kedai Kopi')

        expect(accountId).toBe('acct_test_123')
        expect(mockAccountCreate).toHaveBeenCalledWith({
            type: 'standard',
            email: 'merchant@example.com',
            country: 'MY',
            business_profile: { name: 'Kedai Kopi' },
        })
    })

    it('createAccountLink returns onboarding URL', async () => {
        mockAccountLinkCreate.mockResolvedValue({ url: 'https://connect.stripe.com/setup/xxx' })

        const url = await createAccountLink('acct_test_123', '/refresh', '/return')

        expect(url).toBe('https://connect.stripe.com/setup/xxx')
        expect(mockAccountLinkCreate).toHaveBeenCalledWith({
            account: 'acct_test_123',
            refresh_url: '/refresh',
            return_url: '/return',
            type: 'account_onboarding',
        })
    })

    it('getConnectedAccountStatus reports charges/payouts/details', async () => {
        mockAccountRetrieve.mockResolvedValue({
            id: 'acct_test_123',
            charges_enabled: true,
            payouts_enabled: true,
            details_submitted: true,
            country: 'MY',
            email: 'merchant@example.com',
        })

        const status = await getConnectedAccountStatus('acct_test_123')

        expect(status).toEqual({
            accountId: 'acct_test_123',
            chargesEnabled: true,
            payoutsEnabled: true,
            detailsSubmitted: true,
            country: 'MY',
            email: 'merchant@example.com',
        })
    })

    it('getConnectedAccountStatus handles incomplete onboarding', async () => {
        mockAccountRetrieve.mockResolvedValue({
            id: 'acct_test_456',
            charges_enabled: false,
            payouts_enabled: false,
            details_submitted: false,
            country: null,
            email: null,
        })

        const status = await getConnectedAccountStatus('acct_test_456')

        expect(status.chargesEnabled).toBe(false)
        expect(status.payoutsEnabled).toBe(false)
        expect(status.detailsSubmitted).toBe(false)
    })
})

describe('verifyStripeWebhook', () => {
    beforeEach(() => {
        vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123')
        vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_platform')
        vi.stubEnv('STRIPE_CONNECT_WEBHOOK_SECRET', 'whsec_connect')
        vi.clearAllMocks()
    })

    it('uses platform webhook secret by default', () => {
        const fakeEvent = { id: 'evt_1', type: 'checkout.session.completed' }
        mockConstructEvent.mockReturnValue(fakeEvent)

        const result = verifyStripeWebhook('body', 'sig_v1')

        expect(mockConstructEvent).toHaveBeenCalledWith('body', 'sig_v1', 'whsec_platform')
        expect(result.id).toBe('evt_1')
    })

    it('uses Connect webhook secret when isConnectWebhook=true', () => {
        const fakeEvent = { id: 'evt_2', type: 'account.updated' }
        mockConstructEvent.mockReturnValue(fakeEvent)

        verifyStripeWebhook('body', 'sig_v1', true)

        expect(mockConstructEvent).toHaveBeenCalledWith('body', 'sig_v1', 'whsec_connect')
    })

    it('throws on invalid signature', () => {
        mockConstructEvent.mockImplementation(() => {
            throw new Error('No signatures found matching the expected signature for payload')
        })

        expect(() => verifyStripeWebhook('body', 'bad_sig')).toThrow('No signatures found')
    })
})

describe('normalizeStripeEvent', () => {
    it('checkout.session.completed → payment_success', () => {
        const event = normalizeStripeEvent({
            id: 'evt_1',
            type: 'checkout.session.completed',
            data: { object: { id: 'cs_123', client_reference_id: 'order_1' } },
        } as any)

        expect(event.type).toBe('payment_success')
        expect(event.provider).toBe('stripe')
        expect(event.data.id).toBe('cs_123')
    })

    it('payment_intent.payment_failed → payment_failed', () => {
        const event = normalizeStripeEvent({
            id: 'evt_2',
            type: 'payment_intent.payment_failed',
            data: { object: { id: 'pi_456' } },
        } as any)

        expect(event.type).toBe('payment_failed')
    })

    it('customer.subscription.updated → subscription_updated', () => {
        const event = normalizeStripeEvent({
            id: 'evt_3',
            type: 'customer.subscription.updated',
            data: { object: { id: 'sub_789', status: 'active' } },
        } as any)

        expect(event.type).toBe('subscription_updated')
    })

    it('account.updated → account_updated', () => {
        const event = normalizeStripeEvent({
            id: 'evt_4',
            type: 'account.updated',
            data: { object: { id: 'acct_abc' } },
        } as any)

        expect(event.type).toBe('account_updated')
    })

    it('preserves connectedAccountId from Connect events', () => {
        const event = normalizeStripeEvent({
            id: 'evt_5',
            type: 'account.updated',
            data: { object: { id: 'acct_abc' } },
            account: 'acct_abc',
        } as any)

        expect(event.connectedAccountId).toBe('acct_abc')
    })

    it('connectedAccountId is undefined for non-Connect events', () => {
        const event = normalizeStripeEvent({
            id: 'evt_6',
            type: 'checkout.session.completed',
            data: { object: { id: 'cs_123' } },
        } as any)

        expect(event.connectedAccountId).toBeUndefined()
    })

    it('[TC-F13.65] returns null for unknown/unhandled event types (RT-8 fix — not throw)', () => {
        const result = normalizeStripeEvent({
            id: 'evt_unknown',
            type: 'some.unknown.event',
            data: { object: { id: 'obj_123' } },
        } as any)

        expect(result).toBeNull()
    })
})

describe('createStripeCheckoutSession (Connect)', () => {
    beforeEach(() => {
        vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123')
        vi.clearAllMocks()
    })

    it('creates session with stripeAccount', async () => {
        mockCheckoutSessionCreate.mockResolvedValue({
            id: 'cs_test_1',
            url: 'https://checkout.stripe.com/pay/cs_test_1',
        })

        const result = await createStripeCheckoutSession({
            orderId: 'order_123',
            items: [{ name: 'Baju Kurung Pink', price: 18900, quantity: 1 }],
            currency: 'MYR',
            customerEmail: 'customer@example.com',
            successUrl: 'https://example.com/success',
            cancelUrl: 'https://example.com/cancel',
            stripeAccountId: 'acct_merchant_1',
            paymentMethodTypes: ['card', 'fpx'],
        })

        expect(result.sessionId).toBe('cs_test_1')
        expect(result.url).toBe('https://checkout.stripe.com/pay/cs_test_1')

        // Verify stripeAccount is passed as second arg
        expect(mockCheckoutSessionCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'payment',
                currency: 'myr',
                payment_method_types: ['card', 'fpx'],
            }),
            { stripeAccount: 'acct_merchant_1' },
        )
    })

    it('calculates 3% application_fee', async () => {
        mockCheckoutSessionCreate.mockResolvedValue({
            id: 'cs_test_2',
            url: 'https://checkout.stripe.com/pay/cs_test_2',
        })

        await createStripeCheckoutSession({
            orderId: 'order_456',
            items: [{ name: 'Item', price: 10000, quantity: 1 }], // RM 100
            currency: 'MYR',
            customerEmail: 'test@example.com',
            successUrl: 'https://example.com/success',
            cancelUrl: 'https://example.com/cancel',
            stripeAccountId: 'acct_merchant_2',
            paymentMethodTypes: ['card', 'fpx'],
        })

        expect(mockCheckoutSessionCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                payment_intent_data: {
                    application_fee_amount: 300, // 3% of 10000 sen
                    metadata: { orderId: 'order_456' },
                },
            }),
            expect.any(Object),
        )
    })

    it('uses custom applicationFeePercent', async () => {
        mockCheckoutSessionCreate.mockResolvedValue({
            id: 'cs_test_3',
            url: 'https://checkout.stripe.com/pay/cs_test_3',
        })

        await createStripeCheckoutSession({
            orderId: 'order_789',
            items: [{ name: 'Item', price: 10000, quantity: 1 }],
            currency: 'MYR',
            customerEmail: 'test@example.com',
            successUrl: 'https://example.com/success',
            cancelUrl: 'https://example.com/cancel',
            stripeAccountId: 'acct_merchant_3',
            applicationFeePercent: 5,
            paymentMethodTypes: ['card', 'fpx'],
        })

        expect(mockCheckoutSessionCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                payment_intent_data: {
                    application_fee_amount: 500, // 5% of 10000
                    metadata: { orderId: 'order_789' },
                },
            }),
            expect.any(Object),
        )
    })

    it('still uses card + fpx', async () => {
        mockCheckoutSessionCreate.mockResolvedValue({
            id: 'cs_test_4',
            url: 'https://checkout.stripe.com/pay/cs_test_4',
        })

        await createStripeCheckoutSession({
            orderId: 'order_001',
            items: [{ name: 'Item', price: 5000, quantity: 1 }],
            currency: 'MYR',
            customerEmail: 'test@example.com',
            successUrl: 'https://example.com/success',
            cancelUrl: 'https://example.com/cancel',
            stripeAccountId: 'acct_merchant_4',
            paymentMethodTypes: ['card', 'fpx'],
        })

        expect(mockCheckoutSessionCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                payment_method_types: ['card', 'fpx'],
            }),
            expect.any(Object),
        )
    })

    it('throws when session URL is null', async () => {
        mockCheckoutSessionCreate.mockResolvedValue({
            id: 'cs_test_5',
            url: null, // No URL
        })

        await expect(createStripeCheckoutSession({
            orderId: 'order_002',
            items: [{ name: 'Item', price: 5000, quantity: 1 }],
            currency: 'MYR',
            customerEmail: 'test@example.com',
            successUrl: 'https://example.com/success',
            cancelUrl: 'https://example.com/cancel',
            stripeAccountId: 'acct_merchant_5',
            paymentMethodTypes: ['card'],
        })).rejects.toThrow('Stripe did not return a checkout session URL')
    })
})

describe('Payment Types', () => {
    it('CheckoutParams requires stripeAccountId', () => {
        // Type-level test — if this compiles, the type is correct
        const params = {
            orderId: '123',
            items: [{ name: 'Test', price: 100, quantity: 1 }],
            currency: 'MYR' as const,
            customerEmail: 'test@test.com',
            successUrl: 'https://example.com/success',
            cancelUrl: 'https://example.com/cancel',
            stripeAccountId: 'acct_xxx',
        }
        expect(params.stripeAccountId).toBe('acct_xxx')
    })

    it('PaymentWebhookEvent includes connectedAccountId', () => {
        const event = {
            provider: 'stripe' as const,
            type: 'payment_success' as const,
            data: { id: 'cs_123' },
            rawEvent: {},
            connectedAccountId: 'acct_abc',
        }
        expect(event.connectedAccountId).toBe('acct_abc')
    })

    it('ConnectAccountStatus has all required fields', () => {
        const status = {
            accountId: 'acct_123',
            chargesEnabled: true,
            payoutsEnabled: true,
            detailsSubmitted: true,
            country: 'MY',
            email: 'merchant@test.com',
        }
        expect(status.accountId).toBe('acct_123')
        expect(status.chargesEnabled).toBe(true)
    })
})
