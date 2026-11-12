/**
 * src/lib/auth.ts — getCurrentUser, withAuth, tenant helpers.
 * TC-F02.33, TC-F02-SSO.*, TC-F08-04-26; TC-AISEC-112 — withAuth `csrf` option.
 * Real: lib/auth.ts, lib/auth/session-*.ts, jose (tokens really signed). Faked: Payload's users read, cookies.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { NextResponse } from 'next/server'
import { SignJWT } from 'jose'

// Mock next/headers
const mockGet = vi.fn()
vi.mock('next/headers', () => ({
    cookies: vi.fn(() => Promise.resolve({ get: mockGet })),
}))

// Mock payload: the users read and Payload's derived secret (no permission computation is ever asked for)
const mockAuth = vi.fn()
const mockFindByID = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        secret: 'derived-secret-for-auth-tests-0123',
        auth: mockAuth,
        findByID: mockFindByID,
        db: { defaultIDType: 'number' },
        collections: { users: { config: { auth: {} } } },
    })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('next/server', () => ({
    NextResponse: {
        json: vi.fn((body: unknown, init?: { status?: number }) => ({
            body,
            status: init?.status ?? 200,
        })),
    },
}))

import { getCurrentUser, withAuth, getCurrentTenantId, extractTenantId, tenantIdForQuery } from '@/lib/auth'

const PRIMARY = 'primary-secret-for-auth-tests-0123'
const PEER = 'peer-secret-for-auth-tests-0123456'
const sign = (secret: string, claims: Record<string, unknown>) =>
    new SignJWT({ collection: 'users', ...claims }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
        .sign(new TextEncoder().encode(secret))

let otpToken = ''
beforeAll(async () => {
    otpToken = await sign(PRIMARY, { id: 1, mfa_verified: true })
})

/** A verify-otp session cookie whose users read returns `user`. */
function signedInAs(user: Record<string, unknown>) {
    mockGet.mockReturnValue({ value: otpToken })
    mockFindByID.mockResolvedValue(user)
}

beforeEach(() => {
    vi.stubEnv('PAYLOAD_SECRET', PRIMARY)
    vi.stubEnv('SSO_SHARED_SECRET', '')
    vi.spyOn(console, 'error').mockImplementation(() => {})
})

// ─── TC-F02.33: Auth middleware & role checks ─────────────────────────

describe('getCurrentUser [TC-F02.33]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns null when no payload-token cookie exists', async () => {
        mockGet.mockReturnValue(undefined)

        const user = await getCurrentUser()
        expect(user).toBeNull()
    })

    it('returns user when valid token exists', async () => {
        signedInAs({ id: 1, email: 'test@example.com' })

        const user = await getCurrentUser()
        expect(user).toEqual({ id: 1, email: 'test@example.com', collection: 'users' })
        expect(mockAuth).not.toHaveBeenCalled()
    })

    it('returns null when the token is not a JWT (invalid token)', async () => {
        mockGet.mockReturnValue({ value: 'invalid-token' })

        const user = await getCurrentUser()
        expect(user).toBeNull()
        expect(mockFindByID).not.toHaveBeenCalled()
    })

    it('returns null when payload-token is present but PAYLOAD_SECRET is missing', async () => {
        mockGet.mockReturnValue({ value: otpToken })
        vi.stubEnv('PAYLOAD_SECRET', '')

        const user = await getCurrentUser()
        expect(user).toBeNull()
    })

    it('returns user when the custom JWT is valid (mfa_verified = true)', async () => {
        signedInAs({ id: 123, email: 'test@example.com' })
        mockGet.mockReturnValue({ value: await sign(PRIMARY, { id: 123, mfa_verified: true }) })

        const user = await getCurrentUser()
        expect(user).toEqual({ id: 123, email: 'test@example.com', collection: 'users' })
        expect(mockFindByID).toHaveBeenCalledWith(expect.objectContaining({ collection: 'users', id: 123, depth: 1 }))
    })

    it('returns null when custom JWT has invalid claims (mfa_verified = false)', async () => {
        mockGet.mockReturnValue({ value: await sign(PRIMARY, { id: 123, mfa_verified: false }) })

        const user = await getCurrentUser()
        expect(user).toBeNull()
        expect(mockFindByID).not.toHaveBeenCalled()
    })

    it('returns null when custom JWT id is invalid format', async () => {
        mockGet.mockReturnValue({ value: await sign(PRIMARY, { id: 'invalid id format!', mfa_verified: true }) })

        const user = await getCurrentUser()
        expect(user).toBeNull()
        expect(mockFindByID).not.toHaveBeenCalled()
    })

    it('returns null when the signature does not verify', async () => {
        mockGet.mockReturnValue({ value: await sign('unknown-secret-0123456789-unknown', { id: 1, mfa_verified: true }) })

        const user = await getCurrentUser()
        expect(user).toBeNull()
        expect(mockFindByID).not.toHaveBeenCalled()
    })

    // Plan 260419 staging-bugs-batch — SSO_SHARED_SECRET fallback for cross-service
    // JWT verification. Fixes "signature verification failed at /api/v1/sso/provision"
    // when a peer Payload service (e.g. web-cms-v2) signs with a different secret.
    it('TC-F02-SSO.01 — accepts JWT signed by SSO_SHARED_SECRET when PAYLOAD_SECRET fails', async () => {
        vi.stubEnv('SSO_SHARED_SECRET', PEER)
        signedInAs({ id: 42, email: 'cms@example.com' })
        mockGet.mockReturnValue({ value: await sign(PEER, { id: 42, mfa_verified: true }) })

        const user = await getCurrentUser()
        expect(user).toEqual({ id: 42, email: 'cms@example.com', collection: 'users' })
        expect(mockFindByID).toHaveBeenCalledWith(expect.objectContaining({ collection: 'users', id: 42 }))
    })

    it('TC-F02-SSO.02 — returns null when both PAYLOAD_SECRET and SSO_SHARED_SECRET reject', async () => {
        vi.stubEnv('SSO_SHARED_SECRET', PEER)
        mockGet.mockReturnValue({ value: await sign('third-secret-0123456789-third-sec', { id: 42, mfa_verified: true }) })

        const user = await getCurrentUser()
        expect(user).toBeNull()
        expect(mockFindByID).not.toHaveBeenCalled()
    })

    it('TC-F02-SSO.03 — a peer-signed token is refused when SSO_SHARED_SECRET is unset', async () => {
        mockGet.mockReturnValue({ value: await sign(PEER, { id: 42, mfa_verified: true }) })

        const user = await getCurrentUser()
        expect(user).toBeNull()
    })
})

describe('withAuth [TC-F02.33]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns 401 when user is not authenticated', async () => {
        mockGet.mockReturnValue(undefined) // no cookie

        const handler = vi.fn()
        const wrappedHandler = withAuth(handler)
        const result = await wrappedHandler(new Request('http://localhost'), {} as any)

        expect(handler).not.toHaveBeenCalled()
        expect(result.status).toBe(401)
        expect(result).toMatchObject({ body: { error: 'Unauthorized' } })
    })

    it('uses a route-specific unauthorized response without changing the default', async () => {
        mockGet.mockReturnValue(undefined)
        const handler = vi.fn()
        const unauthorizedResponse = vi.fn((req: Request) => NextResponse.json(
            { success: false, error: { code: 'UNAUTHORIZED', path: new URL(req.url).pathname } },
            { status: 401 },
        ))
        const wrappedHandler = withAuth<{ params: Promise<Record<string, never>> }>(handler, { unauthorizedResponse })
        const request = new Request('http://localhost/api/protected')

        const result = await wrappedHandler(request, { params: Promise.resolve({}) })

        expect(handler).not.toHaveBeenCalled()
        expect(unauthorizedResponse).toHaveBeenCalledWith(request)
        expect(result).toMatchObject({
            status: 401,
            body: {
                success: false,
                error: { code: 'UNAUTHORIZED', path: '/api/protected' },
            },
        })
    })

    it('calls handler with user when authenticated', async () => {
        signedInAs({ id: 1, email: 'admin@test.com' })

        const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
        const wrappedHandler = withAuth(handler)
        await wrappedHandler(new Request('http://localhost'), {} as any)

        expect(handler).toHaveBeenCalledWith(
            expect.objectContaining({ id: 1, email: 'admin@test.com' }),
            expect.any(Request),
            expect.anything(),
        )
    })
})

// ─── TC-AISEC-112: withAuth same-origin (CSRF) option for /api/ai/* ──────────
describe('withAuth csrf option [TC-AISEC-112]', () => {
    const post = (headers: Record<string, string>) =>
        new Request('https://app.test/api/ai/generate-blog', { method: 'POST', headers })

    beforeEach(() => {
        vi.clearAllMocks()
        signedInAs({ id: 1, email: 'owner@shop.test' })
    })

    it('TC-AISEC-112 — refuses a cross-origin POST with 403 before auth or the handler run', async () => {
        // Arrange
        const handler = vi.fn()
        const wrapped = withAuth(handler, { csrf: true })

        // Act
        const result = await wrapped(post({ host: 'app.test', origin: 'https://evil.test' }), {} as any)

        // Assert
        expect(result).toMatchObject({ status: 403, body: { error: 'CSRF verification failed.' } })
        expect(handler).not.toHaveBeenCalled()
        expect(mockFindByID).not.toHaveBeenCalled()
    })

    it('TC-AISEC-112 — refuses a cross-site Referer when Origin is absent', async () => {
        const handler = vi.fn()
        const result = await withAuth(handler, { csrf: true })(
            post({ host: 'app.test', referer: 'https://evil.test/page' }), {} as any)

        expect(result.status).toBe(403)
        expect(handler).not.toHaveBeenCalled()
    })

    it('TC-AISEC-112 — lets a same-origin POST through to the handler', async () => {
        const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))

        await withAuth(handler, { csrf: true })(post({ host: 'app.test', origin: 'https://app.test' }), {} as any)

        expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 1, email: 'owner@shop.test' }), expect.any(Request), expect.anything())
    })

    it('TC-AISEC-112 / TC-PERF-162 — refuses a header-less cookie POST (no session without Origin / Referer)', async () => {
        const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))

        const res = await withAuth(handler, { csrf: true })(post({ host: 'app.test' }), {} as any)

        expect(res.status).toBe(401)
        expect(handler).not.toHaveBeenCalled()
    })

    it('TC-AISEC-112 / TC-PERF-162 — routes without the option refuse a cross-site cookie POST too', async () => {
        const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))

        const res = await withAuth(handler)(post({ host: 'app.test', origin: 'https://evil.test' }), {} as any)

        expect(res.status).toBe(401)
        expect(handler).not.toHaveBeenCalled()
    })
})

// ─── extractTenantId — pure sync, no mocks needed ────────────────────────────
describe('extractTenantId [TC-F02.33]', () => {
    it('returns null when user has no tenants array', () => {
        expect(extractTenantId({ id: 1 })).toBeNull()
    })

    it('returns null when tenants is empty', () => {
        expect(extractTenantId({ id: 1, tenants: [] })).toBeNull()
    })

    it('returns string tenant directly', () => {
        expect(extractTenantId({ tenants: [{ tenant: 'tenant-abc' }] })).toBe('tenant-abc')
    })

    it('returns string id from tenant object', () => {
        expect(extractTenantId({ tenants: [{ tenant: { id: 'tenant-xyz' } }] })).toBe('tenant-xyz')
    })

    it('coerces numeric tenant id to string', () => {
        expect(extractTenantId({ tenants: [{ tenant: { id: 42 } }] })).toBe('42')
    })

    it('returns null when tenant object has no id', () => {
        expect(extractTenantId({ tenants: [{ tenant: { id: undefined } }] })).toBeNull()
    })

    it('returns null when tenant object id is null', () => {
        expect(extractTenantId({ tenants: [{ tenant: { id: null } }] })).toBeNull()
    })
})

describe('getCurrentTenantId [TC-F02.33]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns null when user is not authenticated', async () => {
        mockGet.mockReturnValue(undefined)

        const tenantId = await getCurrentTenantId()
        expect(tenantId).toBeNull()
    })

    it('returns tenant id string when user has tenants', async () => {
        signedInAs({ id: 1, tenants: [{ tenant: 'tenant-abc' }] })

        const tenantId = await getCurrentTenantId()
        expect(tenantId).toBe('tenant-abc')
    })

    it('returns tenant.id when tenant is an object', async () => {
        signedInAs({ id: 1, tenants: [{ tenant: { id: 'tenant-xyz' } }] })

        const tenantId = await getCurrentTenantId()
        expect(tenantId).toBe('tenant-xyz')
    })

    it('returns null when user has no tenants', async () => {
        signedInAs({ id: 1, tenants: [] })

        const tenantId = await getCurrentTenantId()
        expect(tenantId).toBeNull()
    })

    it('returns null when tenants field is undefined [TC-F02.33]', async () => {
        signedInAs({ id: 1 })

        const tenantId = await getCurrentTenantId()
        expect(tenantId).toBeNull()
    })
})

// ─── tenantIdForQuery — pure sync, root-cause guard for GH-1410 ──────────────
// TC-F08-04-26: Coerces numeric-string tenant ids to numbers so Neon integer FK matches.
describe('tenantIdForQuery [TC-F08-04-26]', () => {
    it('coerces all-digit string id to number', () => {
        expect(tenantIdForQuery({ tenants: [{ tenant: '1' }] })).toBe(1)
    })

    it('coerces numeric id (via extractTenantId string path) to number', () => {
        // extractTenantId returns String(42) = "42"; tenantIdForQuery re-coerces to 42
        expect(tenantIdForQuery({ tenants: [{ tenant: { id: 42 } }] })).toBe(42)
    })

    it('preserves non-numeric string ids unchanged', () => {
        expect(tenantIdForQuery({ tenants: [{ tenant: 'abc-tenant' }] })).toBe('abc-tenant')
    })

    it('returns null when tenants array is empty', () => {
        expect(tenantIdForQuery({ tenants: [] })).toBeNull()
    })

    it('returns null when user has no tenants field', () => {
        expect(tenantIdForQuery({ id: 1 })).toBeNull()
    })
})
