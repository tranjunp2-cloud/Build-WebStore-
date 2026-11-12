/**
 * TC-AISEC-118 — auth responses never carry private user fields. `payload.login` skips field read access, so the
 * custom `POST /api/users/login` returned the OTP hash (sha256 of 6 digits: the OTP step could be skipped with the
 * password alone), the encrypted SSO password (`keyString`), the session list and the password hash.
 */
import { describe, expect, it, vi } from 'vitest'
import { publicUser, Users } from '@/collections/Users'

const secrets = {
    otpHash: 'a'.repeat(64), otpExpiresAt: '2026-10-22', otpAttempts: 0, keyString: 'enc', sessions: [{ id: 's' }],
    hash: 'h', salt: 's', resetPasswordToken: 't', resetPasswordExpiration: 'x', loginAttempts: 1, lockUntil: null,
}
const user = { id: 9, email: 'owner@shop.my', firstName: 'Siti', roles: ['tenant-owner'], tenants: [], ...secrets }

describe('auth responses hide private user fields [TC-AISEC-118]', () => {
    it('publicUser keeps the profile and drops every private field', () => {
        const shown = publicUser(user)

        expect(shown).toMatchObject({ id: 9, email: 'owner@shop.my', firstName: 'Siti' })
        for (const field of Object.keys(secrets)) expect(shown).not.toHaveProperty(field)
    })

    it('POST /api/users/login answers without them', async () => {
        // Arrange
        const login = (Users.endpoints || []).find((e) => e.path === '/login' && e.method === 'post')!
        const req = {
            json: async () => ({ email: 'owner@shop.my', password: 'secret-123' }),
            payload: { login: vi.fn(async () => ({ user: { ...user }, token: 'payload-token' })), find: vi.fn() },
        }

        // Act
        const res = await (login.handler as (r: unknown) => Promise<Response>)(req)
        const body = (await res.json()) as { user: Record<string, unknown> }

        // Assert
        expect(res.status).toBe(200)
        expect(body.user.email).toBe('owner@shop.my')
        for (const field of Object.keys(secrets)) expect(body.user).not.toHaveProperty(field)
    })

    it('TC-PERF-127: populated tenants and createdBy / updatedBy go out as name + slug or a bare id', () => {
        // Arrange: the login read runs at depth 2, so a viewer's membership holds the owner's whole tenant row
        const tenant = { id: 1, name: 'Kedai', slug: 'kedai', xenditSecretKey: 'xnd_secret', xenditCallbackToken: 'cb',
            echIntegration: { apiKey: 'ech' }, easyParcelIntegration: { accessToken: 'ep', refreshToken: 'epr' } }
        const populated = { ...user, tenants: [{ id: 'm1', role: 'viewer', status: 'active', tenant }, { id: 'm2', role: 'owner', tenant: 3 }],
            createdBy: { id: 2, ...secrets }, updatedBy: { id: 9, otpHash: 'b'.repeat(64), keyString: 'enc' } }

        // Act
        const shown = publicUser(populated) as Record<string, unknown>

        // Assert
        expect(shown.tenants).toEqual([
            { id: 'm1', role: 'viewer', status: 'active', tenant: { id: 1, name: 'Kedai', slug: 'kedai' } },
            { id: 'm2', role: 'owner', tenant: 3 },
        ])
        expect(shown.createdBy).toBe(2)
        expect(shown.updatedBy).toBe(9)
        expect(JSON.stringify(shown)).not.toMatch(/xnd_secret|"cb"|"ech"|"ep"|"epr"|b{64}|"enc"/)
    })
})
