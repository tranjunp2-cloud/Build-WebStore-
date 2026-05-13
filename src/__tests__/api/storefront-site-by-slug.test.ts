import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFind = vi.fn()
const mockFindByID = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ find: mockFind, findByID: mockFindByID })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { GET } from '@/app/api/storefront/site-by-slug/route'

describe('GET /api/storefront/site-by-slug [TC-F05-11-12]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('[TC-01] returns siteId, tenantId, and payment config for valid slug', async () => {
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 42 }] })   // tenant find by slug
            .mockResolvedValueOnce({ docs: [{ id: 99, paymentConfig: { cardEnabled: true, fpxEnabled: false } }] }) // site find
        mockFindByID.mockResolvedValueOnce({ id: 42, stripeOnboardingComplete: true }) // tenant full
        const req = new Request('http://localhost/api/storefront/site-by-slug?slug=mybakery')
        const res = await GET(req)
        const body = await res.json()
        expect(res.status).toBe(200)
        expect(body.siteId).toBe(99)
        expect(body.tenantId).toBe(42)
        expect(body.cardEnabled).toBe(true)
        expect(body.fpxEnabled).toBe(false)
        expect(body.stripeEnabled).toBe(true)
    })

    it('[TC-02] queries tenants with overrideAccess to bypass auth gate', async () => {
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 1 }] })
            .mockResolvedValueOnce({ docs: [{ id: 2 }] })
        mockFindByID.mockResolvedValueOnce({ id: 1 })
        const req = new Request('http://localhost/api/storefront/site-by-slug?slug=test')
        await GET(req)
        expect(mockFind).toHaveBeenNthCalledWith(1, expect.objectContaining({
            collection: 'tenants',
            where: { slug: { equals: 'test' } },
            overrideAccess: true,
        }))
    })

    it('[TC-03] returns 404 when slug not found', async () => {
        mockFind.mockResolvedValueOnce({ docs: [] })
        const req = new Request('http://localhost/api/storefront/site-by-slug?slug=nonexistent')
        const res = await GET(req)
        expect(res.status).toBe(404)
    })

    it('[TC-04] returns 404 when tenant has no site', async () => {
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 5 }] })
            .mockResolvedValueOnce({ docs: [] })
        mockFindByID.mockResolvedValueOnce({ id: 5 })
        const req = new Request('http://localhost/api/storefront/site-by-slug?slug=nositeyet')
        const res = await GET(req)
        expect(res.status).toBe(404)
    })

    it('[TC-05] returns 400 when slug param missing', async () => {
        const req = new Request('http://localhost/api/storefront/site-by-slug')
        const res = await GET(req)
        expect(res.status).toBe(400)
        expect(mockFind).not.toHaveBeenCalled()
    })
})
