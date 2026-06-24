import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { exchangeCodeForToken } from '@/lib/shipping/easyparcel/token-manager'
import { walletBalance } from '@/lib/shipping/easyparcel/client'

export const dynamic = 'force-dynamic'

/**
 * GET /api/easyparcel/oauth-callback
 *
 * Public route — EP redirects here after merchant authorizes. Security via state=tenantId + code single-use.
 * Never logs or returns token values. Redirects only.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl
    const code = searchParams.get('code')
    const rawState = searchParams.get('state') ?? ''

    // state = "${tenantId}:{nonce}" — split on last colon to support numeric/UUID tenant IDs
    const colonIdx = rawState.lastIndexOf(':')
    const tenantId = colonIdx > 0 ? rawState.slice(0, colonIdx) : ''
    const nonce = colonIdx > 0 ? rawState.slice(colonIdx + 1) : ''

    const makeErrorRedirect = () => {
        const r = NextResponse.redirect(new URL('/settings/shipping?ep=error', request.nextUrl.origin))
        if (tenantId) r.cookies.delete(`ep_state_${tenantId}`)
        return r
    }

    if (!code || !tenantId || !nonce) return makeErrorRedirect()

    // Verify CSRF nonce from HttpOnly cookie set in oauth-start
    const expectedNonce = request.cookies.get(`ep_state_${tenantId}`)?.value
    if (!expectedNonce || nonce !== expectedNonce) return makeErrorRedirect()

    try {
        const payload = await getPayload({ config })

        // Verify tenant exists before storing tokens
        const tenant = await payload
            .findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true })
            .catch(() => null)
        if (!tenant) return makeErrorRedirect()

        const tokens = await exchangeCodeForToken(code)
        // Debug: log all token response fields except the actual tokens
        const { access_token: _a, refresh_token: _r, ...tokenMeta } = tokens as any
        console.log('[EP OAuth Callback] Token response metadata:', JSON.stringify(tokenMeta))
        const now = Date.now()

        // Best-effort: fetch account identifier for display in settings UI
        let accountName: string | undefined
        try {
            const wallet = await walletBalance(tokens.access_token)
            if (wallet.data?.account_id) {
                accountName = `EP #${wallet.data.account_id} · ${wallet.data.currency_code}`
            }
        } catch { /* non-critical — proceed without account name */ }

        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: {
                easyParcelIntegration: {
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token,
                    tokenExpiresAt: new Date(now + tokens.expires_in * 1000).toISOString(),
                    tokenRefreshExpiresAt: new Date(now + tokens.refresh_token_expires_in * 1000).toISOString(),
                    enabled: true,
                    testedAt: new Date().toISOString(),
                    ...(accountName ? { accountName } : {}),
                },
            } as any,
            overrideAccess: true,
        })

        const successRedirect = NextResponse.redirect(new URL('/settings/shipping?ep=connected', request.nextUrl.origin))
        successRedirect.cookies.delete(`ep_state_${tenantId}`)
        return successRedirect
    } catch {
        return makeErrorRedirect()
    }
}
