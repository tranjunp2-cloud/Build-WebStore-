import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveSsoOwner } from '@/lib/sso/avatar-sync/resolve-sso-owner'

const owner = (over: Record<string, unknown> = {}) => ({
    id: 7, email: 'Owner@Example.com', tenants: [{ role: 'owner' }], ssoUserId: null, ...over,
})

describe('resolveSsoOwner (GH-1723)', () => {
    let payload: { find: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
    const input = { ssoUserId: 1234, email: 'owner@example.com' }

    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        // bulk `update` (where) → one doc updated means the bind won
        payload = { find: vi.fn(), update: vi.fn().mockResolvedValue({ docs: [{ id: 7 }], errors: [] }) }
    })

    // Queue results for the (1) lookup by ssoUserId and (2) lookup by email
    const findResults = (byId: unknown[], byEmail: unknown[] = []) => {
        payload.find.mockResolvedValueOnce({ docs: byId }).mockResolvedValueOnce({ docs: byEmail })
    }

    // TC-F23-SSO-09: immutable ssoUserId wins — email is not consulted
    it('uses the user already bound by ssoUserId', async () => {
        findResults([owner({ ssoUserId: 1234 })])

        const result = await resolveSsoOwner(payload as any, input)

        expect(result).toMatchObject({ ok: true, bound: false, user: { id: 7 } })
        expect(payload.find).toHaveBeenCalledTimes(1)
        expect(payload.update).not.toHaveBeenCalled()
    })

    // TC-F23-SSO-09: a bound user that is no longer an Owner is not touched
    it('rejects a bound user that is not an Owner', async () => {
        findResults([owner({ ssoUserId: 1234, tenants: [{ role: 'editor' }] })])
        await expect(resolveSsoOwner(payload as any, input)).resolves.toEqual({ ok: false, reason: 'not_owner' })
    })

    // TC-F23-SSO-09: first-time bind by exact, case-insensitive email
    it('binds ssoUserId when exactly one unbound Owner matches the email', async () => {
        findResults([], [owner()])

        const result = await resolveSsoOwner(payload as any, { ssoUserId: 1234, email: '  Owner@Example.COM ' })

        // exact lookup on the normalized email — no substring LIKE (review #2)
        expect(payload.find).toHaveBeenLastCalledWith(expect.objectContaining({
            where: { email: { equals: 'owner@example.com' } },
            limit: 2,
        }))

        expect(result).toMatchObject({ ok: true, bound: true, user: { id: 7, ssoUserId: 1234 } })
        // atomic bind: guarded by `ssoUserId` still being unset
        expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'users',
            where: { and: [{ id: { equals: 7 } }, { ssoUserId: { exists: false } }] },
            data: { ssoUserId: 1234 },
            overrideAccess: true,
        }))
    })

    // TC-F23-SSO-11: identity preflight outcomes (skip + report, never guess)
    it.each([
        ['not_found', []],
        ['ambiguous_email', [owner(), owner({ id: 9 })]],
        ['sso_id_conflict', [owner({ ssoUserId: 999 })]],
        ['not_owner', [owner({ tenants: [{ role: 'editor' }] })]],
    ])('returns %s without binding', async (reason, byEmail) => {
        findResults([], byEmail)

        const result = await resolveSsoOwner(payload as any, input)

        expect(result).toEqual({ ok: false, reason })
        expect(payload.update).not.toHaveBeenCalled()
    })

    // TC-F23-SSO-09: unique index race on bind → conflict, not a crash
    it('reports sso_id_conflict when the bind hits the unique index', async () => {
        findResults([], [owner()])
        payload.update.mockRejectedValue(new Error('duplicate key value violates unique constraint "users_sso_user_id_uniq"'))

        await expect(resolveSsoOwner(payload as any, input)).resolves.toEqual({ ok: false, reason: 'sso_id_conflict' })
    })

    // TC-F23-SSO-09: bulk update reports the unique violation in `errors` instead of throwing
    it('reports sso_id_conflict when the bulk update returns errors', async () => {
        findResults([], [owner()])
        payload.update.mockResolvedValue({ docs: [], errors: [{ id: 7, message: 'duplicate key' }] })

        await expect(resolveSsoOwner(payload as any, input)).resolves.toEqual({ ok: false, reason: 'sso_id_conflict' })
    })

    // TC-F23-SSO-09: another request bound a different SSO id first → our guarded update matches nothing
    it('reports sso_id_conflict and does not overwrite when a concurrent bind won', async () => {
        findResults([], [owner()])
        payload.update.mockResolvedValue({ docs: [], errors: [] })

        await expect(resolveSsoOwner(payload as any, input)).resolves.toEqual({ ok: false, reason: 'sso_id_conflict' })
    })
})
