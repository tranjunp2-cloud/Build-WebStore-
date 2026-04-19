import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

// Mock next/headers
const mockGet = vi.fn()
vi.mock('next/headers', () => ({
    cookies: vi.fn(() => Promise.resolve({ get: mockGet })),
}))

// Mock payload
const mockAuth = vi.fn()
const mockFindByID = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ auth: mockAuth, findByID: mockFindByID })),
}))

const mockJwtVerify = vi.fn()
vi.mock('jose', () => ({
    jwtVerify: (...args: unknown[]) => mockJwtVerify(...args)
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

import { getCurrentUser, withAuth, getCurrentTenantId } from '@/lib/auth'

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
        mockGet.mockReturnValue({ value: 'valid-jwt-token' })
        mockAuth.mockResolvedValue({ user: { id: 1, email: 'test@example.com' } })

        const user = await getCurrentUser()
        expect(user).toEqual({ id: 1, email: 'test@example.com' })
    })

    it('returns null when auth fails (invalid token)', async () => {
        mockGet.mockReturnValue({ value: 'invalid-token' })
        mockAuth.mockResolvedValue({ user: null })

        const user = await getCurrentUser()
        expect(user).toBeNull()
    })

    it('returns null when auth throws error', async () => {
        mockGet.mockReturnValue({ value: 'some-token' })
        mockAuth.mockRejectedValue(new Error('Auth service down'))

        const user = await getCurrentUser()
        expect(user).toBeNull()
    })

    // Custom JWT Fallback Tests
    it('returns null when payload-token is present but PAYLOAD_SECRET is missing', async () => {
        mockGet.mockReturnValue({ value: 'custom-jwt' })
        mockAuth.mockResolvedValue({ user: null })
        const oldSecret = process.env.PAYLOAD_SECRET
        delete process.env.PAYLOAD_SECRET
        
        const user = await getCurrentUser()
        expect(user).toBeNull()
        
        process.env.PAYLOAD_SECRET = oldSecret // restore
    })

    it('returns user when fallback custom JWT is valid (mfa_verified = true)', async () => {
        mockGet.mockReturnValue({ value: 'custom-jwt' })
        mockAuth.mockResolvedValue({ user: null })
        const oldSecret = process.env.PAYLOAD_SECRET
        process.env.PAYLOAD_SECRET = 'test-secret'
        mockJwtVerify.mockResolvedValue({
            payload: { id: 'user-123', collection: 'users', mfa_verified: true }
        })
        mockFindByID.mockResolvedValue({ id: 'user-123', email: 'test@example.com' })

        const user = await getCurrentUser()
        expect(user).toEqual({ id: 'user-123', email: 'test@example.com' })
        expect(mockFindByID).toHaveBeenCalledWith({ collection: 'users', id: 'user-123' })
        
        process.env.PAYLOAD_SECRET = oldSecret // restore
    })

    it('returns null when custom JWT has invalid claims (mfa_verified = false)', async () => {
        mockGet.mockReturnValue({ value: 'custom-jwt' })
        mockAuth.mockResolvedValue({ user: null })
        const oldSecret = process.env.PAYLOAD_SECRET
        process.env.PAYLOAD_SECRET = 'test-secret'
        mockJwtVerify.mockResolvedValue({
            payload: { id: 'user-123', collection: 'users', mfa_verified: false }
        })

        const user = await getCurrentUser()
        expect(user).toBeNull()
        expect(mockFindByID).not.toHaveBeenCalled()
        
        process.env.PAYLOAD_SECRET = oldSecret // restore
    })

    it('returns null when custom JWT id is invalid format', async () => {
        mockGet.mockReturnValue({ value: 'custom-jwt' })
        mockAuth.mockResolvedValue({ user: null })
        const oldSecret = process.env.PAYLOAD_SECRET
        process.env.PAYLOAD_SECRET = 'test-secret'
        mockJwtVerify.mockResolvedValue({
            payload: { id: 'invalid id format!', collection: 'users', mfa_verified: true }
        })

        const user = await getCurrentUser()
        expect(user).toBeNull()
        expect(mockFindByID).not.toHaveBeenCalled()
        
        process.env.PAYLOAD_SECRET = oldSecret // restore
    })

    it('returns null when jwtVerify throws an error', async () => {
        mockGet.mockReturnValue({ value: 'custom-jwt' })
        mockAuth.mockResolvedValue({ user: null })
        const oldSecret = process.env.PAYLOAD_SECRET
        process.env.PAYLOAD_SECRET = 'test-secret'
        mockJwtVerify.mockRejectedValue(new Error('Invalid token signature'))

        const user = await getCurrentUser()
        expect(user).toBeNull()
        expect(mockFindByID).not.toHaveBeenCalled()

        process.env.PAYLOAD_SECRET = oldSecret // restore
    })

    // Plan 260419 staging-bugs-batch — SSO_SHARED_SECRET fallback for cross-service
    // JWT verification. Fixes "signature verification failed at /api/v1/sso/provision"
    // when a peer Payload service (e.g. web-cms-v2) signs with a different secret.
    it('TC-F02-SSO.01 — accepts JWT signed by SSO_SHARED_SECRET when PAYLOAD_SECRET fails', async () => {
        mockGet.mockReturnValue({ value: 'cross-service-jwt' })
        mockAuth.mockResolvedValue({ user: null })
        const oldSecret = process.env.PAYLOAD_SECRET
        const oldShared = process.env.SSO_SHARED_SECRET
        process.env.PAYLOAD_SECRET = 'primary-secret'
        process.env.SSO_SHARED_SECRET = 'peer-secret'
        // First verify (PAYLOAD_SECRET) fails → second verify (SSO_SHARED_SECRET) succeeds.
        mockJwtVerify
            .mockRejectedValueOnce(new Error('signature verification failed'))
            .mockResolvedValueOnce({
                payload: { id: 'user-42', collection: 'users', mfa_verified: true },
            })
        mockFindByID.mockResolvedValue({ id: 'user-42', email: 'cms@example.com' })

        const user = await getCurrentUser()
        expect(user).toEqual({ id: 'user-42', email: 'cms@example.com' })
        expect(mockJwtVerify).toHaveBeenCalledTimes(2)
        expect(mockFindByID).toHaveBeenCalledWith({ collection: 'users', id: 'user-42' })

        process.env.PAYLOAD_SECRET = oldSecret
        process.env.SSO_SHARED_SECRET = oldShared
    })

    it('TC-F02-SSO.02 — returns null when both PAYLOAD_SECRET and SSO_SHARED_SECRET reject', async () => {
        mockGet.mockReturnValue({ value: 'bad-jwt' })
        mockAuth.mockResolvedValue({ user: null })
        const oldSecret = process.env.PAYLOAD_SECRET
        const oldShared = process.env.SSO_SHARED_SECRET
        process.env.PAYLOAD_SECRET = 'primary-secret'
        process.env.SSO_SHARED_SECRET = 'peer-secret'
        mockJwtVerify
            .mockRejectedValueOnce(new Error('signature verification failed'))
            .mockRejectedValueOnce(new Error('signature verification failed'))

        const user = await getCurrentUser()
        expect(user).toBeNull()
        expect(mockJwtVerify).toHaveBeenCalledTimes(2)
        expect(mockFindByID).not.toHaveBeenCalled()

        process.env.PAYLOAD_SECRET = oldSecret
        process.env.SSO_SHARED_SECRET = oldShared
    })

    it('TC-F02-SSO.03 — does NOT call jwtVerify twice when SSO_SHARED_SECRET is unset', async () => {
        mockGet.mockReturnValue({ value: 'bad-jwt' })
        mockAuth.mockResolvedValue({ user: null })
        const oldSecret = process.env.PAYLOAD_SECRET
        const oldShared = process.env.SSO_SHARED_SECRET
        process.env.PAYLOAD_SECRET = 'primary-secret'
        delete process.env.SSO_SHARED_SECRET
        mockJwtVerify.mockRejectedValueOnce(new Error('signature verification failed'))

        const user = await getCurrentUser()
        expect(user).toBeNull()
        expect(mockJwtVerify).toHaveBeenCalledTimes(1)

        process.env.PAYLOAD_SECRET = oldSecret
        if (oldShared !== undefined) process.env.SSO_SHARED_SECRET = oldShared
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
    })

    it('calls handler with user when authenticated', async () => {
        mockGet.mockReturnValue({ value: 'valid-token' })
        mockAuth.mockResolvedValue({ user: { id: 1, email: 'admin@test.com' } })

        const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
        const wrappedHandler = withAuth(handler)
        await wrappedHandler(new Request('http://localhost'), {} as any)

        expect(handler).toHaveBeenCalledWith(
            { id: 1, email: 'admin@test.com' },
            expect.any(Request),
            expect.anything(),
        )
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
        mockGet.mockReturnValue({ value: 'valid-token' })
        mockAuth.mockResolvedValue({
            user: { id: 1, tenants: [{ tenant: 'tenant-abc' }] },
        })

        const tenantId = await getCurrentTenantId()
        expect(tenantId).toBe('tenant-abc')
    })

    it('returns tenant.id when tenant is an object', async () => {
        mockGet.mockReturnValue({ value: 'valid-token' })
        mockAuth.mockResolvedValue({
            user: { id: 1, tenants: [{ tenant: { id: 'tenant-xyz' } }] },
        })

        const tenantId = await getCurrentTenantId()
        expect(tenantId).toBe('tenant-xyz')
    })

    it('returns null when user has no tenants', async () => {
        mockGet.mockReturnValue({ value: 'valid-token' })
        mockAuth.mockResolvedValue({
            user: { id: 1, tenants: [] },
        })

        const tenantId = await getCurrentTenantId()
        expect(tenantId).toBeNull()
    })

    it('returns null when tenants field is undefined', async () => {
        mockGet.mockReturnValue({ value: 'valid-token' })
        mockAuth.mockResolvedValue({ user: { id: 1 } })

        const tenantId = await getCurrentTenantId()
        expect(tenantId).toBeNull()
    })
})
