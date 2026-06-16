import { NextRequest, NextResponse } from 'next/server'
import { SignJWT, decodeJwt } from 'jose'
import { getPayload } from 'payload'
import config from '@payload-config'
import { checkRateLimit } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
    // Rate limiting: 10 attempts per minute per IP (mirrors other auth endpoints)
    // x-real-ip is set by Vercel infrastructure (not client-spoofable).
    // XFF rightmost entry is the Vercel-appended real IP; leftmost is client-controlled.
    const ip =
        req.headers.get('x-real-ip')?.trim() ||
        req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ||
        'unknown'
    const rateLimit = await checkRateLimit(`sso-session:${ip}`, 10, 60_000)
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: 'rate_limited' },
            {
                status: 429,
                headers: { 'Retry-After': String(Math.max(0, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
            },
        )
    }

    try {
        let v2Token: string | undefined
        try {
            const body = await req.json()
            v2Token = body?.v2_token
        } catch {
            // invalid JSON body
        }
        if (!v2Token || typeof v2Token !== 'string' || v2Token.length > 4096) {
            return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
        }

        // Fast-fail: verify JWT collection claim before hitting the DB.
        // Prevents tokens from other auth-enabled collections (e.g. api-clients) from
        // being accepted even if payload.auth() would validate their signature.
        let jwtClaims: { collection?: unknown }
        try {
            jwtClaims = decodeJwt(v2Token) as { collection?: unknown }
        } catch {
            return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
        }
        if (jwtClaims.collection !== 'users') {
            return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
        }

        const secret = process.env.PAYLOAD_SECRET
        if (!secret) throw new Error('PAYLOAD_SECRET is required')

        // Payload v3 signs JWT with a derived key (not raw PAYLOAD_SECRET),
        // so jwtVerify with raw secret always fails. Use payload.auth() instead.
        const payload = await getPayload({ config })
        const authResult = await payload.auth({
            headers: new Headers({ Authorization: `JWT ${v2Token}` }),
        })
        if (!authResult?.user) {
            console.error('[V2][SSO Session] payload.auth() rejected token')
            return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
        }
        const id = authResult.user.id
        const email = authResult.user.email
        if (!id || !email) {
            console.error('[V2][SSO Session] Missing claims: id=%s email=%s', id, email)
            return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
        }

        // Fetch user with depth:1 to get populated tenants for ban + onboarding checks
        const user = await payload.findByID({
            collection: 'users',
            id: id as string | number,
            depth: 1,
        })

        // Ban enforcement: block SSO login if all tenants are suspended (mirrors Users.ts:178-199).
        // Guard against vacuous truth: [].every() returns true, so only check when length > 0.
        const userTenants = user.tenants as Array<{ tenant: string | number | { id: string | number } }> | undefined
        if (userTenants && userTenants.length > 0) {
            const tenantIds = userTenants
                .map((t) => {
                    if (t.tenant == null) return null
                    if (typeof t.tenant === 'object') return String((t.tenant as { id: string | number }).id)
                    return String(t.tenant)
                })
                // '0' is Payload's sentinel for an unpopulated relationship at depth:0
                .filter((tid): tid is string => Boolean(tid) && tid !== '0')
            if (tenantIds.length > 0) {
                const tenantResults = await Promise.all(
                    tenantIds.map((tid) =>
                        payload.find({ collection: 'tenants', where: { id: { equals: tid } }, limit: 1, depth: 0 }),
                    ),
                )
                const allSuspended = tenantResults.every(
                    (r) => (r.docs[0] as { status?: string } | undefined)?.status === 'suspended',
                )
                if (allSuspended) {
                    console.error('[V2][SSO Session] Blocked: all tenants suspended for user id=%s', id)
                    return NextResponse.json({ error: 'account_suspended' }, { status: 403 })
                }
            }
        }

        // SSO only handles tenant-owner users; staff go through direct Payload login.
        // has_seen_ai_wizard gate takes precedence over onboardingCompleted.
        const roles: string[] = (user.roles as string[]) || []
        const tenants = user.tenants as { tenant: { onboardingCompleted?: boolean } | string }[] | undefined
        const hasSeenAiWizard = user.has_seen_ai_wizard as boolean | undefined
        let redirectTo = '/dashboard'
        if (roles.includes('tenant-owner') && !hasSeenAiWizard) {
            if (!tenants || tenants.length === 0) {
                redirectTo = '/onboarding'
            } else {
                const firstTenant = tenants[0]?.tenant
                // Strict === false: undefined (pre-migration rows, field not yet set) treated as "done"
                if (firstTenant && typeof firstTenant === 'object' && firstTenant.onboardingCompleted === false) {
                    redirectTo = '/onboarding'
                }
            }
        }

        // Mint new token with mfa_verified:true — mirrors Users.ts:204-219 bypass pattern.
        // Signed with raw PAYLOAD_SECRET; middleware and getCurrentUser() fallback verify with same key.
        const secretKey = new TextEncoder().encode(secret)
        const newToken = await new SignJWT({
            id,
            email,
            collection: 'users',
            mfa_verified: true,
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('24h')
            .sign(secretKey)

        // Update lastLoginAt — mirrors the normal login path audit trail (Users.ts ~line 1000)
        try {
            await payload.update({
                collection: 'users',
                id: id as string | number,
                overrideAccess: true,
                data: { lastLoginAt: new Date().toISOString() },
            })
        } catch (e) {
            console.error('[V2][SSO Session] Failed to update lastLoginAt:', e)
        }

        const response = NextResponse.json({ ok: true, redirectTo })
        response.headers.set('Cache-Control', 'no-store')
        response.cookies.set('payload-token', newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 86400,
        })
        return response
    } catch (error) {
        console.error('[V2][SSO Session Error]', error)
        return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
    }
}
