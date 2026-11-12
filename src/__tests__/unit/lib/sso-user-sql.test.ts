import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bindSsoUserId, casSetAvatarState } from '@/lib/sso/avatar-sync/sso-user-sql'

// The two guarded writes of the SSO avatar sync are single `UPDATE … WHERE … RETURNING id` statements
// through `payload.db.pool` (GH-1723). These tests pin the statement shape and the result/error semantics.
describe('sso-user-sql (GH-1723)', () => {
    let payload: { db: { pool: { query: ReturnType<typeof vi.fn> } } }

    beforeEach(() => {
        payload = { db: { pool: { query: vi.fn() } } }
    })

    describe('bindSsoUserId', () => {
        // TC-F23-SSO-09: first bind wins
        it("returns 'bound' when the guarded UPDATE changed a row", async () => {
            payload.db.pool.query.mockResolvedValue({ rows: [{ id: 7 }] })

            await expect(bindSsoUserId(payload as any, 7, 1234)).resolves.toBe('bound')

            const [sql, params] = payload.db.pool.query.mock.calls[0]
            expect(sql).toMatch(/UPDATE users SET sso_user_id = \$1/)
            expect(sql).toMatch(/WHERE id = \$2 AND sso_user_id IS NULL RETURNING id/)
            expect(params).toEqual([1234, 7])
        })

        // TC-F23-SSO-09: the user already has an SSO id (concurrent bind) → nothing overwritten
        it("returns 'conflict' when no row matched", async () => {
            payload.db.pool.query.mockResolvedValue({ rows: [] })
            await expect(bindSsoUserId(payload as any, 7, 1234)).resolves.toBe('conflict')
        })

        // TC-F23-SSO-09: the SSO id already belongs to another user (unique index, SQLSTATE 23505)
        it.each([
            ['code on the error', Object.assign(new Error('duplicate key'), { code: '23505' })],
            ['code on the cause', Object.assign(new Error('query failed'), { cause: { code: '23505' } })],
        ])("returns 'conflict' on a unique violation (%s)", async (_label, err) => {
            payload.db.pool.query.mockRejectedValue(err)
            await expect(bindSsoUserId(payload as any, 7, 1234)).resolves.toBe('conflict')
        })

        // TC-F23-SSO-06: anything else must reach the caller (→ 500, SSO retries), never be disguised as a conflict
        it.each([
            ['connection reset', Object.assign(new Error('connection terminated'), { code: 'ECONNRESET' })],
            ['another SQLSTATE (not-null violation)', Object.assign(new Error('null value'), { code: '23502' })],
            ['an error without a code', new Error('boom')],
        ])('rethrows %s', async (_label, err) => {
            payload.db.pool.query.mockRejectedValue(err)
            await expect(bindSsoUserId(payload as any, 7, 1234)).rejects.toBe(err)
        })
    })

    describe('casSetAvatarState', () => {
        const next = { avatarId: 501, avatarKey: 'new.png', syncedAt: '2026-10-20T06:40:00.000Z' }

        // TC-F23-SSO-07: we won the compare-and-set
        it('returns true when the guarded UPDATE changed a row and sends the params in statement order', async () => {
            payload.db.pool.query.mockResolvedValue({ rows: [{ id: 7 }] })

            await expect(casSetAvatarState(payload as any, 7, '2026-10-01T00:00:00.000Z', next)).resolves.toBe(true)

            const [sql, params] = payload.db.pool.query.mock.calls[0]
            expect(sql).toMatch(/SET avatar_id = \$1, sso_avatar_key = \$2, sso_avatar_synced_at = \$3::timestamptz/)
            expect(sql).toMatch(/WHERE id = \$4 AND sso_avatar_synced_at IS NOT DISTINCT FROM \$5::timestamptz/)
            expect(sql).toMatch(/RETURNING id/)
            expect(params).toEqual([501, 'new.png', '2026-10-20T06:40:00.000Z', 7, '2026-10-01T00:00:00.000Z'])
        })

        // TC-F23-SSO-07: another sync changed the state first → false (caller removes its new Media)
        it('returns false when no row matched', async () => {
            payload.db.pool.query.mockResolvedValue({ rows: [] })
            await expect(casSetAvatarState(payload as any, 7, null, next)).resolves.toBe(false)
        })

        // TC-F23-SSO-07: a never-synced Owner is expressed as NULL (NULL-safe comparison)
        it('passes NULL as the expected state for a first sync, and NULLs for ABSENT', async () => {
            payload.db.pool.query.mockResolvedValue({ rows: [{ id: 7 }] })

            await casSetAvatarState(payload as any, 7, null, { avatarId: null, avatarKey: null, syncedAt: next.syncedAt })

            expect(payload.db.pool.query.mock.calls[0][1]).toEqual([null, null, next.syncedAt, 7, null])
        })

        // TC-F23-SSO-06: a database error propagates (→ 500, SSO retries); the caller deletes its new Media
        it('rethrows database errors', async () => {
            const err = new Error('db down')
            payload.db.pool.query.mockRejectedValue(err)
            await expect(casSetAvatarState(payload as any, 7, null, next)).rejects.toBe(err)
        })
    })
})
