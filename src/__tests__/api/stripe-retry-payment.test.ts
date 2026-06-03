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
    paymentMethod: 'card',
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

    // ─── Webhook-failed order (paymentStatus='failed', status='payment_failed') is retryable ──
    it('[TC-F13.153] retries a webhook-failed order (paymentStatus=failed)', async () => {
        // Arrange — payment_intent.payment_failed webhook sets status='payment_failed', paymentStatus='failed'
        const webhookFailedOrder = {
            ...VALID_PENDING_ORDER,
            status: 'payment_failed',
            paymentStatus: 'failed',
        }
        mockFindByID.mockResolvedValue(webhookFailedOrder)
        mockCookies.mockResolvedValue({
            get: vi.fn((key) => (key === 'ct_123' ? { value: 'valid-token' } : undefined)),
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
        const res = await POST(mockRequest({}), { params: Promise.resolve({ id: '123' }) })
        const body = await res.json()

        // Assert — retryable + resets to awaiting on the order update
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ status: 'pending', paymentStatus: 'awaiting_payment' }),
            }),
        )
    })

    // ─── Auto-cancelled order (status='cancelled', paymentStatus='payment_failed') is NOT retryable ──
    it('[TC-F13.153] rejects an auto-cancelled order despite paymentStatus=payment_failed', async () => {
        // Arrange — 24h cron sets status='cancelled', paymentStatus='payment_failed'
        const autoCancelledOrder = {
            ...VALID_PENDING_ORDER,
            status: 'cancelled',
            paymentStatus: 'payment_failed',
        }
        mockFindByID.mockResolvedValue(autoCancelledOrder)
        mockCookies.mockResolvedValue({
            get: vi.fn((key) => (key === 'ct_123' ? { value: 'valid-token' } : undefined)),
        } as any)
        mockVerifyConfirmToken.mockReturnValue(true)

        // Act
        const res = await POST(mockRequest({}), { params: Promise.resolve({ id: '123' }) })
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

    // ─── Re-priced shipping + tax at retry (recomputed, not stored) ─────
    it('[TC-F13.158] re-prices shipping (flat) + 6% SST from current subtotal on retry', async () => {
        // Arrange — retry recomputes totals from current product prices, ignoring stale order fields
        mockFindByID.mockResolvedValue(VALID_PENDING_ORDER)
        mockCookies.mockResolvedValue({
            get: vi.fn((key) => (key === 'ct_123' ? { value: 'valid-token' } : undefined)),
        } as any)
        mockVerifyConfirmToken.mockReturnValue(true)
        mockBuildPaymentMethodTypes.mockReturnValue(['card', 'fpx'])
        mockBuildOrderItems.mockResolvedValue({
            errorResponse: null,
            checkoutItems: [{ name: 'Product', price: 5000, quantity: 1, images: [] }],
            subtotal: 50, // RM 50 → shipping flat RM10, SST 6% = RM3
        })
        mockCreateCheckoutSession.mockResolvedValue(VALID_CHECKOUT_SESSION)
        mockUpdate.mockResolvedValue({})

        // Act
        const res = await POST(mockRequest({}), { params: Promise.resolve({ id: '123' }) })

        // Assert — line items use recomputed flat shipping (1000 sen) + 6% SST (300 sen)
        expect(res.status).toBe(200)
        expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
            expect.objectContaining({
                items: expect.arrayContaining([
                    expect.objectContaining({ name: 'Product' }),
                    expect.objectContaining({ name: 'Shipping', price: 1000 }),
                    expect.objectContaining({ name: 'SST (6%)', price: 300 }),
                ]),
            }),
        )
        // And persists the re-priced totals so order.total matches the Stripe charge
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ subtotal: 50, shippingFee: 10, tax: 3, total: 63 }),
            }),
        )
    })

    // ─── Bank-transfer order cannot be retried via Stripe (I1) ──────────
    it('[TC-F13.158] rejects retry for non-Stripe (bank_transfer) order', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ ...VALID_PENDING_ORDER, paymentMethod: 'bank_transfer' })
        mockCookies.mockResolvedValue({
            get: vi.fn((key) => (key === 'ct_123' ? { value: 'valid-token' } : undefined)),
        } as any)
        mockVerifyConfirmToken.mockReturnValue(true)

        // Act
        const res = await POST(mockRequest({}), { params: Promise.resolve({ id: '123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(409)
        expect(body.error.code).toBe('NOT_RETRYABLE')
        expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
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

    // ─── TC-F13.155: retry does NOT extend the 24h hold (fixed from placement) ─────
    it('[TC-F13.155] retry preserves the placement deadline — does not touch paymentExpiresAt', async () => {
        // Arrange
        mockFindByID.mockResolvedValue(VALID_PENDING_ORDER)
        mockCookies.mockResolvedValue({
            get: vi.fn((key) => (key === 'ct_123' ? { value: 'valid-token' } : undefined)),
        } as any)
        mockVerifyConfirmToken.mockReturnValue(true)
        mockBuildPaymentMethodTypes.mockReturnValue(['card', 'fpx'])
        mockBuildOrderItems.mockResolvedValue({
            errorResponse: null,
            checkoutItems: [{ name: 'Product', price: 5000, quantity: 1, images: [] }],
            subtotal: 50,
        })
        mockCreateCheckoutSession.mockResolvedValue(VALID_CHECKOUT_SESSION)
        mockUpdate.mockResolvedValue({})

        // Act
        await POST(mockRequest({}), { params: Promise.resolve({ id: '123' }) })

        // Assert — update sets the new session but leaves paymentExpiresAt untouched (24h runs from placement)
        const updateData = mockUpdate.mock.calls[0][0].data
        expect(updateData.stripeSessionId).toBe(VALID_CHECKOUT_SESSION.sessionId)
        expect(updateData).not.toHaveProperty('paymentExpiresAt')
    })
})
