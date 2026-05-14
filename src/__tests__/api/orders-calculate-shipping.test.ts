import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindByID = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { POST } from '@/app/api/orders/calculate-shipping/route'

// ─── POST /api/orders/calculate-shipping [TC-F14] ──────────────────────────

function callPost(body: unknown) {
    return POST(new Request('http://localhost/api/orders/calculate-shipping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }))
}

function mockSite(shippingConfig: unknown) {
    mockFindByID.mockResolvedValue({ id: 'site-1', shippingConfig })
}

const validBase = { siteId: 'site-1', state: 'Selangor', subtotalSen: 5000 }

describe('POST /api/orders/calculate-shipping — happy path [TC-F14]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('[TC-F14.01] Selangor → fee=800, region=west, no hint', async () => {
        mockSite(null)
        const res = await callPost(validBase)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.fee).toBe(800)
        expect(body.data.region).toBe('west')
        expect(body.data.isFree).toBe(false)
        expect(body.data.hint).toBeUndefined()
    })

    it('[TC-F14.02] Sabah → fee=1500, region=east', async () => {
        mockSite(null)
        const res = await callPost({ ...validBase, state: 'Sabah' })
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.fee).toBe(1500)
        expect(body.data.region).toBe('east')
    })

    it('[TC-F14.06] isFree=true when subtotal exceeds freeAbove', async () => {
        mockSite({ enabled: true, westRate: 800, eastRate: 1500, freeAbove: 10_000 })
        const res = await callPost({ ...validBase, subtotalSen: 15_000 })
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.fee).toBe(0)
        expect(body.data.isFree).toBe(true)
        expect(body.data.hint).toBeUndefined()
    })

    it('hint.tier=highlight when gap ≤ 5000 sen', async () => {
        mockSite({ enabled: true, westRate: 800, eastRate: 1500, freeAbove: 10_000 })
        const res = await callPost({ ...validBase, subtotalSen: 9500 })
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.hint).toBeDefined()
        expect(body.data.hint.tier).toBe('highlight')
        expect(body.data.hint.gap).toBe(500)
    })

    it('hint.tier=neutral when gap > 5000 sen', async () => {
        mockSite({ enabled: true, westRate: 800, eastRate: 1500, freeAbove: 10_000 })
        const res = await callPost({ ...validBase, subtotalSen: 2000 })
        const body = await res.json()

        expect(body.data.hint.tier).toBe('neutral')
        expect(body.data.hint.gap).toBe(8000)
    })

    it('isFree=false when enabled=false even though fee=0', async () => {
        mockSite({ enabled: false, westRate: 800, eastRate: 1500, freeAbove: 10_000 })
        const res = await callPost({ ...validBase, subtotalSen: 15_000 })
        const body = await res.json()

        expect(body.data.fee).toBe(0)
        expect(body.data.isFree).toBe(false)
        expect(body.data.hint).toBeUndefined()
    })
})

describe('POST /api/orders/calculate-shipping — validation [TC-F14]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('[TC-F14.04] invalid state returns 400 INVALID_STATE', async () => {
        mockSite(null)
        const res = await callPost({ ...validBase, state: 'Singapore' })
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('INVALID_STATE')
    })

    it('missing siteId returns 400 VALIDATION_ERROR', async () => {
        const res = await callPost({ state: 'Selangor', subtotalSen: 5000 })
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('negative subtotalSen returns 400 VALIDATION_ERROR', async () => {
        mockSite(null)
        const res = await callPost({ ...validBase, subtotalSen: -1 })
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('non-finite subtotalSen returns 400 VALIDATION_ERROR', async () => {
        mockSite(null)
        const res = await callPost({ ...validBase, subtotalSen: Infinity })
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('[TC-F14.04b] float subtotalSen (RM instead of sen) returns 400 VALIDATION_ERROR', async () => {
        mockSite(null)
        const res = await callPost({ ...validBase, subtotalSen: 100.5 })
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('site not found returns 404 NOT_FOUND', async () => {
        mockFindByID.mockResolvedValue(null)
        const res = await callPost(validBase)
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('invalid JSON body returns 400 VALIDATION_ERROR', async () => {
        const res = await POST(new Request('http://localhost/api/orders/calculate-shipping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'not-json',
        }))
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
    })
})
