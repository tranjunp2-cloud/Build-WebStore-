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
    createConnectedAccount: vi.fn().mockResolvedValue('acct_new_123'),
    createAccountLink: vi.fn().mockResolvedValue('https://connect.stripe.com/onboard/xyz'),
    getConnectedAccountStatus: vi.fn().mockResolvedValue({
        accountId: 'acct_existing',
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
    }),
}))

import { POST as onboardPOST } from '@/app/api/stripe/connect/onboard/route'
import { GET as statusGET } from '@/app/api/stripe/connect/status/route'

// ─── TC-F13.03: Stripe Connect onboarding ─────────────────────────────
// ─── TC-F13.09: Webhook signature verification (tested in webhook file)

describe('POST /api/stripe/connect/onboard [TC-F13.03]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('creates new connected account and returns onboarding URL', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ id: 'tenant-1', name: 'Test Store' })
        mockUpdate.mockResolvedValue({})

        // Act
        const req = { json: () => Promise.resolve({ tenantId: 'tenant-1' }) } as unknown as Request
        const res = await onboardPOST(req, {} as any)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.accountId).toBe('acct_new_123')
        expect(body.data.onboardingUrl).toContain('stripe.com')
    })

    it('returns refresh link when account already exists', async () => {
        // Arrange — tenant already has stripeAccountId
        mockFindByID.mockResolvedValue({ id: 'tenant-1', stripeAccountId: 'acct_existing' })

        // Act
        const req = { json: () => Promise.resolve({ tenantId: 'tenant-1' }) } as unknown as Request
        const res = await onboardPOST(req, {} as any)
        const body = await res.json()

        // Assert
        expect(body.data.accountId).toBe('acct_existing')
        expect(body.data.onboardingUrl).toBeDefined()
    })

    it('returns 422 when tenantId missing', async () => {
        // Act
        const req = { json: () => Promise.resolve({}) } as unknown as Request
        const res = await onboardPOST(req, {} as any)

        // Assert
        expect(res.status).toBe(422)
    })

    it('returns 403 when user does not own tenant [TC-F19.38]', async () => {
        // Act — requesting tenant user doesn't own
        const req = { json: () => Promise.resolve({ tenantId: 'other-tenant' }) } as unknown as Request
        const res = await onboardPOST(req, {} as any)

        // Assert
        expect(res.status).toBe(403)
    })
})

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
