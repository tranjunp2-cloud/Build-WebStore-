/**
 * TC-SSOPW2-01 through TC-SSOPW2-10: POST /api/auth/sso-session
 * SSO session exchange — token verification, ban enforcement, redirect logic, cookie
 * Convention: docs/TEST_CONVENTION.md | TC-IDs: docs/qa/F-SSO-PW2.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/auth/sso-session/route'
import { SignJWT, decodeJwt } from 'jose'

// ── Hoisted mocks (must be before vi.mock calls) ──────────────────────────────

const mockCookiesSet = vi.hoisted(() => vi.fn())
const mockCheckRateLimit = vi.hoisted(() =>
    vi.fn().mockResolvedValue({ allowed: true, remaining: 9, resetAt: 0 }),
)

// ── Module mocks (top-level) ──────────────────────────────────────────────────

vi.mock('next/server', () => ({
    NextRequest: vi.fn(),
    NextResponse: {
        // headers is a plain object + .set() method so tests can assert both
        // res.headers['Retry-After'] (property) and response.headers.set(...) (method call)
        json: vi.fn((data, init) => ({
            data,
            status: init?.status || 200,
            headers: { ...(init?.headers || {}), set(k: string, v: string) { (this as Record<string, string>)[k] = v } },
            cookies: { set: mockCookiesSet },
        })),
    },
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: mockCheckRateLimit,
}))

vi.mock('jose', () => ({
    SignJWT: vi.fn().mockImplementation(() => ({
        setProtectedHeader: vi.fn().mockReturnThis(),
        setIssuedAt: vi.fn().mockReturnThis(),
        setExpirationTime: vi.fn().mockReturnThis(),
        sign: vi.fn().mockResolvedValue('mock_jwt_token'),
    })),
    decodeJwt: vi.fn().mockReturnValue({ collection: 'users', id: 42, email: 'owner@example.com' }),
}))

let mockPayload: {
    auth: ReturnType<typeof vi.fn>
    findByID: ReturnType<typeof vi.fn>
    find: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
}

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve(mockPayload)),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeReq = (body?: Record<string, unknown>, ip = '1.2.3.4') => ({
    headers: new Headers({ 'x-forwarded-for': ip, 'content-type': 'application/json' }),
    json: vi.fn().mockResolvedValue(body ?? {}),
})

const BASE_USER = {
    id: 42,
    email: 'owner@example.com',
    roles: ['tenant-owner'] as string[],
    has_seen_ai_wizard: false,
    tenants: [{ tenant: { id: '1', onboardingCompleted: false } }],
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('[TC-SSOPW2] POST /api/auth/sso-session', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 9, resetAt: 0 })
        // clearAllMocks resets return values — restore decodeJwt default for happy path
        vi.mocked(decodeJwt).mockReturnValue({ collection: 'users', id: 42, email: 'owner@example.com' })
        process.env.PAYLOAD_SECRET = 'test-secret'

        mockPayload = {
            auth: vi.fn().mockResolvedValue({ user: { id: 42, email: 'owner@example.com' } }),
            findByID: vi.fn().mockResolvedValue(structuredClone(BASE_USER)),
            find: vi.fn().mockResolvedValue({ docs: [{ id: '1', status: 'active' }] }),
            update: vi.fn().mockResolvedValue({}),
        }
    })

    // ── Input validation ──────────────────────────────────────────────────────

    describe('Input validation', () => {
        it('TC-SSOPW2-01: returns 401 when body has no v2_token', async () => {
            const res = await POST(makeReq({}) as any) as any
            expect(res.status).toBe(401)
            expect(res.data.error).toBe('invalid_token')
        })

        it('TC-SSOPW2-02: returns 401 when v2_token fails payload.auth() verification', async () => {
            mockPayload.auth.mockResolvedValue({ user: null })
            const res = await POST(makeReq({ v2_token: 'forged-token' }) as any) as any
            expect(res.status).toBe(401)
            expect(res.data.error).toBe('invalid_token')
        })

        it('TC-SSOPW2-01b: returns 401 when v2_token is non-string (type coercion guard)', async () => {
            // typeof 123 !== 'string' — must be caught before auth call
            const res = await POST(makeReq({ v2_token: 123 }) as any) as any
            expect(res.status).toBe(401)
            expect(res.data.error).toBe('invalid_token')
            expect(mockPayload.auth).not.toHaveBeenCalled()
        })

        it('TC-SSOPW2-01c: returns 401 when v2_token exceeds 4096 chars (DoS length guard)', async () => {
            const oversized = 'a'.repeat(4097)
            const res = await POST(makeReq({ v2_token: oversized }) as any) as any
            expect(res.status).toBe(401)
            expect(mockPayload.auth).not.toHaveBeenCalled()
        })

        it('TC-SSOPW2-02b: returns 401 when JWT collection claim is not "users"', async () => {
            // SEC-12: prevent tokens for other auth-enabled collections from being accepted
            vi.mocked(decodeJwt).mockReturnValueOnce({ collection: 'api-clients' })
            const res = await POST(makeReq({ v2_token: 'valid-but-wrong-collection' }) as any) as any
            expect(res.status).toBe(401)
            expect(mockPayload.auth).not.toHaveBeenCalled()
        })

        it('TC-SSOPW2-02c: returns 401 when decodeJwt throws (malformed non-JWT string)', async () => {
            // String passes length check but is not a parseable JWT (no base64 header)
            vi.mocked(decodeJwt).mockImplementationOnce(() => { throw new Error('invalid JWT') })
            const res = await POST(makeReq({ v2_token: 'notjwt-but-short-enough' }) as any) as any
            expect(res.status).toBe(401)
            expect(res.data.error).toBe('invalid_token')
            expect(mockPayload.auth).not.toHaveBeenCalled()
        })

    })

    // ── Rate limiting ─────────────────────────────────────────────────────────

    describe('Rate limiting', () => {
        it('TC-SSOPW2-03: returns 429 with Retry-After header when rate limit exceeded', async () => {
            mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 30_000 })
            const res = await POST(makeReq({ v2_token: 'any' }) as any) as any
            expect(res.status).toBe(429)
            expect(res.data.error).toBe('rate_limited')
            expect(res.data.message).toMatch(/Too many sign-in attempts/)
            expect(typeof res.data.retryAfter).toBe('number')
            expect(res.headers['Retry-After']).toMatch(/^\d+$/)
            expect(Number(res.headers['Retry-After'])).toBeGreaterThan(0)
        })

        it('TC-SSOPW2-03b: rate limit key uses x-real-ip over x-forwarded-for (spoof guard)', async () => {
            // SEC-03: x-real-ip (set by Vercel, not client-spoofable) must take precedence
            const reqWithBothIPs = {
                headers: new Headers({
                    'x-real-ip': '10.20.30.40',
                    'x-forwarded-for': '1.2.3.4',  // spoofed leftmost entry
                }),
                json: vi.fn().mockResolvedValue({ v2_token: 'valid' }),
            }
            await POST(reqWithBothIPs as any)
            expect(mockCheckRateLimit).toHaveBeenCalledWith('sso-session:10.20.30.40', 300, 60_000)
        })

        it('TC-SSO.RL-01: IP bucket uses 300 limit — shared-WiFi users all allowed', async () => {
            await POST(makeReq({ v2_token: 'valid' }) as any)
            expect(mockCheckRateLimit).toHaveBeenCalledWith('sso-session:1.2.3.4', 300, 60_000)
        })

        it('TC-SSO.RL-02: per-user bucket blocks spammer even when IP has capacity', async () => {
            mockCheckRateLimit
                .mockResolvedValueOnce({ allowed: true, remaining: 299, resetAt: 0 })
                .mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 10_000 })
            const res = await POST(makeReq({ v2_token: 'valid' }) as any) as any
            expect(res.status).toBe(429)
            expect(res.data.error).toBe('rate_limited')
            expect(res.data.message).toMatch(/Too many sign-in attempts/)
            expect(typeof res.data.retryAfter).toBe('number')
        })

        it('TC-SSO.RL-03: normal login passes both IP and per-user buckets', async () => {
            const res = await POST(makeReq({ v2_token: 'valid' }) as any) as any
            expect(res.status).toBe(200)
            expect(mockCheckRateLimit).toHaveBeenCalledTimes(2)
            expect(mockCheckRateLimit).toHaveBeenNthCalledWith(1, 'sso-session:1.2.3.4', 300, 60_000)
            expect(mockCheckRateLimit).toHaveBeenNthCalledWith(2, 'sso-session:user:42', 10, 60_000)
        })

        it('TC-SSO.RL-08: SSO_RATE_LIMIT_PER_MIN env var overrides IP bucket limit', async () => {
            process.env.SSO_RATE_LIMIT_PER_MIN = '500'
            try {
                await POST(makeReq({ v2_token: 'valid' }) as any)
                expect(mockCheckRateLimit).toHaveBeenNthCalledWith(1, 'sso-session:1.2.3.4', 500, 60_000)
            } finally {
                delete process.env.SSO_RATE_LIMIT_PER_MIN
            }
        })
    })

    // ── Ban enforcement ───────────────────────────────────────────────────────

    describe('Ban enforcement', () => {
        it('TC-SSOPW2-04a: returns 403 when all tenants are suspended', async () => {
            mockPayload.find.mockResolvedValue({ docs: [{ id: '1', status: 'suspended' }] })
            const res = await POST(makeReq({ v2_token: 'valid' }) as any) as any
            expect(res.status).toBe(403)
            expect(res.data.error).toBe('account_suspended')
        })

        it('TC-SSOPW2-04b: allows login when at least one tenant is active', async () => {
            mockPayload.findByID.mockResolvedValue({
                ...BASE_USER,
                tenants: [
                    { tenant: { id: '1', onboardingCompleted: true } },
                    { tenant: { id: '2', onboardingCompleted: true } },
                ],
            })
            // First tenant suspended, second active → NOT allSuspended
            mockPayload.find
                .mockResolvedValueOnce({ docs: [{ id: '1', status: 'suspended' }] })
                .mockResolvedValueOnce({ docs: [{ id: '2', status: 'active' }] })

            const res = await POST(makeReq({ v2_token: 'valid' }) as any) as any
            expect(res.status).toBe(200)
            expect(res.data.ok).toBe(true)
        })
    })

    // ── Redirect logic ────────────────────────────────────────────────────────

    describe('Redirect logic', () => {
        it('TC-SSOPW2-05: tenant-owner with no tenants and no wizard → /onboarding', async () => {
            mockPayload.findByID.mockResolvedValue({ ...BASE_USER, tenants: [] })
            const res = await POST(makeReq({ v2_token: 'valid' }) as any) as any
            expect(res.data).toEqual({ ok: true, redirectTo: '/onboarding' })
        })

        it('TC-SSOPW2-06: tenant-owner, onboardingCompleted=false, no wizard → /onboarding', async () => {
            // BASE_USER has onboardingCompleted=false and has_seen_ai_wizard=false
            const res = await POST(makeReq({ v2_token: 'valid' }) as any) as any
            expect(res.data).toEqual({ ok: true, redirectTo: '/onboarding' })
        })

        it('TC-SSOPW2-07: tenant-owner who has seen wizard → /dashboard (wizard gate wins)', async () => {
            mockPayload.findByID.mockResolvedValue({ ...BASE_USER, has_seen_ai_wizard: true })
            const res = await POST(makeReq({ v2_token: 'valid' }) as any) as any
            expect(res.data).toEqual({ ok: true, redirectTo: '/dashboard' })
        })

        it('TC-SSOPW2-08: non-owner role (editor) → /dashboard (SSO only handles tenant-owners)', async () => {
            mockPayload.findByID.mockResolvedValue({ ...BASE_USER, roles: ['editor'] })
            const res = await POST(makeReq({ v2_token: 'valid' }) as any) as any
            expect(res.data).toEqual({ ok: true, redirectTo: '/dashboard' })
        })

        it('TC-SSOPW2-09: tenant-owner with completed onboarding → /dashboard', async () => {
            mockPayload.findByID.mockResolvedValue({
                ...BASE_USER,
                tenants: [{ tenant: { id: '1', onboardingCompleted: true } }],
            })
            const res = await POST(makeReq({ v2_token: 'valid' }) as any) as any
            expect(res.data).toEqual({ ok: true, redirectTo: '/dashboard' })
        })
    })

    // ── Cookie and audit ──────────────────────────────────────────────────────

    describe('Cookie and audit', () => {
        it('TC-SSOPW2-10: sets httpOnly payload-token cookie on successful exchange', async () => {
            const res = await POST(makeReq({ v2_token: 'valid' }) as any) as any
            expect(res.status).toBe(200)
            expect(mockCookiesSet).toHaveBeenCalledWith(
                'payload-token',
                'mock_jwt_token',
                expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
            )
        })

        it('TC-SSOPW2-10b: updates lastLoginAt on successful login', async () => {
            await POST(makeReq({ v2_token: 'valid' }) as any)
            expect(mockPayload.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    collection: 'users',
                    overrideAccess: true,
                    data: expect.objectContaining({ lastLoginAt: expect.any(String) }),
                }),
            )
        })

        it('TC-SSOPW2-10c: mints JWT containing mfa_verified:true claim', async () => {
            // If mfa_verified claim is removed from production code, this test catches it.
            // SSO bypass requires mfa_verified:true so middleware lets the user through.
            await POST(makeReq({ v2_token: 'valid' }) as any)
            expect(SignJWT).toHaveBeenCalledWith(
                expect.objectContaining({ id: 42, email: 'owner@example.com', mfa_verified: true }),
            )
        })

        it('TC-SSOPW2-10d: success response has Cache-Control: no-store', async () => {
            // CQ-05: prevent proxy/CDN caching of Set-Cookie responses
            const res = await POST(makeReq({ v2_token: 'valid' }) as any) as any
            expect(res.headers['Cache-Control']).toBe('no-store')
        })
    })
})
