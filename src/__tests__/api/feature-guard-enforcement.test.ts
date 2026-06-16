/**
 * Pattern A enforcement tests for withFeatureGuard HOF.
 * TC-SUB-060..063 — exercises the REAL HOF (not mocked as passthrough)
 * with mocked internal dependencies to verify 401/403 paths fire correctly.
 *
 * Test subject: POST /api/seo/apply-fixes (uses withFeatureGuard('content_management'))
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// DO NOT mock withFeatureGuard — tests must exercise the real HOF

vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(),
    withAuth: vi.fn().mockImplementation((handler: any) => {
        return async (req: any, ctx: any) => {
            const mockUser = { id: 'user-1', roles: [], tenants: [] }
            return handler(mockUser, req, ctx)
        }
    }),
}))

vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(),
    canUse: vi.fn(),
    canUseWithinLimit: vi.fn(),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({
        find: vi.fn().mockResolvedValue({ docs: [] }),
        findByID: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}),
    }),
}))

vi.mock('@payload-config', () => ({
    default: Promise.resolve({}),
}))

import { POST } from '@/app/api/seo/apply-fixes/route'
import { getCurrentUser } from '@/lib/auth'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'

const makeRequest = (body = { fixes: [] }) =>
    new NextRequest('http://localhost/api/seo/apply-fixes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })

describe('withFeatureGuard — Pattern A enforcement (TC-SUB-060..063)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('[TC-SUB-060] returns 401 UNAUTHORIZED when no user session', async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValue(null)

        // Act
        const res = await POST(makeRequest())
        const body = await res.json()

        // Assert
        expect(res.status).toBe(401)
        expect(body.error.code).toBe('UNAUTHORIZED')
        expect(vi.mocked(getActivePlanSubscription)).not.toHaveBeenCalled()
    })

    it('[TC-SUB-061] returns 403 SUBSCRIPTION_EXPIRED when tenant has no active subscription', async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValue({
            id: 'user-1',
            tenants: [{ tenant: { id: 'tenant-1' }, role: 'owner' }],
        } as any)
        vi.mocked(getActivePlanSubscription).mockResolvedValue(null)

        // Act
        const res = await POST(makeRequest())
        const body = await res.json()

        // Assert
        expect(res.status).toBe(403)
        expect(body.error.code).toBe('SUBSCRIPTION_EXPIRED')
        expect(vi.mocked(canUse)).not.toHaveBeenCalled()
    })

    it('[TC-SUB-062] returns 403 FEATURE_LOCKED when feature is disabled on current plan', async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValue({
            id: 'user-1',
            tenants: [{ tenant: { id: 'tenant-1' }, role: 'owner' }],
        } as any)
        vi.mocked(getActivePlanSubscription).mockResolvedValue({
            id: 'sub-1', plan: 'FREEMIUM', status: 'active',
        } as any)
        vi.mocked(canUse).mockResolvedValue(false)

        // Act
        const res = await POST(makeRequest())
        const body = await res.json()

        // Assert
        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FEATURE_LOCKED')
    })

    it('[TC-SUB-063] passes guard and invokes handler when subscription and feature are valid', async () => {
        // Arrange — all guard checks pass
        vi.mocked(getCurrentUser).mockResolvedValue({
            id: 'user-1',
            tenants: [{ tenant: { id: 'tenant-1' }, role: 'owner' }],
        } as any)
        vi.mocked(getActivePlanSubscription).mockResolvedValue({
            id: 'sub-1', plan: 'PROFESSIONAL_TM_USER', status: 'active',
        } as any)
        vi.mocked(canUse).mockResolvedValue(true)

        // Act — empty fixes array causes handler to return ALL_FAILED (not a guard error)
        const res = await POST(makeRequest())
        const body = await res.json()

        // Assert — guard did NOT block; response comes from handler
        expect(body.error?.code).not.toBe('UNAUTHORIZED')
        expect(body.error?.code).not.toBe('SUBSCRIPTION_EXPIRED')
        expect(body.error?.code).not.toBe('FEATURE_LOCKED')
        // Handler was reached — ALL_FAILED confirms handler executed with empty fixes
        expect(body.error?.code).toBe('ALL_FAILED')
    })
})
