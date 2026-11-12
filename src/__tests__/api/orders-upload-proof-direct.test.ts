/**
 * TC-PERF-146 — A bank-transfer receipt uploaded from the confirm page is stored private to the order's shop,
 * under a random name (never the buyer's file name), and the order points at it.
 * TC-PERF-170 — A file declared as `application/pdf` must start with the `%PDF-` signature.
 * TC-PERF-166 — The receipt carries the alt text `upload-proof` checks before re-attaching it to the same order.
 * Real: the upload-proof-direct route, lib/orders/proof-filename.ts. Faked: Payload, the upload token check,
 * owner notifications.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const find = vi.fn()
const create = vi.fn()
const update = vi.fn()
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ find, create, update, delete: vi.fn() })) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/orders/upload-token', () => ({ verifyUploadToken: vi.fn(() => true) }))
vi.mock('@/lib/notifications/notify-tenant-owners', () => ({ notifyTenantOwners: vi.fn(async () => {}) }))
vi.mock('@/lib/runtime/run-after-response', () => ({ runAfterResponse: vi.fn() }))

import { POST } from '@/app/api/orders/[id]/upload-proof-direct/route'
import { hasPdfSignature, paymentProofAlt } from '@/lib/orders/proof-filename'

const order = {
    id: 12,
    orderNumber: 'DMO-1-00012',
    customerName: 'Aina',
    tenant: 5,
    paymentStatus: 'awaiting_payment',
    paymentExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
}

const JPEG_HEAD = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
const PDF_BYTES = new TextEncoder().encode('%PDF-1.7\n1 0 obj << >> endobj\n')

function upload(name = 'Aina Binti Ali - Maybank receipt.jpg', type = 'image/jpeg', bytes: Uint8Array = type === 'application/pdf' ? PDF_BYTES : JPEG_HEAD) {
    const form = new FormData()
    form.append('file', new File([bytes as BlobPart], name, { type }))
    form.append('token', 'upload-token')
    return POST(new Request('http://shop.test/api/orders/12/upload-proof-direct', { method: 'POST', body: form }), {
        params: Promise.resolve({ id: '12' }),
    })
}

beforeEach(() => {
    find.mockReset().mockResolvedValue({ docs: [{ ...order }] })
    create.mockReset().mockResolvedValue({ id: 88 })
    update.mockReset().mockResolvedValue({})
})

describe('POST /api/orders/[id]/upload-proof-direct [TC-PERF-146]', () => {
    it('stores the receipt private to the order\'s shop', async () => {
        // Act
        const res = await upload()

        // Assert
        expect(res.status).toBe(200)
        expect(create).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'media',
            data: expect.objectContaining({ tenant: 5, private: true }),
            overrideAccess: true,
        }))
        expect(update).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'orders',
            id: 12,
            data: expect.objectContaining({ paymentProofImage: 88, paymentStatus: 'pending_verification' }),
        }))
    })

    it('never keeps the buyer\'s file name: a random payment-proof-<uuid> name with the type\'s extension', async () => {
        // Act
        await upload('Aina Binti Ali - Maybank receipt.pdf', 'application/pdf')

        // Assert
        const name = create.mock.calls[0]![0].file.name as string
        expect(name).toMatch(/^payment-proof-[0-9a-f-]{36}\.pdf$/)
        expect(name).not.toContain('Aina')
    })

    it('[TC-PERF-166] names the receipt after its order (the alt upload-proof checks)', async () => {
        // Act
        await upload()

        // Assert
        expect(create.mock.calls[0]![0].data.alt).toBe(paymentProofAlt('DMO-1-00012'))
        expect(paymentProofAlt('DMO-1-00012')).toBe('Payment proof — order DMO-1-00012')
    })
})

describe('POST /api/orders/[id]/upload-proof-direct — PDF signature [TC-PERF-170]', () => {
    it('refuses a "PDF" that does not start with %PDF- (422, nothing stored)', async () => {
        // Act
        const res = await upload('receipt.pdf', 'application/pdf', new TextEncoder().encode('<html><script>alert(1)</script>'))

        // Assert
        expect(res.status).toBe(422)
        expect(create).not.toHaveBeenCalled()
        expect(update).not.toHaveBeenCalled()
    })

    it('accepts a real PDF', async () => {
        // Act
        const res = await upload('receipt.pdf', 'application/pdf')

        // Assert
        expect(res.status).toBe(200)
        expect(create).toHaveBeenCalledTimes(1)
    })

    it('reads the signature from the first five bytes only', () => {
        expect(hasPdfSignature(new TextEncoder().encode('%PDF-'))).toBe(true)
        expect(hasPdfSignature(new TextEncoder().encode('%PDF'))).toBe(false)
        expect(hasPdfSignature(new TextEncoder().encode(' %PDF-1.4'))).toBe(false)
    })
})
