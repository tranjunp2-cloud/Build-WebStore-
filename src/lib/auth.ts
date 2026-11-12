import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { NextResponse } from 'next/server'
import type { JsonObject, TypeWithID, User } from 'payload'
import { cookieSessionAllowed, validateCsrf } from '@/lib/auth/csrf'
import { AuthUnavailableError, authUnavailableResponse, isAuthUnavailableError } from '@/lib/auth/auth-unavailable'
import { memoizePerRequest } from '@/lib/auth/request-memo'
import {
    appSessionSecrets,
    readAuthorizationToken,
    SessionSignatureError,
    verifySessionToken,
    type SessionClaims,
} from '@/lib/auth/session-token'
import { loadSessionUser, type SessionUser } from '@/lib/auth/session-user'
import { extractTenantId } from '@/lib/auth/tenant-id'

export { AuthUnavailableError, authUnavailableResponse, isAuthUnavailableError }
export { extractTenantId, tenantIdForQuery } from '@/lib/auth/tenant-id'

/**
 * Get the currently authenticated user from Payload CMS session.
 * Use this in Server Components and Route Handlers.
 *
 * Cost (TC-PERF-001..006): the token is verified once with the secret its kind is signed with (Payload's derived
 * secret for Payload login tokens, raw PAYLOAD_SECRET / SSO_SHARED_SECRET for OTP/SSO tokens) and the user is
 * loaded at depth 1 with only the fields callers read — no `payload.auth()`, whose operation computes permissions
 * for every collection on each call. One load per request and token (per-request memo).
 *
 * `requireMfa`: only a session that passed the OTP step counts — for everyone, super-admins included. The token
 * `POST /api/users/login` returns after the password alone (Payload's own token) has no `mfa_verified` claim; the
 * default gate still lets super-admins use it (Payload admin panel), but the copilot (`/api/agent/*`) must not
 * (TC-AISEC-013/014).
 *
 * @returns The user, or null when there is no session or the token is invalid/expired/revoked.
 * @throws AuthUnavailableError when the session could not be checked (database/pool/network failure):
 *   API routes answer 503 + Retry-After, pages show a retry state — never "sign in" (TC-PERF-010..012).
 */
export async function getCurrentUser(
    req?: Request,
    options: { requireMfa?: boolean } = {},
): Promise<(JsonObject & TypeWithID) | null> {
    // 1. Authorization header first (API calls), 2. the cookie (Web UI)
    let token = readAuthorizationToken(req)
    let scope: object | undefined = req
    if (!token) {
        // Cookie session on a state-changing request: same-site Origin / Referer required (TC-PERF-162)
        if (req && !cookieSessionAllowed(req)) return null
        const cookieStore = await cookies()
        token = cookieStore.get('payload-token')?.value ?? null
        scope = req ?? cookieStore
    }
    if (!token) return null

    // The memo holds the user plus whether the token passed OTP, so a requireMfa caller and a plain caller in the
    // same request share one load; the OTP requirement is applied on the way out.
    const session = await memoizePerRequest(scope ?? {}, token, () => loadSession(token))
    if (!session) return null
    if (options.requireMfa && !session.mfaVerified) return null
    return session.user
}

async function loadSession(token: string): Promise<{ user: SessionUser; mfaVerified: boolean } | null> {
    const payloadSecret = process.env.PAYLOAD_SECRET
    if (!payloadSecret) {
        console.error('getCurrentUser: PAYLOAD_SECRET is not defined. Cannot verify session tokens.')
        return null
    }

    let payload: Awaited<ReturnType<typeof getPayload>>
    try {
        payload = await getPayload({ config })
    } catch (error) {
        throw new AuthUnavailableError(error)
    }

    let claims: SessionClaims | null
    try {
        claims = await verifySessionToken(token, {
            payloadSecret: payload.secret,
            appSecrets: appSessionSecrets({ PAYLOAD_SECRET: payloadSecret, SSO_SHARED_SECRET: process.env.SSO_SHARED_SECRET }),
        })
    } catch (error) {
        if (error instanceof SessionSignatureError) {
            // Cross-service SSO: a sibling Payload deployment (e.g. web-cms-v2) signs with its own secret.
            console.error(
                'getCurrentUser error: signature verification failed. ' +
                'Hint: this Payload project received a JWT signed by a different secret. ' +
                'Align PAYLOAD_SECRET across services, or set SSO_SHARED_SECRET to the issuing service\'s secret.',
            )
        }
        // Expired / malformed tokens are an ordinary signed-out state: no log line per request.
        return null
    }
    if (!claims) return null

    const user = await loadSessionUser(payload, claims)
    return user ? { user, mfaVerified: claims.mfaVerified } : null
}

/**
 * Higher-Order Function (HOC) that wraps a route handler with auth check.
 * Eliminates the need to repeat getCurrentUser() + 401 check in every route.
 *
 * @example
 * // Simple handler (POST, GET without params):
 * export const POST = withAuth(async (user, req) => {
 *     // `user` is guaranteed to be authenticated here
 *     return NextResponse.json({ ok: true })
 * })
 *
 * @example
 * // Handler with route params (e.g. [siteId]):
 * export const GET = withAuth(async (user, req, ctx) => {
 *     const { siteId } = await ctx.params
 *     return NextResponse.json({ siteId })
 * })
 */
export function withAuth<TContext extends { params: Promise<any> } = never>(
    handler: (user: User, req: Request, ctx: TContext) => Promise<NextResponse>,
    options?: {
        unauthorizedResponse?: (req: Request) => NextResponse
        /**
         * Same-origin check (Origin, else Referer, host must equal Host) before auth runs; a
         * cross-site request gets 403. A request with neither header (server-to-server, scripts)
         * passes and still needs a valid session. Opt-in: used by the /api/ai/* POST routes.
         */
        csrf?: boolean
    },
) {
    return async (req: Request, ctx: TContext): Promise<NextResponse> => {
        if (options?.csrf && !validateCsrf(req)) {
            return NextResponse.json({ error: 'CSRF verification failed.' }, { status: 403 })
        }
        let user: Awaited<ReturnType<typeof getCurrentUser>>
        try {
            user = await getCurrentUser(req)
        } catch (error) {
            // DB/pool trouble while checking the session: busy, not signed out (TC-PERF-011).
            if (isAuthUnavailableError(error)) return authUnavailableResponse()
            throw error
        }
        if (!user) {
            if (options?.unauthorizedResponse) {
                return options.unauthorizedResponse(req)
            }
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        return handler(user as User, req, ctx)
    }
}

/**
 * Get the current user's primary tenant ID.
 * Most users only have 1 tenant (their store).
 */
export async function getCurrentTenantId(): Promise<string | null> {
    const user = await getCurrentUser()
    if (!user) return null
    return extractTenantId(user)
}
