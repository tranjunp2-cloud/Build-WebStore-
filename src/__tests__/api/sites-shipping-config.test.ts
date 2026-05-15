import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindByID = vi.fn()
const mockUpdate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID, update: mockUpdate })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

const mockUser = { id: 'user-1', email: 'seller@test.com', tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn().mockImplementation((handler: unknown) => {
        return async (req: unknown, ctx: unknown) => (handler as Function)(mockUser, req, ctx)
    }),
}))

import { PATCH } from '@/app/api/sites/[siteId]/shipping-config/route'

// ─── TC-F14: Shipping config PATCH API ──────────────────────────────────────

const mockSite = { id: 'site-1', tenant: 'tenant-1' }

function mockReq(body: any) {
    return {
        json: () => Promise.resolve(body),
    } as unknown as Request
}

function mockCtx(siteId = 'site-1') {
    return { params: Promise.resolve({ siteId }) } as any
}

const validBody = {
    enabled: true,
    westRateRm: '8.00',
    eastRateRm: '15.00',
    freeAboveRm: '',
}

describe('PATCH /api/sites/[siteId]/shipping-config [TC-F14]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFindByID.mockResolvedValue(mockSite)
        mockUpdate.mockResolvedValue({ ...mockSite, shippingConfig: { enabled: true, westRate: 800, eastRate: 1500, freeAbove: null } })
    })

    it('TC-F14.12 — saves valid config and returns 200', async () => {
        const res = await PATCH(mockReq(validBody), mockCtx())
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'sites',
            id: 'site-1',
            data: expect.objectContaining({
                shippingConfig: expect.objectContaining({ enabled: true, westRate: 800, eastRate: 1500 }),
            }),
        }))
    })

    it('TC-F14.14 — rate of 0 is valid (free shipping)', async () => {
        const res = await PATCH(mockReq({ ...validBody, westRateRm: '0', eastRateRm: '0' }), mockCtx())
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                shippingConfig: expect.objectContaining({ westRate: 0, eastRate: 0 }),
            }),
        }))
    })

    it('TC-F14.15 — rate above RM 1000 (100000 sen) returns 422', async () => {
        const res = await PATCH(mockReq({ ...validBody, westRateRm: '1000.01' }), mockCtx())
        const body = await res.json()

        expect(res.status).toBe(422)
        expect(body.error.code).toBe('VALIDATION_ERROR')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('TC-F14.13 — negative rate returns 422 validation error, does not save', async () => {
        const res = await PATCH(mockReq({ ...validBody, westRateRm: '-5' }), mockCtx())
        const body = await res.json()

        expect(res.status).toBe(422)
        expect(body.error.code).toBe('VALIDATION_ERROR')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('saves freeAbove threshold as sen when provided', async () => {
        const res = await PATCH(mockReq({ ...validBody, freeAboveRm: '150.00' }), mockCtx())
        expect(res.status).toBe(200)
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                shippingConfig: expect.objectContaining({ freeAbove: 15000 }),
            }),
        }))
    })

    it('saves null freeAbove when field is empty', async () => {
        const res = await PATCH(mockReq({ ...validBody, freeAboveRm: '' }), mockCtx())
        expect(res.status).toBe(200)
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                shippingConfig: expect.objectContaining({ freeAbove: null }),
            }),
        }))
    })

    it('freeAbove exceeding RM 100,000 returns 422', async () => {
        const res = await PATCH(mockReq({ ...validBody, freeAboveRm: '100000.01' }), mockCtx())
        const body = await res.json()

        expect(res.status).toBe(422)
        expect(body.error.code).toBe('VALIDATION_ERROR')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('freeAbove = 0 returns 422 (would make all orders free)', async () => {
        const res = await PATCH(mockReq({ ...validBody, freeAboveRm: '0' }), mockCtx())
        const body = await res.json()

        expect(res.status).toBe(422)
        expect(body.error.code).toBe('VALIDATION_ERROR')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('enabled: null returns 400 (must be explicit boolean)', async () => {
        const res = await PATCH(mockReq({ ...validBody, enabled: null }), mockCtx())
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('returns 400 when required fields are missing', async () => {
        const res = await PATCH(mockReq({ freeAboveRm: '50' }), mockCtx())
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('returns 400 on invalid JSON body', async () => {
        const badReq = { json: () => Promise.reject(new SyntaxError('bad json')) } as unknown as Request
        const res = await PATCH(badReq, mockCtx())
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('[TC-F14.95] null JSON body returns 400 VALIDATION_ERROR (not 500)', async () => {
        const res = await PATCH(mockReq(null), mockCtx())
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('returns 404 when site not found', async () => {
        mockFindByID.mockResolvedValueOnce(null)

        const res = await PATCH(mockReq(validBody), mockCtx('nonexistent'))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('returns 403 when user has no site access', async () => {
        const alienSite = { id: 'site-99', tenant: 'other-tenant' }
        mockFindByID.mockResolvedValueOnce(alienSite)

        const res = await PATCH(mockReq(validBody), mockCtx('site-99'))
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('RM to sen conversion: Math.round(8.005 * 100) = 801', async () => {
        const res = await PATCH(mockReq({ ...validBody, westRateRm: '8.005' }), mockCtx())
        expect(res.status).toBe(200)
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                shippingConfig: expect.objectContaining({ westRate: 801 }),
            }),
        }))
    })

    // ─── RF-05 regression: disabled state preservation ────────────────

    it('[TC-F14-RF05.01 RF-05] enabled: false is accepted and persisted — disabled shipping stays disabled', async () => {
        mockUpdate.mockResolvedValueOnce({
            ...mockSite,
            shippingConfig: { enabled: false, westRate: 800, eastRate: 1500, freeAbove: null },
        })

        const res = await PATCH(mockReq({ ...validBody, enabled: false }), mockCtx())
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                shippingConfig: expect.objectContaining({ enabled: false }),
            }),
        }))
    })
})
