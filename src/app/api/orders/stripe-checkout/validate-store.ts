import { NextResponse } from 'next/server'
import type { Payload } from 'payload'
import { buildPaymentMethodTypes } from '@/lib/payment/method-builder'

/** Minimal shape of a tenant document used in stripe-checkout flow. */
export interface TenantDoc {
    id: string | number
    stripeAccountId?: string | null
    stripeOnboardingComplete?: boolean
    status?: string
    slug?: string
    payments?: { payment_card?: boolean; payment_fpx?: boolean }
}

/** Minimal shape of a site document used in stripe-checkout flow. */
export interface SiteDoc {
    id: string | number
    tenant: string | number | { id: string | number }
    paymentConfig?: { cardEnabled?: boolean; fpxEnabled?: boolean }
}

/** Shape of the validated request body from stripeCheckoutSchema. */
export interface CheckoutBody {
    siteId: string | number
    items: unknown[]
    customer: {
        email: string
        name: string
        phone?: string
        address?: {
            line1?: string
            line2?: string
            city?: string
            state?: string
            postcode?: string
            country?: string
        }
    }
    paymentMethod?: string
}

export type ValidateStoreSuccess = {
    site: Awaited<ReturnType<Payload['findByID']>>
    tenant: Awaited<ReturnType<Payload['findByID']>>
    tenantTyped: TenantDoc
    siteTyped: SiteDoc
    stripeAccountId: string
    paymentMethodTypes: string[]
}

export type ValidateStoreResult =
    | { ok: true; value: ValidateStoreSuccess }
    | { ok: false; response: NextResponse }

/**
 * Steps 1–5 of the 6-step stripe-checkout validation chain:
 *   1. Resolve site by siteId
 *   2. Resolve tenant from site.tenant
 *   3. Validate tenant not suspended
 *   4. Validate stripeAccountId + stripeOnboardingComplete
 *   5. Build + filter payment method types (tenant gate + site-level guard)
 *
 * Returns either a success value or a NextResponse error to return immediately.
 */
export async function validateStore(
    payload: Payload,
    siteId: string | number,
): Promise<ValidateStoreResult> {
    const siteIdNum =
        typeof siteId === 'string' && !isNaN(Number(siteId)) ? Number(siteId) : siteId

    // Step 1: Resolve site
    const site = await payload.findByID({
        collection: 'sites',
        id: siteIdNum,
        depth: 0,
        overrideAccess: true,
    })
    if (!site) {
        return {
            ok: false,
            response: NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Site not found' } },
                { status: 404 },
            ),
        }
    }

    const siteTyped = site as unknown as SiteDoc

    // Step 2: Resolve tenant
    const tenantId =
        typeof siteTyped.tenant === 'object'
            ? siteTyped.tenant?.id
            : siteTyped.tenant
    const tenant = await payload.findByID({
        collection: 'tenants',
        id: tenantId,
        depth: 0,
        overrideAccess: true,
    })
    if (!tenant) {
        return {
            ok: false,
            response: NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                { status: 404 },
            ),
        }
    }

    const tenantTyped = tenant as unknown as TenantDoc

    // TC-F13.88: suspended tenant cannot accept payments
    if (tenantTyped.status === 'suspended') {
        return {
            ok: false,
            response: NextResponse.json(
                { success: false, error: { code: 'STORE_UNAVAILABLE', message: 'Store is not available' } },
                { status: 403 },
            ),
        }
    }

    // Step 3: Stripe-ready check
    const stripeAccountId = tenantTyped.stripeAccountId
    const onboardingComplete = tenantTyped.stripeOnboardingComplete === true
    if (!stripeAccountId) {
        return {
            ok: false,
            response: NextResponse.json(
                { success: false, error: { code: 'STRIPE_NOT_CONNECTED', message: 'Seller has not connected Stripe yet' } },
                { status: 422 },
            ),
        }
    }
    if (!onboardingComplete) {
        return {
            ok: false,
            response: NextResponse.json(
                { success: false, error: { code: 'STRIPE_NOT_READY', message: 'Payment temporarily unavailable' } },
                { status: 422 },
            ),
        }
    }

    // Step 4: Tenant master gate — build enabled methods from tenant flags
    let types = buildPaymentMethodTypes(tenantTyped)
    if (types.length === 0) {
        return {
            ok: false,
            response: NextResponse.json(
                { success: false, error: { code: 'NO_PAYMENT_METHODS', message: 'Seller has not enabled Card or FPX' } },
                { status: 422 },
            ),
        }
    }

    // Step 5: Site-level layer-2 guard
    const paymentConfig = siteTyped.paymentConfig ?? {}
    if (paymentConfig.cardEnabled === false) types = types.filter(t => t !== 'card')
    if (paymentConfig.fpxEnabled === false) types = types.filter(t => t !== 'fpx')
    if (types.length === 0) {
        return {
            ok: false,
            response: NextResponse.json(
                { success: false, error: { code: 'METHOD_DISABLED', message: 'No payment method is enabled for this site' } },
                { status: 422 },
            ),
        }
    }

    return {
        ok: true,
        value: { site, tenant, tenantTyped, siteTyped, stripeAccountId, paymentMethodTypes: types },
    }
}
