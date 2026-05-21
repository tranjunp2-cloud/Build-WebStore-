import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { getStripeClient } from '@/lib/payment/stripe'

/**
 * POST /api/stripe/connect/account-link
 *
 * Creates a Stripe-hosted Account Link so the seller can complete business onboarding
 * (KYC, bank account, business details) for their connected account.
 * Required after OAuth when chargesEnabled is still false.
 *
 * Auth: Required (tenant owner). Body: { tenantId }.
 */
export const POST = withAuth(async (user, request) => {
    try {
        const body = await request.json()
        const { tenantId } = body

        if (!tenantId) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'tenantId is required' } },
                { status: 422 },
            )
        }

        const userTenantIds = ((user as any).tenants || []).map((t: any) =>
            String(typeof t.tenant === 'object' ? t.tenant.id : t.tenant)
        )
        if (!userTenantIds.includes(String(tenantId))) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: 'You do not own this tenant' } },
                { status: 403 },
            )
        }

        const payload = await getPayload({ config })
        const tenant = await payload.findByID({ collection: 'tenants', id: tenantId })
        if (!tenant) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
                { status: 404 },
            )
        }

        const stripeAccountId = (tenant as any).stripeAccountId
        if (!stripeAccountId) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'No Stripe account connected. Complete OAuth first.' } },
                { status: 422 },
            )
        }

        const stripe = getStripeClient()
        const origin = new URL(request.url).origin
        const accountLink = await stripe.accountLinks.create({
            account: stripeAccountId,
            type: 'account_onboarding',
            return_url: `${origin}/settings/payments?stripe=verified`,
            refresh_url: `${origin}/settings/payments?stripe=refresh`,
        })

        return NextResponse.json({
            success: true,
            data: { url: accountLink.url },
        })
    } catch (error: any) {
        console.error('[Stripe Account Link Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create Stripe onboarding link' } },
            { status: 500 },
        )
    }
})
