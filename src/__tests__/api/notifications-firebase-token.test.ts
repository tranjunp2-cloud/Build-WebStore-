import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── TC-F16.47: GET /api/notifications/firebase-token (#1972) ──

const mockRateLimit = vi.fn()
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: (...a: unknown[]) => mockRateLimit(...a) }))

let mockUser: { id: number } | null = { id: 7 }
vi.mock('@/lib/auth', () => ({
    // Mirrors withAuth: 401 when there is no session, otherwise calls the handler.
    withAuth: (handler: (u: unknown, r: unknown) => unknown) => async (request: unknown) => {
        if (!mockUser) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        return handler(mockUser, request)
    },
}))

const mockGetConfig = vi.fn()
const mockGetApp = vi.fn()
vi.mock('@/lib/firebase/firebase-admin-app', () => ({
    getFirebaseServerConfig: () => mockGetConfig(),
    getFirebaseAdminApp: () => mockGetApp(),
}))

const mockCreateCustomToken = vi.fn()
vi.mock('firebase-admin/auth', () => ({
    getAuth: () => ({ createCustomToken: (...a: unknown[]) => mockCreateCustomToken(...a) }),
}))

import { GET } from '@/app/api/notifications/firebase-token/route'

const CFG = {
    projectId: 'proj', clientEmail: 'x@proj.iam', privateKey: 'k',
    databaseURL: 'https://proj-rtdb.firebasedatabase.app', webApiKey: 'AIzaTEST',
}
const req = () => new NextRequest(new URL('/api/notifications/firebase-token', 'http://localhost:3000'))

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VERCEL_TARGET_ENV', 'staging')
    mockUser = { id: 7 }
    mockRateLimit.mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 })
    mockGetConfig.mockReturnValue(CFG)
    mockGetApp.mockReturnValue({ name: 'pw2-notif' })
    mockCreateCustomToken.mockResolvedValue('custom.jwt.token')
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
})

describe('[TC-F16.47] GET /api/notifications/firebase-token', () => {
    it('returns 401 without a session', async () => {
        mockUser = null

        const res = await GET(req(), undefined as never)

        expect(res.status).toBe(401)
    })

    it('issues a token for uid pw2_{env}_{userId} plus config and subscribe paths', async () => {
        const res = await GET(req(), undefined as never)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(mockCreateCustomToken).toHaveBeenCalledWith('pw2_staging_7')
        expect(body).toEqual({
            enabled: true,
            token: 'custom.jwt.token',
            config: { apiKey: 'AIzaTEST', databaseURL: CFG.databaseURL, projectId: 'proj' },
            userPath: 'pw2/staging/u/7',
            broadcastPath: 'pw2/staging/broadcast',
        })
    })

    it('never leaks the service-account secrets', async () => {
        const res = await GET(req(), undefined as never)
        const text = JSON.stringify(await res.json())

        expect(text).not.toMatch(/private_?key/i)
        expect(text).not.toContain(CFG.clientEmail)
    })

    it('is never cached', async () => {
        const res = await GET(req(), undefined as never)

        expect(res.headers.get('Cache-Control')).toBe('no-store')
    })

    it('returns { enabled: false } when Firebase is not configured', async () => {
        mockGetConfig.mockReturnValue(null)
        mockGetApp.mockReturnValue(null)

        const res = await GET(req(), undefined as never)

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ enabled: false })
        expect(mockCreateCustomToken).not.toHaveBeenCalled()
    })

    it('returns { enabled: false } on Vercel without VERCEL_TARGET_ENV (fail-closed, no shared prefix)', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.stubEnv('VERCEL_TARGET_ENV', '')
        vi.stubEnv('VERCEL', '1')

        const res = await GET(req(), undefined as never)

        expect(await res.json()).toEqual({ enabled: false })
        expect(mockGetApp).not.toHaveBeenCalled()
        expect(mockCreateCustomToken).not.toHaveBeenCalled()
    })

    it('returns 429 with Retry-After when rate-limited', async () => {
        mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 30_000 })

        const res = await GET(req(), undefined as never)

        expect(res.status).toBe(429)
        expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0)
        expect(mockCreateCustomToken).not.toHaveBeenCalled()
    })

    it('returns 500 without internals when token creation fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        mockCreateCustomToken.mockRejectedValue(new Error('private key parse error: -----BEGIN'))

        const res = await GET(req(), undefined as never)
        const text = await res.text()

        expect(res.status).toBe(500)
        expect(text).not.toContain('BEGIN')
    })
})
