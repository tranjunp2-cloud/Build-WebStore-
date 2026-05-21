import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockGetTenantId = vi.fn()
vi.mock('@/lib/auth', () => ({
    getCurrentTenantId: () => mockGetTenantId(),
}))

const mockFindByID = vi.fn()
const mockUpdate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID, update: mockUpdate })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

const mockDeauth = vi.fn()
vi.mock('@/lib/payment/stripe', () => ({
    deauthorizeStripeAccount: (...args: unknown[]) => mockDeauth(...args),
}))

import { disconnectStripe } from '@/app/(dashboard)/settings/payments/actions'

// ─── TC-F13.87: disconnectStripe server action ─────────────────────────

describe('disconnectStripe [TC-F13.87]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetTenantId.mockResolvedValue('1')
        mockDeauth.mockResolvedValue(undefined)
    })

    it('clears DB fields on happy path', async () => {
        mockFindByID.mockResolvedValue({ stripeAccountId: 'acct_xxx' })
        mockUpdate.mockResolvedValue({})

        const result = await disconnectStripe()

        expect(result).toEqual({ success: true })
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                stripeAccountId: null,
                stripeOnboardingComplete: false,
                payments: { payment_card: false, payment_fpx: false },
            }),
        }))
    })

    it('succeeds when tenant has no stripeAccountId (idempotent)', async () => {
        mockFindByID.mockResolvedValue({ stripeAccountId: null })
        mockUpdate.mockResolvedValue({})

        const result = await disconnectStripe()

        expect(result).toEqual({ success: true })
        expect(mockUpdate).toHaveBeenCalled()
    })

    it('returns error when no tenantId (unauthenticated)', async () => {
        mockGetTenantId.mockResolvedValue(null)

        const result = await disconnectStripe()

        expect(result).toEqual({ success: false, error: 'Unauthorized' })
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('returns error on payload.update failure', async () => {
        mockFindByID.mockResolvedValue({ stripeAccountId: 'acct_xxx' })
        mockUpdate.mockRejectedValueOnce(new Error('db down'))

        const result = await disconnectStripe()

        expect(result.success).toBe(false)
    })

    // Resilience: deauthorize is best-effort — DB cleanup must still run even if Stripe call fails
    it('clears DB even when deauthorize throws (legacy account / network error)', async () => {
        mockFindByID.mockResolvedValue({ stripeAccountId: 'acct_xxx' })
        mockUpdate.mockResolvedValue({})
        mockDeauth.mockRejectedValueOnce(new Error('no_application_for_account'))

        const result = await disconnectStripe()

        expect(result).toEqual({ success: true })
        expect(mockUpdate).toHaveBeenCalled()
    })
})
