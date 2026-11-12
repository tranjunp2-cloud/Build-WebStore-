/**
 * Unit Tests: POST /api/v1/sso/ban-user
 * TC-IDs: TC-1251-SYNC-BU-01 through TC-1251-SYNC-BU-06
 * Behavior: suspends ALL tenants of a user (fire-and-forget, no retry in SSO)
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/v1/sso/ban-user/route'
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockGetCurrentUser = vi.hoisted(() => vi.fn())

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('next/server', () => ({
    NextRequest: vi.fn(),
    NextResponse: {
        json: vi.fn((data, init) => ({ data, status: init?.status ?? 200 })),
    },
}))

vi.mock('@payload-config', () => ({ default: {} }))

const mockRevalidateTag = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ revalidateTag: mockRevalidateTag }))

vi.mock('@/lib/auth', () => ({
    getCurrentUser: mockGetCurrentUser,
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

const createRequest = (headers: Record<string, string>, body: unknown) =>
    ({
        headers: new Headers(headers),
        json: vi.fn().mockResolvedValue(body),
    }) as unknown as NextRequest

const SUPER_ADMIN = { id: 'u1', roles: ['super-admin'] }
const AUTH_HEADER = { authorization: 'Bearer valid-token' }

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/sso/ban-user', () => {
    let mockPayload: { find: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }

    beforeEach(() => {
        vi.clearAllMocks()
        mockPayload = { find: vi.fn(), update: vi.fn() }
        vi.mocked(getPayload).mockResolvedValue(mockPayload as any)
    })

    it('TC-1251-SYNC-BU-01: returns 401 when Authorization header is missing', async () => {
        // Arrange
        const req = createRequest({}, { email: 'user@example.com' })

        // Act
        const res = await POST(req) as unknown as { data: any; status: number }

        // Assert
        expect(res.status).toBe(401)
        expect(res.data.message).toBe('Authorization required')
    })

    it('TC-1251-SYNC-BU-02: returns 403 when caller is not super-admin', async () => {
        // Arrange
        mockGetCurrentUser.mockResolvedValue({ id: 'u1', roles: ['tenant-owner'] })
        const req = createRequest(AUTH_HEADER, { email: 'user@example.com' })

        // Act
        const res = await POST(req) as unknown as { data: any; status: number }

        // Assert
        expect(res.status).toBe(403)
        expect(res.data.message).toBe('Insufficient permissions')
    })

    it('TC-1251-SYNC-BU-03: returns 400 when email is missing', async () => {
        // Arrange
        mockGetCurrentUser.mockResolvedValue(SUPER_ADMIN)
        const req = createRequest(AUTH_HEADER, {})

        // Act
        const res = await POST(req) as unknown as { data: any; status: number }

        // Assert
        expect(res.status).toBe(400)
        expect(res.data.message).toContain('email')
    })

    it('TC-1251-SYNC-BU-04: returns 404 when user is not found', async () => {
        // Arrange
        mockGetCurrentUser.mockResolvedValue(SUPER_ADMIN)
        mockPayload.find.mockResolvedValue({ docs: [] })
        const req = createRequest(AUTH_HEADER, { email: 'ghost@example.com' })

        // Act
        const res = await POST(req) as unknown as { data: any; status: number }

        // Assert
        expect(res.status).toBe(404)
        expect(res.data.message).toBe('User not found')
    })

    it('TC-1251-SYNC-BU-05: user has 0 tenants → 200 with tenantsUpdated:0 (no crash)', async () => {
        // Arrange — user exists but has no tenant memberships
        mockGetCurrentUser.mockResolvedValue(SUPER_ADMIN)
        mockPayload.find.mockResolvedValue({ docs: [{ id: 'u10', email: 'user@example.com', tenants: [] }] })
        const req = createRequest(AUTH_HEADER, { email: 'user@example.com' })

        // Act
        const res = await POST(req) as unknown as { data: any; status: number }

        // Assert
        expect(res.status).toBe(200)
        expect(res.data.tenantsUpdated).toBe(0)
        expect(mockPayload.update).not.toHaveBeenCalled()
    })

    it('TC-1251-SYNC-BU-06: suspends all tenants and returns tenantsUpdated count', async () => {
        // Arrange — user with 2 tenants (depth:1 populated objects)
        mockGetCurrentUser.mockResolvedValue(SUPER_ADMIN)
        mockPayload.find.mockResolvedValue({
            docs: [{
                id: 'u10',
                email: 'user@example.com',
                tenants: [
                    { tenant: { id: 'tenant-a' } },
                    { tenant: { id: 'tenant-b' } },
                ],
            }],
        })
        mockPayload.update.mockResolvedValue({})
        const req = createRequest(AUTH_HEADER, { email: 'user@example.com' })

        // Act
        const res = await POST(req) as unknown as { data: any; status: number }

        // Assert
        expect(res.status).toBe(200)
        expect(res.data.tenantsUpdated).toBe(2)
        expect(mockPayload.update).toHaveBeenCalledTimes(2)
        expect(mockPayload.update).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'tenant-a', data: { status: 'suspended' } }),
        )
        expect(mockPayload.update).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'tenant-b', data: { status: 'suspended' } }),
        )
    })

    it('[TC-F09.285] busts the tenant storefront cache after each write (status shows at once)', async () => {
        // Arrange
        mockGetCurrentUser.mockResolvedValue(SUPER_ADMIN)
        mockPayload.find.mockResolvedValue({ docs: [{ id: 'u10', email: 'user@example.com', tenants: [{ tenant: { id: 7 } }] }] })
        mockPayload.update.mockResolvedValue({ id: 7, slug: 'kedai', status: 'suspended', customDomains: [{ domain: 'kedai.my' }] })

        // Act
        await POST(createRequest(AUTH_HEADER, { email: 'user@example.com' }))

        // Assert
        const tags = mockRevalidateTag.mock.calls.map((c) => c[0])
        expect(tags).toEqual(expect.arrayContaining(['tenant-slug:kedai', 'tenant-domain:kedai.my', 'site-by-tenant-7']))
        expect(mockPayload.update.mock.invocationCallOrder[0]).toBeLessThan(mockRevalidateTag.mock.invocationCallOrder[0])
    })
})
