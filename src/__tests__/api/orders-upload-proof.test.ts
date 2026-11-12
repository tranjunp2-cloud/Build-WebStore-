import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock factories are hoisted — declare mocks with vi.fn() inline,
// then grab typed references after import so vi.mocked works correctly.
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        find: vi.fn(),
        update: vi.fn(),
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth/order-token', () => ({
    verifyOrderToken: vi.fn(),
}))
vi.mock('@/lib/notifications/notify-tenant-owners', () => ({
    notifyTenantOwners: vi.fn(() => Promise.resolve()),
}))

import { POST } from '@/app/api/orders/[id]/upload-proof/route'
import { getPayload } from 'payload'
import { verifyOrderToken } from '@/lib/auth/order-token'

const mockVerifyOrderToken = vi.mocked(verifyOrderToken)

// getPayload resolves to a fresh mock object per test — capture via beforeEach
let mockFind: ReturnType<typeof vi.fn>
let mockUpdate: ReturnType<typeof vi.fn>
let mockFindByID: ReturnType<typeof vi.fn>

// ─── TC-F10: Upload proof API ─────────────────────────────────────────────────

function mockReq(body: object) {
    return { json: () => Promise.resolve(body) } as unknown as Request
}

function mockParams(id: string) {
    return { params: Promise.resolve({ id }) }
}

const baseOrder = {
    id: 1,
    orderNumber: 'ORD-001',
    customerName: 'John Doe',
    currency: 'MYR',
    total: 100,
    tenant: 'tenant-1',
    magicLinkSecret: 'secret-abc',
    paymentStatus: 'awaiting_payment',
    paymentExpiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
}

describe('POST /api/orders/[id]/upload-proof [TC-F10]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // first find = the order (set per test); later finds = "is this receipt on another order?" -> no
        mockFind = vi.fn().mockResolvedValue({ docs: [] })
        mockUpdate = vi.fn().mockResolvedValue({})
        // The attached id is this order's private receipt (what upload-proof-direct creates) unless a test says otherwise
        mockFindByID = vi.fn().mockResolvedValue({ id: 42, tenant: 'tenant-1', private: true, alt: 'Payment proof — order ORD-001' })
        vi.mocked(getPayload).mockResolvedValue({ find: mockFind, update: mockUpdate, findByID: mockFindByID } as any)
    })

    it.each([
        ["another shop's receipt", { id: 42, tenant: 'tenant-2', private: true, alt: 'Payment proof — order ORD-001' }],
        ["the shop's logo / a product picture (public media)", { id: 42, tenant: 'tenant-1', private: false, alt: 'Shop logo' }],
        ['a public media renamed like the receipt', { id: 42, tenant: 'tenant-1', private: false, alt: 'Payment proof — order ORD-001' }],
        ["another order's receipt in the same shop", { id: 42, tenant: 'tenant-1', private: true, alt: 'Payment proof — order ORD-002' }],
        ['a legacy media without a shop', { id: 42, tenant: null, private: true, alt: 'Payment proof — order ORD-001' }],
        ['an unknown id', null],
    ])('[TC-PERF-166] refuses to attach %s (400, nothing written)', async (_label, media) => {
        // Arrange
        mockFind.mockResolvedValueOnce({ docs: [{ ...baseOrder }] })
        mockVerifyOrderToken.mockResolvedValueOnce({ ok: true, orderId: '1' })
        mockFindByID.mockResolvedValueOnce(media)

        // Act
        const res = await POST(mockReq({ token: 'valid-jwt', paymentProofImage: 42 }), mockParams('1'))

        // Assert — neither the order nor the media is touched (a public picture is never made private)
        expect(res.status).toBe(400)
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('[TC-PERF-166] refuses a receipt already attached to another order', async () => {
        // Arrange
        mockFind
            .mockResolvedValueOnce({ docs: [{ ...baseOrder }] })
            .mockResolvedValueOnce({ docs: [{ id: 2 }] })
        mockVerifyOrderToken.mockResolvedValueOnce({ ok: true, orderId: '1' })

        // Act
        const res = await POST(mockReq({ token: 'valid-jwt', paymentProofImage: 42 }), mockParams('1'))

        // Assert
        expect(res.status).toBe(400)
        expect(mockUpdate).not.toHaveBeenCalled()
        expect(mockFind).toHaveBeenLastCalledWith(expect.objectContaining({
            collection: 'orders',
            where: { and: [{ paymentProofImage: { equals: 42 } }, { id: { not_equals: 1 } }] },
        }))
    })

    it("[TC-PERF-166] attaches this order's own receipt without writing to the media row", async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({ docs: [{ ...baseOrder }] })
        mockVerifyOrderToken.mockResolvedValueOnce({ ok: true, orderId: '1' })

        // Act
        const res = await POST(mockReq({ token: 'valid-jwt', paymentProofImage: 42 }), mockParams('1'))

        // Assert
        expect(res.status).toBe(200)
        expect(mockUpdate).toHaveBeenCalledTimes(1)
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ collection: 'orders', data: expect.objectContaining({ paymentProofImage: 42 }) }))
        expect(mockUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ collection: 'media' }))
    })

    it('[TC-F10-04-01] valid token + awaiting_payment → 200 + paymentStatus=pending_verification', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({ docs: [{ ...baseOrder, paymentStatus: 'awaiting_payment' }] })
        mockVerifyOrderToken.mockResolvedValueOnce({ ok: true, orderId: '1' })

        // Act
        const res = await POST(mockReq({ token: 'valid-jwt', paymentProofImage: 42 }), mockParams('1'))
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.paymentStatus).toBe('pending_verification')
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'orders',
            data: expect.objectContaining({
                paymentStatus: 'pending_verification',
                paymentProofImage: 42,
                paymentRejectionReason: null,
                paymentRejectionDetail: null,
            }),
        }))
    })

    it('[TC-F10-04-02] valid token + pending_verification → 200 (re-upload allowed)', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({ docs: [{ ...baseOrder, paymentStatus: 'pending_verification' }] })
        mockVerifyOrderToken.mockResolvedValueOnce({ ok: true, orderId: '1' })

        // Act
        mockFindByID.mockResolvedValueOnce({ id: 99, tenant: 'tenant-1', private: true, alt: 'Payment proof — order ORD-001' })
        const res = await POST(mockReq({ token: 'valid-jwt', paymentProofImage: 99 }), mockParams('1'))
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.paymentStatus).toBe('pending_verification')
    })

    it('[TC-F10-04-03] valid token + paid status → 422', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({ docs: [{ ...baseOrder, paymentStatus: 'paid' }] })
        mockVerifyOrderToken.mockResolvedValueOnce({ ok: true, orderId: '1' })

        // Act
        const res = await POST(mockReq({ token: 'valid-jwt', paymentProofImage: 42 }), mockParams('1'))
        const body = await res.json()

        // Assert
        expect(res.status).toBe(422)
        expect(body.error).toMatch(/paid/)
    })

    it('[TC-F10-04-04] expired JWT → 401 {error:"expired"}', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({ docs: [baseOrder] })
        mockVerifyOrderToken.mockResolvedValueOnce({ ok: false, error: 'expired' })

        // Act
        const res = await POST(mockReq({ token: 'expired-jwt', paymentProofImage: 42 }), mockParams('1'))
        const body = await res.json()

        // Assert
        expect(res.status).toBe(401)
        expect(body.error).toBe('expired')
    })

    it('[TC-F10-04-05] tampered/invalid JWT → 401 {error:"invalid"}', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({ docs: [baseOrder] })
        mockVerifyOrderToken.mockResolvedValueOnce({ ok: false, error: 'invalid' })

        // Act
        const res = await POST(mockReq({ token: 'bad-jwt', paymentProofImage: 42 }), mockParams('1'))
        const body = await res.json()

        // Assert
        expect(res.status).toBe(401)
        expect(body.error).toBe('invalid')
    })

    it('[TC-F10-04-06] JWT orderId !== URL id → 401 (IDOR defense)', async () => {
        // Arrange — token sub=99, but URL id=1
        mockFind.mockResolvedValueOnce({ docs: [baseOrder] })
        mockVerifyOrderToken.mockResolvedValueOnce({ ok: true, orderId: '99' })

        // Act
        const res = await POST(mockReq({ token: 'mismatched-jwt', paymentProofImage: 42 }), mockParams('1'))
        const body = await res.json()

        // Assert
        expect(res.status).toBe(401)
        expect(body.error).toBe('invalid')
    })
})
