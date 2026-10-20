import type { BasePayload, Where } from 'payload'
import { downloadSsoAvatar } from './download-sso-avatar'
import type { SsoOwnerDoc } from './resolve-sso-owner'
import type { SyncAvatarInput } from './sync-avatar-schema'

export type ApplyAvatarResult = 'updated' | 'cleared' | 'unchanged' | 'stale'

/** Alt text set on avatar Media by both the local upload route and this sync — marks Media we own. */
export const AVATAR_MEDIA_ALT = 'User avatar'

const mediaIdOf = (avatar: SsoOwnerDoc['avatar']): number | string | null =>
    avatar == null ? null : typeof avatar === 'object' ? avatar.id : avatar

/**
 * Delete the previous avatar Media only if it was created by an avatar flow (alt marker)
 * and no other user still references it — never library/site Media. Never throws.
 */
async function deletePreviousAvatarMedia(payload: BasePayload, mediaId: number | string, userId: number | string) {
    try {
        const media = await payload.findByID({ collection: 'media', id: mediaId, depth: 0, overrideAccess: true })
        if ((media as { alt?: string } | null)?.alt !== AVATAR_MEDIA_ALT) return
        const stillUsed = await payload.find({
            collection: 'users',
            where: { and: [{ avatar: { equals: mediaId } }, { id: { not_equals: userId } }] },
            limit: 1,
            depth: 0,
            overrideAccess: true,
        })
        if (stillUsed.docs.length > 0) return
        await payload.delete({ collection: 'media', id: mediaId, overrideAccess: true })
    } catch (err) {
        console.warn('[V2][SSO SyncAvatar] old avatar media cleanup failed:', err instanceof Error ? err.message : err)
    }
}

/**
 * Compare-and-set update: only applies when `ssoAvatarSyncedAt` is still the value we read,
 * so two concurrent syncs for the same Owner cannot both win. Returns false when we lost.
 */
async function casUpdateUser(payload: BasePayload, user: SsoOwnerDoc, data: Record<string, unknown>): Promise<boolean> {
    const syncedAtGuard: Where = user.ssoAvatarSyncedAt
        ? { ssoAvatarSyncedAt: { equals: user.ssoAvatarSyncedAt } }
        : { ssoAvatarSyncedAt: { exists: false } }
    const res = await payload.update({
        collection: 'users',
        where: { and: [{ id: { equals: user.id } }, syncedAtGuard] },
        data,
        depth: 0,
        overrideAccess: true,
    })
    if (res.errors?.length) throw new Error(`user update failed: ${JSON.stringify(res.errors)}`)
    return res.docs.length > 0
}

/**
 * Apply the SSO avatar state to a resolved Owner (GH-1723).
 * - stale `changed_at` or same `avatar_key` → no-op (idempotent, ordering-safe)
 * - PRESENT → download, store as Media, link; ABSENT → unlink (initials)
 * - concurrent sync lost the CAS → new Media removed, result 'stale'
 * - download errors propagate as AvatarDownloadError → caller keeps last-known avatar
 */
export async function applyAvatarState(
    payload: BasePayload,
    user: SsoOwnerDoc,
    input: SyncAvatarInput,
): Promise<ApplyAvatarResult> {
    const changedAt = new Date(input.changed_at)
    if (user.ssoAvatarSyncedAt && changedAt.getTime() < new Date(user.ssoAvatarSyncedAt).getTime()) {
        return 'stale'
    }

    const previousMediaId = mediaIdOf(user.avatar)
    const syncedAt = changedAt.toISOString()

    if (input.state === 'ABSENT') {
        if (previousMediaId == null && !user.ssoAvatarKey) return 'unchanged'
        const won = await casUpdateUser(payload, user, { avatar: null, ssoAvatarKey: null, ssoAvatarSyncedAt: syncedAt })
        if (!won) return 'stale'
        if (previousMediaId != null) await deletePreviousAvatarMedia(payload, previousMediaId, user.id)
        return 'cleared'
    }

    if (input.avatar_key === user.ssoAvatarKey && previousMediaId != null) return 'unchanged'

    const image = await downloadSsoAvatar(input.avatar_url)
    const media = await payload.create({
        collection: 'media',
        data: { alt: AVATAR_MEDIA_ALT },
        file: { data: image.buffer, mimetype: image.mimetype, name: `sso-avatar-${user.id}.${image.ext}`, size: image.buffer.length },
        overrideAccess: true,
    })

    let won = false
    try {
        won = await casUpdateUser(payload, user, { avatar: media.id, ssoAvatarKey: input.avatar_key, ssoAvatarSyncedAt: syncedAt })
    } finally {
        if (!won) await payload.delete({ collection: 'media', id: media.id, overrideAccess: true }).catch(() => {})
    }
    if (!won) return 'stale'

    if (previousMediaId != null && previousMediaId !== media.id) {
        await deletePreviousAvatarMedia(payload, previousMediaId, user.id)
    }
    return 'updated'
}
