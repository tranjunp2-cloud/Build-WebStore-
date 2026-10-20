import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyAvatarState, AVATAR_MEDIA_ALT } from '@/lib/sso/avatar-sync/apply-avatar-state'
import { downloadSsoAvatar, AvatarDownloadError } from '@/lib/sso/avatar-sync/download-sso-avatar'
import type { SyncAvatarInput } from '@/lib/sso/avatar-sync/sync-avatar-schema'

vi.mock('@/lib/sso/avatar-sync/download-sso-avatar', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/sso/avatar-sync/download-sso-avatar')>()
    return { ...actual, downloadSsoAvatar: vi.fn() }
})

const present = (over: Partial<SyncAvatarInput> = {}): SyncAvatarInput => ({
    sso_user_id: 1234,
    email: 'owner@example.com',
    state: 'PRESENT',
    avatar_url: 'https://sso-bucket.s3.amazonaws.com/images/users/new.png',
    avatar_key: 'new.png',
    changed_at: '2026-10-20T06:40:00Z',
    trigger: 'update',
    ...over,
} as SyncAvatarInput)

const absent: SyncAvatarInput = {
    sso_user_id: 1234, email: 'owner@example.com', state: 'ABSENT', changed_at: '2026-10-20T06:40:00Z', trigger: 'update',
}

describe('applyAvatarState (GH-1723)', () => {
    let payload: Record<'find' | 'findByID' | 'create' | 'update' | 'delete', ReturnType<typeof vi.fn>>

    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        payload = {
            find: vi.fn().mockResolvedValue({ docs: [] }),
            findByID: vi.fn().mockResolvedValue({ id: 400, alt: AVATAR_MEDIA_ALT }),
            create: vi.fn().mockResolvedValue({ id: 501 }),
            // bulk update (CAS) → one doc updated = we won
            update: vi.fn().mockResolvedValue({ docs: [{ id: 7 }], errors: [] }),
            delete: vi.fn().mockResolvedValue({}),
        }
        vi.mocked(downloadSsoAvatar).mockResolvedValue({ buffer: Buffer.from([0x89, 0x50, 0x4E, 0x47]), mimetype: 'image/png', ext: 'png' })
    })

    // TC-F23-SSO-01: PRESENT replaces the legacy/previous avatar and purges the old avatar Media
    it('stores the SSO avatar as Media, links it via CAS and deletes the old avatar Media', async () => {
        const user = { id: 7, avatar: { id: 400 }, ssoAvatarKey: 'old.png', ssoAvatarSyncedAt: '2026-10-01T00:00:00.000Z' }

        const result = await applyAvatarState(payload as any, user, present())

        expect(result).toBe('updated')
        expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({ collection: 'media', data: { alt: AVATAR_MEDIA_ALT } }))
        expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'users',
            overrideAccess: true,
            where: { and: [{ id: { equals: 7 } }, { ssoAvatarSyncedAt: { equals: '2026-10-01T00:00:00.000Z' } }] },
            data: { avatar: 501, ssoAvatarKey: 'new.png', ssoAvatarSyncedAt: '2026-10-20T06:40:00.000Z' },
        }))
        expect(payload.delete).toHaveBeenCalledWith(expect.objectContaining({ collection: 'media', id: 400 }))
    })

    // TC-F23-SSO-07: first sync guards on "never synced"
    it('guards the first sync with ssoAvatarSyncedAt not existing', async () => {
        await applyAvatarState(payload as any, { id: 7, avatar: null }, present())

        expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { and: [{ id: { equals: 7 } }, { ssoAvatarSyncedAt: { exists: false } }] },
        }))
    })

    // TC-F23-SSO-07: same avatar_key → idempotent no-op
    it('returns unchanged for a duplicate event', async () => {
        const user = { id: 7, avatar: 400, ssoAvatarKey: 'new.png', ssoAvatarSyncedAt: '2026-10-20T06:40:00.000Z' }

        await expect(applyAvatarState(payload as any, user, present())).resolves.toBe('unchanged')
        expect(downloadSsoAvatar).not.toHaveBeenCalled()
        expect(payload.update).not.toHaveBeenCalled()
    })

    // TC-F23-SSO-07: older event never rolls back a newer state
    it('returns stale for an out-of-order event', async () => {
        const user = { id: 7, avatar: 400, ssoAvatarKey: 'newer.png', ssoAvatarSyncedAt: '2026-10-21T00:00:00.000Z' }

        await expect(applyAvatarState(payload as any, user, present())).resolves.toBe('stale')
        expect(payload.update).not.toHaveBeenCalled()
    })

    // TC-F23-SSO-07: concurrent sync won the CAS → our new Media is removed, old Media kept
    it('returns stale and removes its new Media when it loses the compare-and-set', async () => {
        payload.update.mockResolvedValue({ docs: [], errors: [] })

        const result = await applyAvatarState(payload as any, { id: 7, avatar: 400 }, present())

        expect(result).toBe('stale')
        expect(payload.delete).toHaveBeenCalledWith(expect.objectContaining({ collection: 'media', id: 501 }))
        expect(payload.delete).not.toHaveBeenCalledWith(expect.objectContaining({ id: 400 }))
    })

    // TC-F23-SSO-02 / TC-F23-SSO-05: ABSENT unlinks the avatar (initials) and purges stored Media
    it('clears the avatar and deletes the old avatar Media on ABSENT', async () => {
        const user = { id: 7, avatar: 400, ssoAvatarKey: 'old.png' }

        const result = await applyAvatarState(payload as any, user, absent)

        expect(result).toBe('cleared')
        expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
            data: { avatar: null, ssoAvatarKey: null, ssoAvatarSyncedAt: '2026-10-20T06:40:00.000Z' },
        }))
        expect(payload.delete).toHaveBeenCalledWith(expect.objectContaining({ collection: 'media', id: 400 }))
    })

    // TC-F23-SSO-02: ABSENT on an Owner with no avatar is a no-op
    it('returns unchanged on ABSENT when there is nothing to clear', async () => {
        await expect(applyAvatarState(payload as any, { id: 7, avatar: null }, absent)).resolves.toBe('unchanged')
        expect(payload.update).not.toHaveBeenCalled()
    })

    // TC-F23-SSO-06: download failure keeps the last-known avatar
    it('propagates download errors without touching the user', async () => {
        vi.mocked(downloadSsoAvatar).mockRejectedValue(new AvatarDownloadError('HTTP 503', true))

        await expect(applyAvatarState(payload as any, { id: 7, avatar: 400 }, present())).rejects.toThrow(AvatarDownloadError)
        expect(payload.create).not.toHaveBeenCalled()
        expect(payload.update).not.toHaveBeenCalled()
    })

    // TC-F23-SSO-06: failed user update removes the just-created Media (no orphan)
    it('rolls back the new Media when linking it fails', async () => {
        payload.update.mockRejectedValue(new Error('db down'))

        await expect(applyAvatarState(payload as any, { id: 7, avatar: 400 }, present())).rejects.toThrow('db down')
        expect(payload.delete).toHaveBeenCalledWith(expect.objectContaining({ collection: 'media', id: 501 }))
        expect(payload.delete).not.toHaveBeenCalledWith(expect.objectContaining({ id: 400 }))
    })

    // TC-F23-SSO-09: never delete Media still referenced by another user
    it('keeps the old Media when another user still references it', async () => {
        payload.find.mockResolvedValue({ docs: [{ id: 99 }] })

        await applyAvatarState(payload as any, { id: 7, avatar: 400 }, present())

        expect(payload.delete).not.toHaveBeenCalled()
    })

    // TC-F23-SSO-09: never delete library/site Media that was only assigned as avatar
    it('keeps the old Media when it was not created by an avatar flow', async () => {
        payload.findByID.mockResolvedValue({ id: 400, alt: 'Homepage banner' })

        await applyAvatarState(payload as any, { id: 7, avatar: 400 }, present())

        expect(payload.delete).not.toHaveBeenCalled()
    })
})
