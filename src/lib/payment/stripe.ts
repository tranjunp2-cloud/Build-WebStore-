/**
 * Stripe Client + Connect Helpers
 *
 * Uses Direct Charges model:
 * - Payment goes directly to merchant's connected account
 * - PrimeWeb collects application_fee_amount (3%)
 * - Merchant sees payment in their own Stripe Dashboard
 */
import Stripe from 'stripe'
import type {
    CheckoutParams,
    CheckoutResult,
    ConnectAccountStatus,
    ConnectOnboardResult,
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

/**
 * Create a Standard connected account for a merchant.
 * Standard accounts: Stripe handles onboarding UI, merchant manages their own dashboard.
 */
export async function createConnectedAccount(
    email: string,
    businessName: string,
    idempotencyKey?: string,
): Promise<string> {
    const stripe = getStripeClient()

    const account = idempotencyKey
        ? await stripe.accounts.create(
              { type: 'standard', email, country: 'MY', business_profile: { name: businessName } },
              { idempotencyKey },
          )
        : await stripe.accounts.create({
              type: 'standard', email, country: 'MY', business_profile: { name: businessName },
          })

    return account.id
}

/**
 * Create an Account Link for Stripe-hosted onboarding.
 * Merchant clicks this URL to complete KYC + bank details.
 */
export async function createAccountLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string,
): Promise<string> {
    const stripe = getStripeClient()

    const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
    })

    return link.url
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
 * Uses Direct Charges: payment goes to merchant, PrimeWeb takes application_fee.
 */
export async function createStripeCheckoutSession(
    params: CheckoutParams,
): Promise<CheckoutResult> {
    const stripe = getStripeClient()

    if (!params.paymentMethodTypes || params.paymentMethodTypes.length === 0) {
        throw new Error('paymentMethodTypes must contain at least one method')
    }

    const totalAmount = params.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
    )
    // Use explicit cents override if provided, else compute from percent (default 3%).
    // Route passes applicationFeeAmountCents=0 for US→MY cross-border (Stripe restriction).
    const applicationFeeAmount =
        params.applicationFeeAmountCents !== undefined
            ? params.applicationFeeAmountCents
            : Math.round(totalAmount * (params.applicationFeePercent ?? 3) / 100)

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
            payment_intent_data: {
                application_fee_amount: applicationFeeAmount,
                metadata: {
                    orderId: params.orderId,
                    ...(params.metadata ?? {}),
                },
            },
        },
        {
            stripeAccount: params.stripeAccountId,
        },
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
