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
        const r = NextResponse.redirect(new URL('/settings/shipping?tab=easyparcel&ep=error', request.nextUrl.origin))
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

        // Best-effort: fetch the connected account's identity and initial pickup address.
        // Never block the connection if EasyParcel returns incomplete account information.
        let accountName: string | undefined
        let accountEmail: string | undefined
        let connectedWarehouses: Record<string, unknown>[] | undefined
        try {
            const info = await getAccountInfo(tokens.access_token)
            accountName = info.data?.account?.name?.trim() || undefined
            accountEmail = info.data?.address?.pickup_address?.email?.trim() || undefined

            // A normal reconnect follows disconnect, which clears local pickup addresses. Import
            // EasyParcel's current default then; preserve local edits if this callback is replayed.
            const ep = (tenant as any)?.easyParcelIntegration ?? {}
            const existing = Array.isArray(ep.warehouses) ? ep.warehouses : []
            const legacy = ep.warehouse ?? {}
            const hasLocalWarehouse = existing.length > 0 || !!(legacy.name || legacy.address1 || legacy.postcode)
            const pa = info.data?.address?.pickup_address
            if (!hasLocalWarehouse && pa && (pa.name || pa.address1 || pa.postcode)) {
                connectedWarehouses = [{
                    id: crypto.randomUUID(),
                    label: pa.name?.trim() || 'Pickup address',
                    phone: pa.phone_number?.trim() || '',
                    address1: pa.address1?.trim() || '',
                    address2: pa.address2?.trim() || '',
                    city: pa.city?.trim() || '',
                    state: pa.province_code ? mapSubdivisionName(pa.province_code.trim()) : '',
                    postcode: pa.postcode?.trim() || '',
                    country: 'MY',
                    isDefault: true,
                }]
            }
        } catch { /* non-critical — proceed without account identity / pickup address */ }

        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: {
                easyParcelIntegration: {
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token,
                    tokenExpiresAt: new Date(now + tokens.expires_in * 1000).toISOString(),
                    tokenRefreshExpiresAt: new Date(now + tokens.refresh_token_expires_in * 1000).toISOString(),
                    // NOTE: enabled is NOT set here — connecting only stores the token. The merchant
                    // completes the setup stepper and clicks "Save & Activate" to set enabled=true.
                    testedAt: new Date().toISOString(),
                    accountName: accountName ?? null,
                    accountEmail: accountEmail ?? null,
                    ...(connectedWarehouses ? { warehouses: connectedWarehouses } : {}),
                },
            } as any,
            overrideAccess: true,
        })

        const successRedirect = NextResponse.redirect(new URL('/settings/shipping?tab=easyparcel&ep=connected', request.nextUrl.origin))
        successRedirect.cookies.delete(`ep_state_${tenantId}`)
        return successRedirect
    } catch {
        return makeErrorRedirect()
    }
}
