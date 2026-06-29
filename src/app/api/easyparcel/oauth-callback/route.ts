import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { exchangeCodeForToken } from '@/lib/shipping/easyparcel/token-manager'
import { getAccountInfo } from '@/lib/shipping/easyparcel/client'
import { mapSubdivisionName } from '@/lib/shipping/easyparcel/normalize'

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
        const now = Date.now()

        // Best-effort: fetch the connected account's identity + default pickup address. Non-critical —
        // never block the connection if this call fails or returns empty.
        let accountName: string | undefined
        let accountEmail: string | undefined
        let seededWarehouse: Record<string, string> | undefined
        try {
            const info = await getAccountInfo(tokens.access_token)
            accountName = info.data?.account?.name?.trim() || undefined
            accountEmail = info.data?.address?.pickup_address?.email?.trim() || undefined

            // Seed warehouse (sender) from EP's default pickup address — ONLY if the tenant has no
            // warehouse yet, so we never clobber a merchant's local edits. EP address is read-only on
            // their side, so this is a one-time prefill the merchant can then override locally.
            const existingWh = (tenant as any)?.easyParcelIntegration?.warehouse ?? {}
            const hasLocalWarehouse = !!(existingWh.name || existingWh.address1 || existingWh.postcode)
            const pa = info.data?.address?.pickup_address
            if (!hasLocalWarehouse && pa && (pa.name || pa.address1 || pa.postcode)) {
                seededWarehouse = {
                    name: pa.name?.trim() || '',
                    phone: pa.phone_number?.trim() || '',
                    address1: pa.address1?.trim() || '',
                    address2: pa.address2?.trim() || '',
                    city: pa.city?.trim() || '',
                    state: pa.province_code ? mapSubdivisionName(pa.province_code.trim()) : '',
                    postcode: pa.postcode?.trim() || '',
                    country: 'MY',
                }
            }
        } catch { /* non-critical — proceed without account identity / warehouse seed */ }

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
                    accountName: accountName ?? null,
                    accountEmail: accountEmail ?? null,
                    ...(seededWarehouse ? { warehouse: seededWarehouse } : {}),
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
