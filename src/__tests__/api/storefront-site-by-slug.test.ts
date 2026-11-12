import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFind = vi.fn()
const mockFindByID = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ find: mockFind, findByID: mockFindByID })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { GET } from '@/app/api/storefront/site-by-slug/route'
// #2179: store availability has its own tests (store-unavailable.test.ts); here a store is unavailable only when suspended.
vi.mock('@/lib/storefront/store-availability', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/storefront/store-availability')>()),
    isTenantUnavailable: vi.fn(async (_payload: unknown, tenant: { status?: unknown } | null) => tenant?.status === 'suspended'),
    isTenantIdUnavailable: vi.fn(async () => false),
}))
import { isTenantIdUnavailable, isTenantUnavailable } from '@/lib/storefront/store-availability'

describe('GET /api/storefront/site-by-slug [TC-F05-11-12]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('[TC-01] returns siteId, tenantId, and payment config for valid slug', async () => {
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 42 }] })   // tenant find by slug
            .mockResolvedValueOnce({ docs: [{ id: 99, paymentConfig: { cardEnabled: true, fpxEnabled: false } }] }) // site find
        // payments.payment_card=true enables card at tenant level; fpx not enabled
        mockFindByID.mockResolvedValueOnce({ id: 42, stripeOnboardingComplete: true, payments: { payment_card: true, payment_fpx: false } }) // tenant full
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

    it('[TC-PERF-151] shows buyers no bank account digits at all before ordering (not even masked; #2117)', async () => {
        // Arrange
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 42 }] })
            .mockResolvedValueOnce({ docs: [{ id: 99, paymentConfig: { bankName: 'Maybank', bankAccountNo: '5140 1234 5678', bankAccountHolder: 'Kedai' } }] })
        mockFindByID.mockResolvedValueOnce({ id: 42, payments: {} })

        // Act
        const res = await GET(new Request('http://localhost/api/storefront/site-by-slug?slug=mybakery'))
        const body = await res.json()

        // Assert: bank details come only with the order (confirm page), never on the public site lookup
        expect(body).not.toHaveProperty('bankAccountNo')
        expect(body).not.toHaveProperty('bankName')
        expect(JSON.stringify(body)).not.toContain('5678')
        expect(JSON.stringify(body)).not.toContain('51401234')
        expect(JSON.stringify(body)).not.toContain('5140 1234')
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

    it('[TC-F09.283] unavailable store answers 404 like an unknown slug', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({ docs: [{ id: 42, status: 'active' }] })
        vi.mocked(isTenantUnavailable).mockResolvedValueOnce(true)

        // Act
        const res = await GET(new Request('http://localhost/api/storefront/site-by-slug?slug=mybakery'))

        // Assert
        expect(res.status).toBe(404)
        expect(await res.json()).toEqual({ error: 'Not found' })
        expect(mockFind).toHaveBeenCalledTimes(1)
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

    it('[TC-F09.269] never returns the bank account details (GH-2077)', async () => {
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 42 }] })
            .mockResolvedValueOnce({ docs: [{ id: 99, paymentConfig: { bankName: 'CIMB', bankAccountNo: '9876543210', bankAccountHolder: 'Hehe Sdn Bhd' } }] })
        mockFindByID.mockResolvedValueOnce({ id: 42, payments: { payment_qr: true } })
        const res = await GET(new Request('http://localhost/api/storefront/site-by-slug?slug=mybakery'))
        const body = await res.json()
        expect(res.status).toBe(200)
        expect(JSON.stringify(body)).not.toContain('9876543210')
        expect(body).not.toHaveProperty('bankAccountNo')
        expect(body).not.toHaveProperty('bankAccountHolder')
    })

    it('[TC-F09-2477-01] tenant payment_qr=true + site enableQrBanking=false (PW1 store) → enableQrBanking & hasPaymentMethods true, no bank details', async () => {
        // Arrange
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 42 }] })
            .mockResolvedValueOnce({ docs: [{ id: 99, paymentConfig: { enableQrBanking: false, bankAccountNo: '1122334455' } }] })
        mockFindByID.mockResolvedValueOnce({ id: 42, payments: { payment_qr: true } })

        // Act
        const res = await GET(new Request('http://localhost/api/storefront/site-by-slug?slug=pc-changed'))
        const body = await res.json()

        // Assert
        expect(body.enableQrBanking).toBe(true)
        expect(body.hasPaymentMethods).toBe(true)
        expect(JSON.stringify(body)).not.toContain('1122334455')
    })

    it.each([[true], [undefined]])('[TC-F09-2477-02] tenant payment_qr=false + site enableQrBanking=%s → enableQrBanking false', async (siteFlag) => {
        // Arrange
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 42 }] })
            .mockResolvedValueOnce({ docs: [{ id: 99, paymentConfig: { enableQrBanking: siteFlag } }] })
        mockFindByID.mockResolvedValueOnce({ id: 42, payments: { payment_qr: false } })

        // Act
        const res = await GET(new Request('http://localhost/api/storefront/site-by-slug?slug=mybakery'))
        const body = await res.json()

        // Assert
        expect(body.enableQrBanking).toBe(false)
        expect(body.hasPaymentMethods).toBe(false)
    })
})
