/**
 * TC-PERF-001..007, TC-PERF-010..011, TC-PERF-015 — getCurrentUser session fast path and "could not check".
 * Real: lib/auth.ts (getCurrentUser, withAuth, extractTenantId, tenantIdForQuery), lib/auth/session-token.ts,
 * lib/auth/session-user.ts, lib/auth/request-memo.ts,
 * lib/admin/api-utils.ts withSuperAdmin, the session-check route, jose (tokens are really signed here).
 * Faked: Payload (the users read + its derived secret), the cookie store.
 */
import { SignJWT } from 'jose'
import { NextResponse } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const cookieValues = new Map<string, string>()
// Next hands out one cookie store per request: a fresh object per test is a fresh request.
const newCookieStore = () => ({ get: (name: string) => (cookieValues.has(name) ? { value: cookieValues.get(name)! } : undefined) })
let cookieStore = newCookieStore()
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => cookieStore) }))

const findByID = vi.fn()
const payloadAuth = vi.fn()
const getPayload = vi.fn()
vi.mock('payload', () => ({ getPayload: (...args: unknown[]) => getPayload(...args) }))
vi.mock('@payload-config', () => ({ default: {} }))

import {
    AuthUnavailableError,
    extractTenantId,
    getCurrentTenantId,
    getCurrentUser,
    tenantIdForQuery,
    withAuth,
} from '@/lib/auth'
import { SESSION_USER_POPULATE, SESSION_USER_SELECT } from '@/lib/auth/session-user'
import { withSuperAdmin } from '@/lib/admin/api-utils'
import { GET as sessionCheck } from '@/app/api/auth/session-check/route'

const RAW_SECRET = 'raw-payload-secret-for-tests-0123456789'
const DERIVED_SECRET = 'derived-payload-secret-0123456789ab'
const SSO_SECRET = 'peer-sso-secret-for-tests-0123456789'
const SID = 'session-1'

const dbUser = {
    id: 7,
    email: 'owner@shop.my',
    roles: ['tenant-owner'],
    tenants: [{ tenant: { id: 42, name: 'Shop', slug: 'shop', status: 'active' }, role: 'owner', status: 'active', permissions: [] }],
    sessions: [{ id: SID, expiresAt: '2099-01-01T00:00:00.000Z' }],
}

const sign = (secret: string, claims: Record<string, unknown>, header: Record<string, unknown> = {}, exp: string | null = '1h') => {
    const jwt = new SignJWT({ id: 7, collection: 'users', ...claims }).setProtectedHeader({ alg: 'HS256', ...header }).setIssuedAt()
    if (exp) jwt.setExpirationTime(exp)
    return jwt.sign(new TextEncoder().encode(secret))
}
/** Payload's own login token: derived secret, authVersion header, session id. */
const payloadToken = (claims: Record<string, unknown> = { sid: SID }) => sign(DERIVED_SECRET, claims, { authVersion: 1, typ: 'JWT' })
/** The verify-otp / SSO token: raw secret, mfa_verified. */
const otpToken = (claims: Record<string, unknown> = { mfa_verified: true }, secret = RAW_SECRET) => sign(secret, claims)
const bearer = (token: string) => new Request('http://app.test/api/x', { headers: { authorization: `JWT ${token}` } })

beforeEach(() => {
    cookieValues.clear()
    cookieStore = newCookieStore()
    vi.stubEnv('PAYLOAD_SECRET', RAW_SECRET)
    vi.stubEnv('SSO_SHARED_SECRET', SSO_SECRET)
    findByID.mockReset().mockResolvedValue(structuredClone(dbUser))
    payloadAuth.mockReset()
    getPayload.mockReset().mockResolvedValue({
        secret: DERIVED_SECRET,
        auth: payloadAuth,
        findByID,
        db: { defaultIDType: 'number' },
        collections: { users: { config: { auth: {} } } },
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
})

/** Super-admins keep the password token (Payload admin panel / studio); everyone else needs the OTP (TC-PERF-141). */
const superAdminUser = { ...dbUser, roles: ['super-admin'] }

describe('Payload login tokens [TC-PERF-001]', () => {
    it('loads the user with one depth-1 field-selected read and never computes permissions', async () => {
        // Arrange
        findByID.mockResolvedValue(structuredClone(superAdminUser))
        const req = bearer(await payloadToken())

        // Act
        const user = await getCurrentUser(req)

        // Assert
        expect(user).toMatchObject({ id: 7, email: 'owner@shop.my', collection: 'users', _strategy: 'local-jwt', _sid: SID })
        expect(payloadAuth).not.toHaveBeenCalled()
        expect(findByID).toHaveBeenCalledTimes(1)
        expect(findByID).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'users', id: 7, depth: 1, overrideAccess: true, select: SESSION_USER_SELECT, populate: SESSION_USER_POPULATE,
        }))
    })
})

describe('Payload sessions [TC-PERF-002]', () => {
    it('refuses a token whose session was removed (logged out elsewhere)', async () => {
        findByID.mockResolvedValue({ ...structuredClone(superAdminUser), sessions: [{ id: 'another-session' }] })

        expect(await getCurrentUser(bearer(await payloadToken()))).toBeNull()
    })

    it('refuses a Payload token without a session id', async () => {
        findByID.mockResolvedValue(structuredClone(superAdminUser))
        expect(await getCurrentUser(bearer(await payloadToken({})))).toBeNull()
    })

    it('refuses a Payload-shaped token without exp, before any read', async () => {
        const token = await sign(DERIVED_SECRET, { sid: SID }, { authVersion: 1 }, null)

        expect(await getCurrentUser(bearer(token))).toBeNull()
        expect(findByID).not.toHaveBeenCalled()
    })
})

describe('OTP / SSO tokens [TC-PERF-003]', () => {
    it('accepts a verify-otp token signed with the raw PAYLOAD_SECRET', async () => {
        cookieValues.set('payload-token', await otpToken())

        const user = await getCurrentUser()

        expect(user).toMatchObject({ id: 7, collection: 'users' })
        expect(findByID).toHaveBeenCalledTimes(1)
    })

    it('accepts a peer token signed with SSO_SHARED_SECRET', async () => {
        expect(await getCurrentUser(bearer(await otpToken({ mfa_verified: true }, SSO_SECRET)))).toMatchObject({ id: 7 })
    })

    it.each([
        ['no mfa_verified', { mfa_verified: false }],
        ['a malformed id', { id: 'bad id!', mfa_verified: true }],
        ['another collection', { collection: 'customers', mfa_verified: true }],
    ])('refuses a raw-secret token with %s without reading the database', async (_label, claims) => {
        expect(await getCurrentUser(bearer(await otpToken(claims)))).toBeNull()
        expect(findByID).not.toHaveBeenCalled()
    })

    it('refuses a token signed with an unknown secret and logs the SSO hint once', async () => {
        const token = await otpToken({ mfa_verified: true }, 'some-other-service-secret-0123456789')

        expect(await getCurrentUser(bearer(token))).toBeNull()
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('SSO_SHARED_SECRET'))
    })

    it('refuses an expired token quietly (signed out, not an error)', async () => {
        const token = await sign(RAW_SECRET, { mfa_verified: true }, {}, '-1m')

        expect(await getCurrentUser(bearer(token))).toBeNull()
        expect(console.error).not.toHaveBeenCalled()
    })
})

describe('one user load per request [TC-PERF-005]', () => {
    it('reads the user once for repeated calls with the same Request', async () => {
        const req = bearer(await otpToken())

        await getCurrentUser(req)
        await getCurrentUser(req)

        expect(findByID).toHaveBeenCalledTimes(1)
    })

    it('reads the user once per cookie store (server components of one render)', async () => {
        cookieValues.set('payload-token', await otpToken())

        await Promise.all([getCurrentUser(), getCurrentUser(), getCurrentTenantId()])

        expect(findByID).toHaveBeenCalledTimes(1)
    })

    it('reads again for another request', async () => {
        const token = await otpToken()

        await getCurrentUser(bearer(token))
        await getCurrentUser(bearer(token))

        expect(findByID).toHaveBeenCalledTimes(2)
    })
})

describe('password step alone [TC-PERF-141]', () => {
    it.each([
        ['Authorization header', async () => bearer(await payloadToken())],
        ['cookie', async () => { cookieValues.set('payload-token', await payloadToken()); return undefined }],
    ])('refuses a tenant user\'s Payload login token (no OTP) sent as %s', async (_label, makeReq) => {
        // Arrange — the token /api/users/login sets before the OTP step
        const req = await makeReq()

        // Act
        const user = await getCurrentUser(req)

        // Assert
        expect(user).toBeNull()
    })

    it('answers 401 on a withAuth route (e.g. /api/orders) for the password-only token', async () => {
        // Arrange
        const handler = vi.fn(async () => NextResponse.json({ ok: true }))
        const route = withAuth(handler)

        // Act
        const res = await route(bearer(await payloadToken()), undefined as never)

        // Assert
        expect(res.status).toBe(401)
        expect(handler).not.toHaveBeenCalled()
    })

    it('accepts the OTP session of the same user', async () => {
        expect(await getCurrentUser(bearer(await otpToken()))).toMatchObject({ id: 7, email: 'owner@shop.my' })
    })

    it('accepts a Payload token that carries the OTP proof', async () => {
        expect(await getCurrentUser(bearer(await payloadToken({ sid: SID, mfa_verified: true })))).toMatchObject({ id: 7 })
    })

    it('keeps a super-admin\'s password token working (Payload admin panel, /studio)', async () => {
        // Arrange
        findByID.mockResolvedValue(structuredClone(superAdminUser))

        // Act
        const user = await getCurrentUser(bearer(await payloadToken()))

        // Assert
        expect(user).toMatchObject({ id: 7, roles: ['super-admin'] })
    })
})

describe('cookie session on state-changing requests [TC-PERF-162]', () => {
    const cookieRequest = (method: string, headers: Record<string, string> = {}) =>
        new Request('http://app.test/api/x', { method, headers: { host: 'app.test', ...headers } })

    beforeEach(async () => {
        cookieValues.set('payload-token', await otpToken())
    })

    it('refuses a cookie POST with neither Origin nor Referer', async () => {
        expect(await getCurrentUser(cookieRequest('POST'))).toBeNull()
        expect(findByID).not.toHaveBeenCalled()
    })

    it.each(['PATCH', 'PUT', 'DELETE'])('refuses a cookie %s from another site', async (method) => {
        expect(await getCurrentUser(cookieRequest(method, { origin: 'https://evil.example' }))).toBeNull()
    })

    it('accepts a same-site Origin, or a same-site Referer when Origin is absent', async () => {
        expect(await getCurrentUser(cookieRequest('POST', { origin: 'http://app.test' }))).toMatchObject({ id: 7 })
        expect(await getCurrentUser(cookieRequest('DELETE', { referer: 'http://app.test/orders' }))).toMatchObject({ id: 7 })
    })

    it('leaves safe methods and Authorization-token clients alone', async () => {
        expect(await getCurrentUser(cookieRequest('GET'))).toMatchObject({ id: 7 })
        const bearerPost = new Request('http://app.test/api/x', { method: 'POST', headers: { authorization: `Bearer ${await otpToken()}` } })
        expect(await getCurrentUser(bearerPost)).toMatchObject({ id: 7 })
    })

    it('answers 401 on a withAuth POST without Origin / Referer', async () => {
        const handler = vi.fn(async () => NextResponse.json({ ok: true }))

        const res = await withAuth(handler)(cookieRequest('POST'), undefined as never)

        expect(res.status).toBe(401)
        expect(handler).not.toHaveBeenCalled()
    })
})

describe('returned user shape [TC-PERF-006]', () => {
    it('drops the session list and never asks for private fields', async () => {
        findByID.mockResolvedValue(structuredClone(superAdminUser))
        const user = await getCurrentUser(bearer(await payloadToken()))

        expect(user).not.toHaveProperty('sessions')
        const select = Object.keys(SESSION_USER_SELECT)
        for (const privateField of ['hash', 'salt', 'otpHash', 'keyString', 'resetPasswordToken']) expect(select).not.toContain(privateField)
        expect(SESSION_USER_POPULATE.tenants).toMatchObject({ name: true, slug: true, status: true })
        // TC-PERF-151: the raw SSO payload (owner contact) is not carried on every member's session
        expect(SESSION_USER_POPULATE.tenants).not.toHaveProperty('metaData')
    })

    it('answers null without a query for an id the integer key could not hold', async () => {
        expect(await getCurrentUser(bearer(await otpToken({ id: 'abc-def', mfa_verified: true })))).toBeNull()
        expect(findByID).not.toHaveBeenCalled()
    })

    it('answers null when the user no longer exists', async () => {
        findByID.mockResolvedValue(null)

        expect(await getCurrentUser(bearer(await otpToken()))).toBeNull()
    })
})

describe('null user tenant helpers [TC-PERF-007]', () => {
    it.each([null, undefined, 'x', { tenants: null }])('extractTenantId / tenantIdForQuery give null for %j', (user) => {
        expect(extractTenantId(user)).toBeNull()
        expect(tenantIdForQuery(user)).toBeNull()
    })
})

const poolTimeout = () => Object.assign(new Error('Failed query: select "users"."id" …'), {
    cause: new Error('timeout exceeded when trying to connect'),
})

describe('could not check the session [TC-PERF-010]', () => {
    it('throws AuthUnavailableError when the user read fails (pool timeout)', async () => {
        findByID.mockRejectedValue(poolTimeout())

        const error = await getCurrentUser(bearer(await otpToken())).catch((e: unknown) => e)

        expect(error).toBeInstanceOf(AuthUnavailableError)
        expect((error as Error).cause).toBeInstanceOf(Error)
    })

    it('throws AuthUnavailableError when Payload cannot start', async () => {
        getPayload.mockRejectedValue(new Error('connect ECONNREFUSED'))

        await expect(getCurrentUser(bearer(await otpToken()))).rejects.toBeInstanceOf(AuthUnavailableError)
    })

    it('lets the next call of the same request try again after a failure', async () => {
        const req = bearer(await otpToken())
        findByID.mockRejectedValueOnce(poolTimeout())

        await expect(getCurrentUser(req)).rejects.toBeInstanceOf(AuthUnavailableError)
        expect(await getCurrentUser(req)).toMatchObject({ id: 7 })
    })

    it('still answers null (no database) when there is no token', async () => {
        getPayload.mockRejectedValue(new Error('down'))

        expect(await getCurrentUser()).toBeNull()
    })
})

describe('busy answers instead of "sign in" [TC-PERF-011]', () => {
    beforeEach(() => findByID.mockRejectedValue(poolTimeout()))

    it('withAuth answers 503 with Retry-After and never runs the handler', async () => {
        const handler = vi.fn()
        const route = withAuth(handler)

        const res = await route(bearer(await otpToken()), undefined as never)

        expect(res.status).toBe(503)
        expect(res.headers.get('Retry-After')).toBe('5')
        expect(await res.json()).toEqual({ error: 'Service busy, please retry' })
        expect(handler).not.toHaveBeenCalled()
    })

    it('withAuth keeps 401 for a signed-out request', async () => {
        const res = await withAuth(vi.fn())(new Request('http://app.test/api/x'), undefined as never)

        expect(res.status).toBe(401)
    })

    it('withSuperAdmin answers 503', async () => {
        cookieValues.set('payload-token', await otpToken())

        const res = await withSuperAdmin(vi.fn())(new Request('http://app.test/api/admin/x') as never)

        expect(res.status).toBe(503)
    })

    it('/api/auth/session-check answers 503 so the watcher keeps polling instead of counting a sign-out', async () => {
        cookieValues.set('payload-token', await otpToken())

        const res = await sessionCheck()

        expect(res.status).toBe(503)
        expect(res.headers.get('Retry-After')).toBe('5')
    })
})

describe('a starved request ends after the session lookup [TC-PERF-015]', () => {
    it('answers 503 after the one failed acquire; the handler and its queries never run', async () => {
        findByID.mockRejectedValue(poolTimeout())
        const handlerQueries = vi.fn()
        const route = withAuth(async () => {
            handlerQueries()
            throw new Error('unreachable')
        })

        const res = await route(bearer(await otpToken()), undefined as never)

        expect(res.status).toBe(503)
        expect(findByID).toHaveBeenCalledTimes(1)
        expect(handlerQueries).not.toHaveBeenCalled()
    })
})
