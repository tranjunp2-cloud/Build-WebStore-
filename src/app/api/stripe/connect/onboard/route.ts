import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { getStripeOAuthUrl } from '@/lib/payment/stripe'

/**
 * POST /api/stripe/connect/onboard
 *
 * Returns Stripe OAuth authorize URL so merchant can connect their Stripe account
 * (login with existing or create new). Auth: Required (tenant owner). Body: { tenantId }.
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
