/**
 * Unit Tests: GET /api/v1/sso/check-email
 * TC-IDs: TC-1251-SYNC-CE-01 through TC-1251-SYNC-CE-06
 * Bug fix: #1251 TC-3.06 — DB error must return {exists: false, error: 'service_unavailable'} 200
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/v1/sso/check-email/route'
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

vi.mock('@/lib/auth', () => ({
    getCurrentUser: mockGetCurrentUser,
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

const createRequest = (headers: Record<string, string>, email?: string) =>
    ({
        headers: new Headers(headers),
        nextUrl: { searchParams: { get: vi.fn().mockReturnValue(email ?? null) } },
    }) as unknown as NextRequest

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/sso/check-email', () => {
    let mockPayload: { find: ReturnType<typeof vi.fn> }

    beforeEach(() => {
        vi.clearAllMocks()
        mockPayload = { find: vi.fn() }
        vi.mocked(getPayload).mockResolvedValue(mockPayload as any)
    })

    it('TC-1251-SYNC-CE-01: returns 401 when Authorization header is missing', async () => {
        // Arrange
        const req = createRequest({})

        // Act
        const res = await GET(req) as unknown as { data: any; status: number }

        // Assert
        expect(res.status).toBe(401)
        expect(res.data.message).toBe('Authorization required')
    })

    it('TC-1251-SYNC-CE-01b: returns 401 when Authorization header malformed (no Bearer prefix)', async () => {
        // Arrange — route rejects at header check before calling getCurrentUser
        const req = createRequest({ authorization: 'Token abc123' })

        // Act
        const res = await GET(req) as unknown as { data: any; status: number }

        // Assert
        expect(res.status).toBe(401)
        expect(res.data.message).toBe('Authorization required')
    })

    it('TC-1251-SYNC-CE-02: returns 403 when caller is not super-admin', async () => {
        // Arrange
        mockGetCurrentUser.mockResolvedValue({ id: 'u1', roles: ['tenant-owner'] })
        const req = createRequest({ authorization: 'Bearer valid-token' }, 'user@example.com')

        // Act
        const res = await GET(req) as unknown as { data: any; status: number }

        // Assert
        expect(res.status).toBe(403)
        expect(res.data.message).toBe('Insufficient permissions')
    })

    it('TC-1251-SYNC-CE-03: returns 400 when email query param is missing', async () => {
        // Arrange
        mockGetCurrentUser.mockResolvedValue({ id: 'u1', roles: ['super-admin'] })
        const req = createRequest({ authorization: 'Bearer valid-token' }, undefined)

        // Act
        const res = await GET(req) as unknown as { data: any; status: number }

        // Assert
        expect(res.status).toBe(400)
        expect(res.data.message).toContain('email')
    })

    it('TC-1251-SYNC-CE-04a: returns { exists: true } when email is found', async () => {
        // Arrange
        mockGetCurrentUser.mockResolvedValue({ id: 'u1', roles: ['super-admin'] })
        mockPayload.find.mockResolvedValue({ docs: [{ id: 'u99', email: 'found@example.com' }] })
        const req = createRequest({ authorization: 'Bearer valid-token' }, 'found@example.com')

        // Act
        const res = await GET(req) as unknown as { data: any; status: number }

        // Assert
        expect(res.status).toBe(200)
        expect(res.data.exists).toBe(true)
    })

    it('TC-1251-SYNC-CE-04b: returns { exists: false } when email is not found', async () => {
        // Arrange
        mockGetCurrentUser.mockResolvedValue({ id: 'u1', roles: ['super-admin'] })
        mockPayload.find.mockResolvedValue({ docs: [] })
        const req = createRequest({ authorization: 'Bearer valid-token' }, 'missing@example.com')

        // Act
        const res = await GET(req) as unknown as { data: any; status: number }

        // Assert — normal not-found path must NOT include error sentinel
        expect(res.status).toBe(200)
        expect(res.data.exists).toBe(false)
        expect(res.data.error).toBeUndefined()
    })

    it('TC-1251-SYNC-CE-05: DB error → fail-safe { exists: false, error: "service_unavailable" } 200 (TC-3.06 fix)', async () => {
        // Arrange
        mockGetCurrentUser.mockResolvedValue({ id: 'u1', roles: ['super-admin'] })
        mockPayload.find.mockRejectedValue(new Error('DB connection lost'))
        const req = createRequest({ authorization: 'Bearer valid-token' }, 'user@example.com')

        // Act
        const res = await GET(req) as unknown as { data: any; status: number }

        // Assert — fail-safe: SSO must receive a boolean, not a 500
        expect(res.status).toBe(200)
        expect(res.data.exists).toBe(false)
        expect(res.data.error).toBe('service_unavailable')
    })
})
