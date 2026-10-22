import type { BasePayload } from 'payload'
import { isOwner } from '@/lib/profile/role-utils'
import { bindSsoUserId } from './sso-user-sql'

/**
 * Allow binding `ssoUserId` by email the first time an SSO Owner is seen (GH-1979). Owners created
 * before `users.sso_user_id` existed have no SSO id, so without this they get 409 `email_bind_disabled`
 * and never sync. The bind only happens when the email matches exactly one unbound Owner (see
 * `resolveSsoOwner`); afterwards the immutable `ssoUserId` is the key. BR-23-04 / FR-23-13 in the PRD
 * must be updated to allow this first-time email bind.
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

export type ResolveFailureReason = 'not_found' | 'ambiguous_email' | 'not_owner' | 'sso_id_conflict' | 'email_bind_disabled'

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
    options: { allowEmailBind?: boolean } = {},
): Promise<ResolveResult> {
    const allowEmailBind = options.allowEmailBind ?? ALLOW_EMAIL_BIND
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

    if (!allowEmailBind) return { ok: false, reason: 'email_bind_disabled' }

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

    // Atomic bind (single UPDATE … WHERE sso_user_id IS NULL): a concurrent bind or an id already
    // owned by another user (unique index) loses with 'conflict'. Other database errors propagate
    // so the route answers 5xx and SSO retries.
    if ((await bindSsoUserId(payload, candidate.id, input.ssoUserId)) === 'conflict') {
        return { ok: false, reason: 'sso_id_conflict' }
    }
    return { ok: true, user: { ...candidate, ssoUserId: input.ssoUserId }, bound: true }
}
