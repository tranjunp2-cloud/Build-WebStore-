import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

// STRIPE_CONNECT_DISABLED: mocks kept but unused while route is a stub
const mockUser = { id: 1, email: 'owner@test.com', tenants: [{ tenant: '1' }] }
vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(() => Promise.resolve(mockUser)),
}))

const mockFindByID = vi.fn()
const mockUpdate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID, update: mockUpdate })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/payment/stripe', () => ({
    exchangeOAuthCode: vi.fn().mockResolvedValue({ stripeUserId: 'acct_oauth_xxx' }),
}))

import { GET as callbackGET } from '@/app/api/stripe/connect/callback/route'

// ─── TC-F13.24: Stripe OAuth callback — DISABLED state ────────────────
// Route currently stubs all requests → redirect ?stripe=refresh.
// Full OAuth tests preserved below in STRIPE_CONNECT_DISABLED block.

describe('GET /api/stripe/connect/callback [TC-F13.24] — disabled stub', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://app.test')
    })

    it('always redirects to ?stripe=refresh regardless of params', async () => {
        const req = new Request('https://app.test/api/stripe/connect/callback?code=ac_xxx&state=1')
        const res = await callbackGET(req)

        expect(res.status).toBe(307)
        expect(res.headers.get('location')).toContain('?stripe=refresh')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('redirects even with no query params', async () => {
        const req = new Request('https://app.test/api/stripe/connect/callback')
        const res = await callbackGET(req)

        expect(res.status).toBe(307)
        expect(res.headers.get('location')).toContain('?stripe=refresh')
    })
})

/* STRIPE_CONNECT_DISABLED — full OAuth callback tests preserved below.
 * Restore by re-enabling callback/route.ts implementation and updating stubs above.
 *
describe('GET /api/stripe/connect/callback [TC-F13.24]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://app.test')
        mockExchange.mockResolvedValue({ stripeUserId: 'acct_oauth_xxx' })
    })

    it('[TC-F13.24] success: exchanges code, saves stripeAccountId, redirects ?stripe=complete', async () => {
        mockFindByID.mockResolvedValue({ id: '1', name: 'Test Tenant' })
        mockUpdate.mockResolvedValue({})
        const req = new Request('https://app.test/api/stripe/connect/callback?code=ac_xxx&state=1')

        const res = await callbackGET(req)

        expect(res.status).toBe(307)
        expect(res.headers.get('location')).toContain('/dashboard/settings/payments?stripe=complete')
        expect(mockExchange).toHaveBeenCalledWith('ac_xxx')
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'tenants',
            id: '1',
            data: expect.objectContaining({
                stripeAccountId: 'acct_oauth_xxx',
                stripeOnboardingComplete: false,
            }),
        }))
    })

    it('[TC-F13.28] error=access_denied → redirects ?stripe=refresh, no DB write', async () => {
        const req = new Request('https://app.test/api/stripe/connect/callback?error=access_denied&state=1')

        const res = await callbackGET(req)

        expect(res.status).toBe(307)
        expect(res.headers.get('location')).toContain('?stripe=refresh')
        expect(mockExchange).not.toHaveBeenCalled()
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('missing code → redirects ?stripe=refresh, no DB write', async () => {
        const req = new Request('https://app.test/api/stripe/connect/callback?state=1')

        const res = await callbackGET(req)

        expect(res.status).toBe(307)
        expect(res.headers.get('location')).toContain('?stripe=refresh')
        expect(mockExchange).not.toHaveBeenCalled()
    })

    it('missing state → redirects ?stripe=refresh', async () => {
        const req = new Request('https://app.test/api/stripe/connect/callback?code=ac_xxx')

        const res = await callbackGET(req)

        expect(res.status).toBe(307)
        expect(res.headers.get('location')).toContain('?stripe=refresh')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('invalid state (non-digits, tampered) → 400, no DB write', async () => {
        const req = new Request('https://app.test/api/stripe/connect/callback?code=ac_xxx&state=evil-payload')

        const res = await callbackGET(req)

        expect(res.status).toBe(400)
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('[TC-F13.30] state for tenant user does not own → 403, no DB write', async () => {
        const req = new Request('https://app.test/api/stripe/connect/callback?code=ac_xxx&state=999')

        const res = await callbackGET(req)

        expect(res.status).toBe(403)
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('exchangeOAuthCode throws (expired code) → redirects ?stripe=refresh', async () => {
        mockFindByID.mockResolvedValue({ id: '1' })
        mockExchange.mockRejectedValueOnce(new Error('invalid_grant'))
        const req = new Request('https://app.test/api/stripe/connect/callback?code=ac_expired&state=1')

        const res = await callbackGET(req)

        expect(res.status).toBe(307)
        expect(res.headers.get('location')).toContain('?stripe=refresh')
    })
})
*/
