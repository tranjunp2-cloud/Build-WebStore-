import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

// Mock next/headers
const mockGet = vi.fn()
vi.mock('next/headers', () => ({
    cookies: vi.fn(() => Promise.resolve({ get: mockGet })),
}))

// Mock payload
const mockAuth = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ auth: mockAuth })),
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
