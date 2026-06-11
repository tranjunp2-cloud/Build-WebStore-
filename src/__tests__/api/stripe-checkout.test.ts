import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockFindByID = vi.fn()
const mockFind = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockDrizzleExecute = vi.fn()

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        findByID: mockFindByID,
        find: mockFind,
        create: mockCreate,
        update: mockUpdate,
        delete: mockDelete,
        db: { drizzle: { execute: mockDrizzleExecute } },
        sendEmail: vi.fn().mockResolvedValue(undefined),
        logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
    })),
}))

vi.mock('@/app/api/orders/lib/stock-utils', () => ({
    decrementVariantStock: vi.fn().mockResolvedValue({ ok: true }),
    restockItem: vi.fn().mockResolvedValue({ restocked: 1, skipped: false }),
}))
vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/payment/stripe', () => ({
    createStripeCheckoutSession: vi.fn(),
}))

vi.mock('@/lib/orders/upload-token', () => ({
    generateConfirmToken: vi.fn(() => 'mock-confirm-token'),
    generateUploadToken: vi.fn(() => 'mock-upload-token'),
    verifyConfirmToken: vi.fn(() => true),
    verifyUploadToken: vi.fn(() => true),
}))

vi.mock('@/app/api/orders/stripe-checkout/build-order-items', () => ({
    buildOrderItems: vi.fn(),
}))

vi.mock('@/lib/validations/helpers', () => ({
    parseRequest: vi.fn(async (request, schema) => {
        try {
            const data = await request.json()
            return { data, errorResponse: null }
        } catch (err) {
            return { data: null, errorResponse: { status: 400 } }
        }
    }),
}))
vi.mock('@/lib/validations/orders', () => ({
    stripeCheckoutSchema: {
        safeParse: (data: any) => ({ success: true, data }),
    },
}))

// recordDiscountRedemption does I/O (drizzle SQL); mock at module level so it
// never touches the real DB. applyDiscount is a pure function — not mocked.
const mockRecordRedemption = vi.fn(() => Promise.resolve({ recorded: true }))
vi.mock('@/lib/discounts/record-discount-redemption', () => ({
    recordDiscountRedemption: (...args: any[]) => mockRecordRedemption(...args),
}))

import { POST } from '@/app/api/orders/stripe-checkout/route'
import { buildOrderItems } from '@/app/api/orders/stripe-checkout/build-order-items'
import { createStripeCheckoutSession } from '@/lib/payment/stripe'

const mockBuildOrderItems = vi.mocked(buildOrderItems)
const mockCreateCheckoutSession = vi.mocked(createStripeCheckoutSession)

// ─── Test Helpers ─────────────────────────────────────────────────────

function mockRequest(body: any) {
    return {
        json: () => Promise.resolve(body),
    } as unknown as Request
}

const VALID_SITE = {
    id: 1,
    tenant: 'tenant-1',
    paymentConfig: { fpxEnabled: true, cardEnabled: true },
}

const VALID_TENANT = {
    id: 'tenant-1',
    stripeAccountId: 'acct_test_123',
    stripeOnboardingComplete: true,
    slug: 'test-store',
    payment_card: true,
    payment_fpx: true,
}

const VALID_PRODUCT = {
    id: 'prod-1',
    name: 'Test Widget',
    price: 50,
    currency: 'MYR',
    inventory: 100,
}

const VALID_ORDER = {
    id: 'order-1',
    orderNumber: 'ORD-ABC123',
    tenant: 'tenant-1',
    status: 'pending',
}

const VALID_CHECKOUT_SESSION = {
    sessionId: 'cs_test_123',
    url: 'https://checkout.stripe.com/pay/cs_test_123',
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
    paymentMethod: 'fpx',
}

// ─── TC-F13: Stripe Checkout ──────────────────────────────────────────

describe('POST /api/orders/stripe-checkout [TC-F13]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockDelete.mockResolvedValue({})
        // Default: non-variant stock CAS succeeds (returns id row)
        mockDrizzleExecute.mockResolvedValue({ rows: [{ id: 1 }] })
        // Default: no discount found (discount lookup via payload.find returns empty)
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0 })
    })

    // ─── TC-F13.01: FPX checkout success ─────────────────────────────
    it('[TC-F13.01] creates FPX checkout session successfully with MYR currency', async () => {
        // Arrange
        mockFindByID
            .mockResolvedValueOnce(VALID_SITE) // site lookup
            .mockResolvedValueOnce(VALID_TENANT) // tenant lookup
        mockBuildOrderItems.mockResolvedValue({
            orderItems: [{ product: 'prod-1', productName: 'Widget', quantity: 1, unitPrice: 5000 }],
            checkoutItems: [{ price_data: { currency: 'myr', product_data: { name: 'Widget' }, unit_amount: 5000 }, quantity: 1 }],
            subtotal: 5000,
            currency: 'MYR',
            errorResponse: null,
        })
        mockCreate.mockResolvedValue(VALID_ORDER)
        mockCreateCheckoutSession.mockResolvedValue(VALID_CHECKOUT_SESSION)
        mockUpdate.mockResolvedValue({})

        // Act
        const req = mockRequest(VALID_REQUEST_BODY)
        const res = await POST(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.orderId).toBe('order-1')
        expect(body.data.sessionUrl).toBe(VALID_CHECKOUT_SESSION.url)
        expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
            expect.objectContaining({
                currency: 'MYR',
                stripeAccountId: 'acct_test_123',
                metadata: expect.objectContaining({ siteId: '1', tenantId: 'tenant-1' }),
            }),
        )
    })

    // ─── TC-F13.03: Currency & smallest unit (sen) ──────────────────
    it('[TC-F13.03] converts product price RM 29.90 to 2990 sen for Stripe', async () => {
        // Arrange
        mockFindByID
            .mockResolvedValueOnce(VALID_SITE)
            .mockResolvedValueOnce(VALID_TENANT)
        mockBuildOrderItems.mockResolvedValue({
            orderItems: [{ product: 'prod-1', productName: 'Widget', quantity: 1, unitPrice: 2990 }],
            checkoutItems: [{ price_data: { currency: 'myr', product_data: { name: 'Widget' }, unit_amount: 2990 }, quantity: 1 }],
            subtotal: 2990,
            currency: 'MYR',
            errorResponse: null,
        })
        mockCreate.mockResolvedValue(VALID_ORDER)
        mockCreateCheckoutSession.mockResolvedValue(VALID_CHECKOUT_SESSION)
        mockUpdate.mockResolvedValue({})

        // Act
        const req = mockRequest({ ...VALID_REQUEST_BODY, items: [{ productId: 'prod-1', quantity: 1, price: 29.90 }] })
        const res = await POST(req)

        // Assert
        expect(res.status).toBe(200)
        expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
            expect.objectContaining({ currency: 'MYR' }),
        )
    })

    // ─── Site-level layer-2 guard: FPX disabled by site config ────────
    // (2-layer toggle: tenant.payment_fpx=true but site.paymentConfig.fpxEnabled=false)
    it('returns 422 METHOD_DISABLED when site config disables FPX (layer-2 guard)', async () => {
        // Arrange — tenant has ONLY fpx; site disables fpx → no method left → METHOD_DISABLED
        const siteWithFpxDisabled = {
            ...VALID_SITE,
            paymentConfig: { fpxEnabled: false, cardEnabled: true },
        }
        const tenantFpxOnly = { ...VALID_TENANT, payment_card: false, payment_fpx: true }
        mockFindByID
            .mockResolvedValueOnce(siteWithFpxDisabled)
            .mockResolvedValueOnce(tenantFpxOnly)

        // Act
        const req = mockRequest(VALID_REQUEST_BODY)
        const res = await POST(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(422)
        expect(body.error.code).toBe('METHOD_DISABLED')
        expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
    })

    // ─── Site-level layer-2 guard: Card disabled by site config ───────
    it('returns 422 METHOD_DISABLED when site config disables card (layer-2 guard)', async () => {
        // Arrange — tenant has ONLY card; site disables card → no method left → METHOD_DISABLED
        const siteWithCardDisabled = {
            ...VALID_SITE,
            paymentConfig: { fpxEnabled: true, cardEnabled: false },
        }
        const tenantCardOnly = { ...VALID_TENANT, payment_card: true, payment_fpx: false }
        mockFindByID
            .mockResolvedValueOnce(siteWithCardDisabled)
            .mockResolvedValueOnce(tenantCardOnly)

        // Act
        const req = mockRequest(VALID_REQUEST_BODY)
        const res = await POST(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(422)
        expect(body.error.code).toBe('METHOD_DISABLED')
        expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
    })

    // ─── TC-F13.16: Both tenant flags off → NO_PAYMENT_METHODS ─────
    it('[TC-F13.16] returns 422 NO_PAYMENT_METHODS when both tenant payment flags are off', async () => {
        // Arrange — tenant explicitly disables both card and fpx
        const tenantBothOff = { ...VALID_TENANT, payment_card: false, payment_fpx: false }
        mockFindByID
            .mockResolvedValueOnce(VALID_SITE)
            .mockResolvedValueOnce(tenantBothOff)

        // Act
        const req = mockRequest(VALID_REQUEST_BODY)
        const res = await POST(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(422)
        expect(body.error.code).toBe('NO_PAYMENT_METHODS')
        expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
    })

    // ─── TC-F13.88: Suspended tenant cannot accept payments ─────────
    it('[TC-F13.88] returns 403 STORE_UNAVAILABLE for suspended tenant', async () => {
        // Arrange
        const suspendedTenant = { ...VALID_TENANT, status: 'suspended' }
        mockFindByID
            .mockResolvedValueOnce(VALID_SITE)
            .mockResolvedValueOnce(suspendedTenant)

        // Act
        const req = mockRequest(VALID_REQUEST_BODY)
        const res = await POST(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(403)
        expect(body.error.code).toBe('STORE_UNAVAILABLE')
        expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
    })

    // ─── TC-F13.58: Stripe onboarding incomplete ────────────────────
    it('[TC-F13.58] returns 422 STRIPE_NOT_READY when stripeOnboardingComplete=false', async () => {
        // Arrange
        const tenantIncomplete = {
            ...VALID_TENANT,
            stripeOnboardingComplete: false,
        }
        mockFindByID
            .mockResolvedValueOnce(VALID_SITE)
            .mockResolvedValueOnce(tenantIncomplete)

        // Act
        const req = mockRequest(VALID_REQUEST_BODY)
        const res = await POST(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(422)
        expect(body.error.code).toBe('STRIPE_NOT_READY')
        expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
    })

    // ─── Edge: Site not found ────────────────────────────────────────
    it('returns 404 NOT_FOUND when site not found', async () => {
        // Arrange
        mockFindByID.mockResolvedValueOnce(null)

        // Act
        const req = mockRequest(VALID_REQUEST_BODY)
        const res = await POST(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(404)
        expect(body.error.code).toBe('NOT_FOUND')
    })

    // ─── Edge: Tenant not found ──────────────────────────────────────
    it('returns 404 NOT_FOUND when tenant not found', async () => {
        // Arrange
        mockFindByID
            .mockResolvedValueOnce(VALID_SITE)
            .mockResolvedValueOnce(null)

        // Act
        const req = mockRequest(VALID_REQUEST_BODY)
        const res = await POST(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(404)
        expect(body.error.code).toBe('NOT_FOUND')
    })

    // ─── Edge: No stripeAccountId ────────────────────────────────────
    it('returns 422 STRIPE_NOT_CONNECTED when stripeAccountId is missing', async () => {
        // Arrange
        const tenantNoAccount = {
            ...VALID_TENANT,
            stripeAccountId: null,
        }
        mockFindByID
            .mockResolvedValueOnce(VALID_SITE)
            .mockResolvedValueOnce(tenantNoAccount)

        // Act
        const req = mockRequest(VALID_REQUEST_BODY)
        const res = await POST(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(422)
        expect(body.error.code).toBe('STRIPE_NOT_CONNECTED')
    })

    // ─── TC-F13.59: buildOrderItems returns error ──────────────────────
    it('[TC-F13.59] returns error when buildOrderItems fails (no valid products)', async () => {
        // Arrange
        mockFindByID
            .mockResolvedValueOnce(VALID_SITE)
            .mockResolvedValueOnce(VALID_TENANT)
        mockBuildOrderItems.mockResolvedValue({
            orderItems: [],
            checkoutItems: [],
            subtotal: 0,
            currency: 'MYR',
            errorResponse: {
                status: 422,
                json: () => Promise.resolve({ error: { code: 'VALIDATION_ERROR' } }),
            },
        })

        // Act
        const req = mockRequest(VALID_REQUEST_BODY)
        const res = await POST(req)

        // Assert — should return error from buildOrderItems
        expect(res.status).toBe(422)
        expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
    })

    // ─── TC-F13.61: Connected account passed to Stripe request ──────────
    it('[TC-F13.61] creates card checkout session with connected account in Stripe request', async () => {
        // Arrange
        mockFindByID
            .mockResolvedValueOnce(VALID_SITE)
            .mockResolvedValueOnce(VALID_TENANT)
        mockBuildOrderItems.mockResolvedValue({
            orderItems: [{ product: 'prod-1', productName: 'Widget', quantity: 1, unitPrice: 5000 }],
            checkoutItems: [{ price_data: { currency: 'myr', product_data: { name: 'Widget' }, unit_amount: 5000 }, quantity: 1 }],
            subtotal: 5000,
            currency: 'MYR',
            errorResponse: null,
        })
        mockCreate.mockResolvedValue(VALID_ORDER)
        mockCreateCheckoutSession.mockResolvedValue(VALID_CHECKOUT_SESSION)
        mockUpdate.mockResolvedValue({})

        // Act
        const req = mockRequest({ ...VALID_REQUEST_BODY, paymentMethod: 'card' })
        const res = await POST(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
            expect.objectContaining({
                stripeAccountId: 'acct_test_123',
                metadata: expect.objectContaining({ siteId: '1', tenantId: 'tenant-1' }),
            }),
        )
    })

    // ─── TC-F13.84: Session ID persistence for idempotent webhook ──────
    it('[TC-F13.84] updates order with stripeSessionId for idempotent webhook processing', async () => {
        // Arrange
        mockFindByID
            .mockResolvedValueOnce(VALID_SITE)
            .mockResolvedValueOnce(VALID_TENANT)
        mockBuildOrderItems.mockResolvedValue({
            orderItems: [{ product: 'prod-1', productName: 'Widget', quantity: 1, unitPrice: 5000 }],
            checkoutItems: [{ price_data: { currency: 'myr', product_data: { name: 'Widget' }, unit_amount: 5000 }, quantity: 1 }],
            subtotal: 5000,
            currency: 'MYR',
            errorResponse: null,
        })
        mockCreate.mockResolvedValue(VALID_ORDER)
        mockCreateCheckoutSession.mockResolvedValue(VALID_CHECKOUT_SESSION)
        mockUpdate.mockResolvedValue({})

        // Act
        const req = mockRequest(VALID_REQUEST_BODY)
        await POST(req)

        // Assert — second mockUpdate call should persist session ID
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'orders',
                id: 'order-1',
                data: expect.objectContaining({ stripeSessionId: 'cs_test_123' }),
            }),
        )
    })

    // ─── TC-F13.62: Success/cancel URLs include storefront slug ─────────
    it('[TC-F13.62] success_url contains site slug and cancel_url returns to confirm page with cancelled flag', async () => {
        // Arrange
        mockFindByID
            .mockResolvedValueOnce(VALID_SITE)
            .mockResolvedValueOnce(VALID_TENANT)
        mockBuildOrderItems.mockResolvedValue({
            orderItems: [{ product: 'prod-1', productName: 'Widget', quantity: 1, unitPrice: 5000 }],
            checkoutItems: [{ price_data: { currency: 'myr', product_data: { name: 'Widget' }, unit_amount: 5000 }, quantity: 1 }],
            subtotal: 5000,
            currency: 'MYR',
            errorResponse: null,
        })
        mockCreate.mockResolvedValue(VALID_ORDER)
        mockCreateCheckoutSession.mockResolvedValue(VALID_CHECKOUT_SESSION)
        mockUpdate.mockResolvedValue({})

        // Act
        const req = mockRequest(VALID_REQUEST_BODY)
        await POST(req)

        // Assert — success returns to confirm page; cancel returns to confirm page with cancelled=1
        // so the buyer sees the order with a "Pay Now" retry CTA instead of a cleared cart.
        expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
            expect.objectContaining({
                successUrl: expect.stringContaining('/sites/test-store/'),
                cancelUrl: expect.stringContaining('/confirm?cancelled=1'),
            }),
        )
    })

    // ─── TC-F13.98: Stripe API timeout → 502 STRIPE_API_ERROR ──────────
    it('[TC-F13.98] returns 502 STRIPE_API_ERROR when Stripe API throws during session create', async () => {
        // Arrange
        mockFindByID
            .mockResolvedValueOnce(VALID_SITE)
            .mockResolvedValueOnce(VALID_TENANT)
        mockBuildOrderItems.mockResolvedValue({
            orderItems: [{ product: 'prod-1', productName: 'Widget', quantity: 1, unitPrice: 5000 }],
            checkoutItems: [{ price_data: { currency: 'myr', product_data: { name: 'Widget' }, unit_amount: 5000 }, quantity: 1 }],
            subtotal: 5000,
            currency: 'MYR',
            errorResponse: null,
        })
        mockCreate.mockResolvedValue(VALID_ORDER)
        mockCreateCheckoutSession.mockRejectedValue(new Error('Stripe timeout'))
        mockUpdate.mockResolvedValue({})

        // Act
        const req = mockRequest(VALID_REQUEST_BODY)
        const res = await POST(req)
        const body = await res.json()

        // Assert — Stripe error → 502, not 500; pending order cleaned up
        expect(res.status).toBe(502)
        expect(body.error.code).toBe('STRIPE_API_ERROR')
    })

    // ─── TC-F13.103: Free order (total <= 0) — skip Stripe ──────────
    it('[TC-F13.103] returns 200 paid status for free order without creating Stripe session', async () => {
        // Arrange — zero-price product: subtotal=0, tax=0, shipping=10 BUT total rounded to 10
        // Use subtotal=-10 to simulate coupon bringing total to <=0
        mockFindByID
            .mockResolvedValueOnce(VALID_SITE)
            .mockResolvedValueOnce(VALID_TENANT)
        mockBuildOrderItems.mockResolvedValue({
            orderItems: [{ product: 'prod-1', productName: 'Free Item', quantity: 1, unitPrice: 0 }],
            checkoutItems: [],
            subtotal: -10, // coupon discount drives total <= 0
            currency: 'MYR',
            errorResponse: null,
        })
        mockCreate.mockResolvedValue({ id: 'order-free', orderNumber: 'ORD-FREE123' })

        // Act
        const req = mockRequest(VALID_REQUEST_BODY)
        const res = await POST(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.status).toBe('paid')
        expect(body.data.sessionUrl).toBeNull()
        expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
        // Free order must persist paymentStatus='paid' so the confirm page renders it as paid (not "verifying")
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ status: 'paid', paymentStatus: 'paid', paymentMethod: 'free' }),
            }),
        )
    })

    // ─── Error handling ──────────────────────────────────────────────
    it('returns 500 INTERNAL_ERROR on unexpected exception', async () => {
        // Arrange
        mockFindByID.mockRejectedValueOnce(new Error('Database connection failed'))

        // Act
        const req = mockRequest(VALID_REQUEST_BODY)
        const res = await POST(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(500)
        expect(body.error.code).toBe('INTERNAL_ERROR')
    })

    // ─── TC-F09.228: Stripe buildOrderItems variant support ──────────────

    it('[TC-F09.228] buildOrderItems uses variant.price for line item unitPrice', async () => {
        // Arrange: product with variant Red @ RM 75 (base RM 50)
        mockFindByID
            .mockResolvedValueOnce(VALID_SITE)
            .mockResolvedValueOnce(VALID_TENANT)
        mockBuildOrderItems.mockResolvedValue({
            orderItems: [
                { product: 'prod-v', productName: 'Shirt', variant: 'Red', quantity: 1, unitPrice: 75 },
            ],
            checkoutItems: [
                { name: 'Shirt', price: 7500, quantity: 1, images: [] }, // 75 * 100 sen
            ],
            subtotal: 75,
            currency: 'MYR',
            errorResponse: null,
        })
        mockCreate.mockResolvedValue(VALID_ORDER)
        mockCreateCheckoutSession.mockResolvedValue(VALID_CHECKOUT_SESSION)
        mockUpdate.mockResolvedValue({})

        // Act
        const req = mockRequest({
            ...VALID_REQUEST_BODY,
            items: [{ productId: 'prod-v', quantity: 1, variant: 'Red' }],
        })
        const res = await POST(req)
        const body = await res.json()

        // Assert: unitPrice in orderItems is variant.price
        expect(res.status).toBe(200)
        expect(mockBuildOrderItems).toHaveBeenCalledWith(
            expect.anything(),
            expect.arrayContaining([
                expect.objectContaining({ productId: 'prod-v', variant: 'Red', quantity: 1 }),
            ]),
            expect.anything(),
        )
        // Stripe session amount must reflect correct unit price
        expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
            expect.objectContaining({ currency: 'MYR' }),
        )
    })

    it('[TC-F09.228] buildOrderItems variant.price converts correctly to sen for Stripe', async () => {
        // Arrange: variant price RM 29.90 → 2990 sen
        mockFindByID
            .mockResolvedValueOnce(VALID_SITE)
            .mockResolvedValueOnce(VALID_TENANT)
        mockBuildOrderItems.mockResolvedValue({
            orderItems: [
                { product: 'prod-v', productName: 'Jacket', variant: 'Blue', quantity: 1, unitPrice: 29.90 },
            ],
            checkoutItems: [
                { name: 'Jacket', price: 2990, quantity: 1, images: [] }, // 29.90 * 100
            ],
            subtotal: 29.90,
            currency: 'MYR',
            errorResponse: null,
        })
        mockCreate.mockResolvedValue(VALID_ORDER)
        mockCreateCheckoutSession.mockResolvedValue(VALID_CHECKOUT_SESSION)
        mockUpdate.mockResolvedValue({})

        // Act
        const req = mockRequest({
            ...VALID_REQUEST_BODY,
            items: [{ productId: 'prod-v', quantity: 1, variant: 'Blue' }],
        })
        const res = await POST(req)
        const resBody = await res.json()

        // Assert: Stripe item price is in sen (100-fold)
        expect(res.status).toBe(200)
        expect(resBody.success).toBe(true)
    })

    it('[TC-F09.228] buildOrderItems multiple variants of same product with correct prices', async () => {
        // Arrange: same product, Red @ 75, Blue @ 80
        mockFindByID
            .mockResolvedValueOnce(VALID_SITE)
            .mockResolvedValueOnce(VALID_TENANT)
        mockBuildOrderItems.mockResolvedValue({
            orderItems: [
                { product: 'prod-v', productName: 'Shirt', variant: 'Red', quantity: 1, unitPrice: 75 },
                { product: 'prod-v', productName: 'Shirt', variant: 'Blue', quantity: 1, unitPrice: 80 },
            ],
            checkoutItems: [
                { name: 'Shirt', price: 7500, quantity: 1, images: [] },
                { name: 'Shirt', price: 8000, quantity: 1, images: [] },
            ],
            subtotal: 155,
            currency: 'MYR',
            errorResponse: null,
        })
        mockCreate.mockResolvedValue(VALID_ORDER)
        mockCreateCheckoutSession.mockResolvedValue(VALID_CHECKOUT_SESSION)
        mockUpdate.mockResolvedValue({})

        // Act
        const body = {
            ...VALID_REQUEST_BODY,
            items: [
                { productId: 'prod-v', quantity: 1, variant: 'Red' },
                { productId: 'prod-v', quantity: 1, variant: 'Blue' },
            ],
        }
        const req = mockRequest(body)
        const res = await POST(req)
        const resBody = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(resBody.success).toBe(true)
        expect(mockBuildOrderItems).toHaveBeenCalledWith(
            expect.anything(),
            expect.arrayContaining([
                expect.objectContaining({ variant: 'Red' }),
                expect.objectContaining({ variant: 'Blue' }),
            ]),
            expect.anything(),
        )
    })

    // ─── TC-F13.155: paymentExpiresAt set on pending Stripe order ──────────
    it('[TC-F13.155] sets paymentExpiresAt ~24h ahead when creating pending Stripe order', async () => {
        // Arrange
        const before = Date.now()
        mockFindByID
            .mockResolvedValueOnce(VALID_SITE)
            .mockResolvedValueOnce(VALID_TENANT)
        mockBuildOrderItems.mockResolvedValue({
            orderItems: [{ product: 'prod-1', productName: 'Widget', quantity: 1, unitPrice: 5000 }],
            checkoutItems: [{ name: 'Widget', price: 5000, quantity: 1, images: [] }],
            subtotal: 5000,
            currency: 'MYR',
            errorResponse: null,
        })
        mockCreate.mockResolvedValue(VALID_ORDER)
        mockCreateCheckoutSession.mockResolvedValue(VALID_CHECKOUT_SESSION)
        mockUpdate.mockResolvedValue({})

        // Act
        const req = mockRequest(VALID_REQUEST_BODY)
        await POST(req)

        const after = Date.now()

        // Assert — paymentExpiresAt must be present in create data, within 24h window
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    paymentExpiresAt: expect.any(String),
                }),
            }),
        )
        const createCall = mockCreate.mock.calls[0][0]
        const exp = new Date(createCall.data.paymentExpiresAt).getTime()
        expect(exp).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000 - 2000)
        expect(exp).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000 + 2000)
    })

    // ─── TC-F13.155: free order must NOT set paymentExpiresAt ──────────────
    it('[TC-F13.155] does NOT set paymentExpiresAt for free orders (total <= 0)', async () => {
        // Arrange
        mockFindByID
            .mockResolvedValueOnce(VALID_SITE)
            .mockResolvedValueOnce(VALID_TENANT)
        mockBuildOrderItems.mockResolvedValue({
            orderItems: [{ product: 'prod-1', productName: 'Free Item', quantity: 1, unitPrice: 0 }],
            checkoutItems: [],
            subtotal: -10,
            currency: 'MYR',
            errorResponse: null,
        })
        mockCreate.mockResolvedValue({ id: 'order-free', orderNumber: 'ORD-FREE123' })

        // Act
        const req = mockRequest(VALID_REQUEST_BODY)
        await POST(req)

        // Assert — free order create data must NOT contain paymentExpiresAt
        const createCall = mockCreate.mock.calls[0][0]
        expect(createCall.data.paymentExpiresAt).toBeUndefined()
        expect(createCall.data.status).toBe('paid')
    })

    // ─── TC-F33-07-02: Stripe charges discounted total as consolidated line item ──

    it('[TC-F33-07-02] 50% discount → single consolidated line item at discounted total, no negative items, no Stripe Coupon', async () => {
        // Arrange:
        //   subtotal = 100 RM (10000 sen), 50% off → discountSen = 5000
        //   shippingFee = 10 RM (1000 sen, fixed in route)
        //   total = (10000 - 5000 + 1000) / 100 = 60 RM
        //   finalTotalSen = Math.round(60 * 100) = 6000
        mockFindByID
            .mockResolvedValueOnce(VALID_SITE)
            .mockResolvedValueOnce(VALID_TENANT)
        mockBuildOrderItems.mockResolvedValue({
            orderItems: [{ product: 'prod-1', productName: 'Widget', quantity: 2, unitPrice: 5000 }],
            checkoutItems: [{ name: 'Widget', price: 5000, quantity: 2, images: [] }],
            subtotal: 100, // RM (2 × RM 50)
            currency: 'MYR',
            errorResponse: null,
        })
        // Discount: 50% off, active, for tenant-1
        mockFind.mockResolvedValueOnce({
            docs: [{
                id: 10,
                code: 'HALF50',
                type: 'percentage',
                value: 50,
                status: 'active',
                usageLimit: null,
                usageCount: 0,
                startsAt: null,
                expiresAt: null,
                tenant: 'tenant-1',
            }],
            totalDocs: 1,
        })
        mockCreate.mockResolvedValue(VALID_ORDER)
        mockCreateCheckoutSession.mockResolvedValue(VALID_CHECKOUT_SESSION)
        mockUpdate.mockResolvedValue({})

        // Act
        const req = mockRequest({ ...VALID_REQUEST_BODY, discountCode: 'HALF50' })
        const res = await POST(req as any)
        const body = await res.json()

        // Assert — session created successfully
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)

        // The single consolidated line item replaces per-product items when a discount is applied
        const sessionCall = mockCreateCheckoutSession.mock.calls[0][0]
        const lineItems: any[] = sessionCall.items
        expect(lineItems).toHaveLength(1)
        expect(lineItems[0].name).toBe('Order total (discount applied)')
        // price = finalTotalSen = Math.round(60 * 100) = 6000 sen (discounted total, no tax)
        expect(lineItems[0].price).toBe(6000)
        expect(lineItems[0].quantity).toBe(1)

        // No negative items (Stripe forbids them)
        const hasNegativeItem = lineItems.some((item: any) => item.price < 0)
        expect(hasNegativeItem).toBe(false)

        // No Stripe Coupon object — consolidated approach does NOT use Stripe coupon API
        expect(sessionCall).not.toHaveProperty('coupon')
        expect(sessionCall).not.toHaveProperty('discounts')

        // The order was persisted with the discount snapshot fields
        const createData = mockCreate.mock.calls[0][0].data
        expect(createData.discountCode).toBe('HALF50')
        expect(createData.discountAmount).toBe(5000) // discountSen
    })

    it('[TC-F33-07-02b] no discount → per-product line items + shipping line item (original shape preserved)', async () => {
        // When no discount is applied the route must NOT collapse to a consolidated item —
        // individual product lines + shipping line are passed to Stripe as before.
        mockFindByID
            .mockResolvedValueOnce(VALID_SITE)
            .mockResolvedValueOnce(VALID_TENANT)
        mockBuildOrderItems.mockResolvedValue({
            orderItems: [{ product: 'prod-1', productName: 'Widget', quantity: 1, unitPrice: 5000 }],
            checkoutItems: [{ name: 'Widget', price: 5000, quantity: 1, images: [] }],
            subtotal: 50,
            currency: 'MYR',
            errorResponse: null,
        })
        // No discount code in request → mockFind not called for discounts
        mockCreate.mockResolvedValue(VALID_ORDER)
        mockCreateCheckoutSession.mockResolvedValue(VALID_CHECKOUT_SESSION)
        mockUpdate.mockResolvedValue({})

        // Act
        const req = mockRequest(VALID_REQUEST_BODY) // no discountCode field
        const res = await POST(req as any)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        const sessionCall = mockCreateCheckoutSession.mock.calls[0][0]
        const lineItems: any[] = sessionCall.items

        // Must contain product item AND shipping item; no consolidated item
        expect(lineItems.length).toBeGreaterThan(1)
        const hasConsolidated = lineItems.some((item: any) =>
            item.name === 'Order total (discount applied)'
        )
        expect(hasConsolidated).toBe(false)
        const hasShipping = lineItems.some((item: any) => item.name === 'Shipping')
        expect(hasShipping).toBe(true)
    })
})
