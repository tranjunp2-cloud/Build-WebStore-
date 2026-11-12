import type { Payload } from 'payload'

import { readAuthorizationToken, verifySessionToken } from './session-token'
import { passesOtpGate } from './session-user'

/**
 * Payload REST and the Users custom endpoints authenticate with Payload's own login token, which
 * `POST /api/users/login` issues before the OTP step. Without this guard the password alone read orders and
 * customers over `/api/<collection>`. A Payload token without `mfa_verified` is refused (401) for every user
 * except a super-admin (the Payload admin panel signs in with it), on every path but the endpoints the
 * login / OTP / password-reset screens call before the code is verified (TC-PERF-142).
 */
export const PRE_OTP_REST_PATHS: ReadonlySet<string> = new Set([
    'users/login',
    'users/logout',
    'users/send-otp',
    'users/verify-otp',
    'users/forgot-password',
    'users/reset-password',
])

/** `/api/users/login?x=1` → `users/login` (no trailing slash). */
export function restPath(url: string): string {
    const { pathname } = new URL(url, 'http://local')
    return pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '')
}

/** Every token Payload could authenticate the request with: the Authorization header and the cookie. */
export function candidateTokens(req: Pick<Request, 'headers'>): string[] {
    const tokens: string[] = []
    const header = readAuthorizationToken(req)
    if (header) tokens.push(header)
    const cookie = req.headers.get('cookie') ?? ''
    for (const part of cookie.split(';')) {
        const [name, ...rest] = part.trim().split('=')
        if (name.trim() === 'payload-token' && rest.length) {
            let value = rest.join('=')
            try {
                // Match Next cookies(): authentication sees the decoded value, so both guards must too.
                value = decodeURIComponent(value)
            } catch {
                // Keep malformed values as-is; JWT verification/detection rejects them safely.
            }
            if (value && !tokens.includes(value)) tokens.push(value)
            try {
                // Payload trims cookie keys and uses decodeURI; keep its candidate too when reserved escapes differ.
                const payloadValue = decodeURI(rest.join('='))
                if (payloadValue && !tokens.includes(payloadValue)) tokens.push(payloadValue)
            } catch {
                // Payload also ignores malformed percent encoding.
            }
        }
    }
    return tokens
}

type GuardPayload = Pick<Payload, 'secret' | 'findByID'>

const refusal = () =>
    Response.json(
        { errors: [{ message: 'Enter the verification code sent to your email to continue.' }] },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )

/** A 401 response when the request carries a pre-OTP Payload token of a non-super-admin, else null. */
export async function refusePreOtpPayloadToken(
    req: Pick<Request, 'headers' | 'url'>,
    loadPayload: () => Promise<GuardPayload>,
): Promise<Response | null> {
    const tokens = candidateTokens(req)
    if (tokens.length === 0 || PRE_OTP_REST_PATHS.has(restPath(req.url))) return null

    let payload: GuardPayload | null = null
    for (const token of tokens) {
        payload ??= await loadPayload()
        let claims: Awaited<ReturnType<typeof verifySessionToken>>
        try {
            // App (OTP / SSO) secrets are left out on purpose: Payload REST never accepts those tokens anyway.
            claims = await verifySessionToken(token, { payloadSecret: payload.secret, appSecrets: [] })
        } catch {
            continue // not a valid Payload token: Payload treats the request as signed out
        }
        if (!claims || claims.kind !== 'payload' || claims.mfaVerified) continue

        let roles: unknown = null
        try {
            const user = (await payload.findByID({
                collection: 'users',
                id: claims.id,
                depth: 0,
                overrideAccess: true,
                disableErrors: true,
                select: { roles: true },
            } as Parameters<Payload['findByID']>[0])) as { roles?: unknown } | null
            roles = user?.roles ?? null
        } catch {
            roles = null
        }
        if (!passesOtpGate(claims, roles)) return refusal()
    }
    return null
}
