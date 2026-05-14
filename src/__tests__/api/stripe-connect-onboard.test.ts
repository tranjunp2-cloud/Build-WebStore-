import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────
// vi.mock() is hoisted — factory cannot reference const declared below.
// Use vi.fn() inline; get typed refs via vi.mocked() after import.

vi.mock('@/lib/payment/stripe', () => ({
    createConnectedAccount: vi.fn(),
    createAccountLink: vi.fn(),
}))

const mockFindByID = vi.fn()
const mockUpdate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID, update: mockUpdate })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth', () => ({
    withAuth: (handler: any) => async (req: any) => {
        const user = { email: 'seller@x.com', tenants: [{ tenant: 't1' }] }
        return handler(user, req)
    },
}))

import { POST } from '@/app/api/stripe/connect/onboard/route'
import { createConnectedAccount, createAccountLink } from '@/lib/payment/stripe'

const mockCreateConnectedAccount = vi.mocked(createConnectedAccount)
const mockCreateAccountLink = vi.mocked(createAccountLink)

// ─── Helpers ─────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): Request {
    return new Request('http://localhost/api/stripe/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

// ─── TC-F13.26, TC-F13.27: Stripe Connect Onboard API ────────────────

describe('POST /api/stripe/connect/onboard [TC-F13.26..27]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://staging.example.com')
    })

    // TC-F13.26: New account creation
    it('[TC-F13.26] creates new Stripe account when tenant has none', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ id: 't1', name: 'Shop A' })
        mockCreateConnectedAccount.mockResolvedValue('acct_new')
        mockCreateAccountLink.mockResolvedValue('https://stripe/onboarding-url')

        // Act
        const res = await POST(makeRequest({ tenantId: 't1' }) as any, {} as any)
        const json = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(json.success).toBe(true)
        expect(json.data.accountId).toBe('acct_new')
        expect(json.data.onboardingUrl).toBe('https://stripe/onboarding-url')
        expect(mockCreateConnectedAccount).toHaveBeenCalledWith('seller@x.com', 'Shop A')
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'tenants',
                id: 't1',
                data: expect.objectContaining({
                    stripeAccountId: 'acct_new',
                    stripeOnboardingComplete: false,
                }),
            }),
        )
    })

    // TC-F13.27: Retry — reuses existing stripeAccountId, skips account creation
    it('[TC-F13.27] reuses existing stripeAccountId on retry — no duplicate account', async () => {
        // Arrange — tenant already has account
        mockFindByID.mockResolvedValue({ id: 't1', stripeAccountId: 'acct_existing' })
        mockCreateAccountLink.mockResolvedValue('https://stripe/retry-url')

        // Act
        const res = await POST(makeRequest({ tenantId: 't1' }) as any, {} as any)
        const json = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(mockCreateConnectedAccount).not.toHaveBeenCalled()
        expect(json.data.accountId).toBe('acct_existing')
        expect(json.data.onboardingUrl).toBe('https://stripe/retry-url')
    })

    // Return URLs must target /dashboard/settings/payments (locked architecture decision)
    it('return URLs target /dashboard/settings/payments with correct stripe param', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ id: 't1', name: 'Shop' })
        mockCreateConnectedAccount.mockResolvedValue('acct_x')
        mockCreateAccountLink.mockResolvedValue('https://stripe/x')

        // Act
        await POST(makeRequest({ tenantId: 't1' }) as any, {} as any)

        // Assert — createAccountLink receives correct refresh + return URLs
        const [, refreshUrl, returnUrl] = mockCreateAccountLink.mock.calls[0]
        expect(refreshUrl).toBe('https://staging.example.com/dashboard/settings/payments?stripe=refresh')
        expect(returnUrl).toBe('https://staging.example.com/dashboard/settings/payments?stripe=complete')
    })

    it('returns 403 FORBIDDEN when user does not own the tenant', async () => {
        // Arrange — user owns 't1' but requesting 'other-tenant'
        const res = await POST(makeRequest({ tenantId: 'other-tenant' }) as any, {} as any)
        const json = await res.json()

        // Assert
        expect(res.status).toBe(403)
        expect(json.error.code).toBe('FORBIDDEN')
        expect(mockCreateConnectedAccount).not.toHaveBeenCalled()
    })

    it('returns 422 VALIDATION_ERROR when tenantId is missing', async () => {
        // Act
        const res = await POST(makeRequest({}) as any, {} as any)
        const json = await res.json()

        // Assert
        expect(res.status).toBe(422)
        expect(json.error.code).toBe('VALIDATION_ERROR')
    })
})
