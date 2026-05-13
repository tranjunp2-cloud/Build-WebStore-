import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockFindByID = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        findByID: mockFindByID,
        create: mockCreate,
        update: mockUpdate,
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/payment/stripe', () => ({
    createStripeCheckoutSession: vi.fn(),
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
vi.mock('@/lib/validations/orders', () => ({ stripeCheckoutSchema: {} }))

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
                metadata: expect.objectContaining({ paymentMethod: 'fpx' }),
            }),
        )
    })

    // ─── TC-F13.19: Currency & smallest unit (sen) ──────────────────
    it('[TC-F13.19] converts product price RM 29.90 to 2990 sen for Stripe', async () => {
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

    // ─── TC-F13.26: FPX disabled ────────────────────────────────────
    it('[TC-F13.26] returns 422 METHOD_DISABLED when FPX is disabled', async () => {
        // Arrange
        const siteWithFpxDisabled = {
            ...VALID_SITE,
            paymentConfig: { fpxEnabled: false, cardEnabled: true },
        }
        mockFindByID.mockResolvedValueOnce(siteWithFpxDisabled)

        // Act
        const req = mockRequest({ ...VALID_REQUEST_BODY, paymentMethod: 'fpx' })
        const res = await POST(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(422)
        expect(body.error.code).toBe('METHOD_DISABLED')
        expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
    })

    // ─── TC-F13.27: Card disabled ───────────────────────────────────
    it('[TC-F13.27] returns 422 METHOD_DISABLED when card is disabled', async () => {
        // Arrange
        const siteWithCardDisabled = {
            ...VALID_SITE,
            paymentConfig: { fpxEnabled: true, cardEnabled: false },
        }
        mockFindByID.mockResolvedValueOnce(siteWithCardDisabled)

        // Act
        const req = mockRequest({ ...VALID_REQUEST_BODY, paymentMethod: 'card' })
        const res = await POST(req)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(422)
        expect(body.error.code).toBe('METHOD_DISABLED')
        expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
    })

    // ─── TC-F13.18: Stripe onboarding incomplete ────────────────────
    it('[TC-F13.18] returns 400 PAYMENT_NOT_CONFIGURED when stripeOnboardingComplete=false', async () => {
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
        expect(res.status).toBe(400)
        expect(body.error.code).toBe('PAYMENT_NOT_CONFIGURED')
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
    it('returns 400 PAYMENT_NOT_CONFIGURED when stripeAccountId is missing', async () => {
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
        expect(res.status).toBe(400)
        expect(body.error.code).toBe('PAYMENT_NOT_CONFIGURED')
    })

    // ─── Edge: buildOrderItems returns error ──────────────────────────
    it('returns error when buildOrderItems fails (no valid products)', async () => {
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

    // ─── Card checkout (alternative payment method) ──────────────────
    it('creates card checkout session with correct payment method metadata', async () => {
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
                metadata: expect.objectContaining({ paymentMethod: 'card' }),
            }),
        )
    })

    // ─── Session ID persistence ─────────────────────────────────────
    it('updates order with stripeSessionId for idempotent webhook processing', async () => {
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
})
