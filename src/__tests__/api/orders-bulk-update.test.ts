import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any) => handler(mockUser, req)),
}))

const mockFindByID = vi.fn()
const mockUpdate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID, update: mockUpdate })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({
        id: 'mock-sub-1', plan: 'PROFESSIONAL_TM_USER', status: 'active', startDate: '2026-01-01T00:00:00.000Z',
    }),
    canUse: vi.fn().mockResolvedValue(true),
    canUseWithinLimit: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/lib/subscriptions/feature-guard', () => ({
    withFeatureGuard: vi.fn(() => (h: any) => h),
}))

import { POST } from '@/app/api/orders/bulk-update/route'

// ─── TC-F10.32: Bulk order status update ─────────────────────────────

function mockReq(body: any) {
    return { json: () => Promise.resolve(body) } as unknown as Request
}

describe('POST /api/orders/bulk-update [TC-F10.32]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('updates multiple orders with valid transition', async () => {
        mockFindByID.mockResolvedValue({ id: 'o1', status: 'pending', orderNumber: 'ORD-1' })
        mockUpdate.mockResolvedValue({})

        const res = await POST(mockReq({ orderIds: ['o1', 'o2'], status: 'confirmed' }))
        const body = await res.json()

        expect(body.success).toBe(true)
        expect(body.data.total).toBe(2)
    })

    it('reports failed transitions per order', async () => {
        mockFindByID.mockResolvedValue({ id: 'o1', status: 'completed', orderNumber: 'ORD-1' })

        const res = await POST(mockReq({ orderIds: ['o1'], status: 'confirmed' }))
        const body = await res.json()

        expect(body.data.failed).toBe(1)
        expect(body.data.results[0].success).toBe(false)
    })

    it('returns 400 for invalid body', async () => {
        const res = await POST(mockReq({ orderIds: [], status: 'confirmed' }))
        expect(res.status).toBe(400)
    })
})
