import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockUser = { id: 1, email: 'owner@test.com', tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)),
}))

const mockFindByID = vi.fn()
const mockUpdate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID, update: mockUpdate })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/payment/stripe', () => ({
    getStripeOAuthUrl: vi.fn(
        (tenantId: string) =>
            `https://connect.stripe.com/oauth/authorize?client_id=ca_test&state=${tenantId}&response_type=code&scope=read_write`,
    ),
    getConnectedAccountStatus: vi.fn().mockResolvedValue({
        accountId: 'acct_existing',
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
    }),
}))

import { POST as onboardPOST } from '@/app/api/stripe/connect/onboard/route'
import { GET as statusGET } from '@/app/api/stripe/connect/status/route'

// ─── TC-F13.24: Stripe Connect OAuth onboarding — DISABLED stub ───────
// Route returns 503 DISABLED while Stripe Connect is temporarily off.
// Full OAuth tests preserved below in STRIPE_CONNECT_DISABLED block.

describe('POST /api/stripe/connect/onboard [TC-F13.24]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns 503 DISABLED for all requests while Connect is off', async () => {
        // Act
        const req = { json: () => Promise.resolve({ tenantId: 'tenant-1' }) } as unknown as Request
        const res = await onboardPOST(req, {} as any)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(503)
        expect(body.success).toBe(false)
        expect(body.error.code).toBe('DISABLED')
        expect(mockUpdate).not.toHaveBeenCalled()
    })
})

/* STRIPE_CONNECT_DISABLED — full onboard tests preserved below.
 * Restore by re-enabling onboard/route.ts and getStripeOAuthUrl in stripe.ts.
 *
describe('POST /api/stripe/connect/onboard [TC-F13.24] — full', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('[TC-F13.24] returns OAuth URL with tenantId as state', async () => {
        const req = { json: () => Promise.resolve({ tenantId: 'tenant-1' }) } as unknown as Request
        const res = await onboardPOST(req, {} as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.oauthUrl).toContain('connect.stripe.com/oauth/authorize')
        expect(body.data.oauthUrl).toContain('state=tenant-1')
        expect(body.data.oauthUrl).toContain('scope=read_write')
        expect(mockUpdate).not.toHaveBeenCalled()
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
*/

describe('GET /api/stripe/connect/status [TC-F13.03]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns connected account status with onboardingComplete', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ id: 'tenant-1', stripeAccountId: 'acct_existing' })

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
