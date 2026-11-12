import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)),
}))

const mockFindByID = vi.fn()
const mockUpdate = vi.fn()
const mockSendEmail = vi.fn(() => Promise.resolve())
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID, update: mockUpdate, sendEmail: mockSendEmail })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

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

import { PATCH, GET } from '@/app/api/orders/[id]/route'

// ─── TC-F10.09: Order status update ──────────────────────────────────

describe('PATCH /api/orders/[id] [TC-F10.09]', () => {
    const ctx = { params: Promise.resolve({ id: 'order-1' }) }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('updates order status with valid transition', async () => {
        mockFindByID.mockResolvedValue({ id: 'order-1', status: 'pending' })
        mockUpdate.mockResolvedValue({ id: 'order-1', status: 'confirmed' })

        const req = { json: () => Promise.resolve({ status: 'confirmed' }) } as unknown as Request
        const res = await PATCH(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
    })

    it('rejects invalid transition [TC-F10.09]', async () => {
        mockFindByID.mockResolvedValue({ id: 'order-1', status: 'pending' })

        const req = { json: () => Promise.resolve({ status: 'completed' }) } as unknown as Request
        const res = await PATCH(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(422)
        expect(body.error.code).toBe('INVALID_TRANSITION')
    })



    it('returns 404 when order not found', async () => {
        mockFindByID.mockResolvedValue(null)

        const req = { json: () => Promise.resolve({ status: 'confirmed' }) } as unknown as Request
        const res = await PATCH(req, ctx as any)

        expect(res.status).toBe(404)
    })
})

describe('GET /api/orders/[id] [TC-F10]', () => {
    const ctx = { params: Promise.resolve({ id: 'order-1' }) }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns order details', async () => {
        mockFindByID.mockResolvedValue({ id: 'order-1', tenant: 'tenant-1', orderNumber: 'ORD-001', status: 'pending' })

        const req = new Request('http://localhost')
        const res = await GET(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.orderNumber).toBe('ORD-001')
    })

    it('returns 404 when order not found', async () => {
        mockFindByID.mockResolvedValue(null)

        const req = new Request('http://localhost')
        const res = await GET(req, ctx as any)

        expect(res.status).toBe(404)
    })
})
