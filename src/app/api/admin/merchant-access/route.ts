/**
 * Merchant CMS access for the Prime support team (super-admin or `support` role).
 *
 * GET  /api/admin/merchant-access?q=<email or company>  → merchant accounts matching the search
 * POST /api/admin/merchant-access { userId }              → one-time login link into that merchant's CMS
 *
 * The link skips the merchant's OTP, so it is short-lived (10 min), single-use, never opens a staff
 * account, and every link is written to merchant_access_events with the staff member who created it.
 */
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { authUnavailableResponse, getCurrentUser, isAuthUnavailableError } from '@/lib/auth'
import { canUseMerchantAccess, hasStaffRole } from '@/lib/admin/studio-roles'
import { checkRateLimit } from '@/lib/rateLimit'
import { findMerchantAccounts } from '@/lib/support/find-merchant-accounts'
import { recordMerchantAccessLink } from '@/lib/support/merchant-access-events'
import { MERCHANT_ACCESS_LINK_TTL_SECONDS, signMerchantAccessToken } from '@/lib/support/merchant-access-token'
import type { PlatformUser } from '@/types/user'

type ActorResult = { actor: PlatformUser } | { response: NextResponse }

async function requireMerchantAccessActor(req: NextRequest): Promise<ActorResult> {
    let rawUser: Awaited<ReturnType<typeof getCurrentUser>>
    try {
        rawUser = await getCurrentUser(req)
    } catch (error) {
        if (isAuthUnavailableError(error)) return { response: authUnavailableResponse() }
        throw error
    }
    if (!rawUser) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    const actor = rawUser as unknown as PlatformUser
    // A session minted by a merchant access link must not be able to mint further links.
    if (!canUseMerchantAccess(actor.roles)) return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    return { actor }
}

export async function GET(req: NextRequest) {
    const auth = await requireMerchantAccessActor(req)
    if ('response' in auth) return auth.response

    const q = req.nextUrl.searchParams.get('q') ?? ''
    if (q.length > 200) return NextResponse.json({ error: 'Query too long' }, { status: 400 })

    const payload = await getPayload({ config })
    const accounts = await findMerchantAccounts(payload, q)
    return NextResponse.json({ data: accounts }, { headers: { 'Cache-Control': 'no-store' } })
}

const CreateLinkSchema = z.object({ userId: z.number().int().positive() })

export async function POST(req: NextRequest) {
    const auth = await requireMerchantAccessActor(req)
    if ('response' in auth) return auth.response
    const { actor } = auth

    // A support seat opens a handful of stores a day; a burst of links means a script or a stolen session.
    const rate = await checkRateLimit(`merchant-access-mint:${actor.id}`, 10, 60_000)
    if (!rate.allowed) return NextResponse.json({ error: 'Too many links, try again in a minute' }, { status: 429 })

    const parsed = CreateLinkSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

    const payload = await getPayload({ config })
    const target = await payload
        .findByID({ collection: 'users', id: parsed.data.userId, depth: 0, overrideAccess: true })
        .catch(() => null)
    if (!target) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

    const targetUser = target as unknown as PlatformUser
    if (hasStaffRole(targetUser.roles)) {
        return NextResponse.json({ error: 'Only merchant accounts can be opened' }, { status: 403 })
    }

    const jti = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + MERCHANT_ACCESS_LINK_TTL_SECONDS * 1000)
    await recordMerchantAccessLink(payload, {
        jti,
        actor: { id: Number(actor.id), email: actor.email },
        target: { id: Number(targetUser.id), email: targetUser.email },
        expiresAt,
    })
    const token = await signMerchantAccessToken({
        jti,
        targetUserId: Number(targetUser.id),
        actorUserId: Number(actor.id),
    })

    // The token rides in the fragment: browsers never send it to the server, so it stays out of access logs.
    const url = `${new URL('/sso/merchant-access', req.nextUrl.origin).toString()}#token=${encodeURIComponent(token)}`
    console.info('[merchant-access] link created', { actorId: actor.id, targetId: targetUser.id, jti })
    return NextResponse.json(
        { data: { url, expiresAt: expiresAt.toISOString(), email: targetUser.email } },
        { status: 201, headers: { 'Cache-Control': 'no-store' } },
    )
}
