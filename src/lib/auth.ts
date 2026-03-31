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
export async function getCurrentUser() {
    const cookieStore = await cookies()
    const token = cookieStore.get('payload-token')?.value

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

        // Fallback: decode custom JWT (from verify-otp endpoint)
        // The verify-otp creates a jose-signed JWT with {id, email, collection, mfa_verified}
        // which payload.auth() cannot verify — so we decode it manually
        const payloadSecret = process.env.PAYLOAD_SECRET
        if (!payloadSecret) {
            console.error('getCurrentUser: PAYLOAD_SECRET is not defined. Cannot decode custom JWT.')
            return null
        }

        const { jwtVerify } = await import('jose')
        const secret = new TextEncoder().encode(payloadSecret)
        const { payload: decoded } = await jwtVerify(token, secret)

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
        console.error('getCurrentUser error:', error)
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
        const user = await getCurrentUser()
        if (!user) {
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

    const tenants = (user as unknown as { tenants?: Array<{ tenant: string | { id: string } }> }).tenants
    if (!tenants || tenants.length === 0) return null

    const firstTenant = tenants[0].tenant
    return typeof firstTenant === 'string' ? firstTenant : firstTenant?.id || null
}
