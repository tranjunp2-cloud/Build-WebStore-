import 'server-only'
import type { Payload } from 'payload'
import { withTenantRowLock } from '@/lib/payload/tenant-row-lock'
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
    if (!res.ok) {
        // F11 (review #1434): carry the HTTP status so callers can distinguish a rejected
        // grant (4xx, e.g. invalid_grant) from a transient 5xx — only the former means
        // reconnection is actually required.
        throw new EasyParcelError('AUTH_ERROR', 'EP OAuth token request failed', { status: res.status })
    }
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
    payload: Payload,
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

    // F11 (review #1434): dedupe concurrent refreshes for the same tenant. EP rotates
    // refresh tokens on use, so two callers racing to refresh at once would have the 2nd
    // fail (its refresh_token was already rotated away) and get misclassified as
    // AUTH_EXPIRED. Cache the in-flight refresh promise per tenant so concurrent callers
    // await the same refresh instead of racing.
    const tenantKey = String(tenantId)
    let inFlight = inFlightRefreshes.get(tenantKey)
    if (!inFlight) {
        inFlight = refreshAndPersist(refreshToken, tenantId, payload).finally(() => {
            inFlightRefreshes.delete(tenantKey)
        })
        inFlightRefreshes.set(tenantKey, inFlight)
    }
    return inFlight
}

// Module-level de-dup cache for in-flight refreshes, keyed by tenantId (F11, review #1434).
const inFlightRefreshes = new Map<string, Promise<string>>()

async function refreshAndPersist(
    refreshToken: string,
    tenantId: string | number,
    payload: Payload,
): Promise<string> {
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
    })

    let refreshed: EpOAuthTokenResponse
    try {
        refreshed = await postToken(body)
    } catch (err) {
        // F11 (review #1434): only a rejected grant (4xx, e.g. invalid_grant on an
        // already-rotated/expired refresh token) actually requires reconnection. A 5xx or
        // network failure (no status at all) is transient — throw a retryable error instead
        // of forcing the merchant through OAuth again.
        const status = err instanceof EasyParcelError ? (err.raw as { status?: number } | undefined)?.status : undefined
        if (status != null && status < 500) {
            throw new EasyParcelError(
                'AUTH_EXPIRED',
                'EasyParcel session expired. Please reconnect.',
            )
        }
        throw new EasyParcelError(
            'AUTH_REFRESH_FAILED',
            'EasyParcel token refresh failed (transient) — retry later.',
        )
    }

    return withTenantRowLock(payload, tenantId, async (req) => {
        const currentTenant = await payload.findByID({
            collection: 'tenants',
            id: tenantId,
            depth: 0,
            overrideAccess: true,
            showHiddenFields: true,
            req,
        })
        const currentIntegration = (currentTenant as { easyParcelIntegration?: Record<string, unknown> })
            .easyParcelIntegration ?? {}
        const currentRefreshToken = currentIntegration.refreshToken

        if (!currentRefreshToken) {
            throw new EasyParcelError('AUTH_EXPIRED', 'EasyParcel was disconnected while refreshing.')
        }
        if (currentRefreshToken !== refreshToken) {
            throw new EasyParcelError('AUTH_REFRESH_FAILED', 'EasyParcel connection changed while refreshing. Please retry.')
        }

        const now = Date.now()
        await payload.update({
            collection: 'tenants',
            id: tenantId,
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
            req,
        })

        return refreshed.access_token
    })
}
