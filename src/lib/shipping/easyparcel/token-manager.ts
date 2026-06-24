import 'server-only'
import type { BasePayload } from 'payload'
import { EP_OAUTH_BASE, EasyParcelError } from './types'
import type { EpOAuthTokenResponse } from './types'

const CLIENT_ID = process.env.EASYPARCEL_CLIENT_ID ?? ''
const CLIENT_SECRET = process.env.EASYPARCEL_CLIENT_SECRET ?? ''
const REDIRECT_URI = process.env.EASYPARCEL_REDIRECT_URI ?? ''

function basicAuth(): string {
    return Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
}

async function postToken(body: URLSearchParams): Promise<EpOAuthTokenResponse> {
    const res = await fetch(`${EP_OAUTH_BASE}/oauth/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${basicAuth()}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
    })
    if (!res.ok) throw new EasyParcelError('AUTH_ERROR', 'EP OAuth token request failed')
    return res.json() as Promise<EpOAuthTokenResponse>
}

/** Exchange authorization code for token pair (used by oauth-callback route). */
export async function exchangeCodeForToken(code: string): Promise<EpOAuthTokenResponse> {
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
    })
    return postToken(body)
}

/**
 * Get a valid access token for a tenant.
 * Auto-refreshes if near/past expiry and persists new tokens to DB.
 * Throws EasyParcelError('AUTH_EXPIRED') if reconnection is required.
 */
export async function getValidToken(
    tenantEp: Record<string, unknown>,
    tenantId: string | number,
    payload: BasePayload,
): Promise<string> {
    const accessToken = tenantEp.accessToken as string | null | undefined
    const refreshToken = tenantEp.refreshToken as string | null | undefined
    const tokenExpiresAt = tenantEp.tokenExpiresAt as string | null | undefined

    if (!accessToken || !refreshToken) {
        throw new EasyParcelError(
            'AUTH_EXPIRED',
            'EasyParcel not connected. Please reconnect via OAuth.',
        )
    }

    // Return current token if not expiring within 60s
    const expiresMs = tokenExpiresAt ? new Date(tokenExpiresAt).getTime() : 0
    if (expiresMs - Date.now() > 60_000) {
        return accessToken
    }

    // Refresh token
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
    })

    let refreshed: EpOAuthTokenResponse
    try {
        refreshed = await postToken(body)
    } catch {
        throw new EasyParcelError(
            'AUTH_EXPIRED',
            'EasyParcel session expired. Please reconnect.',
        )
    }

    const now = Date.now()
    await payload.update({
        collection: 'tenants',
        id: tenantId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: {
            easyParcelIntegration: {
                accessToken: refreshed.access_token,
                refreshToken: refreshed.refresh_token,
                tokenExpiresAt: new Date(now + refreshed.expires_in * 1000).toISOString(),
                tokenRefreshExpiresAt: new Date(
                    now + refreshed.refresh_token_expires_in * 1000,
                ).toISOString(),
            },
        } as any,
        overrideAccess: true,
    })

    return refreshed.access_token
}
