import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { exchangeOAuthCode, verifyOAuthState } from '@/lib/payment/stripe'

/**
 * GET /api/stripe/connect/callback?code=xxx&state=tenantId
 *
 * Stripe OAuth callback — exchanges authorization code for stripe_user_id,
 * saves account ID with onboarding reset, then redirects to ?stripe=complete
 * so user must complete the account-link info form.
 */
export async function GET(request: Request) {
    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
    const paymentsUrl = `${baseUrl}/settings/payments`

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const rawState = searchParams.get('state')
    const error = searchParams.get('error')

    // Verify HMAC-signed state to prevent OAuth callback account hijacking
    const tenantId = rawState ? verifyOAuthState(rawState) : null

    if (error || !code || !tenantId) {
        console.error('[Stripe OAuth Callback] Missing params, error, or invalid state:', { error, code: !!code, tenantId: !!tenantId })
        return NextResponse.redirect(`${paymentsUrl}?stripe=refresh`)
    }

    try {
        const { stripeUserId } = await exchangeOAuthCode(code)

        // Always reset onboarding state on (re)connect — forces user through the
        // account-link info form even if they previously had a verified account.
        const payload = await getPayload({ config })
        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: {
                stripeAccountId: stripeUserId,
                stripeOnboardingComplete: false,
            } as Record<string, unknown>,
        })

        return NextResponse.redirect(`${paymentsUrl}?stripe=complete`)
    } catch (err) {
        console.error('[Stripe OAuth Callback Error]', err)
        return NextResponse.redirect(`${paymentsUrl}?stripe=refresh`)
    }
}
