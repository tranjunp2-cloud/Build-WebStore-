import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { NextResponse } from 'next/server'
import type { User } from 'payload'

/**
 * Get the currently authenticated user from Payload CMS session.
 * Use this in Server Components and Route Handlers.
 *
 * @returns The user object or null if not authenticated
 */
export async function getCurrentUser(req?: Request) {
    let token: string | undefined

    // 1. Try Authorization header first (for API calls)
    if (req) {
        const authHeader = req.headers.get('authorization')
        if (authHeader?.startsWith('Bearer ') || authHeader?.startsWith('JWT ')) {
            token = authHeader.split(' ')[1]
        }
    }

    // 2. Fallback to cookie (for Web UI)
    if (!token) {
        const cookieStore = await cookies()
        token = cookieStore.get('payload-token')?.value
    }

    if (!token) return null

    try {
        const payload = await getPayload({ config })

        // Try standard Payload auth first
        const authResult = await payload.auth({
            headers: new Headers({
                Authorization: `JWT ${token}`,
            }),
        })

        if (authResult?.user) {
            return authResult.user
        }

        // Fallback: decode custom JWT (from verify-otp endpoint OR cross-service SSO)
        // The verify-otp creates a jose-signed JWT with {id, email, collection, mfa_verified}
        // which payload.auth() cannot verify — so we decode it manually.
        //
        // Cross-service SSO support: when a sibling Payload deployment (e.g.
        // web-cms-v2) issues a token with its own secret, set
        // `SSO_SHARED_SECRET` to that peer's secret. We try PAYLOAD_SECRET first,
        // then fall back to SSO_SHARED_SECRET. Both projects can align PAYLOAD_SECRET
        // to avoid needing this fallback — this exists for defense-in-depth when
        // secrets are scoped separately per Vercel project. Fixes staging bug
        // "signature verification failed at /api/v1/sso/provision".
        const payloadSecret = process.env.PAYLOAD_SECRET
        if (!payloadSecret) {
            console.error('getCurrentUser: PAYLOAD_SECRET is not defined. Cannot decode custom JWT.')
            return null
        }

        const { jwtVerify } = await import('jose')
        const encoder = new TextEncoder()
        const candidateSecrets = [encoder.encode(payloadSecret)]
        const ssoSecret = process.env.SSO_SHARED_SECRET
        if (ssoSecret && ssoSecret !== payloadSecret) {
            candidateSecrets.push(encoder.encode(ssoSecret))
        }

        let decoded: Awaited<ReturnType<typeof jwtVerify>>['payload'] | null = null
        let lastErr: unknown = null
        for (const secret of candidateSecrets) {
            try {
                const result = await jwtVerify(token, secret)
                decoded = result.payload
                break
            } catch (e) {
                lastErr = e
            }
        }
        if (!decoded) {
            // Re-throw so outer catch logs a single structured error.
            throw lastErr ?? new Error('JWT signature verification failed against all candidate secrets')
        }

        const isIdValid =
            typeof decoded.id === 'number' ||
            (typeof decoded.id === 'string' && /^[a-zA-Z0-9-]+$/.test(decoded.id))

        if (
            isIdValid &&
            decoded.collection === 'users' &&
            decoded.mfa_verified === true
        ) {
            const user = await payload.findByID({
                collection: 'users',
                id: decoded.id as string | number,
            })
            return user || null
        }

        return null
    } catch (error) {
        // error == null catches both null and undefined thrown by payload.auth() for invalid/expired tokens
        if (error == null) return null
        const msg = error instanceof Error ? error.message : String(error)
        if (msg.includes('signature verification failed')) {
            console.error(
                'getCurrentUser error: signature verification failed. ' +
                'Hint: this Payload project received a JWT signed by a different secret. ' +
                'Align PAYLOAD_SECRET across services, or set SSO_SHARED_SECRET to the issuing service\'s secret.',
            )
        } else {
            console.error('getCurrentUser error:', error)
        }
        return null
    }
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
) {
    return async (req: Request, ctx: TContext): Promise<NextResponse> => {
        const user = await getCurrentUser(req)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        return handler(user as User, req, ctx)
    }
}

/** Extract the primary tenant ID from an already-fetched user object. */
export function extractTenantId(user: unknown): string | null {
    const tenants = (user as { tenants?: Array<{ tenant: string | number | { id: string | number } }> }).tenants
    if (!tenants || tenants.length === 0) return null
    const first = tenants[0].tenant
    if (typeof first === 'string') return first
    if (typeof first === 'number') return String(first)
    if (first?.id != null) return String(first.id)
    return null
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
