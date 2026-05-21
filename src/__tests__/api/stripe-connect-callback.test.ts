import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

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
    // Returns the raw state string as tenantId — tests pass plain 'tenant_1' (not HMAC-signed)
    verifyOAuthState: vi.fn((state: string) => state || null),
    exchangeOAuthCode: vi.fn().mockResolvedValue({ stripeUserId: 'acct_test_123' }),
    getConnectedAccountStatus: vi.fn().mockResolvedValue({
        accountId: 'acct_test_123',
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        country: 'MY',
        email: 'merchant@test.com',
    }),
}))

import { GET as callbackGET } from '@/app/api/stripe/connect/callback/route'
import { getConnectedAccountStatus } from '@/lib/payment/stripe'

const mockGetStatus = getConnectedAccountStatus as ReturnType<typeof vi.fn>

// ─── Tests ────────────────────────────────────────────────────────────

describe('GET /api/stripe/connect/callback', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://app.test')
    })

    it('[TC-F13.26] redirects ?stripe=complete when account not yet verified', async () => {
        // Arrange: getConnectedAccountStatus returns unverified (default mock)
        const req = new Request('https://app.test/api/stripe/connect/callback?code=test_code&state=tenant_1')

        // Act
        const res = await callbackGET(req)

        // Assert
        expect(res.status).toBe(307)
        expect(res.headers.get('location')).toContain('?stripe=complete')
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ stripeOnboardingComplete: false }),
        }))
    })

    it('[TC-F13.142] redirects ?stripe=verified when existing account is already fully verified', async () => {
        // Arrange: existing fully-verified Stripe account
        mockGetStatus.mockResolvedValueOnce({
            accountId: 'acct_test_123',
            chargesEnabled: true,
            payoutsEnabled: true,
            detailsSubmitted: true,
            country: 'MY',
            email: 'merchant@test.com',
        })
        const req = new Request('https://app.test/api/stripe/connect/callback?code=test_code&state=tenant_1')

        // Act
        const res = await callbackGET(req)

        // Assert
        expect(res.status).toBe(307)
        expect(res.headers.get('location')).toContain('?stripe=verified')
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ stripeOnboardingComplete: true }),
        }))
    })

    it('[TC-F13.28] redirects ?stripe=refresh when error param present', async () => {
        // Arrange: Stripe sends back an error (user denied or access_denied)
        const req = new Request('https://app.test/api/stripe/connect/callback?error=access_denied')

        // Act
        const res = await callbackGET(req)

        // Assert
        expect(res.status).toBe(307)
        expect(res.headers.get('location')).toContain('?stripe=refresh')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('redirects ?stripe=refresh when code missing', async () => {
        // Arrange: no code param (incomplete redirect from Stripe)
        const req = new Request('https://app.test/api/stripe/connect/callback?state=tenant_1')

        // Act
        const res = await callbackGET(req)

        // Assert
        expect(res.status).toBe(307)
        expect(res.headers.get('location')).toContain('?stripe=refresh')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('redirects ?stripe=refresh when state missing', async () => {
        // Arrange: no state param (tenantId lost)
        const req = new Request('https://app.test/api/stripe/connect/callback?code=test_code')

        // Act
        const res = await callbackGET(req)

        // Assert
        expect(res.status).toBe(307)
        expect(res.headers.get('location')).toContain('?stripe=refresh')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('redirects ?stripe=refresh when exchangeOAuthCode throws (expired code)', async () => {
        // Arrange: Stripe rejects expired/invalid code
        const { exchangeOAuthCode } = await import('@/lib/payment/stripe')
        ;(exchangeOAuthCode as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('invalid_grant'))
        const req = new Request('https://app.test/api/stripe/connect/callback?code=expired_code&state=tenant_1')

        // Act
        const res = await callbackGET(req)

        // Assert
        expect(res.status).toBe(307)
        expect(res.headers.get('location')).toContain('?stripe=refresh')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('falls back to ?stripe=complete when getConnectedAccountStatus throws', async () => {
        // Arrange: status check fails (non-fatal) — should not block the connect flow
        mockGetStatus.mockRejectedValueOnce(new Error('Stripe API unavailable'))
        const req = new Request('https://app.test/api/stripe/connect/callback?code=test_code&state=tenant_1')

        // Act
        const res = await callbackGET(req)

        // Assert: graceful fallback — account saved, redirect to complete (manual Verify)
        expect(res.status).toBe(307)
        expect(res.headers.get('location')).toContain('?stripe=complete')
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ stripeOnboardingComplete: false }),
        }))
    })
})
