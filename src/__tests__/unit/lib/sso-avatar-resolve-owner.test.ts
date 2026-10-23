import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ALLOW_EMAIL_BIND, resolveSsoOwner } from '@/lib/sso/avatar-sync/resolve-sso-owner'

const owner = (over: Record<string, unknown> = {}) => ({
    id: 7, email: 'Owner@Example.com', tenants: [{ role: 'owner' }], ssoUserId: null, ...over,
})

describe('resolveSsoOwner (GH-1723)', () => {
    let payload: { find: ReturnType<typeof vi.fn>; db: { pool: { query: ReturnType<typeof vi.fn> } } }
    const input = { ssoUserId: 1234, email: 'owner@example.com' }
    const bindEnabled = { allowEmailBind: true }

    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        // the bind is ONE `UPDATE … WHERE sso_user_id IS NULL RETURNING id`: a row back means it won
        payload = { find: vi.fn(), db: { pool: { query: vi.fn().mockResolvedValue({ rows: [{ id: 7 }] }) } } }
    })

    // Queue results for the (1) lookup by ssoUserId and (2) lookup by email
    const findResults = (byId: unknown[], byEmail: unknown[] = []) => {
        payload.find.mockResolvedValueOnce({ docs: byId }).mockResolvedValueOnce({ docs: byEmail })
    }

    // TC-F23-SSO-09: immutable ssoUserId wins — email is not consulted
    it('uses the user already bound by ssoUserId', async () => {
        findResults([owner({ ssoUserId: 1234 })])

        const result = await resolveSsoOwner(payload as any, input, bindEnabled)

        expect(result).toMatchObject({ ok: true, bound: false, user: { id: 7 } })
        expect(payload.find).toHaveBeenCalledTimes(1)
        expect(payload.db.pool.query).not.toHaveBeenCalled()
    })

    // TC-F23-SSO-09: a bound user that is no longer an Owner is not touched
    it('rejects a bound user that is not an Owner', async () => {
        findResults([owner({ ssoUserId: 1234, tenants: [{ role: 'editor' }] })])
        await expect(resolveSsoOwner(payload as any, input, bindEnabled)).resolves.toEqual({ ok: false, reason: 'not_owner' })
    })

    // TC-F23-SSO-09: GH-1979 — an Owner created before sso_user_id existed binds by email by default
    it('binds an existing Owner by email by default', async () => {
        expect(ALLOW_EMAIL_BIND).toBe(true)
        findResults([], [owner()])

        const result = await resolveSsoOwner(payload as any, input)

        expect(result).toMatchObject({ ok: true, bound: true, user: { id: 7, ssoUserId: 1234 } })
        expect(payload.db.pool.query).toHaveBeenCalledTimes(1)
    })

    // TC-F23-SSO-11: email mapping can still be switched off per call (reports email_bind_disabled)
    it('does not bind by email when allowEmailBind is false and reports email_bind_disabled', async () => {
        findResults([], [owner()])

        const result = await resolveSsoOwner(payload as any, input, { allowEmailBind: false })

        expect(result).toEqual({ ok: false, reason: 'email_bind_disabled' })
        expect(payload.find).toHaveBeenCalledTimes(1) // only the ssoUserId lookup, never the email
        expect(payload.db.pool.query).not.toHaveBeenCalled()
    })

    // TC-F23-SSO-09: first-time bind by exact, case-insensitive email (when enabled)
    it('binds ssoUserId when exactly one unbound Owner matches the email', async () => {
        findResults([], [owner()])

        const result = await resolveSsoOwner(payload as any, { ssoUserId: 1234, email: '  Owner@Example.COM ' }, bindEnabled)

        // exact lookup on the normalized email — no substring LIKE
        expect(payload.find).toHaveBeenLastCalledWith(expect.objectContaining({
            where: { email: { equals: 'owner@example.com' } },
            limit: 2,
        }))
        expect(result).toMatchObject({ ok: true, bound: true, user: { id: 7, ssoUserId: 1234 } })
        // atomic bind: one UPDATE that only matches while the user still has no SSO id
        const [sql, params] = payload.db.pool.query.mock.calls[0]
        expect(sql).toMatch(/UPDATE users SET sso_user_id = \$1/)
        expect(sql).toMatch(/AND sso_user_id IS NULL RETURNING id/)
        expect(params).toEqual([1234, 7])
    })

    // TC-F23-SSO-11: identity preflight outcomes (skip + report, never guess)
    it.each([
        ['not_found', []],
        ['ambiguous_email', [owner(), owner({ id: 9 })]],
        ['sso_id_conflict', [owner({ ssoUserId: 999 })]],
        ['not_owner', [owner({ tenants: [{ role: 'editor' }] })]],
    ])('returns %s without binding', async (reason, byEmail) => {
        findResults([], byEmail)

        const result = await resolveSsoOwner(payload as any, input, bindEnabled)

        expect(result).toEqual({ ok: false, reason })
        expect(payload.db.pool.query).not.toHaveBeenCalled()
    })

    // TC-F23-SSO-09: a concurrent bind already set an SSO id → the guarded UPDATE matches no row
    it('reports sso_id_conflict and overwrites nothing when a concurrent bind won', async () => {
        findResults([], [owner()])
        payload.db.pool.query.mockResolvedValue({ rows: [] })

        await expect(resolveSsoOwner(payload as any, input, bindEnabled)).resolves.toEqual({ ok: false, reason: 'sso_id_conflict' })
    })

    // TC-F23-SSO-09: unique index users_sso_user_id_uniq (Postgres 23505) → this id belongs to another user
    it.each([
        ['pg error', Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' })],
        ['wrapped error', Object.assign(new Error('query failed'), { cause: { code: '23505' } })],
    ])('reports sso_id_conflict on a unique violation (%s)', async (_label, err) => {
        findResults([], [owner()])
        payload.db.pool.query.mockRejectedValue(err)

        await expect(resolveSsoOwner(payload as any, input, bindEnabled)).resolves.toEqual({ ok: false, reason: 'sso_id_conflict' })
    })

    // TC-F23-SSO-06: a transient database error must NOT become a permanent 409 — it propagates (→ 500, SSO retries)
    it('rethrows non-unique database errors so the sync is retried', async () => {
        findResults([], [owner()])
        payload.db.pool.query.mockRejectedValue(Object.assign(new Error('connection terminated'), { code: 'ECONNRESET' }))

        await expect(resolveSsoOwner(payload as any, input, bindEnabled)).rejects.toThrow('connection terminated')
    })
})
