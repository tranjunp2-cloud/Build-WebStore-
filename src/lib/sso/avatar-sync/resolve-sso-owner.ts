import type { BasePayload } from 'payload'
import { isOwner } from '@/lib/profile/role-utils'

/**
 * Allow binding `ssoUserId` by email the first time an SSO Owner is seen (proposed BR-23-04 change,
 * GH-1723). Set to false if PO rejects it: only users already bound by `ssoUserId` will sync.
 */
export const ALLOW_EMAIL_BIND = true

export type SsoOwnerDoc = {
    id: number | string
    email?: string
    tenants?: Array<{ role?: string | null }> | null
    avatar?: number | string | { id: number | string } | null
    ssoUserId?: number | null
    ssoAvatarKey?: string | null
    ssoAvatarSyncedAt?: string | null
}

export type ResolveFailureReason = 'not_found' | 'ambiguous_email' | 'not_owner' | 'sso_id_conflict'

export type ResolveResult =
    | { ok: true; user: SsoOwnerDoc; bound: boolean }
    | { ok: false; reason: ResolveFailureReason }

const isOwnerDoc = (user: SsoOwnerDoc) =>
    isOwner({ tenants: (user.tenants ?? []).map((t) => ({ role: t.role ?? undefined })) })

/**
 * Map an SSO user to a PWv2 Owner. Primary key is the immutable `ssoUserId`.
 * Email is used once, to bind `ssoUserId`, and only when it matches exactly one
 * unbound Owner (PWv2 allows the same email with a different customerIdNumber).
 */
export async function resolveSsoOwner(
    payload: BasePayload,
    input: { ssoUserId: number; email: string },
): Promise<ResolveResult> {
    const byId = await payload.find({
        collection: 'users',
        where: { ssoUserId: { equals: input.ssoUserId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
    })
    const boundUser = byId.docs[0] as SsoOwnerDoc | undefined
    if (boundUser) {
        return isOwnerDoc(boundUser) ? { ok: true, user: boundUser, bound: false } : { ok: false, reason: 'not_owner' }
    }

    if (!ALLOW_EMAIL_BIND) return { ok: false, reason: 'not_found' }

    // Payload stores auth emails lowercased → exact `equals` on the normalized value.
    // limit 2 is enough to tell "exactly one" from "ambiguous".
    const email = input.email.trim().toLowerCase()
    const byEmail = await payload.find({
        collection: 'users',
        where: { email: { equals: email } },
        limit: 2,
        depth: 0,
        overrideAccess: true,
    })
    const matches = byEmail.docs as SsoOwnerDoc[]
    if (matches.length === 0) return { ok: false, reason: 'not_found' }
    if (matches.length > 1) return { ok: false, reason: 'ambiguous_email' }

    const candidate = matches[0]
    if (candidate.ssoUserId != null) return { ok: false, reason: 'sso_id_conflict' }
    if (!isOwnerDoc(candidate)) return { ok: false, reason: 'not_owner' }

    // Atomic bind: the `exists:false` guard makes a concurrent bind lose instead of overwriting
    // another SSO id. A unique-index violation (same id on another user) is reported in `errors`
    // for bulk updates, or thrown — both mean the id is taken.
    try {
        const res = await payload.update({
            collection: 'users',
            where: { and: [{ id: { equals: candidate.id } }, { ssoUserId: { exists: false } }] },
            data: { ssoUserId: input.ssoUserId },
            depth: 0,
            overrideAccess: true,
        })
        if (res.errors?.length) {
            console.error('[V2][SSO SyncAvatar] bind ssoUserId failed:', JSON.stringify(res.errors))
            return { ok: false, reason: 'sso_id_conflict' }
        }
        if (res.docs.length === 0) return { ok: false, reason: 'sso_id_conflict' }
    } catch (err) {
        console.error('[V2][SSO SyncAvatar] bind ssoUserId failed:', err instanceof Error ? err.message : err)
        return { ok: false, reason: 'sso_id_conflict' }
    }
    return { ok: true, user: { ...candidate, ssoUserId: input.ssoUserId }, bound: true }
}
