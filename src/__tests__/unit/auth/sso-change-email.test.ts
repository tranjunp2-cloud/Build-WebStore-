/**
 * Unit Tests: POST /api/v1/sso/change-email
 * TC-IDs: TC-1251-SYNC-CHE-01 through TC-1251-SYNC-CHE-07
 * Idempotency: old email missing + new_email already applied → 200 (retry-safe per JobBase)
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/v1/sso/change-email/route'
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

const createRequest = (headers: Record<string, string>, body: unknown) =>
    ({
        headers: new Headers(headers),
        json: vi.fn().mockResolvedValue(body),
    }) as unknown as NextRequest

const SUPER_ADMIN = { id: 'u1', roles: ['super-admin'] }
const AUTH_HEADER = { authorization: 'Bearer valid-token' }

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/sso/change-email', () => {
    let mockPayload: { find: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }

    beforeEach(() => {
        vi.clearAllMocks()
        mockPayload = { find: vi.fn(), update: vi.fn() }
        vi.mocked(getPayload).mockResolvedValue(mockPayload as any)
    })

    it('TC-1251-SYNC-CHE-01: returns 401 when Authorization header is missing', async () => {
        // Arrange
        const req = createRequest({}, { email: 'old@example.com', new_email: 'new@example.com' })

        // Act
        const res = await POST(req) as unknown as { data: any; status: number }

        // Assert
        expect(res.status).toBe(401)
        expect(res.data.message).toBe('Authorization required')
    })

    it('TC-1251-SYNC-CHE-02: returns 403 when caller is not super-admin', async () => {
        // Arrange
        mockGetCurrentUser.mockResolvedValue({ id: 'u1', roles: ['tenant-owner'] })
        const req = createRequest(AUTH_HEADER, { email: 'old@example.com', new_email: 'new@example.com' })

        // Act
        const res = await POST(req) as unknown as { data: any; status: number }

        // Assert
        expect(res.status).toBe(403)
        expect(res.data.message).toBe('Insufficient permissions')
    })

    it('TC-1251-SYNC-CHE-03: returns 400 when required fields are missing', async () => {
        // Arrange
        mockGetCurrentUser.mockResolvedValue(SUPER_ADMIN)
        const req = createRequest(AUTH_HEADER, { email: 'old@example.com' }) // missing new_email

        // Act
        const res = await POST(req) as unknown as { data: any; status: number }

        // Assert
        expect(res.status).toBe(400)
        expect(res.data.message).toContain('new_email')
    })

    it('TC-1251-SYNC-CHE-04: returns 404 when old email not found and new_email not yet applied', async () => {
        // Arrange
        mockGetCurrentUser.mockResolvedValue(SUPER_ADMIN)
        // First find (old email): not found; second find (new_email idempotency): also not found
        mockPayload.find.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [] })
        const req = createRequest(AUTH_HEADER, { email: 'ghost@example.com', new_email: 'new@example.com' })

        // Act
        const res = await POST(req) as unknown as { data: any; status: number }

        // Assert
        expect(res.status).toBe(404)
        expect(res.data.message).toBe('User not found')
    })

    it('TC-1251-SYNC-CHE-05: idempotency — old email missing but new_email already applied → 200', async () => {
        // Arrange — simulates a successful prior retry
        mockGetCurrentUser.mockResolvedValue(SUPER_ADMIN)
        // First find (old email): not found; second find (new_email): already applied
        mockPayload.find
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [{ id: 'u99', email: 'new@example.com' }] })
        const req = createRequest(AUTH_HEADER, { email: 'old@example.com', new_email: 'new@example.com' })

        // Act
        const res = await POST(req) as unknown as { data: any; status: number }

        // Assert — idempotency: route must NOT call update when email already applied
        expect(res.status).toBe(200)
        expect(res.data.userId).toBe('u99')
        expect(mockPayload.update).not.toHaveBeenCalled()
    })

    it('TC-1251-SYNC-CHE-06: returns 409 when new_email is in use by a different user', async () => {
        // Arrange
        mockGetCurrentUser.mockResolvedValue(SUPER_ADMIN)
        // First find (old email): found as u10; second find (conflict check): found as u99 (different user)
        mockPayload.find
            .mockResolvedValueOnce({ docs: [{ id: 'u10', email: 'old@example.com' }] })
            .mockResolvedValueOnce({ docs: [{ id: 'u99', email: 'new@example.com' }] })
        const req = createRequest(AUTH_HEADER, { email: 'old@example.com', new_email: 'new@example.com' })

        // Act
        const res = await POST(req) as unknown as { data: any; status: number }

        // Assert
        expect(res.status).toBe(409)
        expect(res.data.message).toBe('Email already in use')
    })

    it('TC-1251-SYNC-CHE-07: updates email and returns 200 on success', async () => {
        // Arrange
        mockGetCurrentUser.mockResolvedValue(SUPER_ADMIN)
        // First find (old email): found; second find (conflict): no conflict
        mockPayload.find
            .mockResolvedValueOnce({ docs: [{ id: 'u10', email: 'old@example.com' }] })
            .mockResolvedValueOnce({ docs: [] })
        mockPayload.update.mockResolvedValue({})
        const req = createRequest(AUTH_HEADER, { email: 'old@example.com', new_email: 'new@example.com' })

        // Act
        const res = await POST(req) as unknown as { data: any; status: number }

        // Assert
        expect(res.status).toBe(200)
        expect(res.data.userId).toBe('u10')
        expect(mockPayload.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { email: 'new@example.com' } }),
        )
    })
})
