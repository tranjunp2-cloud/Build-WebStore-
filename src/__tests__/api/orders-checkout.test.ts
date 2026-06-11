import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindByID = vi.fn()
const mockFind = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockSendEmail = vi.fn(() => Promise.resolve())
const mockDrizzleExecute = vi.fn()
const mockLogger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        findByID: mockFindByID, find: mockFind, create: mockCreate, update: mockUpdate, delete: mockDelete, sendEmail: mockSendEmail,
        db: { drizzle: { execute: mockDrizzleExecute } },
        logger: mockLogger,
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
vi.mock('@/lib/email/get-template-config', () => ({
    getTemplateConfig: vi.fn(() => Promise.resolve(null)),
    invalidateTemplateConfigCache: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/lib/orders/upload-token', () => ({
    generateUploadToken: vi.fn(() => 'mock-upload-token'),
    verifyUploadToken: vi.fn(() => true),
    generateConfirmToken: vi.fn(() => 'mock-confirm-token'),
    verifyConfirmToken: vi.fn(() => true),
}))
// Q7: the COD/bank_transfer path must delegate redemption to the idempotent helper (single writer,
// ON CONFLICT (order_id)). We mock it here to assert the route WIRES it correctly; the helper's own
// idempotency is unit-tested in record-discount-redemption.test.ts [TC-F33-10-07].
const mockRecordRedemption = vi.fn(() => Promise.resolve({ recorded: true }))
vi.mock('@/lib/discounts/record-discount-redemption', () => ({
    recordDiscountRedemption: (...args: any[]) => mockRecordRedemption(...args),
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

// Default tenant mock with all manual payment methods enabled
const MOCK_TENANT = {
    id: 'tenant-1',
    name: 'Test Shop',
    slug: 'test-shop',
    payments: { payment_cod: true, payment_qr: true },
}

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
        mockUpdate.mockResolvedValue({})
    })

    it('creates order with valid input', async () => {
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })   // site
            .mockResolvedValueOnce(MOCK_TENANT)                              // tenant (payment check + email)
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
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
            .mockResolvedValueOnce(MOCK_TENANT)
        mockFind.mockResolvedValueOnce(EMPTY_FIND)

        const res = await POST(mockReq(validBody))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.code).toBe('PRODUCT_NOT_FOUND')
    })

    it('returns 422 when out of stock', async () => {
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
            .mockResolvedValueOnce(MOCK_TENANT)
        mockFind.mockResolvedValueOnce(mockProduct({ id: 'prod-1', name: 'Product', price: 25, inventory: 1 })) // only 1 left

        const res = await POST(mockReq(validBody)) // requesting 2
        const body = await res.json()

        expect(res.status).toBe(422)
        expect(body.error.code).toBe('OUT_OF_STOCK')
    })

    it('[F33 phase-06] no SST tax added to total', async () => {
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
            .mockResolvedValueOnce(MOCK_TENANT)
        mockFind.mockResolvedValueOnce(mockProduct({ id: 'prod-1', name: 'P', price: 100, inventory: 10 }))
        mockCreate.mockResolvedValue({ id: 'order-1' })
        mockUpdate.mockResolvedValue({})

        const res = await POST(mockReq({ ...validBody, items: [{ productId: 'prod-1', quantity: 1 }] }))
        const body = await res.json()

        expect(body.data.total).toBe(108) // 100 subtotal + 8 shipping (Selangor/west default), SST removed (phase-06)
    })

    it('[TC-F14.02 integration] Sabah → east rate RM 15 applied to order total', async () => {
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' }) // site — no shippingConfig, uses defaults
            .mockResolvedValueOnce(MOCK_TENANT)
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
        expect(data.data.total).toBe(115) // 100 sub + 15 ship (east default), SST removed (phase-06)
    })

    it('[TC-F14.06 integration] shippingFee=0 when subtotal meets freeAbove threshold', async () => {
        const siteWithConfig = {
            id: 'site-1', tenant: 'tenant-1',
            shippingConfig: { enabled: true, westRate: 800, eastRate: 1500, freeAbove: 10_000 },
        }
        mockFindByID
            .mockResolvedValueOnce(siteWithConfig) // product price=100 → subtotal=10000 sen ≥ freeAbove
            .mockResolvedValueOnce(MOCK_TENANT)
        mockFind.mockResolvedValueOnce(mockProduct({ id: 'prod-1', name: 'P', price: 100, inventory: 10 }))
        mockCreate.mockResolvedValue({ id: 'order-1' })
        mockUpdate.mockResolvedValue({})

        const res = await POST(mockReq({ ...validBody, items: [{ productId: 'prod-1', quantity: 1 }] }))
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data.data.total).toBe(100) // 100 sub + 0 ship (free), SST removed (phase-06)
    })

    it('[TC-F33-35 integration] discount drops subtotal below freeAbove → shipping charged', async () => {
        const siteWithConfig = {
            id: 'site-1', tenant: 'tenant-1',
            shippingConfig: { enabled: true, westRate: 800, eastRate: 1500, freeAbove: 10_000 },
        }
        mockFindByID
            .mockResolvedValueOnce(siteWithConfig)
            .mockResolvedValueOnce(MOCK_TENANT)
        mockFind
            .mockResolvedValueOnce(mockProduct({ id: 'prod-1', name: 'P', price: 120, inventory: 10 })) // subtotal=120 → 12000 sen ≥ freeAbove
            .mockResolvedValueOnce({ // discounts find: 30% off → 3600 sen → effective 8400 sen < freeAbove
                docs: [{ id: 5, code: 'SAVE30', type: 'percentage', value: 30, status: 'active', usageLimit: null, usageCount: 0, startsAt: null, expiresAt: null, tenant: 'tenant-1' }],
                totalDocs: 1,
            })
        mockCreate.mockResolvedValue({ id: 'order-1' })

        const res = await POST(mockReq({ ...validBody, items: [{ productId: 'prod-1', quantity: 1 }], discountCode: 'SAVE30' }))
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data.data.total).toBe(92) // max(0, 120 − 36) + 8 west ship — free-ship lost after discount
    })

    it('[TC-F33-36 integration] discount but subtotal still ≥ freeAbove → free ship kept', async () => {
        const siteWithConfig = {
            id: 'site-1', tenant: 'tenant-1',
            shippingConfig: { enabled: true, westRate: 800, eastRate: 1500, freeAbove: 10_000 },
        }
        mockFindByID
            .mockResolvedValueOnce(siteWithConfig)
            .mockResolvedValueOnce(MOCK_TENANT)
        mockFind
            .mockResolvedValueOnce(mockProduct({ id: 'prod-1', name: 'P', price: 200, inventory: 10 })) // subtotal=200 → 20000 sen
            .mockResolvedValueOnce({ // 10% off → 2000 sen → effective 18000 sen ≥ freeAbove
                docs: [{ id: 6, code: 'SAVE10', type: 'percentage', value: 10, status: 'active', usageLimit: null, usageCount: 0, startsAt: null, expiresAt: null, tenant: 'tenant-1' }],
                totalDocs: 1,
            })
        mockCreate.mockResolvedValue({ id: 'order-1' })

        const res = await POST(mockReq({ ...validBody, items: [{ productId: 'prod-1', quantity: 1 }], discountCode: 'SAVE10' }))
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data.data.total).toBe(180) // max(0, 200 − 20) + 0 free ship — still above threshold after discount
    })

    it('[TC-F33-10-07 Q7] COD checkout routes redemption through the idempotent helper', async () => {
        // Arrange — valid active discount on a COD order
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
            .mockResolvedValueOnce(MOCK_TENANT)
        mockFind
            .mockResolvedValueOnce(mockProduct({ id: 'prod-1', name: 'P', price: 100, inventory: 10 })) // subtotal 100 → 10000 sen
            .mockResolvedValueOnce({ // active 50% discount → 5000 sen
                docs: [{ id: 5, code: 'SAVE50', type: 'percentage', value: 50, status: 'active', usageLimit: null, usageCount: 0, startsAt: null, expiresAt: null, tenant: 'tenant-1' }],
                totalDocs: 1,
            })
        mockCreate.mockResolvedValue({ id: 42 }) // numeric order id

        // Act
        const res = await POST(mockReq({ ...validBody, items: [{ productId: 'prod-1', quantity: 1 }], discountCode: 'SAVE50' }))

        // Assert — helper called exactly once with the order/discount snapshot (idempotency lives in the helper)
        expect(res.status).toBe(200)
        expect(mockRecordRedemption).toHaveBeenCalledTimes(1)
        expect(mockRecordRedemption).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            discountId: 5,
            orderId: 42,
            amountApplied: 5000,
            discountCode: 'SAVE50',
            customerEmail: 'john@test.com',
        }))
    })

    it('[TC-F33-10-18 Q9] discount set inactive between apply and place-order → silent reject at commit, no redemption', async () => {
        // Arrange — checkout re-fetches the discount fresh; admin flipped it to inactive after the
        // customer saw the "applied" chip. BR-03: silent reject, order proceeds at full price.
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
            .mockResolvedValueOnce(MOCK_TENANT)
        mockFind
            .mockResolvedValueOnce(mockProduct({ id: 'prod-1', name: 'P', price: 100, inventory: 10 }))
            .mockResolvedValueOnce({ // discount now inactive
                docs: [{ id: 5, code: 'OFF50', type: 'percentage', value: 50, status: 'inactive', usageLimit: null, usageCount: 0, startsAt: null, expiresAt: null, tenant: 'tenant-1' }],
                totalDocs: 1,
            })
        mockCreate.mockResolvedValue({ id: 43 })

        // Act
        const res = await POST(mockReq({ ...validBody, items: [{ productId: 'prod-1', quantity: 1 }], discountCode: 'OFF50' }))
        const data = await res.json()

        // Assert — full price (100 sub + 8 west ship), no discount applied, no redemption recorded
        expect(res.status).toBe(200)
        expect(data.data.total).toBe(108)
        expect(mockRecordRedemption).not.toHaveBeenCalled()
        // Order persisted WITHOUT the discount snapshot fields
        const createData = mockCreate.mock.calls[0][0].data
        expect(createData.discountCode).toBeUndefined()
        expect(createData.discountAmount).toBeUndefined()
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
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
            .mockResolvedValueOnce(MOCK_TENANT)
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
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
            .mockResolvedValueOnce(MOCK_TENANT)
        mockFind.mockResolvedValueOnce(EMPTY_FIND)

        const res = await POST(mockReq(validBody))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.code).toBe('PRODUCT_NOT_FOUND')
    })

    it('[TC-F10-06-02 security] duplicate productIds aggregated — stock bypass prevented', async () => {
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
            .mockResolvedValueOnce(MOCK_TENANT)
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
            .mockResolvedValueOnce(MOCK_TENANT)
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
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
            .mockResolvedValueOnce(MOCK_TENANT)
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
            .mockResolvedValueOnce(MOCK_TENANT)
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
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
            .mockResolvedValueOnce(MOCK_TENANT)
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
            .mockResolvedValueOnce(MOCK_TENANT)                              // tenant
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

    it('[TC-F09.227] variant OOS check uses per-variant stock (not aggregate inventory)', async () => {
        // Per-variant stock is now authoritative for variant products.
        // variant.stock=1, aggregate inventory=10, requested qty=2 → OOS on per-variant check
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' }) // site
            .mockResolvedValueOnce(MOCK_TENANT)                              // tenant
        mockFind.mockResolvedValueOnce(mockProduct({
            id: 'prod-v', name: 'Shirt', price: 50, inventory: 10, // aggregate: 10 (not the limit)
            hasVariants: true,
            variants: [
                { name: 'Red', price: 75, stock: 1 }, // per-variant: only 1 left
            ],
        }))

        const body = {
            siteId: 'site-1',
            items: [{ productId: 'prod-v', quantity: 2, variant: 'Red' }], // qty=2 > variant.stock=1
            customer: validBody.customer,
            paymentMethod: 'cod',
        }

        // Act
        const res = await POST(mockReq(body))
        const data = await res.json()

        // Assert: rejects because variant.stock (1) < requested qty (2)
        expect(res.status).toBe(422)
        expect(data.error.code).toBe('OUT_OF_STOCK')
        expect(data.error.available).toBe(1) // variant.stock value
        expect(data.error.variant).toBe('Red') // includes variant name
    })

    it('[TC-F09.226b] stale variant name returns 422 VARIANT_NOT_FOUND', async () => {
        // Arrange: product with Red variant, request Purple (doesn't exist)
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
            .mockResolvedValueOnce(MOCK_TENANT)
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
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' }) // site
            .mockResolvedValueOnce(MOCK_TENANT)
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
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
            .mockResolvedValueOnce(MOCK_TENANT)
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

    // ─── TC-F10-02-15 through TC-F10-02-19: Variant stock decrement tests (Bug #1082) ────────

    it('[TC-F10-02-15] COD checkout decrements variants[N].stock for variant product via SQL CAS', async () => {
        // Arrange: Red-M has stock=5, order qty=2
        // SQL CAS on products_variants: UPDATE ... WHERE stock >= 2 RETURNING id
        const variantProd = { id: 'prod-1', name: 'Shirt', price: 25, hasVariants: true, variants: [{ name: 'Red - M', stock: 5, price: 25 }], inventory: 5 }
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' }) // site
            .mockResolvedValueOnce(MOCK_TENANT)                              // tenant
        mockFind.mockResolvedValueOnce(mockProduct(variantProd))
        mockCreate.mockResolvedValue({ id: 'order-1' })
        // mockDrizzleExecute default { rows: [{ id: 1 }] } handles: product check + CAS decrement + inventory recompute

        const body = {
            siteId: 'site-1',
            items: [{ productId: 'prod-1', quantity: 2, variant: 'Red - M' }],
            customer: validBody.customer,
            paymentMethod: 'cod',
        }

        // Act
        const res = await POST(mockReq(body))
        const data = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(data.success).toBe(true)
        // SQL CAS called (product check + CAS decrement + inventory recompute)
        expect(mockDrizzleExecute).toHaveBeenCalled()
        // ORM update NOT called for variant stock (pure SQL path)
        const variantUpdateCall = mockUpdate.mock.calls.find(c => c[0]?.data?.variants !== undefined)
        expect(variantUpdateCall).toBeUndefined()
    })

    it('[TC-F10-02-16] Variant insufficient stock at checkout → 422 OUT_OF_STOCK with variant name', async () => {
        // Arrange: Red-M has stock=1, order qty=2 → OOS at availability check
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' }) // site
            .mockResolvedValueOnce(MOCK_TENANT)                              // tenant
        mockFind.mockResolvedValueOnce(mockProduct({
            id: 'prod-1', name: 'Shirt', price: 25, hasVariants: true,
            variants: [{ name: 'Red - M', stock: 1, price: 25 }], inventory: 1,
        }))

        const body = {
            siteId: 'site-1',
            items: [{ productId: 'prod-1', quantity: 2, variant: 'Red - M' }],
            customer: validBody.customer,
            paymentMethod: 'cod',
        }

        // Act
        const res = await POST(mockReq(body))
        const data = await res.json()

        // Assert
        expect(res.status).toBe(422)
        expect(data.error.code).toBe('OUT_OF_STOCK')
        expect(data.error.variant).toBe('Red - M')
        expect(data.error.available).toBe(1)
        // Order NOT created
        expect(mockCreate).not.toHaveBeenCalled()
    })

    it('[TC-F10-02-17] Mixed cart COD: variant uses SQL CAS on products_variants, non-variant uses SQL CAS on products', async () => {
        // Arrange: 2 items — variant prod-v (Red, stock=5) + non-variant prod-n (inventory=10)
        // Both paths use SQL CAS via mockDrizzleExecute (default { rows: [{ id: 1 }] } succeeds all calls)
        const variantProd = { id: 'prod-v', name: 'Shirt', price: 25, hasVariants: true, variants: [{ name: 'Red', stock: 5, price: 25 }], inventory: 5 }
        const plainProd = { id: 'prod-n', name: 'Cap', price: 15, hasVariants: false, inventory: 10 }
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' }) // site
            .mockResolvedValueOnce(MOCK_TENANT)                              // tenant
        mockFind
            .mockResolvedValueOnce(mockProduct(variantProd))
            .mockResolvedValueOnce(mockProduct(plainProd))
        mockCreate.mockResolvedValue({ id: 'order-1' })

        const body = {
            siteId: 'site-1',
            items: [
                { productId: 'prod-v', quantity: 1, variant: 'Red' },
                { productId: 'prod-n', quantity: 2 },
            ],
            customer: validBody.customer,
            paymentMethod: 'cod',
        }

        // Act
        const res = await POST(mockReq(body))
        const data = await res.json()

        // Assert
        expect(res.status).toBe(200)
        // Both variant (SQL on products_variants) and non-variant (SQL on products) use mockDrizzleExecute
        expect(mockDrizzleExecute).toHaveBeenCalled()
        // No ORM update for variant stock (SQL path replaces ORM)
        const variantUpdateCall = mockUpdate.mock.calls.find(c => c[0]?.data?.variants !== undefined)
        expect(variantUpdateCall).toBeUndefined()
    })

    it('[TC-F10-02-18] bank_transfer variant order: decrements stock at checkout (same CAS as COD)', async () => {
        // bank_transfer now decrements stock at checkout — same CAS block as COD.
        const variantProd = { id: 'prod-1', name: 'Shirt', price: 25, hasVariants: true, variants: [{ name: 'Red', stock: 5, price: 25 }], inventory: 5 }
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' }) // site
            .mockResolvedValueOnce(MOCK_TENANT)                              // tenant
        mockFind
            .mockResolvedValueOnce(mockProduct(variantProd))
            .mockResolvedValueOnce({ docs: [], totalDocs: 0 }) // paymentReference uniqueness check
        mockCreate.mockResolvedValue({
            id: 'order-bt', orderNumber: 'ORD-BT1', total: 30, currency: 'MYR',
        })
        // mockDrizzleExecute default { rows: [{ id: 1 }] } handles: product check + CAS decrement + inventory recompute

        const body = {
            siteId: 'site-1',
            items: [{ productId: 'prod-1', quantity: 1, variant: 'Red' }],
            customer: validBody.customer,
            paymentMethod: 'bank_transfer',
        }

        // Act
        const res = await POST(mockReq(body))
        const data = await res.json()

        // Assert: order created and stock decremented via SQL CAS (same as COD)
        expect(res.status).toBe(200)
        expect(data.data.paymentMethod).toBe('bank_transfer')
        // SQL CAS called (product check + CAS decrement + inventory recompute)
        expect(mockDrizzleExecute).toHaveBeenCalled()
        // ORM update NOT called for variant stock (SQL path)
        const variantUpdateCall = mockUpdate.mock.calls.find(
            call => call[0]?.data?.variants !== undefined
        )
        expect(variantUpdateCall).toBeUndefined()
    })

    it('[TC-F10-02-19] Mid-flight variant decrement failure: compensates prior decrements, deletes order, returns 422', async () => {
        // Arrange: 2 variant items. Item A decrements OK via SQL CAS.
        // Item B passes OOS check (stock=3) but SQL CAS finds stock=1 < qty=2 → fails.
        // Compensation: restockItem for A via SQL. Order deleted.
        const prodA = { id: 'prod-a', name: 'Shirt A', price: 25, hasVariants: true, variants: [{ name: 'Red - M', stock: 5, price: 25 }], inventory: 5 }
        const prodB_atCheck = { id: 'prod-b', name: 'Shirt B', price: 25, hasVariants: true, variants: [{ name: 'Blue - L', stock: 3, price: 25 }], inventory: 3 }

        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' }) // site
            .mockResolvedValueOnce(MOCK_TENANT)                              // tenant
        mockFind
            .mockResolvedValueOnce(mockProduct(prodA))
            .mockResolvedValueOnce(mockProduct(prodB_atCheck)) // passes OOS check (stock=3)
        mockCreate.mockResolvedValue({ id: 'order-race-1' })

        // SQL call sequence: prodA decrement (3) + prodB decrement fail (3) + prodA compensation restock (3) = 9
        mockDrizzleExecute
            .mockResolvedValueOnce({ rows: [{ id: 'prod-a' }] })                   // 1. prodA product check
            .mockResolvedValueOnce({ rows: [{ id: 'uuid-a' }] })                   // 2. prodA CAS decrement → success
            .mockResolvedValueOnce({ rows: [] })                                    // 3. prodA inventory recompute
            .mockResolvedValueOnce({ rows: [{ id: 'prod-b' }] })                   // 4. prodB product check
            .mockResolvedValueOnce({ rows: [] })                                    // 5. prodB CAS → fails (stock=1 < qty=2)
            .mockResolvedValueOnce({ rows: [{ stock: 1 }] })                       // 6. prodB diagnostic → insufficient_stock
            .mockResolvedValueOnce({ rows: [{ id: 'prod-a', has_variants: true }] }) // 7. comp: prodA product check
            .mockResolvedValueOnce({ rows: [{ id: 'uuid-comp' }] })                // 8. comp: prodA restock SQL
            .mockResolvedValueOnce({ rows: [] })                                    // 9. comp: prodA inventory recompute

        const body = {
            siteId: 'site-1',
            items: [
                { productId: 'prod-a', quantity: 2, variant: 'Red - M' },
                { productId: 'prod-b', quantity: 2, variant: 'Blue - L' },
            ],
            customer: validBody.customer,
            paymentMethod: 'cod',
        }

        // Act
        const res = await POST(mockReq(body))
        const data = await res.json()

        // Assert: 422 OUT_OF_STOCK
        expect(res.status).toBe(422)
        expect(data.error.code).toBe('OUT_OF_STOCK')
        // Order deleted
        expect(mockDelete).toHaveBeenCalledWith(
            expect.objectContaining({ collection: 'orders', id: 'order-race-1', overrideAccess: true })
        )
        // Sentinel: order marked cancelled before delete so lingering order cannot be re-restocked
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'orders',
            id: 'order-race-1',
            data: { status: 'cancelled' },
            overrideAccess: true,
        }))
        // 9 SQL calls: prodA decrement (3) + prodB fail (3) + prodA compensation (3)
        expect(mockDrizzleExecute).toHaveBeenCalledTimes(9)
    })

    it('[TC-F10-02-21] Compensation failure: logs console.error when restockItem returns skipped', async () => {
        // Arrange: 2 variant items. Prod-A decrements OK (SQL CAS). Prod-B fails (CAS OOS).
        // During compensation, prod-A SQL product check returns empty (product deleted).
        // restockItem returns { skipped: true, reason: 'product_not_found' }.
        const prodA = { id: 'prod-a', name: 'Shirt A', price: 25, hasVariants: true, variants: [{ name: 'Red - M', stock: 5, price: 25 }], inventory: 5 }
        const prodB_atCheck = { id: 'prod-b', name: 'Shirt B', price: 25, hasVariants: true, variants: [{ name: 'Blue - L', stock: 3, price: 25 }], inventory: 3 }

        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' }) // site
            .mockResolvedValueOnce(MOCK_TENANT)                              // tenant
        mockFind
            .mockResolvedValueOnce(mockProduct(prodA))
            .mockResolvedValueOnce(mockProduct(prodB_atCheck))
        mockCreate.mockResolvedValue({ id: 'order-comp-fail-1' })

        // SQL call sequence (7 calls total)
        mockDrizzleExecute
            .mockResolvedValueOnce({ rows: [{ id: 'prod-a' }] })  // 1. prodA product check
            .mockResolvedValueOnce({ rows: [{ id: 'uuid' }] })    // 2. prodA CAS decrement → success
            .mockResolvedValueOnce({ rows: [] })                   // 3. prodA inventory recompute
            .mockResolvedValueOnce({ rows: [{ id: 'prod-b' }] })  // 4. prodB product check
            .mockResolvedValueOnce({ rows: [] })                   // 5. prodB CAS → fails
            .mockResolvedValueOnce({ rows: [{ stock: 1 }] })      // 6. prodB diagnostic → insufficient_stock
            .mockResolvedValueOnce({ rows: [] })                   // 7. comp: prodA check → deleted → product_not_found

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        const body = {
            siteId: 'site-1',
            items: [
                { productId: 'prod-a', quantity: 2, variant: 'Red - M' },
                { productId: 'prod-b', quantity: 2, variant: 'Blue - L' },
            ],
            customer: validBody.customer,
            paymentMethod: 'cod',
        }

        // Act
        const res = await POST(mockReq(body))
        const data = await res.json()

        // Assert: still 422 OUT_OF_STOCK
        expect(res.status).toBe(422)
        expect(data.error.code).toBe('OUT_OF_STOCK')
        // Compensation failure was logged
        expect(consoleSpy).toHaveBeenCalledWith(
            '[Stock Compensation] Variant re-increment failed — manual inventory reconciliation required',
            expect.objectContaining({
                orderId: 'order-comp-fail-1',
                productId: expect.anything(),
                variantName: 'Red - M',
                reason: 'product_not_found',
            })
        )
        consoleSpy.mockRestore()
    })

    it('[TC-F10-02-23] Inventory recompute throws after CAS: order created, ok:true, no compensation', async () => {
        // CAS succeeds (stock decremented), but inventory recompute throws.
        // decrementVariantStock must return ok:true — recompute is isolated in inner try/catch.
        // No compensation should run; order must NOT be deleted.
        const variantProd = { id: 'prod-1', name: 'Shirt', price: 25, hasVariants: true, variants: [{ name: 'Red - M', stock: 5, price: 25 }], inventory: 5 }
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' }) // site
            .mockResolvedValueOnce(MOCK_TENANT)                              // tenant
        mockFind.mockResolvedValueOnce(mockProduct(variantProd))
        mockCreate.mockResolvedValue({ id: 'order-recompute-1' })

        mockDrizzleExecute
            .mockResolvedValueOnce({ rows: [{ id: 'prod-1' }] })  // 1. product check
            .mockResolvedValueOnce({ rows: [{ id: 'uuid-a' }] })  // 2. CAS decrement → success
            .mockRejectedValueOnce(new Error('Recompute timeout')) // 3. inventory recompute throws

        const body = {
            siteId: 'site-1',
            items: [{ productId: 'prod-1', quantity: 1, variant: 'Red - M' }],
            customer: validBody.customer,
            paymentMethod: 'cod',
        }

        const res = await POST(mockReq(body))
        const data = await res.json()

        // Order created successfully — CAS committed despite recompute failure
        expect(res.status).toBe(200)
        expect(data.success).toBe(true)
        // No compensation: delete not called
        expect(mockDelete).not.toHaveBeenCalled()
        // Recompute failure was logged as warning, not thrown
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.objectContaining({ productId: expect.anything() }),
            expect.stringContaining('[Decrement] Inventory recompute failed'),
        )
    })

    it('[TC-F10-02-20] Product deleted mid-decrement → 422 OUT_OF_STOCK with "no longer available" message', async () => {
        // Arrange: variant passes OOS check, but SQL product check returns empty (product deleted between validation and decrement)
        const prodA = { id: 'prod-a', name: 'Shirt A', price: 25, hasVariants: true, variants: [{ name: 'Red - M', stock: 5, price: 25 }], inventory: 5 }

        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' }) // site
            .mockResolvedValueOnce(MOCK_TENANT)                              // tenant
        mockFind.mockResolvedValueOnce(mockProduct(prodA))
        mockCreate.mockResolvedValue({ id: 'order-deleted-1' })
        // First SQL call (product existence check) returns empty → product_not_found
        mockDrizzleExecute.mockResolvedValueOnce({ rows: [] })

        const body = {
            siteId: 'site-1',
            items: [{ productId: 'prod-a', quantity: 1, variant: 'Red - M' }],
            customer: validBody.customer,
            paymentMethod: 'cod',
        }

        // Act
        const res = await POST(mockReq(body))
        const data = await res.json()

        // Assert: 422 with PRODUCT_NOT_FOUND code (not OUT_OF_STOCK) and data-integrity message
        expect(res.status).toBe(422)
        expect(data.error.code).toBe('PRODUCT_NOT_FOUND')
        expect(data.error.message).toMatch(/no longer available/)
        // Order deleted (no decremented items to compensate, but order still cleaned up)
        expect(mockDelete).toHaveBeenCalledWith(
            expect.objectContaining({ collection: 'orders', id: 'order-deleted-1', overrideAccess: true })
        )
    })

    it('[TC-F10-02-22] Variant with NULL stock at SQL CAS → 422 OUT_OF_STOCK (null_inventory → insufficient_stock)', async () => {
        // FINDING-4 fix: NULL stock variant now returns null_inventory reason → insufficient_stock →
        // OUT_OF_STOCK error code. Previously (incorrectly) mapped to PRODUCT_NOT_FOUND.
        // variant.stock=5 passes OOS check; SQL CAS hits NULL stock guard → CAS fails
        // diagnostic: variant row found but stock=null → variant_not_found (not insufficient_stock)
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' }) // site
            .mockResolvedValueOnce(MOCK_TENANT)                              // tenant
        mockFind.mockResolvedValueOnce(mockProduct({
            id: 'prod-null', name: 'Shirt', price: 25, hasVariants: true,
            variants: [{ name: 'Red - M', stock: 5, price: 25 }], inventory: 5,
        }))
        mockCreate.mockResolvedValue({ id: 'order-null-1' })

        mockDrizzleExecute
            .mockResolvedValueOnce({ rows: [{ id: 'prod-null' }] })  // product check
            .mockResolvedValueOnce({ rows: [] })                       // CAS: NULL stock guard fires → 0 rows
            .mockResolvedValueOnce({ rows: [{ stock: null }] })        // diagnostic: row exists, stock=null

        const body = {
            siteId: 'site-1',
            items: [{ productId: 'prod-null', quantity: 1, variant: 'Red - M' }],
            customer: validBody.customer,
            paymentMethod: 'cod',
        }

        const res = await POST(mockReq(body))
        const data = await res.json()

        expect(res.status).toBe(422)
        expect(data.error.code).toBe('OUT_OF_STOCK')
        expect(mockDelete).toHaveBeenCalledWith(
            expect.objectContaining({ collection: 'orders', id: 'order-null-1', overrideAccess: true })
        )
        expect(mockDrizzleExecute).toHaveBeenCalledTimes(3)
    })

    it('[TC-F10-02-24] Non-variant product deleted mid-decrement → 422 PRODUCT_NOT_FOUND with "no longer available"', async () => {
        // Non-variant product passes OOS check (inventory=10). CAS UPDATE returns 0 rows.
        // Existence SELECT also returns 0 rows → product deleted between validation and CAS.
        // failedReason = 'product_not_found'; error code = 'PRODUCT_NOT_FOUND'.
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' }) // site
            .mockResolvedValueOnce(MOCK_TENANT)                              // tenant
        mockFind.mockResolvedValueOnce(mockProduct({ id: 'prod-del', name: 'Cap', price: 15, hasVariants: false, inventory: 10 }))
        mockCreate.mockResolvedValue({ id: 'order-del-1' })

        mockDrizzleExecute
            .mockResolvedValueOnce({ rows: [] })  // CAS UPDATE → 0 rows (product deleted)
            .mockResolvedValueOnce({ rows: [] })  // existence SELECT → product not found

        const body = {
            siteId: 'site-1',
            items: [{ productId: 'prod-del', quantity: 2 }],
            customer: validBody.customer,
            paymentMethod: 'cod',
        }

        const res = await POST(mockReq(body))
        const data = await res.json()

        expect(res.status).toBe(422)
        expect(data.error.code).toBe('PRODUCT_NOT_FOUND')
        expect(data.error.message).toMatch(/no longer available/)
        // Order deleted (no items decremented before failure)
        expect(mockDelete).toHaveBeenCalledWith(
            expect.objectContaining({ collection: 'orders', id: 'order-del-1', overrideAccess: true })
        )
        expect(mockDrizzleExecute).toHaveBeenCalledTimes(2)
    })

    it('[TC-F10-02-25] Non-variant compensation 0 rows → logs console.error (BUG-5 guard)', async () => {
        // Race condition: prod-a passes OOS check AND CAS OK. prod-b passes OOS check but CAS
        // fails (concurrent decrement between validation and SQL write → insufficient_stock).
        // Compensation for prod-a runs; UPDATE returns 0 rows (prod-a deleted mid-flight).
        // Verify: console.error logged for 0-row result (observability fix).
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' }) // site
            .mockResolvedValueOnce(MOCK_TENANT)                              // tenant
        mockFind
            .mockResolvedValueOnce(mockProduct({ id: 'prod-a', name: 'Hat', price: 10, hasVariants: false, inventory: 5 }))
            .mockResolvedValueOnce(mockProduct({ id: 'prod-b', name: 'Cap', price: 15, hasVariants: false, inventory: 10 }))
        mockCreate.mockResolvedValue({ id: 'order-comp-1' })

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        mockDrizzleExecute
            .mockResolvedValueOnce({ rows: [{ id: 'prod-a' }] })   // prod-a CAS succeeds
            .mockResolvedValueOnce({ rows: [] })                     // prod-b CAS fails (concurrent decrement)
            .mockResolvedValueOnce({ rows: [{ id: 'prod-b' }] })    // existence SELECT → exists → insufficient_stock
            .mockResolvedValueOnce({ rows: [] })                     // prod-a compensation → 0 rows (deleted mid-flight)

        const body = {
            siteId: 'site-1',
            items: [
                { productId: 'prod-a', quantity: 1 },
                { productId: 'prod-b', quantity: 2 },
            ],
            customer: validBody.customer,
            paymentMethod: 'cod',
        }

        const res = await POST(mockReq(body))
        const data = await res.json()

        expect(res.status).toBe(422)
        expect(data.error.code).toBe('OUT_OF_STOCK')
        // Compensation 0-row case logged as error
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Compensation re-increment returned 0 rows'),
            expect.objectContaining({ productId: 'prod-a' })
        )
        consoleSpy.mockRestore()
    })

    it('[TC-F10-02-26] variant_not_found at CAS → console.error logged with productId + variantName', async () => {
        // Variant passes ORM check (variant in product.variants), but SQL diagnostic finds
        // no row in products_variants → variant_not_found (ORM/DB inconsistency).
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' }) // site
            .mockResolvedValueOnce(MOCK_TENANT)                              // tenant
        mockFind.mockResolvedValueOnce(mockProduct({
            id: 'prod-v', name: 'Shirt', price: 25, hasVariants: true,
            variants: [{ name: 'Red - M', stock: 5, price: 25 }], inventory: 5,
        }))
        mockCreate.mockResolvedValue({ id: 'order-vnf-1' })

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        mockDrizzleExecute
            .mockResolvedValueOnce({ rows: [{ id: 'prod-v' }] }) // product check
            .mockResolvedValueOnce({ rows: [] })                  // CAS: 0 rows
            .mockResolvedValueOnce({ rows: [] })                  // diagnostic: no row → variant_not_found

        const body = {
            siteId: 'site-1',
            items: [{ productId: 'prod-v', quantity: 1, variant: 'Red - M' }],
            customer: validBody.customer,
            paymentMethod: 'cod',
        }

        const res = await POST(mockReq(body))
        const data = await res.json()

        expect(res.status).toBe(422)
        expect(data.error.code).toBe('PRODUCT_NOT_FOUND') // variant_not_found → product_not_found (H2 fix)
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('variant_not_found'),
            expect.objectContaining({ productId: 'prod-v', variant: 'Red - M' })
        )
        consoleSpy.mockRestore()
    })

    // ─── TC-F10-02-27: orphaned order sentinel (Bug #3 fix) ──────────────────────

    it('[TC-F10-02-27] Orphaned order: sentinel marks cancelled before delete so future cancel is idempotent', async () => {
        // Arrange: 2 variant items. A decrements OK. B fails → compensation → sentinel → delete (fails).
        // If delete fails, the order persists. Without sentinel it would be status='pending',
        // and a seller cancel would re-restock already-compensated stock (inventory inflation).
        // With sentinel, order is status='cancelled' → cancel returns idempotent success (shouldRestock=false).
        const prodA = { id: 'prod-a', name: 'Shirt A', price: 25, hasVariants: true, variants: [{ name: 'Red - M', stock: 5, price: 25 }], inventory: 5 }
        const prodB = { id: 'prod-b', name: 'Shirt B', price: 25, hasVariants: true, variants: [{ name: 'Blue - L', stock: 3, price: 25 }], inventory: 3 }

        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' }) // site
            .mockResolvedValueOnce(MOCK_TENANT)                              // tenant
        mockFind
            .mockResolvedValueOnce(mockProduct(prodA))
            .mockResolvedValueOnce(mockProduct(prodB))
        mockCreate.mockResolvedValue({ id: 'order-orphan-1' })

        // SQL: prodA decrement (3) + prodB fail (3) + prodA compensation (3) = 9
        mockDrizzleExecute
            .mockResolvedValueOnce({ rows: [{ id: 'prod-a' }] })                    // 1. prodA product check
            .mockResolvedValueOnce({ rows: [{ id: 'uuid-a' }] })                    // 2. prodA CAS → success
            .mockResolvedValueOnce({ rows: [] })                                     // 3. prodA recompute
            .mockResolvedValueOnce({ rows: [{ id: 'prod-b' }] })                    // 4. prodB product check
            .mockResolvedValueOnce({ rows: [] })                                     // 5. prodB CAS → fails
            .mockResolvedValueOnce({ rows: [{ stock: 1 }] })                        // 6. prodB diagnostic
            .mockResolvedValueOnce({ rows: [{ id: 'prod-a', has_variants: true }] }) // 7. comp: prodA product check
            .mockResolvedValueOnce({ rows: [{ id: 'uuid-comp' }] })                 // 8. comp: prodA restock
            .mockResolvedValueOnce({ rows: [] })                                     // 9. comp: prodA recompute

        // Simulate delete failure — orphan order persists
        mockDelete.mockRejectedValueOnce(new Error('FK constraint violation'))

        const body = {
            siteId: 'site-1',
            items: [
                { productId: 'prod-a', quantity: 2, variant: 'Red - M' },
                { productId: 'prod-b', quantity: 2, variant: 'Blue - L' },
            ],
            customer: validBody.customer,
            paymentMethod: 'cod',
        }

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        // Act
        const res = await POST(mockReq(body))
        const data = await res.json()

        // Assert: buyer still gets 422 OUT_OF_STOCK (response shape unchanged)
        expect(res.status).toBe(422)
        expect(data.error.code).toBe('OUT_OF_STOCK')

        // Sentinel: mockUpdate called with status='cancelled' BEFORE mockDelete
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'orders',
            id: 'order-orphan-1',
            data: { status: 'cancelled' },
            overrideAccess: true,
        }))
        expect(mockDelete).toHaveBeenCalledWith(
            expect.objectContaining({ collection: 'orders', id: 'order-orphan-1', overrideAccess: true })
        )
        // Sentinel called before delete (invocation order check)
        const updateOrder = mockUpdate.mock.invocationCallOrder[0]
        const deleteOrder = mockDelete.mock.invocationCallOrder[0]
        expect(updateOrder).toBeLessThan(deleteOrder)

        consoleSpy.mockRestore()
    })

    // ─── TC-F33-31 (scenario #31): site-scoping enforced at checkout ──────────

    it('[TC-F33-31 scenario#31 behavioral] discount from another site is silently rejected — order at full price', async () => {
        // Arrange — discount is scoped to site-2; checkout is on site-1.
        // The where-clause filters it out → find() returns empty → silent reject → full price.
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
            .mockResolvedValueOnce(MOCK_TENANT)
        mockFind
            .mockResolvedValueOnce(mockProduct({ id: 'prod-1', name: 'P', price: 100, inventory: 10 })) // product
            .mockResolvedValueOnce({ docs: [], totalDocs: 0 }) // site-scoped lookup returns empty
        mockCreate.mockResolvedValue({ id: 'order-site-scoped-1' })

        // Act
        const res = await POST(mockReq({
            ...validBody,
            items: [{ productId: 'prod-1', quantity: 1 }],
            discountCode: 'SITE2ONLY',
        }))
        const data = await res.json()

        // Assert — order created at full price; discount fields absent from persisted order
        expect(res.status).toBe(200)
        expect(data.data.total).toBe(108) // 100 sub + 8 west ship, no discount
        const createData = mockCreate.mock.calls[0][0].data
        expect(createData.discountCode).toBeUndefined()
        expect(createData.discountAmount).toBeUndefined()
    })

    it('[TC-F33-31 scenario#31 whitebox] discount find() called with site or-clause for site scoping', async () => {
        // White-box: verify the where-clause shape passed to payload.find for the discount lookup.
        // This ensures the scoping is enforced at the DB query level, not post-filter.
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })
            .mockResolvedValueOnce(MOCK_TENANT)
        mockFind
            .mockResolvedValueOnce(mockProduct({ id: 'prod-1', name: 'P', price: 100, inventory: 10 }))
            .mockResolvedValueOnce({
                docs: [{
                    id: 7,
                    code: 'GLOBAL',
                    type: 'percentage',
                    value: 10,
                    status: 'active',
                    usageLimit: null,
                    usageCount: 0,
                    startsAt: null,
                    expiresAt: null,
                    tenant: 'tenant-1',
                }],
                totalDocs: 1,
            })
        mockCreate.mockResolvedValue({ id: 'order-wb-1' })

        // Act
        await POST(mockReq({
            ...validBody,
            items: [{ productId: 'prod-1', quantity: 1 }],
            discountCode: 'GLOBAL',
        }))

        // Assert — the discount find() call must include the site or-clause
        const discountFindCall = mockFind.mock.calls.find(
            (call) => call[0]?.collection === 'discounts',
        )
        expect(discountFindCall).toBeDefined()
        const whereAnd: any[] = discountFindCall![0].where.and
        const siteOrClause = whereAnd.find((clause: any) => clause.or !== undefined)
        expect(siteOrClause).toBeDefined()
        expect(siteOrClause.or).toEqual(
            expect.arrayContaining([
                { site: { exists: false } },
                { site: { equals: expect.anything() } },
            ]),
        )
    })
})
