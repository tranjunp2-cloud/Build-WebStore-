/**
 * TC-AISEC-013..016 — the copilot needs a session that passed the OTP step, and acts in the tenant's platform org.
 * `POST /api/users/login` returns Payload's own token after the password alone (no `mfa_verified`); the middleware
 * keeps it out of pages, but `/api/*` is not behind the middleware, so the token drove refunds, buyer emails and
 * publishing through `/api/agent/*` (live-confirmed in the audit, H-S1). The session fast path (TC-PERF-141) still
 * lets super-admins use the password token elsewhere (Payload admin panel), so `requireMfa` must refuse it for
 * everyone, super-admins included.
 * Real: lib/auth.ts getCurrentUser, lib/auth/session-token.ts + session-user.ts, lib/ai-platform/context.ts
 * resolveAgentActor / actorForSessionUserInTenant, lib/auth/bridge-token.ts, jose (tokens are really signed here).
 * Faked: Payload (its derived secret, the users / tenants reads), the cookie store.
 */
import { SignJWT } from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const cookieValues = new Map<string, string>()
vi.mock('next/headers', () => ({
    // One cookie store per call: each getCurrentUser() call below is its own request.
    cookies: vi.fn(async () => ({ get: (name: string) => (cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined) })),
}))
const findByID = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        secret: DERIVED_SECRET,
        findByID,
        db: { defaultIDType: 'number' },
        collections: { users: { config: { auth: {} } } },
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { getCurrentUser } from '@/lib/auth'
import { actorForSessionUserInTenant, AgentAccessError, resolveAgentActor } from '@/lib/ai-platform/context'
import { toPlatformOrganizationId } from '@/lib/auth/bridge-token'
import type { PlatformUser } from '@/types/user'

const RAW_SECRET = 'raw-payload-secret-for-tests-0123456789'
const DERIVED_SECRET = 'derived-payload-secret-0123456789ab'
const SID = 'session-1'
const PINNED_ORG = 'org_legacyech0000000000000001'

const owner = {
    id: 3,
    email: 'owner@shop.my',
    roles: ['tenant-owner'],
    tenants: [{ tenant: { id: 42, name: 'Shop', slug: 'shop', status: 'active' }, role: 'owner', status: 'active' }],
    sessions: [{ id: SID }],
}
const superAdmin = { ...owner, roles: ['super-admin'] }

const sign = (secret: string, claims: Record<string, unknown>, header: Record<string, unknown> = {}) =>
    new SignJWT({ id: 3, collection: 'users', ...claims })
        .setProtectedHeader({ alg: 'HS256', ...header })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(new TextEncoder().encode(secret))
/** Payload's own login token (password step only unless the claim is added). */
const passwordToken = (claims: Record<string, unknown> = {}) => sign(DERIVED_SECRET, { sid: SID, ...claims }, { authVersion: 1, typ: 'JWT' })
/** The verify-otp / SSO token. */
const otpToken = () => sign(RAW_SECRET, { mfa_verified: true })

/** The users read answers with `user`; the tenants read (platform-org pin) answers with `tenantDoc`. */
function database(user: object, tenantDoc: object | null = { id: 42, metaData: null }) {
    findByID.mockImplementation(async ({ collection }: { collection: string }) =>
        collection === 'users' ? structuredClone(user) : structuredClone(tenantDoc),
    )
}

beforeEach(() => {
    cookieValues.clear()
    vi.stubEnv('PAYLOAD_SECRET', RAW_SECRET)
    findByID.mockReset()
    database(owner)
})

afterEach(() => {
    vi.unstubAllEnvs()
})

describe('getCurrentUser requireMfa [TC-AISEC-013]', () => {
    it('refuses a password-only Payload token', async () => {
        // Arrange
        cookieValues.set('payload-token', await passwordToken())

        // Act
        const strict = await getCurrentUser(undefined, { requireMfa: true })

        // Assert
        expect(strict).toBeNull()
    })

    it('refuses a super-admin password-only token too', async () => {
        database(superAdmin)
        cookieValues.set('payload-token', await passwordToken())

        expect(await getCurrentUser(undefined, { requireMfa: true })).toBeNull()
    })

    it('accepts the session once it passed the OTP step (Payload token with the claim, or the verify-otp token)', async () => {
        cookieValues.set('payload-token', await passwordToken({ mfa_verified: true }))
        expect(await getCurrentUser(undefined, { requireMfa: true })).toMatchObject({ id: 3, email: 'owner@shop.my' })

        cookieValues.set('payload-token', await otpToken())
        expect(await getCurrentUser(undefined, { requireMfa: true })).toMatchObject({ id: 3, email: 'owner@shop.my' })
    })

    it('applies the requirement per call when one request asks both ways (shared per-request load)', async () => {
        // Arrange: one Request = one memo scope
        database(superAdmin)
        const req = new Request('http://app.test/api/x', { headers: { authorization: `JWT ${await passwordToken()}` } })

        // Act
        const plain = await getCurrentUser(req)
        const strict = await getCurrentUser(req, { requireMfa: true })

        // Assert
        expect(plain).toMatchObject({ id: 3 })
        expect(strict).toBeNull()
        expect(findByID).toHaveBeenCalledTimes(1)
    })
})

describe('getCurrentUser without requireMfa [TC-AISEC-014]', () => {
    it('keeps the super-admin password token working (Payload admin panel, /studio)', async () => {
        database(superAdmin)
        cookieValues.set('payload-token', await passwordToken())

        expect(await getCurrentUser()).toMatchObject({ id: 3, roles: ['super-admin'] })
    })

    it('refuses a merchant password-only token (OTP gate for everyone else, TC-PERF-141)', async () => {
        cookieValues.set('payload-token', await passwordToken())

        expect(await getCurrentUser()).toBeNull()
    })
})

describe('resolveAgentActor [TC-AISEC-015]', () => {
    it('answers 401 to a super-admin password-only token sent as a bearer header', async () => {
        // Arrange
        database(superAdmin)
        const req = new Request('http://app.test/api/agent/runs', { headers: { authorization: `JWT ${await passwordToken()}` } })

        // Act
        const refused = await resolveAgentActor(req).catch((error: unknown) => error)

        // Assert
        expect(refused).toBeInstanceOf(AgentAccessError)
        expect((refused as AgentAccessError).status).toBe(401)
    })
})

describe('actorForSessionUserInTenant platform-org pin [TC-AISEC-016]', () => {
    const sessionUser = { ...owner, id: '3' } as unknown as PlatformUser

    it('bills a tenant pinned to an existing platform org to that org, reading only metaData', async () => {
        // Arrange
        database(owner, { id: 42, metaData: { platformOrgId: PINNED_ORG, platformOrgName: 'Legacy ECH', ownerEmail: 'pii@x.my' } })

        // Act
        const actor = await actorForSessionUserInTenant(sessionUser, '42')

        // Assert
        expect(actor.organizationId).toBe(PINNED_ORG)
        expect(actor.tenantId).toBe('42')
        expect(findByID).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'tenants', id: 42, overrideAccess: true, select: { metaData: true },
        }))
        // The actor keeps the session user as given: no SSO metaData copied onto it
        expect(actor.user).toBe(sessionUser)
    })

    it('falls back to the derived org when the tenant has no pin', async () => {
        const actor = await actorForSessionUserInTenant(sessionUser, '42')

        expect(actor.organizationId).toBe(toPlatformOrganizationId('42'))
    })

    it('still refuses a workspace the user is not a member of, without reading it', async () => {
        const refused = await actorForSessionUserInTenant(sessionUser, '99').catch((error: unknown) => error)

        expect(refused).toBeInstanceOf(AgentAccessError)
        expect((refused as AgentAccessError).status).toBe(403)
        expect(findByID).not.toHaveBeenCalled()
    })
})
