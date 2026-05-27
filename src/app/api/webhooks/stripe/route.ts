import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { verifyStripeWebhook, normalizeStripeEvent } from '@/lib/payment/stripe'
import { handleCheckoutCompleted } from './handlers/checkout-completed'
import { handlePaymentFailed } from './handlers/payment-failed'
import { handleSubscriptionUpdated } from './handlers/subscription-updated'
import { handleAccountUpdated, handleAccountDeauthorized } from './handlers/account-updated'
import { handleChargeRefunded } from './handlers/charge-refunded'
import type { PaymentWebhookEvent } from '@/lib/payment/types'

/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events:
 * - checkout.session.completed → Create order (paid) + reduce stock
 * - payment_intent.payment_failed → Update order status
 * - customer.subscription.updated → Update subscription
 * - account.updated → Update merchant onboarding status
 *
 * Also handles Stripe Connect events (account.updated).
 */
export async function POST(request: NextRequest) {
    let rawBody: string

    try {
        rawBody = await request.text()
    } catch {
        return new Response('Invalid body', { status: 400 })
    }

    const signature = request.headers.get('stripe-signature')
    if (!signature) {
        return new Response('Missing stripe-signature header', { status: 400 })
    }

    // Determine if this is a Connect webhook (has 'account' field in the event)
    let isConnect = false
    try {
        const parsed = JSON.parse(rawBody)
        isConnect = Boolean(parsed.account)
    } catch {
        // Will fail at verification step anyway
    }

    // Verify webhook signature
    let event: PaymentWebhookEvent
    try {
        const stripeEvent = verifyStripeWebhook(rawBody, signature, isConnect)
        const normalized = normalizeStripeEvent(stripeEvent)
        if (!normalized) {
            // Unknown event type — not subscribed, return 200 so Stripe won't retry
            console.log(`[Stripe Webhook] Ignoring unhandled event type: ${stripeEvent.type}`)
            return new Response('OK', { status: 200 })
        }
        event = normalized
    } catch (err: unknown) {
        console.error('[Stripe Webhook] Signature verification failed:', err instanceof Error ? err.message : err)
        return new Response('Webhook signature verification failed', { status: 400 })
    }

    // Process the event
    try {
        const payload = await getPayload({ config })

        switch (event.type) {
            case 'payment_success':
                await handleCheckoutCompleted(payload, event)
                break

            case 'payment_failed':
                await handlePaymentFailed(payload, event)
                break

            case 'subscription_updated':
                await handleSubscriptionUpdated(payload, event)
                break

            case 'account_updated':
                await handleAccountUpdated(payload, event)
                break

            case 'account_deauthorized':
                await handleAccountDeauthorized(payload, event)
                break

            case 'refund_completed':
                await handleChargeRefunded(payload, event)
                break

            default:
                console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
        }
    } catch (err: unknown) {
        console.error(`[Stripe Webhook] Error processing ${event.type}:`, err instanceof Error ? err.message : err)
        // Still return 200 to prevent Stripe from retrying
    }

    return new Response('OK', { status: 200 })
}
