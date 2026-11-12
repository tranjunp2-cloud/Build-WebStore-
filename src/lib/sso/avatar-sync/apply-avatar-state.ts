import type { BasePayload } from 'payload'
import { withMediaCreateLock } from '@/lib/ai/media-create-lock'
import { downloadSsoAvatar } from './download-sso-avatar'
import { casSetAvatarState } from './sso-user-sql'
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
 * Apply the SSO avatar state to a resolved Owner (GH-1723).
 * - stale `changed_at` or same `avatar_key` → no-op (idempotent, ordering-safe)
 * - PRESENT → download, store as Media, link; ABSENT → unlink (initials)
 * - the write is one atomic compare-and-set on `sso_avatar_synced_at` (sso-user-sql.ts); a sync that
 *   lost the race removes its new Media and answers 'stale'
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
        const won = await casSetAvatarState(payload, user.id, user.ssoAvatarSyncedAt ?? null, { avatarId: null, avatarKey: null, syncedAt })
        if (!won) return 'stale'
        if (previousMediaId != null) await deletePreviousAvatarMedia(payload, previousMediaId, user.id)
        return 'cleared'
    }

    if (input.avatar_key === user.ssoAvatarKey && previousMediaId != null) return 'unchanged'

    const image = await downloadSsoAvatar(input.avatar_url)
    // GH-1185: parallel Media creates race in the drizzle adapter (lost rows / 500) — same mutex as uploads.
    // The unique suffix avoids Payload's numeric-suffix renaming (`…-3.png` → `…-4.png`) on name clashes.
    const media = await withMediaCreateLock(() => payload.create({
        collection: 'media',
        data: { alt: AVATAR_MEDIA_ALT },
        file: {
            data: image.buffer,
            mimetype: image.mimetype,
            name: `sso-avatar-u${user.id}-${Date.now().toString(36)}.${image.ext}`,
            size: image.buffer.length,
        },
        overrideAccess: true,
    }))

    let won = false
    try {
        won = await casSetAvatarState(payload, user.id, user.ssoAvatarSyncedAt ?? null, { avatarId: media.id, avatarKey: input.avatar_key, syncedAt })
    } finally {
        if (!won) await payload.delete({ collection: 'media', id: media.id, overrideAccess: true }).catch(() => {})
    }
    if (!won) return 'stale'

    if (previousMediaId != null && previousMediaId !== media.id) {
        await deletePreviousAvatarMedia(payload, previousMediaId, user.id)
    }
    return 'updated'
}
