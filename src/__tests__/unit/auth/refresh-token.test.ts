/**
 * Unit Tests: POST /api/auth/refresh-token
 * TC-IDs: TC-F02-RTOKEN-01 through TC-F02-RTOKEN-08
 * Convention: docs/TEST_CONVENTION.md | TC-IDs: docs/qa/F02-auth.md §3.8
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/auth/refresh-token/route'
import { jwtVerify, SignJWT } from 'jose'

// ── Hoisted mocks ──────────────────────────────────────────────────────────────

const mockCookiesSet = vi.hoisted(() => vi.fn())
const mockCookiesGet = vi.hoisted(() => vi.fn())
const mockCheckRateLimit = vi.hoisted(() =>
    vi.fn().mockResolvedValue({ allowed: true, remaining: 9, resetAt: 0 }),
)

// ── Module mocks ───────────────────────────────────────────────────────────────

vi.mock('next/server', () => ({
    NextRequest: vi.fn(),
    NextResponse: {
        json: vi.fn((data, init) => ({
            data,
            status: init?.status || 200,
            headers: { ...(init?.headers || {}), set(k: string, v: string) { (this as Record<string, string>)[k] = v } },
            cookies: { set: mockCookiesSet },
        })),
    },
}))

vi.mock('next/headers', () => ({
    cookies: vi.fn().mockResolvedValue({ get: mockCookiesGet }),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: mockCheckRateLimit,
}))

vi.mock('jose', () => ({
    jwtVerify: vi.fn().mockResolvedValue({
        payload: { id: 42, email: 'user@example.com', mfa_verified: true },
    }),
    SignJWT: vi.fn().mockImplementation(() => ({
        setProtectedHeader: vi.fn().mockReturnThis(),
        setIssuedAt: vi.fn().mockReturnThis(),
        setExpirationTime: vi.fn().mockReturnThis(),
        sign: vi.fn().mockResolvedValue('new.mock.jwt'),
    })),
}))

let mockPayload: { find: ReturnType<typeof vi.fn> }

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve(mockPayload)),
}))

// ── Helpers ────────────────────────────────────────────────────────────────────

const makeReq = (ip = '1.2.3.4') => ({
    headers: new Headers({ 'x-forwarded-for': ip }),
})

// depth:0 → tenant field is a raw numeric ID, not a populated object
const BASE_USER = {
    id: 42,
    email: 'user@example.com',
    tenants: [{ tenant: 1 }],
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('[TC-F02-RTOKEN] POST /api/auth/refresh-token', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.PAYLOAD_SECRET = 'test-secret'
        mockCookiesGet.mockReturnValue({ value: 'valid.jwt.cookie' })
        mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 9, resetAt: 0 })
        vi.mocked(jwtVerify).mockResolvedValue({
            payload: { id: 42, email: 'user@example.com', mfa_verified: true },
        } as any)
        vi.mocked(SignJWT).mockImplementation(() => ({
            setProtectedHeader: vi.fn().mockReturnThis(),
            setIssuedAt: vi.fn().mockReturnThis(),
            setExpirationTime: vi.fn().mockReturnThis(),
            sign: vi.fn().mockResolvedValue('new.mock.jwt'),
        }) as any)
        mockPayload = {
            find: vi.fn()
                .mockResolvedValueOnce({ docs: [BASE_USER] })
                .mockResolvedValue({ docs: [{ id: '1', status: 'active' }] }),
        }
    })

    // ── Rate limiting ──────────────────────────────────────────────────────────

    it('TC-F02-RTOKEN-01: returns 429 with Retry-After when rate limit exceeded', async () => {
        mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 30_000 })
        const res = await POST(makeReq() as any) as any
        expect(res.status).toBe(429)
        expect(res.data.error).toBe('rate_limited')
        expect(res.headers['Retry-After']).toMatch(/^\d+$/)
    })

    // ── Token validation ───────────────────────────────────────────────────────

    it('TC-F02-RTOKEN-02: returns 401 when no payload-token cookie', async () => {
        mockCookiesGet.mockReturnValue(undefined)
        const res = await POST(makeReq() as any) as any
        expect(res.status).toBe(401)
        expect(res.data.error).toBe('No token found')
    })

    it('TC-F02-RTOKEN-03: returns 401 when jwtVerify throws (invalid signature / expired)', async () => {
        vi.mocked(jwtVerify).mockRejectedValueOnce(new Error('invalid signature'))
        const res = await POST(makeReq() as any) as any
        expect(res.status).toBe(401)
        expect(res.data.error).toBe('Invalid or expired token')
    })

    it('TC-F15.36: never renews a support session opened through a merchant access link', async () => {
        vi.mocked(jwtVerify).mockResolvedValueOnce({
            payload: { id: 3185, email: 'owner@example.com', mfa_verified: true, impersonated_by: 7 },
        } as any)
        const res = await POST(makeReq() as any) as any
        expect(res.status).toBe(401)
        expect(mockPayload.find).not.toHaveBeenCalled()
    })

    // ── User lookup ────────────────────────────────────────────────────────────

    it('TC-F02-RTOKEN-04: returns 403 when user not found in DB', async () => {
        mockPayload.find = vi.fn().mockResolvedValue({ docs: [] })
        const res = await POST(makeReq() as any) as any
        expect(res.status).toBe(403)
        expect(res.data.error).toBe('User not found')
    })

    // ── Tenant suspension check (depth:0 raw IDs) ──────────────────────────────

    it('TC-F02-RTOKEN-05: returns 403 when all tenants suspended (depth:0 raw numeric ID)', async () => {
        // depth:0 returns tenant as raw number, not populated object — type guard falls through to String(t.tenant)
        mockPayload.find = vi.fn()
            .mockResolvedValueOnce({ docs: [{ ...BASE_USER, tenants: [{ tenant: 1 }] }] })
            .mockResolvedValue({ docs: [{ id: '1', status: 'suspended' }] })
        const res = await POST(makeReq() as any) as any
        expect(res.status).toBe(403)
        expect(res.data.error).toBe('account_suspended')
    })

    // ── mfa_verified claim preservation ────────────────────────────────────────

    it('TC-F02-RTOKEN-06: preserves mfa_verified:true from original token claims', async () => {
        vi.mocked(jwtVerify).mockResolvedValueOnce({
            payload: { id: 42, email: 'user@example.com', mfa_verified: true },
        } as any)
        await POST(makeReq() as any)
        const signedPayload = vi.mocked(SignJWT).mock.calls[0][0] as Record<string, unknown>
        expect(signedPayload.mfa_verified).toBe(true)
    })

    it('TC-F02-RTOKEN-07 / TC-PERF-143: refuses a token without mfa_verified (never upgrades it to an OTP session)', async () => {
        // Arrange — a raw-secret token with no OTP proof (getCurrentUser refuses it too)
        vi.mocked(jwtVerify).mockResolvedValueOnce({
            payload: { id: 42, email: 'user@example.com' },
        } as any)

        // Act
        const res = await POST(makeReq() as any) as any

        // Assert
        expect(res.status).toBe(401)
        expect(vi.mocked(SignJWT)).not.toHaveBeenCalled()
    })

    // ── Happy path ─────────────────────────────────────────────────────────────

    it('TC-F02-RTOKEN-08: mints new token and sets httpOnly cookie on success', async () => {
        const res = await POST(makeReq() as any) as any
        expect(res.status).toBe(200)
        expect(res.data.ok).toBe(true)
        expect(mockCookiesSet).toHaveBeenCalledWith(
            'payload-token',
            'new.mock.jwt',
            expect.objectContaining({ httpOnly: true }),
        )
    })
})
