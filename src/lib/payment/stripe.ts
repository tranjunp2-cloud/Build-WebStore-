/**
 * Stripe Client + Connect Helpers
 *
 * Uses Direct Charges model:
 * - Payment goes directly to merchant's connected Stripe account
 * - No platform fee — merchant pays Stripe's standard processing fees
 */
import Stripe from 'stripe'
import { createHmac, timingSafeEqual } from 'crypto'
import type {
    CheckoutParams,
    CheckoutResult,
    ConnectAccountStatus,
    PaymentWebhookEvent,
    PaymentEventType,
} from './types'

// ── Singleton ────────────────────────────────────────────────────────

let stripeInstance: Stripe | null = null

export function getStripeClient(): Stripe {
    if (stripeInstance) return stripeInstance

    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set')

    stripeInstance = new Stripe(key, {
        typescript: true,
    })

    return stripeInstance
}

// ── Connect Account Management ───────────────────────────────────────

// ── OAuth State Signing ──────────────────────────────────────────────

function computeStateHmac(tenantId: string, secret: string): string {
    return createHmac('sha256', secret).update(tenantId).digest('hex')
}

/**
 * Produce a tamper-proof `state` param for Stripe OAuth.
 * Format: `{tenantId}_{hmac}` signed with STRIPE_SECRET_KEY.
 * Prevents an attacker from forging `state=victim_tenantId` in the callback.
 */
export function signOAuthState(tenantId: string): string {
    const secret = process.env.STRIPE_SECRET_KEY
    if (!secret) throw new Error('STRIPE_SECRET_KEY is not set')
    const hmac = computeStateHmac(tenantId, secret)
    return `${tenantId}_${hmac}`
}

/**
 * Verify the signed OAuth state and return the tenantId, or null if tampered.
 */
export function verifyOAuthState(state: string): string | null {
    const secret = process.env.STRIPE_SECRET_KEY
    if (!secret) return null
    const sepIdx = state.lastIndexOf('_')
    if (sepIdx === -1) return null
    const tenantId = state.substring(0, sepIdx)
    const providedHmac = state.substring(sepIdx + 1)
    const expected = computeStateHmac(tenantId, secret)
    try {
        const a = Buffer.from(providedHmac, 'hex')
        const b = Buffer.from(expected, 'hex')
        if (a.length !== b.length) return null
        return timingSafeEqual(a, b) ? tenantId : null
    } catch {
        return null
    }
}

export function getStripeOAuthUrl(tenantId: string): string {
    const clientId = process.env.STRIPE_CLIENT_ID
    if (!clientId) throw new Error('STRIPE_CLIENT_ID is not set')

    const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        scope: 'read_write',
        state: signOAuthState(tenantId),
        prompt: 'login',
    })

    return `https://connect.stripe.com/oauth/authorize?${params.toString()}`
}

export async function exchangeOAuthCode(
    code: string,
): Promise<{ stripeUserId: string }> {
    const stripe = getStripeClient()
    const response = await stripe.oauth.token({
        grant_type: 'authorization_code',
        code,
    })

    if (!response.stripe_user_id) {
        throw new Error('Stripe OAuth response missing stripe_user_id')
    }

    return { stripeUserId: response.stripe_user_id }
}

export async function deauthorizeStripeAccount(accountId: string): Promise<void> {
    const stripe = getStripeClient()
    const clientId = process.env.STRIPE_CLIENT_ID
    if (!clientId) throw new Error('STRIPE_CLIENT_ID is not set')

    await stripe.oauth.deauthorize({
        client_id: clientId,
        stripe_user_id: accountId,
    })
}

/**
 * Get the onboarding/verification status of a connected account.
 */
export async function getConnectedAccountStatus(
    accountId: string,
): Promise<ConnectAccountStatus> {
    const stripe = getStripeClient()

    const account = await stripe.accounts.retrieve(accountId)

    return {
        accountId: account.id,
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
        detailsSubmitted: account.details_submitted ?? false,
        country: account.country ?? null,
        email: account.email ?? null,
    }
}

// ── Direct Charges Checkout ──────────────────────────────────────────

/**
 * Create a Stripe Checkout Session on the merchant's connected account.
 * Direct Charges: payment goes directly to merchant, no platform fee.
 */
export async function createStripeCheckoutSession(
    params: CheckoutParams,
): Promise<CheckoutResult> {
    if (!params.paymentMethodTypes || params.paymentMethodTypes.length === 0) {
        throw new Error('paymentMethodTypes must contain at least one method')
    }

    const stripe = getStripeClient()

    const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData = {
        metadata: {
            orderId: params.orderId,
            ...(params.metadata ?? {}),
        },
    }

    // Direct Charges: payment goes directly to merchant's connected account (required).
    const requestOptions: Stripe.RequestOptions = {
        stripeAccount: params.stripeAccountId,
    }

    const session = await stripe.checkout.sessions.create(
        {
            mode: 'payment',
            currency: params.currency.toLowerCase(),
            payment_method_types: params.paymentMethodTypes,
            line_items: params.items.map((item) => ({
                price_data: {
                    currency: params.currency.toLowerCase(),
                    product_data: {
                        name: item.name,
                        ...(item.images?.length ? { images: item.images } : {}),
                    },
                    unit_amount: item.price,
                },
                quantity: item.quantity,
            })),
            client_reference_id: params.orderId,
            customer_email: params.customerEmail,
            metadata: params.metadata ?? {},
            success_url: params.successUrl,
            cancel_url: params.cancelUrl,
            payment_intent_data: paymentIntentData,
        },
        requestOptions,
    )

    if (!session.url) {
        throw new Error('Stripe did not return a checkout session URL')
    }

    return {
        sessionId: session.id,
        url: session.url,
    }
}

// ── Webhook Verification ─────────────────────────────────────────────

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

// ── Event Normalization ──────────────────────────────────────────────

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
        data: event.data.object as Record<string, any>,
        rawEvent: event,
        connectedAccountId: (event as any).account ?? undefined,
    }
}
