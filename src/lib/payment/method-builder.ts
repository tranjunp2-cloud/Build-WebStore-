import type { StripePaymentMethod } from './types'

interface TenantPaymentFlags {
    payment_card?: boolean
    payment_fpx?: boolean
    payments?: {
        payment_card?: boolean
        payment_fpx?: boolean
    }
}

/**
 * Build Stripe payment_method_types array from tenant master flags.
 * Returns [] when no method is enabled — caller MUST reject with 422 NO_PAYMENT_METHODS.
 *
 * Reads both flat (tenant.payment_card) and nested (tenant.payments.payment_card)
 * shapes — Payload group fields surface as nested object at runtime.
 *
 * Layer 1 of 2 — tenant master gate. Layer 2 = site-level paymentConfig guard (caller).
 */
export function buildPaymentMethodTypes(tenant: TenantPaymentFlags): StripePaymentMethod[] {
    const cardEnabled =
        tenant.payments?.payment_card === true || (tenant as any).payment_card === true
    const fpxEnabled =
        tenant.payments?.payment_fpx === true || (tenant as any).payment_fpx === true

    const methods: StripePaymentMethod[] = []
    if (cardEnabled) methods.push('card')
    if (fpxEnabled) methods.push('fpx')
    return methods
}
