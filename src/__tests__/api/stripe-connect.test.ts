import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockUser = { id: 1, email: 'owner@test.com', tenants: [{ tenant: 'tenant-1', role: 'owner', status: 'active' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)),
}))

const mockFindByID = vi.fn()
const mockUpdate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID, update: mockUpdate })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

const mockGetStripeOAuthUrl = vi.fn()
const mockGetConnectedAccountStatus = vi.fn()

vi.mock('@/lib/payment/stripe', () => ({
    getStripeOAuthUrl: (...args: any[]) => mockGetStripeOAuthUrl(...args),
    getConnectedAccountStatus: (...args: any[]) => mockGetConnectedAccountStatus(...args),
}))

vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({
        id: 'mock-sub-1',
        plan: 'PROFESSIONAL_TM_USER',
        status: 'active',
        startDate: '2026-01-01T00:00:00.000Z',
    }),
    isSubscriptionActive: vi.fn().mockReturnValue(true),
    canUse: vi.fn().mockResolvedValue(true),
    canUseWithinLimit: vi.fn().mockResolvedValue(true),
    recordUsage: vi.fn().mockResolvedValue(undefined),
    reduceUsage: vi.fn().mockResolvedValue(undefined),
    getConsumed: vi.fn().mockResolvedValue(0),
}))

vi.mock('@/lib/subscriptions/feature-guard', () => ({
    withFeatureGuard: vi.fn(() => (h: any) => h),
}))

import { POST as onboardPOST } from '@/app/api/stripe/connect/onboard/route'
import { GET as statusGET } from '@/app/api/stripe/connect/status/route'

// ─── TC-F13.24: OAuth onboarding ─────────────────────────────────────

describe('POST /api/stripe/connect/onboard [TC-F13.24]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('[TC-F13.24] returns oauthUrl for authenticated tenant owner', async () => {
        mockGetStripeOAuthUrl.mockReturnValue('https://connect.stripe.com/oauth/authorize?client_id=ca_test&state=tenant-1')

        const req = { headers: new Headers(), json: () => Promise.resolve({ tenantId: 'tenant-1' }) } as unknown as Request
        const res = await onboardPOST(req, {} as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.oauthUrl).toContain('connect.stripe.com/oauth/authorize')
        expect(mockGetStripeOAuthUrl).toHaveBeenCalledWith('tenant-1')
    })

    it('returns 422 when tenantId missing', async () => {
        const req = { json: () => Promise.resolve({}) } as unknown as Request
        const res = await onboardPOST(req, {} as any)

        expect(res.status).toBe(422)
    })

    it('[TC-F13.30] returns 403 when user does not own tenant', async () => {
        const req = { json: () => Promise.resolve({ tenantId: 'other-tenant' }) } as unknown as Request
        const res = await onboardPOST(req, {} as any)

        expect(res.status).toBe(403)
    })
})

describe('GET /api/stripe/connect/status [TC-F13.03]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetConnectedAccountStatus.mockResolvedValue({
            accountId: 'acct_existing',
            chargesEnabled: true,
            payoutsEnabled: true,
            detailsSubmitted: true,
            country: 'MY',
            email: 'merchant@test.com',
        })
    })

    it('returns connected account status with onboardingComplete', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ id: 'tenant-1', stripeAccountId: 'acct_existing', stripeOnboardingComplete: true })

        // Act
        const req = new Request('http://localhost/api/stripe/connect/status?tenantId=tenant-1')
        const res = await statusGET(req, {} as any)
        const body = await res.json()

        // Assert
        expect(body.success).toBe(true)
        expect(body.data.connected).toBe(true)
        expect(body.data.onboardingComplete).toBe(true)
    })

    it('returns not connected when no stripeAccountId', async () => {
        // Arrange — tenant without Stripe account
        mockFindByID.mockResolvedValue({ id: 'tenant-1' })

        // Act
        const req = new Request('http://localhost/api/stripe/connect/status?tenantId=tenant-1')
        const res = await statusGET(req, {} as any)
        const body = await res.json()

        // Assert
        expect(body.data.connected).toBe(false)
        expect(body.data.chargesEnabled).toBe(false)
    })

    it('returns 422 when tenantId missing', async () => {
        // Act
        const req = new Request('http://localhost/api/stripe/connect/status')
        const res = await statusGET(req, {} as any)

        // Assert
        expect(res.status).toBe(422)
    })

    it('returns 403 for unauthorized tenant [TC-F19.38]', async () => {
        // Act
        const req = new Request('http://localhost/api/stripe/connect/status?tenantId=other-tenant')
        const res = await statusGET(req, {} as any)

        // Assert
        expect(res.status).toBe(403)
    })
})
