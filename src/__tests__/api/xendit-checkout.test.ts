import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockFindByID = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        findByID: mockFindByID,
        create: mockCreate,
        update: mockUpdate,
        delete: mockDelete,
        sendEmail: vi.fn().mockResolvedValue(undefined),
        logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
    })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/payment/xendit', () => ({
    createInvoice: vi.fn(),
}))

// XenditError must be a real class so `instanceof` checks work
vi.mock('@/lib/payment/xendit-client', () => ({
    XenditError: class XenditError extends Error {
        constructor(message: string) { super(message) }
    },
}))

vi.mock('@/lib/validations/orders', () => ({
    xenditCheckoutSchema: {
        safeParse: (data: any) => ({ success: true, data }),
    },
}))

vi.mock('@/app/api/orders/stripe-checkout/build-order-items', () => ({
    buildOrderItems: vi.fn(),
}))

const mockDecrementOrderStock = vi.fn()
const mockRestockAll = vi.fn()
vi.mock('@/app/api/orders/xendit-checkout/decrement-stock', () => ({
    decrementOrderStock: (...args: any[]) => mockDecrementOrderStock(...args),
    restockAll: (...args: any[]) => mockRestockAll(...args),
}))

vi.mock('@/lib/orders/upload-token', () => ({
    generateConfirmToken: vi.fn(() => 'mock-confirm-token'),
}))

vi.mock('@/lib/email/templates/order-confirmation', () => ({
    orderConfirmationEmail: vi.fn(() => ({ subject: 'Order placed', html: '<p>Thanks</p>' })),
}))

vi.mock('@/lib/email/templates/new-order-seller', () => ({
    newOrderSellerEmail: vi.fn(() => ({ subject: 'New order', html: '<p>New order</p>' })),
}))

vi.mock('@/lib/email/get-tenant-owner-emails', () => ({
    getTenantOwnerEmails: vi.fn().mockResolvedValue(['seller@test.com']),
}))

vi.mock('@/lib/email/get-template-config', () => ({
    getTemplateConfig: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/utils/storefront-url', () => ({
    buildStorefrontUrl: vi.fn((_slug: string, path: string) => `https://store.test${path}`),
}))

import { POST } from '@/app/api/orders/xendit-checkout/route'
import { buildOrderItems } from '@/app/api/orders/stripe-checkout/build-order-items'
import { createInvoice } from '@/lib/payment/xendit'

const mockBuildOrderItems = vi.mocked(buildOrderItems)
const mockCreateInvoice = vi.mocked(createInvoice)

// ─── Test Helpers ─────────────────────────────────────────────────────

function mockRequest(body: any) {
    return {
        json: () => Promise.resolve(body),
    } as unknown as Request
}

const VALID_SITE = {
    id: 1,
    tenant: 'tenant-1',
    shippingConfig: { westRate: 1000, eastRate: 1500 },
}

const VALID_TENANT = {
    id: 'tenant-1',
    name: 'Test Store',
    slug: 'test-store',
    status: 'active',
    xenditSecretKey: 'xnd_test_abc123',
}

const VALID_ORDER = {
    id: 'order-1',
    orderNumber: 'ORD-ABC123',
    tenant: 'tenant-1',
    status: 'pending',
    total: 60,
}

const VALID_INVOICE = {
    id: 'inv-test-1',
    invoice_url: 'https://checkout.xendit.co/web/inv-test-1',
    status: 'PENDING',
}

const VALID_REQUEST_BODY = {
    siteId: 1,
    items: [{ productId: 'prod-1', quantity: 1 }],
    customer: {
        name: 'Test User',
        email: 'test@example.com',
        phone: '+60123456789',
        address: {
            line1: '123 Main St',
            city: 'Kuala Lumpur',
            state: 'KL',
            postcode: '50000',
            country: 'Malaysia',
        },
    },
}

// ─── TC-SHIP-10/11/12: Xendit dynamic shipping ────────────────────────

describe('POST /api/orders/xendit-checkout [shipping]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockDelete.mockResolvedValue({})
        mockDecrementOrderStock.mockResolvedValue({ ok: true, decremented: [] })
        mockRestockAll.mockResolvedValue(undefined)
    })

    it('[TC-SHIP-10] charges configured west rate (KL → westRate 1000 sen = RM 10)', async () => {
        // Arrange
        mockFindByID
            .mockResolvedValueOnce(VALID_SITE) // site: westRate=1000, eastRate=1500
            .mockResolvedValueOnce(VALID_TENANT)
        mockBuildOrderItems.mockResolvedValue({
            orderItems: [{ product: 'prod-1', productName: 'Widget', quantity: 1, unitPrice: 5000 }],
            subtotal: 50, // RM — subtotalSen = 5000; shipping = 1000 sen = RM 10; total = RM 60
            currency: 'MYR',
            errorResponse: null,
        })
        mockCreate.mockResolvedValue(VALID_ORDER)
        mockCreateInvoice.mockResolvedValue(VALID_INVOICE)
        mockUpdate.mockResolvedValue({})

        // Act — state: 'KL' (west) from VALID_REQUEST_BODY
        const res = await POST(mockRequest(VALID_REQUEST_BODY) as any)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.type).toBe('redirect')
        expect(body.data.sessionUrl).toBe(VALID_INVOICE.invoice_url)
        // order row stores RM float
        expect(mockCreate.mock.calls[0][0].data.shippingFee).toBeCloseTo(10, 2)
        // invoice amount = total in RM (subtotal 50 + shipping 10 = 60)
        expect(mockCreateInvoice.mock.calls[0][0].amount).toBeCloseTo(60, 2)
    })

    it('[TC-SHIP-11] charges east rate for East-MY state (Sabah → eastRate 1500 sen = RM 15)', async () => {
        // Arrange
        mockFindByID
            .mockResolvedValueOnce(VALID_SITE) // westRate=1000, eastRate=1500
            .mockResolvedValueOnce(VALID_TENANT)
        mockBuildOrderItems.mockResolvedValue({
            orderItems: [{ product: 'prod-1', productName: 'Widget', quantity: 1, unitPrice: 5000 }],
            subtotal: 50, // RM — subtotalSen = 5000; shipping = 1500 sen = RM 15; total = RM 65
            currency: 'MYR',
            errorResponse: null,
        })
        mockCreate.mockResolvedValue({ ...VALID_ORDER, total: 65 })
        mockCreateInvoice.mockResolvedValue(VALID_INVOICE)
        mockUpdate.mockResolvedValue({})

        const body = {
            ...VALID_REQUEST_BODY,
            customer: {
                ...VALID_REQUEST_BODY.customer,
                address: { ...VALID_REQUEST_BODY.customer.address, state: 'Sabah' },
            },
        }

        // Act
        const res = await POST(mockRequest(body) as any)
        const resBody = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(resBody.success).toBe(true)
        expect(mockCreate.mock.calls[0][0].data.shippingFee).toBeCloseTo(15, 2)
        expect(mockCreateInvoice.mock.calls[0][0].amount).toBeCloseTo(65, 2)
    })

    it('[TC-SHIP-12] charges zero shipping when subtotal meets freeAbove threshold', async () => {
        // Arrange — freeAbove: 10000 sen; subtotal 150 RM = 15000 sen ≥ 10000 → shipping = 0
        const siteWithFreeShip = { ...VALID_SITE, shippingConfig: { westRate: 1000, eastRate: 1500, freeAbove: 10000 } }
        mockFindByID
            .mockResolvedValueOnce(siteWithFreeShip)
            .mockResolvedValueOnce(VALID_TENANT)
        mockBuildOrderItems.mockResolvedValue({
            orderItems: [{ product: 'prod-1', productName: 'Widget', quantity: 1, unitPrice: 15000 }],
            subtotal: 150, // RM — subtotalSen = 15000 ≥ freeAbove 10000 → shipping = 0; total = RM 150
            currency: 'MYR',
            errorResponse: null,
        })
        mockCreate.mockResolvedValue({ ...VALID_ORDER, total: 150 })
        mockCreateInvoice.mockResolvedValue(VALID_INVOICE)
        mockUpdate.mockResolvedValue({})

        // Act — state: 'KL' (west) from VALID_REQUEST_BODY
        const res = await POST(mockRequest(VALID_REQUEST_BODY) as any)
        const resBody = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(resBody.success).toBe(true)
        expect(mockCreate.mock.calls[0][0].data.shippingFee).toBe(0)
        expect(mockCreateInvoice.mock.calls[0][0].amount).toBeCloseTo(150, 2)
    })
})
