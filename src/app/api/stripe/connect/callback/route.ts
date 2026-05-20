import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { exchangeOAuthCode, getConnectedAccountStatus, verifyOAuthState } from '@/lib/payment/stripe'

/**
 * GET /api/stripe/connect/callback?code=xxx&state=tenantId
 *
 * Stripe OAuth callback — exchanges authorization code for stripe_user_id,
 * auto-detects if account is already verified, saves status to tenant,
 * then redirects: ?stripe=verified (already verified) or ?stripe=complete (pending Verify click).
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

        // Auto-detect if connected account is already fully verified (existing Stripe account).
        // Non-fatal: if this fails, merchant can always click Verify manually.
        let onboardingComplete = false
        try {
            const status = await getConnectedAccountStatus(stripeUserId)
            onboardingComplete = status.chargesEnabled && status.detailsSubmitted
        } catch {
            // non-fatal — falls back to manual Verify flow
        }

        const payload = await getPayload({ config })
        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: {
                stripeAccountId: stripeUserId,
                stripeOnboardingComplete: onboardingComplete,
            } as any,
        })

        const redirectParam = onboardingComplete ? 'verified' : 'complete'
        return NextResponse.redirect(`${paymentsUrl}?stripe=${redirectParam}`)
    } catch (err) {
        console.error('[Stripe OAuth Callback Error]', err)
        return NextResponse.redirect(`${paymentsUrl}?stripe=refresh`)
    }
}
