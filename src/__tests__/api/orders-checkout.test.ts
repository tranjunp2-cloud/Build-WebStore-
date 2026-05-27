import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindByID = vi.fn()
const mockFind = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockSendEmail = vi.fn(() => Promise.resolve())
const mockDrizzleExecute = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        findByID: mockFindByID, find: mockFind, create: mockCreate, update: mockUpdate, delete: mockDelete, sendEmail: mockSendEmail,
        db: { drizzle: { execute: mockDrizzleExecute } },
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth/order-token', () => ({
    signOrderToken: vi.fn(() => Promise.resolve('mock-jwt-token')),
}))
vi.mock('@/lib/email/templates/bank-transfer-instructions', () => ({
    bankTransferInstructionsEmail: vi.fn(() => ({ subject: 'test', html: '<p>test</p>' })),
}))
vi.mock('@/lib/email/templates/order-confirmation', () => ({
    orderConfirmationEmail: vi.fn(() => ({ subject: 'test', html: '<p>test</p>' })),
}))
vi.mock('@/lib/email/templates/new-order-seller', () => ({
    newOrderSellerEmail: vi.fn(() => ({ subject: 'test', html: '<p>test</p>' })),
}))
vi.mock('@/lib/email/get-tenant-owner-emails', () => ({
    getTenantOwnerEmails: vi.fn(() => Promise.resolve([])),
}))
vi.mock('@/lib/orders/upload-token', () => ({
    generateUploadToken: vi.fn(() => 'mock-upload-token'),
    verifyUploadToken: vi.fn(() => true),
    generateConfirmToken: vi.fn(() => 'mock-confirm-token'),
    verifyConfirmToken: vi.fn(() => true),
}))

import { POST } from '@/app/api/orders/checkout/route'
import { MAX_CHECKOUT_ITEMS } from '@/lib/validations/orders'

// ─── TC-F10: Order checkout API ──────────────────────────────────────

function mockReq(body: any) {
    return { json: () => Promise.resolve(body) } as unknown as Request
}

// Simulates a payload.find() returning one matching product
function mockProduct(product: object) {
    return { docs: [product], totalDocs: 1 }
}

// Simulates payload.find() returning no results (not found / filtered out)
const EMPTY_FIND = { docs: [], totalDocs: 0 }

const validBody = {
    siteId: 'site-1',
    items: [{ productId: 'prod-1', quantity: 2 }],
    customer: {
        name: 'John',
        email: 'john@test.com',
        phone: '0123456789',
        address: { line1: '123 Main St', city: 'Kuala Lumpur', state: 'Selangor', postcode: '50100', country: 'Malaysia' },
    },
    paymentMethod: 'cod',
}

describe('POST /api/orders/checkout [TC-F10]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // mockReset clears queued mockResolvedValueOnce values that vi.clearAllMocks() leaves behind
        mockFindByID.mockReset()
        mockFind.mockReset()
        mockCreate.mockReset()
        mockUpdate.mockReset()
        mockDrizzleExecute.mockReset()
        mockDelete.mockReset()
        // CAS stock decrement succeeds by default (COD only)
        mockDrizzleExecute.mockResolvedValue({ rows: [{ id: 1 }] })
        mockDelete.mockResolvedValue({})
    })

    it('creates order with valid input', async () => {
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })   // site
            .mockResolvedValueOnce({ id: 'prod-1', inventory: 10 })         // restock check
        mockFind.mockResolvedValueOnce(mockProduct({ id: 'prod-1', name: 'Product 1', price: 25, inventory: 10 }))
        mockCreate.mockResolvedValue({ id: 'order-1' })
        mockUpdate.mockResolvedValue({})

        const res = await POST(mockReq(validBody))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        // status field removed from response shape in v2.2 BT rewrite — orderId/paymentMethod present
        expect(body.data.orderId).toBe('order-1')
        expect(body.data.paymentMethod).toBe('cod')
    })

    it('returns 400 for invalid body (missing customer)', async () => {
        const res = await POST(mockReq({ siteId: '1', items: [{ productId: '1', quantity: 1 }], paymentMethod: 'cod' }))
        expect(res.status).toBe(400)
    })

    it('returns 404 when site not found', async () => {
        mockFindByID.mockResolvedValueOnce(null)

        const res = await POST(mockReq(validBody))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('returns 404 when product not found', async () => {
        mockFindByID.mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
        mockFind.mockResolvedValueOnce(EMPTY_FIND)

        const res = await POST(mockReq(validBody))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.code).toBe('PRODUCT_NOT_FOUND')
    })

    it('returns 422 when out of stock', async () => {
        mockFindByID.mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
        mockFind.mockResolvedValueOnce(mockProduct({ id: 'prod-1', name: 'Product', price: 25, inventory: 1 })) // only 1 left

        const res = await POST(mockReq(validBody)) // requesting 2
        const body = await res.json()

        expect(res.status).toBe(422)
        expect(body.error.code).toBe('OUT_OF_STOCK')
    })

    it('calculates SST 6% tax', async () => {
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
            .mockResolvedValueOnce({ id: 'prod-1', inventory: 10 }) // restock check
        mockFind.mockResolvedValueOnce(mockProduct({ id: 'prod-1', name: 'P', price: 100, inventory: 10 }))
        mockCreate.mockResolvedValue({ id: 'order-1' })
        mockUpdate.mockResolvedValue({})

        const res = await POST(mockReq({ ...validBody, items: [{ productId: 'prod-1', quantity: 1 }] }))
        const body = await res.json()

        expect(body.data.total).toBe(114) // 100 subtotal + 8 shipping (Selangor/west default) + 6 SST
    })

    it('[TC-F14.02 integration] Sabah → east rate RM 15 applied to order total', async () => {
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' }) // site — no shippingConfig, uses defaults
            .mockResolvedValueOnce({ id: 'prod-1', inventory: 10 })      // restock check
        mockFind.mockResolvedValueOnce(mockProduct({ id: 'prod-1', name: 'P', price: 100, inventory: 10 }))
        mockCreate.mockResolvedValue({ id: 'order-1' })
        mockUpdate.mockResolvedValue({})

        const body = {
            ...validBody,
            items: [{ productId: 'prod-1', quantity: 1 }],
            customer: { ...validBody.customer, address: { ...validBody.customer.address, state: 'Sabah' } },
        }
        const res = await POST(mockReq(body))
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data.data.total).toBe(121) // 100 sub + 15 ship (east default) + 6 SST
    })

    it('[TC-F14.06 integration] shippingFee=0 when subtotal meets freeAbove threshold', async () => {
        const siteWithConfig = {
            id: 'site-1', tenant: 'tenant-1',
            shippingConfig: { enabled: true, westRate: 800, eastRate: 1500, freeAbove: 10_000 },
        }
        mockFindByID
            .mockResolvedValueOnce(siteWithConfig) // product price=100 → subtotal=10000 sen ≥ freeAbove
            .mockResolvedValueOnce({ id: 'prod-1', inventory: 10 }) // restock check
        mockFind.mockResolvedValueOnce(mockProduct({ id: 'prod-1', name: 'P', price: 100, inventory: 10 }))
        mockCreate.mockResolvedValue({ id: 'order-1' })
        mockUpdate.mockResolvedValue({})

        const res = await POST(mockReq({ ...validBody, items: [{ productId: 'prod-1', quantity: 1 }] }))
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data.data.total).toBe(106) // 100 sub + 0 ship (free) + 6 SST
    })

    it('[TC-F14.04] empty/invalid state rejected by schema — returns 400', async () => {
        const body = {
            ...validBody,
            customer: { ...validBody.customer, address: { ...validBody.customer.address, state: '' } },
        }
        const res = await POST(mockReq(body))
        const data = await res.json()

        expect(res.status).toBe(400)
        expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('[TC-F14.04] non-MY state string rejected by schema — returns 400', async () => {
        const body = {
            ...validBody,
            customer: { ...validBody.customer, address: { ...validBody.customer.address, state: 'California' } },
        }
        const res = await POST(mockReq(body))
        const data = await res.json()

        expect(res.status).toBe(400)
        expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('[TC-F14.04] missing state (undefined) returns 422 VALIDATION_ERROR', async () => {
        mockFindByID.mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
        mockFind.mockResolvedValueOnce(mockProduct({ id: 'prod-1', name: 'P', price: 100, inventory: 10 }))
        const { state: _s, ...addressWithoutState } = validBody.customer.address
        const body = {
            ...validBody,
            customer: { ...validBody.customer, address: addressWithoutState },
        }
        const res = await POST(mockReq(body))
        const data = await res.json()

        expect(res.status).toBe(422)
        expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('[TC-F10-06-01 security] cross-tenant product returns 404', async () => {
        // find() query filters by site=site-1, so a product from site-2 is not returned
        mockFindByID.mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
        mockFind.mockResolvedValueOnce(EMPTY_FIND)

        const res = await POST(mockReq(validBody))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.code).toBe('PRODUCT_NOT_FOUND')
    })

    it('[TC-F10-06-02 security] duplicate productIds aggregated — stock bypass prevented', async () => {
        mockFindByID.mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
        mockFind.mockResolvedValueOnce(mockProduct({ id: 'prod-1', name: 'Product', price: 25, inventory: 3 })) // inventory=3

        const body = {
            ...validBody,
            items: [
                { productId: 'prod-1', quantity: 2 }, // individually passes inventory=3
                { productId: 'prod-1', quantity: 2 }, // individually passes inventory=3 — aggregate=4 should fail
            ],
        }
        const res = await POST(mockReq(body))
        const data = await res.json()

        expect(res.status).toBe(422)
        expect(data.error.code).toBe('OUT_OF_STOCK')
    })

    it('[TC-F10-06-03 security] duplicate productIds create one aggregated order line', async () => {
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
            .mockResolvedValueOnce({ id: 'prod-1', inventory: 10 }) // restock check
        mockFind.mockResolvedValueOnce(mockProduct({ id: 'prod-1', name: 'Product', price: 25, inventory: 10 }))
        mockCreate.mockResolvedValue({ id: 'order-1' })
        mockUpdate.mockResolvedValue({})

        const body = {
            ...validBody,
            items: [
                { productId: 'prod-1', quantity: 2 },
                { productId: 'prod-1', quantity: 3 },
            ],
        }
        const res = await POST(mockReq(body))
        const data = await res.json()

        expect(res.status).toBe(200)
        const createdItems = mockCreate.mock.calls[0][0].data.items
        expect(createdItems).toHaveLength(1)
        expect(createdItems[0].quantity).toBe(5)
    })

    // ─── RF-02 regression: quantity validation ────────────────────────

    it('[TC-F14-RF02.01 RF-02] fractional quantity rejected by schema — returns 400', async () => {
        const body = { ...validBody, items: [{ productId: 'prod-1', quantity: 1.5 }] }
        const res = await POST(mockReq(body))
        const data = await res.json()

        expect(res.status).toBe(400)
        expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it(`[TC-F14-RF02.02 RF-02] more than ${MAX_CHECKOUT_ITEMS} items rejected by schema — returns 400`, async () => {
        const body = {
            ...validBody,
            items: Array.from({ length: MAX_CHECKOUT_ITEMS + 1 }, (_, i) => ({ productId: `prod-${i}`, quantity: 1 })),
        }
        const res = await POST(mockReq(body))
        const data = await res.json()

        expect(res.status).toBe(400)
        expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    // ─── RF-01 regression: product eligibility via find() filter ─────

    it('[TC-F14-RF01.01 RF-01] inactive product (status≠active) returns 404 — find() where clause verified', async () => {
        mockFindByID.mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
        mockFind.mockResolvedValueOnce(EMPTY_FIND) // status filter excludes draft/archived products

        const res = await POST(mockReq(validBody))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.code).toBe('PRODUCT_NOT_FOUND')
        // Verify find() was called with the status=active and site filters
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'products',
            where: expect.objectContaining({
                and: expect.arrayContaining([
                    expect.objectContaining({ status: { equals: 'active' } }),
                    expect.objectContaining({ deletedAt: { exists: false } }),
                ]),
            }),
        }))
    })

    it('[TC-F10-02-02] bank_transfer order created with paymentStatus=awaiting_payment, no proof at checkout', async () => {
        // Arrange — bank_transfer: no proof upload, paymentReference uniqueness check via find()
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
        mockFind
            .mockResolvedValueOnce(mockProduct({ id: 'prod-1', name: 'P', price: 50, inventory: 10 })) // product lookup
            .mockResolvedValueOnce({ docs: [], totalDocs: 0 }) // paymentReference uniqueness check
        mockCreate.mockResolvedValue({
            id: 'order-bt-1',
            orderNumber: 'ORD-BT1',
            total: 59,
            currency: 'MYR',
        })

        const body = { ...validBody, paymentMethod: 'bank_transfer' }

        // Act
        const res = await POST(mockReq(body))
        const data = await res.json()

        // Assert — bank_transfer orders are created with awaiting_payment status
        expect(res.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.paymentMethod).toBe('bank_transfer')
        const createdData = mockCreate.mock.calls[0][0].data
        expect(createdData.paymentStatus).toBe('awaiting_payment')
        expect(createdData.paymentProofImage).toBeUndefined()
        expect(createdData.paymentReference).toMatch(/^BT-[A-Z2-9]{6}$/)
        expect(createdData.magicLinkSecret).toBeTruthy()
        expect(createdData.paymentExpiresAt).toBeInstanceOf(Date)
    })

    it('[TC-F10-02-03] bank_transfer rejects paymentProofImage at checkout (Zod refine)', async () => {
        // Sending proof at checkout for bank_transfer is forbidden
        const body = { ...validBody, paymentMethod: 'bank_transfer', paymentProofImage: 'media-42' }
        const res = await POST(mockReq(body))
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('[TC-F10-02-04] qr_banking (legacy) rejected by Zod — returns 400', async () => {
        // qr_banking is no longer a valid enum value — client must send bank_transfer
        const body = { ...validBody, paymentMethod: 'qr_banking', paymentProofImage: 'media-42' }
        const res = await POST(mockReq(body))
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('[TC-F14-RF01.02 RF-01] soft-deleted product (deletedAt set) returns 404 — find() where clause verified', async () => {
        mockFindByID.mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
        mockFind.mockResolvedValueOnce(EMPTY_FIND) // deletedAt filter excludes soft-deleted products

        const res = await POST(mockReq(validBody))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.code).toBe('PRODUCT_NOT_FOUND')
        // Verify the where clause enforces both eligibility conditions
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'products',
            where: expect.objectContaining({
                and: expect.arrayContaining([
                    expect.objectContaining({ status: { equals: 'active' } }),
                    expect.objectContaining({ deletedAt: { exists: false } }),
                ]),
            }),
        }))
    })

    // ─── TC-F09.226–228: Variant cart/checkout fixes ──────────────────────

    it('[TC-F09.226] variant product: order unitPrice = variant.price not base price', async () => {
        // Arrange: product with Red variant @ RM 75 (base price RM 50)
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })   // site
        mockFind.mockResolvedValueOnce(mockProduct({
            id: 'prod-v', name: 'Shirt', price: 50,  // base price — must NOT be used
            currency: 'MYR', inventory: 10,
            hasVariants: true,
            variants: [
                { name: 'Red', price: 75, stock: 5 },
                { name: 'Blue', price: 80, stock: 3 },
            ],
        }))
        mockCreate.mockResolvedValue({ id: 'order-v1' })

        const body = {
            siteId: 'site-1',
            items: [{ productId: 'prod-v', quantity: 1, variant: 'Red' }],
            customer: validBody.customer,
            paymentMethod: 'cod',
        }

        // Act
        const res = await POST(mockReq(body))
        const data = await res.json()

        // Assert: unitPrice is variant.price
        expect(res.status).toBe(200)
        const createdItem = mockCreate.mock.calls[0][0].data.items[0]
        expect(createdItem.unitPrice).toBe(75)        // variant.price, not base price 50
        expect(createdItem.variant).toBe('Red')
    })

    it('[TC-F09.227] variant OOS check uses aggregate p.inventory (not per-variant stock)', async () => {
        // Arrange: variant product with aggregate inventory=1 and variant.stock=5 (stale).
        // OOS guard must fire based on p.inventory (the field CAS decrements), not variant.stock.
        mockFindByID.mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
        mockFind.mockResolvedValueOnce(mockProduct({
            id: 'prod-v', name: 'Shirt', price: 50, inventory: 1, // aggregate: only 1 left
            hasVariants: true,
            variants: [
                { name: 'Red', price: 75, stock: 5 },  // variant.stock is stale — NOT used
            ],
        }))

        const body = {
            siteId: 'site-1',
            items: [{ productId: 'prod-v', quantity: 2, variant: 'Red' }], // qty=2 > p.inventory=1
            customer: validBody.customer,
            paymentMethod: 'cod',
        }

        // Act
        const res = await POST(mockReq(body))
        const data = await res.json()

        // Assert: rejects because p.inventory (1) < requested qty (2)
        expect(res.status).toBe(422)
        expect(data.error.code).toBe('OUT_OF_STOCK')
        expect(data.error.available).toBe(1)
    })

    it('[TC-F09.226b] stale variant name returns 422 VARIANT_NOT_FOUND', async () => {
        // Arrange: product with Red variant, request Purple (doesn't exist)
        mockFindByID.mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
        mockFind.mockResolvedValueOnce(mockProduct({
            id: 'prod-v', name: 'Shirt', price: 50, inventory: 10,
            hasVariants: true,
            variants: [{ name: 'Red', price: 75, stock: 5 }],
        }))

        const body = {
            siteId: 'site-1',
            items: [{ productId: 'prod-v', quantity: 1, variant: 'Purple' }], // doesn't exist
            customer: validBody.customer,
            paymentMethod: 'cod',
        }

        // Act
        const res = await POST(mockReq(body))
        const data = await res.json()

        // Assert: VARIANT_NOT_FOUND error
        expect(res.status).toBe(422)
        expect(data.error.code).toBe('VARIANT_NOT_FOUND')
    })

    it('[TC-F09.226c] variant product with multiple variants — correct unitPrice per variant', async () => {
        // Arrange: product with 2 variants, add both to order
        mockFindByID.mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' }) // site
        // Need 2 find() calls: one for Red, one for Blue
        const shirtProduct = {
            id: 'prod-v', name: 'Shirt', price: 50,
            currency: 'MYR', inventory: 10,
            hasVariants: true,
            variants: [
                { name: 'Red', price: 75, stock: 5 },
                { name: 'Blue', price: 80, stock: 3 },
            ],
        }
        mockFind
            .mockResolvedValueOnce(mockProduct(shirtProduct)) // Red variant lookup
            .mockResolvedValueOnce(mockProduct(shirtProduct)) // Blue variant lookup
        mockCreate.mockResolvedValue({ id: 'order-v2' })

        const body = {
            siteId: 'site-1',
            items: [
                { productId: 'prod-v', quantity: 1, variant: 'Red' },
                { productId: 'prod-v', quantity: 1, variant: 'Blue' },
            ],
            customer: validBody.customer,
            paymentMethod: 'cod',
        }

        // Act
        const res = await POST(mockReq(body))
        const data = await res.json()

        // Assert: each line has correct unitPrice
        expect(res.status).toBe(200)
        const createdItems = mockCreate.mock.calls[0][0].data.items
        expect(createdItems).toHaveLength(2)
        expect(createdItems[0].variant).toBe('Red')
        expect(createdItems[0].unitPrice).toBe(75)
        expect(createdItems[1].variant).toBe('Blue')
        expect(createdItems[1].unitPrice).toBe(80)
    })

    it('[TC-F09.229] hasVariants product without variant field returns 422 VARIANT_REQUIRED', async () => {
        // Arrange: variant product sent without variant name (direct API bypass attempt)
        mockFindByID.mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
        mockFind.mockResolvedValueOnce(mockProduct({
            id: 'prod-v', name: 'Shirt', price: 50, inventory: 100,
            hasVariants: true,
            variants: [{ name: 'Red', price: 75, stock: 5 }],
        }))

        const body = {
            siteId: 'site-1',
            items: [{ productId: 'prod-v', quantity: 1 }], // no variant field
            customer: validBody.customer,
            paymentMethod: 'cod',
        }

        // Act
        const res = await POST(mockReq(body))
        const data = await res.json()

        // Assert: rejected before stock/price logic; base price not silently used
        expect(res.status).toBe(422)
        expect(data.error.code).toBe('VARIANT_REQUIRED')
    })
})
