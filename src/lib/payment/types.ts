/**
 * Payment Provider Types — Adapter Pattern
 *
 * Abstract interfaces for multi-provider payment support.
 * Currently: Stripe Connect (Direct Charges).
 * Future: iPay88, Revenue Monster, ToyyibPay.
 */

// ── Checkout ─────────────────────────────────────────────────────────

export type StripePaymentMethod = 'card' | 'fpx'

export interface CheckoutParams {
    orderId: string
    items: Array<{
        name: string
        price: number // in smallest currency unit (sen for MYR)
        quantity: number
        images?: string[]
    }>
    currency: 'MYR' | 'USD' | 'SGD'
    customerEmail: string
    successUrl: string
    cancelUrl: string
    metadata?: Record<string, string>
    /** Stripe Connected Account ID (required for Direct Charges) */
    stripeAccountId: string
    /** Platform fee percentage (default: 3%) */
    applicationFeePercent?: number
    /** Override fee in cents — when set, applicationFeePercent is ignored.
     *  Use when items includes non-product line items (shipping, tax) to charge fee on product subtotal only. */
    applicationFeeAmountCents?: number
    /** Stripe payment methods enabled for this checkout. MUST be non-empty.
     *  Built by backend from tenant.payment_card/fpx filtered by site.paymentConfig. */
    paymentMethodTypes: StripePaymentMethod[]
}

export interface CheckoutResult {
    sessionId: string
    url: string
}

// ── Webhook Events ───────────────────────────────────────────────────

export type PaymentEventType =
    | 'payment_success'
    | 'payment_failed'
    | 'subscription_updated'
    | 'account_updated'
    | 'account_deauthorized'
    | 'refund_completed'

export interface PaymentWebhookEvent {
    provider: 'stripe' | 'ipay88' | 'revenue_monster' | 'toyyibpay'
    type: PaymentEventType
    data: Record<string, any>
    rawEvent: any
    /** Connected Account ID (Stripe Connect) */
    connectedAccountId?: string
}

// ── Stripe Connect ───────────────────────────────────────────────────

export interface ConnectAccountStatus {
    accountId: string
    chargesEnabled: boolean
    payoutsEnabled: boolean
    detailsSubmitted: boolean
    country: string | null
    email: string | null
}

export interface ConnectOnboardResult {
    accountId: string
    accountLinkUrl: string
}

// ── Payment Provider Interface (for future multi-provider) ───────────

export interface PaymentProvider {
    name: string
    createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult>
    verifyWebhook(request: Request): Promise<PaymentWebhookEvent>
    refund?(paymentId: string, amount?: number): Promise<{ refundId: string }>
}
