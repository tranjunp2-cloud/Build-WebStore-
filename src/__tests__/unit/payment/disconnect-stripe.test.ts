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
    deauthorizeStripeAccount: (id: string) => mockDeauth(id),
}))

import { disconnectStripe } from '@/app/(dashboard)/settings/payments/actions'

// ─── TC-F13.87: disconnectStripe server action ─────────────────────────

describe('disconnectStripe [TC-F13.87]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetTenantId.mockResolvedValue('1')
    })

    it('clears DB on happy path (STRIPE_CONNECT_DISABLED: deauth skipped)', async () => {
        // Arrange — deauth + findByID are commented out; only DB clear runs
        mockUpdate.mockResolvedValue({})

        // Act
        const result = await disconnectStripe()

        // Assert
        expect(result).toEqual({ success: true })
        // deauth not called while STRIPE_CONNECT_DISABLED
        expect(mockDeauth).not.toHaveBeenCalled()
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                stripeAccountId: null,
                stripeOnboardingComplete: false,
                payments: { payment_card: false, payment_fpx: false },
            }),
        }))
    })

    it('clears DB even when deauthorize throws (legacy account / network error)', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ stripeAccountId: 'acct_legacy' })
        mockUpdate.mockResolvedValue({})
        mockDeauth.mockRejectedValueOnce(new Error('no_application_for_account'))

        // Act
        const result = await disconnectStripe()

        // Assert — deauth failure must not block DB cleanup
        expect(result).toEqual({ success: true })
        expect(mockUpdate).toHaveBeenCalled()
    })

    it('skips deauthorize when no stripeAccountId present (idempotent)', async () => {
        // Arrange — tenant already disconnected
        mockFindByID.mockResolvedValue({ stripeAccountId: null })
        mockUpdate.mockResolvedValue({})

        // Act
        const result = await disconnectStripe()

        // Assert
        expect(result).toEqual({ success: true })
        expect(mockDeauth).not.toHaveBeenCalled()
        expect(mockUpdate).toHaveBeenCalled()
    })

    it('returns error when no tenantId (unauthenticated)', async () => {
        // Arrange
        mockGetTenantId.mockResolvedValue(null)

        // Act
        const result = await disconnectStripe()

        // Assert
        expect(result).toEqual({ success: false, error: 'Unauthorized' })
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('returns error on payload.update failure', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ stripeAccountId: 'acct_xxx' })
        mockDeauth.mockResolvedValue(undefined)
        mockUpdate.mockRejectedValueOnce(new Error('db down'))

        // Act
        const result = await disconnectStripe()

        // Assert
        expect(result.success).toBe(false)
    })
})
