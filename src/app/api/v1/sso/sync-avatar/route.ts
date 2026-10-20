import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { syncAvatarSchema } from '@/lib/sso/avatar-sync/sync-avatar-schema'
import { resolveSsoOwner } from '@/lib/sso/avatar-sync/resolve-sso-owner'
import { applyAvatarState } from '@/lib/sso/avatar-sync/apply-avatar-state'
import { AvatarDownloadError } from '@/lib/sso/avatar-sync/download-sso-avatar'

export const runtime = 'nodejs'

/**
 * POST /api/v1/sso/sync-avatar
 *
 * Applies the SSO-authoritative Owner avatar state (GH-1723, US-F23-05).
 * Called by SSO SyncAvatarPrimeWebV2 job (update / login / backfill triggers).
 *
 * Auth: Bearer token (super-admin), same as the other /v1/sso/* routes.
 * Contract: plans/261020-1358-gh-1723-sso-owner-avatar-sync/contract-sso-pw2-avatar-sync.md
 * Responses: 200 { result } | 400 invalid | 401/403 auth | 409 { reason } unmapped
 *            | 422 avatar rejected (bad URL, size, type, 4xx — no retry) | 502 transient download failure (SSO retries)
 */
export async function POST(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ message: 'Authorization required' }, { status: 401 })
    }

    try {
        const callerUser = await getCurrentUser(req)
        if (!callerUser) return NextResponse.json({ message: 'Invalid token' }, { status: 401 })
        if (!callerUser.roles?.includes('super-admin')) {
            return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 })
        }

        const body = await req.json().catch(() => null)
        const parsed = syncAvatarSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({ message: 'Invalid payload', issues: parsed.error.issues }, { status: 400 })
        }
        const input = parsed.data
        const logCtx = `sso_user_id=${input.sso_user_id} trigger=${input.trigger}`

        const payload = await getPayload({ config })
        const resolved = await resolveSsoOwner(payload, { ssoUserId: input.sso_user_id, email: input.email })
        if (!resolved.ok) {
            console.warn(`[V2][SSO SyncAvatar] skipped ${logCtx} reason=${resolved.reason}`)
            return NextResponse.json({ message: 'Owner not mapped', reason: resolved.reason }, { status: 409 })
        }

        try {
            const result = await applyAvatarState(payload, resolved.user, input)
            console.log(`[V2][SSO SyncAvatar] ${result} ${logCtx} user=${resolved.user.id}${resolved.bound ? ' (bound)' : ''}`)
            return NextResponse.json({ result, bound: resolved.bound }, { status: 200 })
        } catch (err) {
            if (err instanceof AvatarDownloadError) {
                // UNKNOWN: keep last-known avatar. 502 → SSO retries; 422 → deterministic, no retry
                console.warn(`[V2][SSO SyncAvatar] download failed ${logCtx} retryable=${err.retryable}: ${err.message}`)
                return err.retryable
                    ? NextResponse.json({ message: 'Avatar download failed' }, { status: 502 })
                    : NextResponse.json({ message: 'Avatar rejected' }, { status: 422 })
            }
            throw err
        }
    } catch (error) {
        console.error('[V2][SSO SyncAvatar Error]', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}
