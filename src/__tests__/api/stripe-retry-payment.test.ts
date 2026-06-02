import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockFindByID = vi.fn()
const mockUpdate = vi.fn()

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        findByID: mockFindByID,
        update: mockUpdate,
    })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/payment/stripe', () => ({
    createStripeCheckoutSession: vi.fn(),
}))

vi.mock('@/lib/orders/upload-token', () => ({
    generateConfirmToken: vi.fn(() => 'mock-confirm-token'),
    verifyConfirmToken: vi.fn(),
}))

vi.mock('@/lib/auth/order-token', () => ({
    verifyOrderToken: vi.fn(),
}))

vi.mock('@/lib/payment/method-builder', () => ({
    buildPaymentMethodTypes: vi.fn(),
}))

vi.mock('@/app/api/orders/stripe-checkout/build-order-items', () => ({
    buildOrderItems: vi.fn(),
}))

vi.mock('next/headers', () => ({
    cookies: vi.fn(),
}))

// ─── Imports after mocks ──────────────────────────────────────────────

import { POST } from '@/app/api/orders/[id]/retry-payment/route'
import { createStripeCheckoutSession } from '@/lib/payment/stripe'
import { verifyConfirmToken, generateConfirmToken } from '@/lib/orders/upload-token'
import { verifyOrderToken } from '@/lib/auth/order-token'
import { buildPaymentMethodTypes } from '@/lib/payment/method-builder'
import { buildOrderItems } from '@/app/api/orders/stripe-checkout/build-order-items'
import { cookies } from 'next/headers'

const mockCreateCheckoutSession = vi.mocked(createStripeCheckoutSession)
const mockVerifyConfirmToken = vi.mocked(verifyConfirmToken)
const mockVerifyOrderToken = vi.mocked(verifyOrderToken)
const mockBuildPaymentMethodTypes = vi.mocked(buildPaymentMethodTypes)
const mockBuildOrderItems = vi.mocked(buildOrderItems)
const mockCookies = vi.mocked(cookies)

// ─── Test Helpers ─────────────────────────────────────────────────────

function mockRequest(body: any = {}) {
    return {
        json: () => Promise.resolve(body),
    } as unknown as Request
}

const VALID_TENANT = {
    id: 'tenant-1',
    slug: 'test-store',
    stripeAccountId: 'acct_test_123',
    stripeOnboardingComplete: true,
    status: 'active',
    payments: { payment_card: true, payment_fpx: true },
}

const VALID_SITE = {
    id: 'site-1',
    slug: 'test-site',
    paymentConfig: { cardEnabled: true, fpxEnabled: true },
}

const VALID_PENDING_ORDER = {
    id: '123',
    orderNumber: 'ORD-ABC123',
    status: 'pending',
    paymentStatus: 'awaiting_payment',
    tenant: VALID_TENANT,
    site: VALID_SITE,
    customerEmail: 'buyer@example.com',
    currency: 'MYR',
    items: [{ product: { id: 'prod-1' }, quantity: 1 }],
    shippingFee: 1000,
    tax: 500,
    magicLinkSecret: 'secret-123',
    stripeSessionId: null,
}

const VALID_PAYMENT_FAILED_ORDER = {
    ...VALID_PENDING_ORDER,
    paymentStatus: 'payment_failed',
}

const VALID_CHECKOUT_SESSION = {
    sessionId: 'cs_test_456',
    url: 'https://checkout.stripe.com/pay/cs_test_456',
}

// ─── TC-F13: Retry Payment ────────────────────────────────────────────

describe('POST /api/orders/[id]/retry-payment [TC-F13.153-154]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockCookies.mockResolvedValue({
            get: vi.fn(() => null),
        } as any)
    })

    // ─── TC-F13.153: Happy path — pending/payment_failed order ─────────
    it('[TC-F13.153] creates new Stripe session for pending order with valid ct_ cookie', async () => {
        // Arrange
        mockFindByID.mockResolvedValue(VALID_PENDING_ORDER)
        mockCookies.mockResolvedValue({
            get: vi.fn((key) => {
                if (key === 'ct_123') return { value: 'valid-token' }
                return undefined
            }),
        } as any)
        mockVerifyConfirmToken.mockReturnValue(true)
        mockBuildPaymentMethodTypes.mockReturnValue(['card', 'fpx'])
        mockBuildOrderItems.mockResolvedValue({
            errorResponse: null,
            checkoutItems: [{ name: 'Product', price: 5000, quantity: 1, images: [] }],
        })
        mockCreateCheckoutSession.mockResolvedValue(VALID_CHECKOUT_SESSION)
        mockUpdate.mockResolvedValue({})

        // Act
        const req = mockRequest({})
        const res = await POST(req, { params: Promise.resolve({ id: '123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.sessionUrl).toBe(VALID_CHECKOUT_SESSION.url)
        expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
            expect.objectContaining({
                orderId: '123',
                currency: 'MYR',
                customerEmail: 'buyer@example.com',
                stripeAccountId: 'acct_test_123',
                paymentMethodTypes: ['card', 'fpx'],
            }),
        )
    })

    // ─── TC-F13.153: Payment failed order with magic-link token ────────
    it('[TC-F13.153] creates new Stripe session for payment_failed order with magic-link token', async () => {
        // Arrange
        mockFindByID.mockResolvedValue(VALID_PAYMENT_FAILED_ORDER)
        mockCookies.mockResolvedValue({
            get: vi.fn(() => null),
        } as any)
        mockVerifyConfirmToken.mockReturnValue(false)
        mockVerifyOrderToken.mockResolvedValue({ ok: true })
        mockBuildPaymentMethodTypes.mockReturnValue(['fpx'])
        mockBuildOrderItems.mockResolvedValue({
            errorResponse: null,
            checkoutItems: [{ name: 'Product', price: 5000, quantity: 1, images: [] }],
        })
        mockCreateCheckoutSession.mockResolvedValue(VALID_CHECKOUT_SESSION)
        mockUpdate.mockResolvedValue({})

        // Act
        const req = mockRequest({ token: 'magic-link-token-abc' })
        const res = await POST(req, { params: Promise.resolve({ id: '123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(mockVerifyOrderToken).toHaveBeenCalledWith({
            token: 'magic-link-token-abc',
            secret: 'secret-123',
        })
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'orders',
                id: '123',
                data: expect.objectContaining({
                    status: 'pending',
                    paymentStatus: 'awaiting_payment',
                    stripeSessionId: VALID_CHECKOUT_SESSION.sessionId,
                }),
            }),
        )
    })

    // ─── TC-F13.153: Reset payment_failed to awaiting_payment ─────────
    it('[TC-F13.153] resets payment_failed order status to awaiting_payment on retry', async () => {
        // Arrange
        mockFindByID.mockResolvedValue(VALID_PAYMENT_FAILED_ORDER)
        mockCookies.mockResolvedValue({
            get: vi.fn((key) => {
                if (key === 'ct_123') return { value: 'valid-token' }
                return undefined
            }),
        } as any)
        mockVerifyConfirmToken.mockReturnValue(true)
        mockBuildPaymentMethodTypes.mockReturnValue(['card', 'fpx'])
        mockBuildOrderItems.mockResolvedValue({
            errorResponse: null,
            checkoutItems: [{ name: 'Product', price: 5000, quantity: 1, images: [] }],
        })
        mockCreateCheckoutSession.mockResolvedValue(VALID_CHECKOUT_SESSION)
        mockUpdate.mockResolvedValue({})

        // Act
        const req = mockRequest({})
        const res = await POST(req, { params: Promise.resolve({ id: '123' }) })

        // Assert
        expect(res.status).toBe(200)
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: 'pending',
                    paymentStatus: 'awaiting_payment',
                }),
            }),
        )
    })

    // ─── TC-F13.154: Out of stock validation ──────────────────────────
    it('[TC-F13.154] rejects with 422 when product out of stock', async () => {
        // Arrange
        mockFindByID.mockResolvedValue(VALID_PENDING_ORDER)
        mockCookies.mockResolvedValue({
            get: vi.fn((key) => {
                if (key === 'ct_123') return { value: 'valid-token' }
                return undefined
            }),
        } as any)
        mockVerifyConfirmToken.mockReturnValue(true)
        mockBuildPaymentMethodTypes.mockReturnValue(['card', 'fpx'])
        // errorResponse is a NextResponse-like object
        const mockErrorResponse = {
            status: 422,
            json: vi.fn().mockResolvedValue({ error: { code: 'OUT_OF_STOCK', message: 'Product out of stock' } }),
        }
        mockBuildOrderItems.mockResolvedValue({
            errorResponse: mockErrorResponse,
        })

        // Act
        const req = mockRequest({})
        const res = await POST(req, { params: Promise.resolve({ id: '123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(422)
        expect(body.error.code).toBe('OUT_OF_STOCK')
        expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    // ─── No auth: No cookie + No body token ───────────────────────────
    it('[Unlabeled] returns 401 when no cookie and no body token', async () => {
        // Arrange
        mockFindByID.mockResolvedValue(VALID_PENDING_ORDER)
        mockCookies.mockResolvedValue({
            get: vi.fn(() => null),
        } as any)
        mockVerifyConfirmToken.mockReturnValue(false)
        mockVerifyOrderToken.mockResolvedValue({ ok: false })

        // Act
        const req = mockRequest({})
        const res = await POST(req, { params: Promise.resolve({ id: '123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(401)
        expect(body.error.code).toBe('UNAUTHORIZED')
        expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
    })

    // ─── Already paid order ───────────────────────────────────────────
    it('[Unlabeled] returns 409 when order already paid', async () => {
        // Arrange
        const paidOrder = {
            ...VALID_PENDING_ORDER,
            status: 'new',
            paymentStatus: 'paid',
        }
        mockFindByID.mockResolvedValue(paidOrder)
        mockCookies.mockResolvedValue({
            get: vi.fn((key) => {
                if (key === 'ct_123') return { value: 'valid-token' }
                return undefined
            }),
        } as any)
        mockVerifyConfirmToken.mockReturnValue(true)

        // Act
        const req = mockRequest({})
        const res = await POST(req, { params: Promise.resolve({ id: '123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(409)
        expect(body.error.code).toBe('NOT_RETRYABLE')
        expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
    })

    // ─── Cancelled order ──────────────────────────────────────────────
    it('[Unlabeled] returns 409 when order is cancelled', async () => {
        // Arrange
        const cancelledOrder = {
            ...VALID_PENDING_ORDER,
            status: 'cancelled',
            paymentStatus: 'cancelled',
        }
        mockFindByID.mockResolvedValue(cancelledOrder)
        mockCookies.mockResolvedValue({
            get: vi.fn((key) => {
                if (key === 'ct_123') return { value: 'valid-token' }
                return undefined
            }),
        } as any)
        mockVerifyConfirmToken.mockReturnValue(true)

        // Act
        const req = mockRequest({})
        const res = await POST(req, { params: Promise.resolve({ id: '123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(409)
        expect(body.error.code).toBe('NOT_RETRYABLE')
        expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
    })

    // ─── Stripe not connected ─────────────────────────────────────────
    it('[Unlabeled] returns 422 when tenant has no stripeAccountId', async () => {
        // Arrange
        const noStripeOrder = {
            ...VALID_PENDING_ORDER,
            tenant: { ...VALID_TENANT, stripeAccountId: null },
        }
        mockFindByID.mockResolvedValue(noStripeOrder)
        mockCookies.mockResolvedValue({
            get: vi.fn((key) => {
                if (key === 'ct_123') return { value: 'valid-token' }
                return undefined
            }),
        } as any)
        mockVerifyConfirmToken.mockReturnValue(true)

        // Act
        const req = mockRequest({})
        const res = await POST(req, { params: Promise.resolve({ id: '123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(422)
        expect(body.error.code).toBe('STRIPE_NOT_CONNECTED')
        expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
    })

    // ─── Stripe not ready (onboarding incomplete) ─────────────────────
    it('[Unlabeled] returns 422 when Stripe onboarding incomplete', async () => {
        // Arrange
        const incompleteOrder = {
            ...VALID_PENDING_ORDER,
            tenant: { ...VALID_TENANT, stripeOnboardingComplete: false },
        }
        mockFindByID.mockResolvedValue(incompleteOrder)
        mockCookies.mockResolvedValue({
            get: vi.fn((key) => {
                if (key === 'ct_123') return { value: 'valid-token' }
                return undefined
            }),
        } as any)
        mockVerifyConfirmToken.mockReturnValue(true)

        // Act
        const req = mockRequest({})
        const res = await POST(req, { params: Promise.resolve({ id: '123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(422)
        expect(body.error.code).toBe('STRIPE_NOT_READY')
        expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
    })

    // ─── Suspended tenant ─────────────────────────────────────────────
    it('[Unlabeled] returns 403 when tenant is suspended', async () => {
        // Arrange
        const suspendedOrder = {
            ...VALID_PENDING_ORDER,
            tenant: { ...VALID_TENANT, status: 'suspended' },
        }
        mockFindByID.mockResolvedValue(suspendedOrder)
        mockCookies.mockResolvedValue({
            get: vi.fn((key) => {
                if (key === 'ct_123') return { value: 'valid-token' }
                return undefined
            }),
        } as any)
        mockVerifyConfirmToken.mockReturnValue(true)

        // Act
        const req = mockRequest({})
        const res = await POST(req, { params: Promise.resolve({ id: '123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(403)
        expect(body.error.code).toBe('STORE_UNAVAILABLE')
        expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
    })

    // ─── No payment methods enabled ────────────────────────────────────
    it('[Unlabeled] returns 422 when no payment methods enabled', async () => {
        // Arrange
        mockFindByID.mockResolvedValue(VALID_PENDING_ORDER)
        mockCookies.mockResolvedValue({
            get: vi.fn((key) => {
                if (key === 'ct_123') return { value: 'valid-token' }
                return undefined
            }),
        } as any)
        mockVerifyConfirmToken.mockReturnValue(true)
        mockBuildPaymentMethodTypes.mockReturnValue([])

        // Act
        const req = mockRequest({})
        const res = await POST(req, { params: Promise.resolve({ id: '123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(422)
        expect(body.error.code).toBe('NO_PAYMENT_METHODS')
        expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
    })

    // ─── Order not found ──────────────────────────────────────────────
    it('[Unlabeled] returns 404 when order not found', async () => {
        // Arrange
        mockFindByID.mockResolvedValue(null)

        // Act
        const req = mockRequest({})
        const res = await POST(req, { params: Promise.resolve({ id: '999' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(404)
        expect(body.error.code).toBe('NOT_FOUND')
    })

    // ─── Tenant not found (order.tenant is ID, not populated) ─────────
    it('[Unlabeled] returns 404 when tenant not expanded in order', async () => {
        // Arrange
        const unpopulatedOrder = {
            ...VALID_PENDING_ORDER,
            tenant: 'tenant-id-not-expanded',
        }
        mockFindByID.mockResolvedValue(unpopulatedOrder)
        mockCookies.mockResolvedValue({
            get: vi.fn((key) => {
                if (key === 'ct_123') return { value: 'valid-token' }
                return undefined
            }),
        } as any)
        mockVerifyConfirmToken.mockReturnValue(true)

        // Act
        const req = mockRequest({})
        const res = await POST(req, { params: Promise.resolve({ id: '123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(404)
        expect(body.error.code).toBe('NOT_FOUND')
        expect(body.error.message).toBe('Store not found')
    })

    // ─── Stripe API error ─────────────────────────────────────────────
    it('[Unlabeled] returns 502 when Stripe API fails', async () => {
        // Arrange
        mockFindByID.mockResolvedValue(VALID_PENDING_ORDER)
        mockCookies.mockResolvedValue({
            get: vi.fn((key) => {
                if (key === 'ct_123') return { value: 'valid-token' }
                return undefined
            }),
        } as any)
        mockVerifyConfirmToken.mockReturnValue(true)
        mockBuildPaymentMethodTypes.mockReturnValue(['card', 'fpx'])
        mockBuildOrderItems.mockResolvedValue({
            errorResponse: null,
            checkoutItems: [{ name: 'Product', price: 5000, quantity: 1, images: [] }],
        })
        mockCreateCheckoutSession.mockRejectedValue(new Error('Stripe API error'))

        // Act
        const req = mockRequest({})
        const res = await POST(req, { params: Promise.resolve({ id: '123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(502)
        expect(body.error.code).toBe('STRIPE_API_ERROR')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    // ─── Cookie is set on success response ─────────────────────────────
    it('[Unlabeled] sets confirm token cookie on successful retry', async () => {
        // Arrange
        mockFindByID.mockResolvedValue(VALID_PENDING_ORDER)
        const mockCookieStore = {
            get: vi.fn(() => null),
            set: vi.fn(),
        }
        mockCookies.mockResolvedValue(mockCookieStore as any)
        mockVerifyConfirmToken.mockReturnValue(false)
        mockVerifyOrderToken.mockResolvedValue({ ok: true })
        mockBuildPaymentMethodTypes.mockReturnValue(['card', 'fpx'])
        mockBuildOrderItems.mockResolvedValue({
            errorResponse: null,
            checkoutItems: [{ name: 'Product', price: 5000, quantity: 1, images: [] }],
        })
        mockCreateCheckoutSession.mockResolvedValue(VALID_CHECKOUT_SESSION)
        mockUpdate.mockResolvedValue({})

        // Act
        const req = mockRequest({ token: 'magic-link-token' })
        const res = await POST(req, { params: Promise.resolve({ id: '123' }) })

        // Assert
        expect(res.status).toBe(200)
        // Verify cookie setting via response headers
        const setCookieHeader = res.headers.get('set-cookie')
        expect(setCookieHeader).toBeTruthy()
        expect(setCookieHeader).toContain('ct_123')
        expect(setCookieHeader).toContain('mock-confirm-token')
    })

    // ─── Shipping and tax included in checkout items ────────────────────
    it('[Unlabeled] includes shipping fee and tax in checkout items', async () => {
        // Arrange
        // Note: shippingFee and tax are in cents (or base units) — route multiplies by 100 for Stripe
        const orderWithFees = {
            ...VALID_PENDING_ORDER,
            shippingFee: 20, // RM 0.20 → 2000 sen
            tax: 8, // RM 0.08 → 800 sen
        }
        mockFindByID.mockResolvedValue(orderWithFees)
        mockCookies.mockResolvedValue({
            get: vi.fn((key) => {
                if (key === 'ct_123') return { value: 'valid-token' }
                return undefined
            }),
        } as any)
        mockVerifyConfirmToken.mockReturnValue(true)
        mockBuildPaymentMethodTypes.mockReturnValue(['card', 'fpx'])
        mockBuildOrderItems.mockResolvedValue({
            errorResponse: null,
            checkoutItems: [{ name: 'Product', price: 5000, quantity: 1, images: [] }],
        })
        mockCreateCheckoutSession.mockResolvedValue(VALID_CHECKOUT_SESSION)
        mockUpdate.mockResolvedValue({})

        // Act
        const req = mockRequest({})
        const res = await POST(req, { params: Promise.resolve({ id: '123' }) })

        // Assert
        expect(res.status).toBe(200)
        expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
            expect.objectContaining({
                items: expect.arrayContaining([
                    expect.objectContaining({ name: 'Product' }),
                    expect.objectContaining({ name: 'Shipping', price: 2000 }),
                    expect.objectContaining({ name: 'SST (6%)', price: 800 }),
                ]),
            }),
        )
    })

    // ─── Numeric order ID (converted to string) ───────────────────────
    it('[Unlabeled] handles numeric order ID correctly', async () => {
        // Arrange
        mockFindByID.mockResolvedValue(VALID_PENDING_ORDER)
        mockCookies.mockResolvedValue({
            get: vi.fn((key) => {
                if (key === 'ct_123') return { value: 'valid-token' }
                return undefined
            }),
        } as any)
        mockVerifyConfirmToken.mockReturnValue(true)
        mockBuildPaymentMethodTypes.mockReturnValue(['card', 'fpx'])
        mockBuildOrderItems.mockResolvedValue({
            errorResponse: null,
            checkoutItems: [{ name: 'Product', price: 5000, quantity: 1, images: [] }],
        })
        mockCreateCheckoutSession.mockResolvedValue(VALID_CHECKOUT_SESSION)
        mockUpdate.mockResolvedValue({})

        // Act
        const req = mockRequest({})
        const res = await POST(req, { params: Promise.resolve({ id: '123' }) })

        // Assert
        expect(res.status).toBe(200)
        expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
            expect.objectContaining({
                orderId: '123',
            }),
        )
    })

    // ─── Internal error (unexpected exception in update) ─────────────────
    it('[Unlabeled] returns 500 for unexpected errors during update', async () => {
        // Arrange
        mockFindByID.mockResolvedValue(VALID_PENDING_ORDER)
        mockCookies.mockResolvedValue({
            get: vi.fn((key) => {
                if (key === 'ct_123') return { value: 'valid-token' }
                return undefined
            }),
        } as any)
        mockVerifyConfirmToken.mockReturnValue(true)
        mockBuildPaymentMethodTypes.mockReturnValue(['card', 'fpx'])
        mockBuildOrderItems.mockResolvedValue({
            errorResponse: null,
            checkoutItems: [{ name: 'Product', price: 5000, quantity: 1, images: [] }],
        })
        mockCreateCheckoutSession.mockResolvedValue(VALID_CHECKOUT_SESSION)
        mockUpdate.mockRejectedValue(new Error('Database connection failed'))

        // Act
        const req = mockRequest({})
        const res = await POST(req, { params: Promise.resolve({ id: '123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(500)
        expect(body.error.code).toBe('INTERNAL_ERROR')
    })

    // ─── TC-F13.155: retry refreshes paymentExpiresAt ─────────────────────
    it('[TC-F13.155] update data includes refreshed paymentExpiresAt ~24h ahead on retry', async () => {
        // Arrange
        const before = Date.now()
        mockFindByID.mockResolvedValue(VALID_PENDING_ORDER)
        mockCookies.mockResolvedValue({
            get: vi.fn((key) => {
                if (key === 'ct_123') return { value: 'valid-token' }
                return undefined
            }),
        } as any)
        mockVerifyConfirmToken.mockReturnValue(true)
        mockBuildPaymentMethodTypes.mockReturnValue(['card', 'fpx'])
        mockBuildOrderItems.mockResolvedValue({
            errorResponse: null,
            checkoutItems: [{ name: 'Product', price: 5000, quantity: 1, images: [] }],
        })
        mockCreateCheckoutSession.mockResolvedValue(VALID_CHECKOUT_SESSION)
        mockUpdate.mockResolvedValue({})

        // Act
        const req = mockRequest({})
        await POST(req, { params: Promise.resolve({ id: '123' }) })

        const after = Date.now()

        // Assert — update must include paymentExpiresAt within the 24h window
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    stripeSessionId: VALID_CHECKOUT_SESSION.sessionId,
                    paymentExpiresAt: expect.any(String),
                }),
            }),
        )
        const updateCall = mockUpdate.mock.calls[0][0]
        const exp = new Date(updateCall.data.paymentExpiresAt).getTime()
        expect(exp).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000 - 2000)
        expect(exp).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000 + 2000)
    })
})
