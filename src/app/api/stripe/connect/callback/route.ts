import { NextResponse } from 'next/server'

/**
 * GET /api/stripe/connect/callback
 *
 * STRIPE_CONNECT_DISABLED — OAuth Connect flow temporarily disabled.
 * Uncomment the implementation below to restore the OAuth callback handler.
 */
export async function GET() {
    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
    return NextResponse.redirect(`${baseUrl}/dashboard/settings/payments?stripe=refresh`)
}

/* STRIPE_CONNECT_DISABLED — original implementation preserved below
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { exchangeOAuthCode } from '@/lib/payment/stripe'

export async function GET(request: Request) {
    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
    const refreshUrl = `${baseUrl}/dashboard/settings/payments?stripe=refresh`
    const successUrl = `${baseUrl}/dashboard/settings/payments?stripe=complete`

    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const errorParam = url.searchParams.get('error')

    // Seller denied consent or Stripe error
    if (errorParam) {
        console.warn('[Stripe OAuth Callback] error from Stripe:', errorParam)
        return NextResponse.redirect(refreshUrl)
    }

    // Missing code or state
    if (!code || !state) {
        console.warn('[Stripe OAuth Callback] missing code or state')
        return NextResponse.redirect(refreshUrl)
    }

    // Validate state is a plausible Payload integer tenant ID
    if (!/^\d+$/.test(state)) {
        return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid state' } },
            { status: 400 },
        )
    }

    try {
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } },
                { status: 401 },
            )
        }

        // IDOR guard — user must own this tenant
        const userTenantIds = ((user as any).tenants || []).map((t: any) =>
            String(typeof t.tenant === 'object' ? t.tenant.id : t.tenant)
        )
        if (!userTenantIds.includes(state)) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: 'You do not own this tenant' } },
                { status: 403 },
            )
        }

        const payload = await getPayload({ config })
        const tenant = await payload.findByID({ collection: 'tenants', id: state })
        if (!tenant) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
                { status: 404 },
            )
        }

        const { stripeUserId } = await exchangeOAuthCode(code)

        await payload.update({
            collection: 'tenants',
            id: state,
            data: {
                stripeAccountId: stripeUserId,
                stripeOnboardingComplete: false,
            } as any,
        })

        return NextResponse.redirect(successUrl)
    } catch (error: any) {
        console.error('[Stripe OAuth Callback Error]', error)
        return NextResponse.redirect(refreshUrl)
    }
}
*/
