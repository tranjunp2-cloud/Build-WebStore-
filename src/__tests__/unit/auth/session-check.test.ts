/**
 * Unit Tests: GET /api/auth/session-check — false-positive eviction prevention
 * TC-IDs: TC-1270-SC-01 through TC-1270-SC-07
 * Bug: #1270 — "Access Revoked" dialog false-positive on HMR / stale tenant cache
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/auth/session-check/route'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockGetCurrentUser = vi.hoisted(() => vi.fn())
const mockIsSubscriptionActive = vi.hoisted(() => vi.fn().mockReturnValue(true))

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('next/server', () => ({
    NextResponse: {
        json: vi.fn((data, init) => ({
            data,
            status: init?.status ?? 200,
            headers: {
                ...(init?.headers ?? {}),
                set(k: string, v: string) { (this as Record<string, string>)[k] = v },
            },
        })),
    },
}))

// cookies() is called at the end of the ok:true path to decode expiresAt.
// Return undefined (no cookie) so expiresAt resolves to null — non-fatal, per best-effort design.
vi.mock('next/headers', () => ({
    cookies: vi.fn(() => Promise.resolve({ get: vi.fn().mockReturnValue(undefined) })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/auth', () => ({
    getCurrentUser: mockGetCurrentUser,
}))

vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    isSubscriptionActive: mockIsSubscriptionActive,
}))

let mockPayload: {
    findByID: ReturnType<typeof vi.fn>
    find: ReturnType<typeof vi.fn>
}

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve(mockPayload)),
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ACTIVE_TENANT = { id: 'tenant-1', status: 'active' }
const ACTIVE_SUB = {
    id: 'sub-1',
    name: 'main',
    status: 'active',
    endsAt: new Date(Date.now() + 86_400_000).toISOString(),
}
const BASE_USER = {
    id: 'user-1',
    email: 'owner@example.com',
    tenants: [{ tenant: 'tenant-1' }],
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('[TC-1270-SC] GET /api/auth/session-check', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockIsSubscriptionActive.mockReturnValue(true)
        mockPayload = {
            findByID: vi.fn(),
            find: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
                if (collection === 'plan-subscriptions') return Promise.resolve({ docs: [ACTIVE_SUB] })
                if (collection === 'tenants') return Promise.resolve({ docs: [ACTIVE_TENANT] })
                return Promise.resolve({ docs: [] })
            }),
        }
    })

    it('TC-1270-SC-01: returns retry:true (not force_logout) when getCurrentUser is null', async () => {
        // Arrange
        mockGetCurrentUser.mockResolvedValue(null)

        // Act
        const res = await GET() as any

        // Assert — must NOT return force_logout; must signal retry
        expect(res.data).toEqual({ ok: false, retry: true })
        expect(res.data.action).toBeUndefined()
    })

    it('TC-1270-SC-02: returns ok:true for valid user with tenant and active subscription', async () => {
        // Arrange
        mockGetCurrentUser.mockResolvedValue(BASE_USER)

        // Act
        const res = await GET() as any

        // Assert — expiresAt is null when no cookie present (best-effort decode)
        expect(res.data).toMatchObject({ ok: true })
    })

    it('TC-1270-SC-03: re-fetches user from DB when JWT tenants empty — force_logout if DB also empty', async () => {
        // Arrange — user object has no tenants (stale JWT cache), DB also returns none
        mockGetCurrentUser.mockResolvedValue({ ...BASE_USER, tenants: [] })
        mockPayload.findByID.mockResolvedValue({ id: 'user-1', tenants: [] })

        // Act
        const res = await GET() as any

        // Assert — confirmed removal via DB → force_logout
        expect(res.data.action).toBe('force_logout')
        expect(res.data.reason).toBe('Removed from workspace')
        expect(mockPayload.findByID).toHaveBeenCalledWith(
            expect.objectContaining({ collection: 'users', id: 'user-1', depth: 1 }),
        )
    })

    it('TC-1270-SC-04: DB re-fetch resolves tenant — does not force_logout, continues to ok:true', async () => {
        // Arrange — JWT tenants stale/empty, but DB has valid tenant
        mockGetCurrentUser.mockResolvedValue({ ...BASE_USER, tenants: [] })
        mockPayload.findByID.mockResolvedValue({
            id: 'user-1',
            tenants: [{ tenant: 'tenant-1' }],
        })

        // Act
        const res = await GET() as any

        // Assert — subscription + ban checks ran, session is ok; expiresAt null (no cookie in test)
        expect(res.data).toMatchObject({ ok: true })
        expect(mockPayload.find).toHaveBeenCalled()
    })

    it('TC-1270-SC-05: force_logout subscription_expired when subscription is inactive', async () => {
        // Arrange
        mockGetCurrentUser.mockResolvedValue(BASE_USER)
        mockIsSubscriptionActive.mockReturnValue(false)

        // Act
        const res = await GET() as any

        // Assert
        expect(res.data.action).toBe('force_logout')
        expect(res.data.reason).toBe('subscription_expired')
    })

    it('TC-1270-SC-06: force_logout Account suspended when tenant.status is suspended', async () => {
        // Arrange
        mockGetCurrentUser.mockResolvedValue(BASE_USER)
        mockPayload.find.mockImplementation(({ collection }: { collection: string }) => {
            if (collection === 'plan-subscriptions') return Promise.resolve({ docs: [ACTIVE_SUB] })
            if (collection === 'tenants') return Promise.resolve({ docs: [{ id: 'tenant-1', status: 'suspended' }] })
            return Promise.resolve({ docs: [] })
        })

        // Act
        const res = await GET() as any

        // Assert
        expect(res.data.action).toBe('force_logout')
        expect(res.data.reason).toBe('Account suspended')
    })

    it('TC-1270-SC-07: returns 500 and does not leak internals on unexpected error', async () => {
        // Arrange
        mockGetCurrentUser.mockRejectedValue(new Error('DB connection lost'))

        // Act
        const res = await GET() as any

        // Assert — generic error shape, no stack trace
        expect(res.status).toBe(500)
        expect(res.data).toEqual({ error: 'Internal Server Error' })
    })
})
