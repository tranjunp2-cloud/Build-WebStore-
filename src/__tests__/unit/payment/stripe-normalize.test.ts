import { describe, it, expect, vi } from 'vitest'

// Mock Stripe SDK before importing normalizeStripeEvent
vi.mock('stripe', () => ({
    default: vi.fn().mockImplementation(() => ({
        checkout: { sessions: { create: vi.fn() } },
        accounts: { create: vi.fn(), retrieve: vi.fn() },
        accountLinks: { create: vi.fn() },
        webhooks: { constructEvent: vi.fn() },
    })),
}))

import { normalizeStripeEvent } from '@/lib/payment/stripe'

// ─── TC-F13.65: normalizeStripeEvent ─────────────────────────────────────────

describe('normalizeStripeEvent [TC-F13.65]', () => {

    function makeEvent(type: string, data: Record<string, unknown> = {}, account?: string) {
        return {
            type,
            data: { object: data },
            account,
        } as any
    }

    // TC-F13.65: success event maps correctly
    it('[TC-F13.65] checkout.session.completed → payment_success', () => {
        const event = makeEvent('checkout.session.completed', { id: 'sess_1' })

        const result = normalizeStripeEvent(event)

        expect(result).not.toBeNull()
        expect(result!.type).toBe('payment_success')
        expect(result!.provider).toBe('stripe')
        expect(result!.data).toEqual({ id: 'sess_1' })
        expect(result!.rawEvent).toBe(event)
    })

    // TC-F13.65: failure event maps correctly
    it('[TC-F13.65] payment_intent.payment_failed → payment_failed', () => {
        const event = makeEvent('payment_intent.payment_failed', { id: 'pi_1' })

        const result = normalizeStripeEvent(event)

        expect(result).not.toBeNull()
        expect(result!.type).toBe('payment_failed')
    })

    // TC-F13.65: account.updated maps correctly
    it('[TC-F13.65] account.updated → account_updated', () => {
        const event = makeEvent('account.updated', { id: 'acct_1', charges_enabled: true }, 'acct_1')

        const result = normalizeStripeEvent(event)

        expect(result).not.toBeNull()
        expect(result!.type).toBe('account_updated')
        expect(result!.connectedAccountId).toBe('acct_1')
    })

    // TC-F13.65: subscription.updated maps correctly
    it('[TC-F13.65] customer.subscription.updated → subscription_updated', () => {
        const event = makeEvent('customer.subscription.updated', { id: 'sub_1', status: 'active' })

        const result = normalizeStripeEvent(event)

        expect(result).not.toBeNull()
        expect(result!.type).toBe('subscription_updated')
    })

    // TC-F13.65: account.application.deauthorized maps correctly
    it('[TC-F13.65] account.application.deauthorized → account_deauthorized', () => {
        const event = makeEvent('account.application.deauthorized', { id: 'acct_revoked' }, 'acct_revoked')

        const result = normalizeStripeEvent(event)

        expect(result).not.toBeNull()
        expect(result!.type).toBe('account_deauthorized')
    })

    // TC-F13.65: unknown event → null (caller must return 200 to prevent Stripe retries)
    it('[TC-F13.65] unknown event type → returns null (not throw)', () => {
        const event = makeEvent('invoice.created', { id: 'inv_1' })

        const result = normalizeStripeEvent(event)

        expect(result).toBeNull()
    })

    it('[TC-F13.65] charge.dispute.created → returns null (deferred Wave 7+)', () => {
        const result = normalizeStripeEvent(makeEvent('charge.dispute.created', {}))
        expect(result).toBeNull()
    })

    it('[TC-F13.65] checkout.session.expired → returns null (caller acks 200)', () => {
        const result = normalizeStripeEvent(makeEvent('checkout.session.expired', {}))
        expect(result).toBeNull()
    })

    it('[TC-F13.65] payment_intent.processing → returns null (FPX async pending)', () => {
        const result = normalizeStripeEvent(makeEvent('payment_intent.processing', {}))
        expect(result).toBeNull()
    })

    // TC-F13.122: Connect account country=MY hardcoded (static guard)
    // (normalizeStripeEvent itself does not control country; tested via createConnectedAccount)

    // TC-F13.141: Stripe SDK default tolerance 300s (constructEvent is the validator)
    // (tolerance is in verifyStripeWebhook; normalizeStripeEvent works on already-verified events)
})
