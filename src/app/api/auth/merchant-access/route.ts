/**
 * POST /api/auth/merchant-access { token }
 *
 * Redeems a one-time merchant CMS access link (created at /api/admin/merchant-access) and signs the browser in
 * as that merchant. Called by /sso/merchant-access from the page's own script, so a chat app that unfurls the
 * link (GET only, no JS) cannot burn it. Every failure answers the same 401 to avoid telling links apart.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { hasStaffRole } from '@/lib/admin/studio-roles'
import { checkRateLimit } from '@/lib/rateLimit'
import { redeemMerchantAccessLink } from '@/lib/support/merchant-access-events'
import {
    MERCHANT_ACCESS_SESSION_TTL_SECONDS,
    signMerchantSessionToken,
    verifyMerchantAccessToken,
} from '@/lib/support/merchant-access-token'
import type { PlatformUser } from '@/types/user'

const MAX_TOKEN_LENGTH = 2048

type Membership = { tenant?: number | string | { id: number | string } | null }

/** Same ban rule as sso-session and refresh-token: an account whose every store is suspended is not opened. */
async function allTenantsSuspended(payload: Awaited<ReturnType<typeof getPayload>>, user: PlatformUser) {
    const ids = ((user as unknown as { tenants?: Membership[] }).tenants ?? [])
        .map((m) => (m.tenant && typeof m.tenant === 'object' ? m.tenant.id : m.tenant))
        .filter((id): id is number | string => id != null && String(id) !== '0')
    if (ids.length === 0) return false
    const tenants = await payload.find({
        collection: 'tenants',
        where: { id: { in: ids } },
        limit: ids.length,
        depth: 0,
        overrideAccess: true,
    })
    return tenants.docs.length > 0 && tenants.docs.every((t) => (t as { status?: string }).status === 'suspended')
}

function invalidLink() {
    return NextResponse.json({ error: 'invalid_link' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
    const ip = req.headers.get('x-real-ip')?.trim() || req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || null
    const rate = await checkRateLimit(`merchant-access:${ip ?? 'unknown'}`, 20, 60_000)
    if (!rate.allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

    const body = (await req.json().catch(() => null)) as { token?: unknown } | null
    const token = body?.token
    if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return invalidLink()

    const claims = await verifyMerchantAccessToken(token)
    if (!claims) return invalidLink()

    const payload = await getPayload({ config })
    const redeemed = await redeemMerchantAccessLink(payload, claims.jti, ip)
    if (!redeemed) return invalidLink()

    const target = await payload
        .findByID({ collection: 'users', id: claims.targetUserId, depth: 0, overrideAccess: true })
        .catch(() => null)
    const user = target as unknown as PlatformUser | null
    // Roles may have changed since the link was made: never sign in as a staff account.
    if (!user || hasStaffRole(user.roles)) return invalidLink()
    if (await allTenantsSuspended(payload, user)) return invalidLink()

    const sessionToken = await signMerchantSessionToken(
        { id: Number(user.id), email: user.email },
        claims.actorUserId,
        redeemed.actorEmail || undefined,
    )
    console.info('[merchant-access] link redeemed', { actorId: claims.actorUserId, targetId: user.id, jti: claims.jti })

    const response = NextResponse.json({ ok: true, redirectTo: '/dashboard' })
    response.headers.set('Cache-Control', 'no-store')
    response.cookies.set('payload-token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: MERCHANT_ACCESS_SESSION_TTL_SECONDS,
    })
    return response
}
