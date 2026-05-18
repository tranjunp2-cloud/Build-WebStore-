import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
// import { getStripeOAuthUrl } from '@/lib/payment/stripe' // STRIPE_CONNECT_DISABLED

/**
 * POST /api/stripe/connect/onboard
 *
 * STRIPE_CONNECT_DISABLED — OAuth Connect flow temporarily disabled.
 * Uncomment the implementation below and re-enable getStripeOAuthUrl import to restore.
 *
 * Original flow: returns Stripe OAuth authorize URL so seller can connect
 * an existing Stripe account. Auth: Required (tenant owner). Body: { tenantId }.
 */
export const POST = withAuth(async (_user, _request) => {
    return NextResponse.json(
        { success: false, error: { code: 'DISABLED', message: 'Stripe Connect is temporarily disabled' } },
        { status: 503 },
    )
})

/* STRIPE_CONNECT_DISABLED — original implementation preserved below
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

        // Verify user owns this tenant (normalize to string — Payload returns integer IDs)
        const userTenantIds = ((user as any).tenants || []).map((t: any) =>
            String(typeof t.tenant === 'object' ? t.tenant.id : t.tenant)
        )
        if (!userTenantIds.includes(String(tenantId))) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: 'You do not own this tenant' } },
                { status: 403 },
            )
        }

        const oauthUrl = getStripeOAuthUrl(String(tenantId))

        return NextResponse.json({
            success: true,
            data: { oauthUrl },
        })
    } catch (error: any) {
        console.error('[Stripe Connect Onboard Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Stripe onboarding failed' } },
            { status: 500 },
        )
    }
})
*/
