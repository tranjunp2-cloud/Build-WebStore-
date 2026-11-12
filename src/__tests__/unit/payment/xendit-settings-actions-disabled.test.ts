import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// GH-2132 kill switch — toggled per test
const xenditFlag = vi.hoisted(() => ({ enabled: false }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() })) // no merchant-access cookie in these tests
vi.mock('@/lib/payment/xendit-visibility', () => ({
    get XENDIT_ENABLED() { return xenditFlag.enabled },
}))

const mockFindByID = vi.fn()
const mockUpdate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID, update: mockUpdate })),
}))
vi.mock('@payload-config', () => ({ default: Promise.resolve({}) }))
vi.mock('@/lib/auth', () => ({ getCurrentTenantId: vi.fn().mockResolvedValue('tenant-123') }))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({ id: 'sub-1', plan: 'PROFESSIONAL_TM_USER', status: 'active' }),
    canUse: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/lib/payload/tenant-row-lock', () => ({
    withTenantRowLock: vi.fn(async (_p: unknown, _t: string, op: (req: { transactionID: string }) => Promise<unknown>) => op({ transactionID: 'tx-1' })),
}))
vi.mock('@/lib/payment/xendit-client', () => ({
    xenditFetch: vi.fn(),
    XenditError: class XenditError extends Error {},
}))
vi.mock('@/lib/payment/xendit', () => ({ setCallbackUrl: vi.fn() }))
vi.mock('@/lib/payment/stripe', () => ({ deauthorizeStripeAccount: vi.fn() }))

import { saveXenditKeys, disconnectXendit } from '@/app/(dashboard)/settings/payments/actions'
import { xenditFetch } from '@/lib/payment/xendit-client'
import { setCallbackUrl } from '@/lib/payment/xendit'

describe('Xendit settings server actions — temporarily disabled (GH-2132)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        xenditFlag.enabled = false
    })
    afterEach(() => {
        xenditFlag.enabled = false
    })

    it('[TC-F34X-24-10] saveXenditKeys is rejected: no DB read, no Xendit call, no key written', async () => {
        const res = await saveXenditKeys('xnd_development_abc', 'callback-token')

        expect(res.success).toBe(false)
        expect(mockFindByID).not.toHaveBeenCalled()
        expect(mockUpdate).not.toHaveBeenCalled()
        expect(xenditFetch).not.toHaveBeenCalled()
        expect(setCallbackUrl).not.toHaveBeenCalled()
    })

    it('[TC-F34X-24-11] disconnectXendit still clears the keys while hidden', async () => {
        mockUpdate.mockResolvedValue({})

        const res = await disconnectXendit()

        expect(res.success).toBe(true)
        expect(mockUpdate).toHaveBeenCalledTimes(1)
        const arg = mockUpdate.mock.calls[0][0]
        expect(arg.data.xenditSecretKey).toBeNull()
        expect(arg.data.xenditCallbackToken).toBeNull()
    })
})
