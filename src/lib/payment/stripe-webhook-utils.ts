import Stripe from 'stripe'
import { getStripeClient } from './stripe-client'
import type { PaymentWebhookEvent, PaymentEventType } from './types'

/**
 * Verify a Stripe webhook signature and return the event.
 */
export function verifyStripeWebhook(
    body: string,
    signature: string,
    isConnectWebhook = false,
): Stripe.Event {
    const stripe = getStripeClient()

    const secret = isConnectWebhook
        ? (process.env.STRIPE_CONNECT_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET)
        : process.env.STRIPE_WEBHOOK_SECRET

    if (!secret) {
        throw new Error(
            isConnectWebhook
                ? 'STRIPE_CONNECT_WEBHOOK_SECRET (or STRIPE_WEBHOOK_SECRET fallback) is not set'
                : 'STRIPE_WEBHOOK_SECRET is not set',
        )
    }

    return stripe.webhooks.constructEvent(body, signature, secret)
}

/**
 * Normalize a Stripe event into our unified PaymentWebhookEvent format.
 * Returns null for event types we don't handle — caller should return 200 to prevent retries.
 */
export function normalizeStripeEvent(
    event: Stripe.Event,
): PaymentWebhookEvent | null {
    const typeMap: Record<string, PaymentEventType> = {
        'checkout.session.completed': 'payment_success',
        'payment_intent.payment_failed': 'payment_failed',
        'customer.subscription.updated': 'subscription_updated',
        'account.updated': 'account_updated',
        'account.application.deauthorized': 'account_deauthorized',
        'charge.refunded': 'refund_completed',
    }

    const normalizedType = typeMap[event.type]

    if (!normalizedType) {
        return null
    }

    return {
        provider: 'stripe',
        type: normalizedType,
        data: event.data.object as unknown as Record<string, unknown>,
        rawEvent: event,
        connectedAccountId: (event as Stripe.Event & { account?: string }).account ?? undefined,
    }
}
