import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFindByID = vi.fn()
const mockUpdate = vi.fn()

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        findByID: mockFindByID,
        update: mockUpdate,
        sendEmail: vi.fn(),
        logger: { error: vi.fn() },
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth', () => ({
    withAuth: (fn: any) => (request: Request, context: unknown) => fn(
        { id: 'merchant-17', email: 'merchant@example.com' },
        request,
        context,
    ),
}))
vi.mock('@/lib/subscriptions/feature-guard', () => ({
    withFeatureGuard: () => (fn: unknown) => fn,
}))
vi.mock('@/collections/Orders', () => ({
    ORDER_STATUS_TRANSITIONS: {
        shipped: ['completed', 'refunded'],
        completed: ['refunded'],
    },
}))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(),
    canUse: vi.fn(),
}))
vi.mock('@/lib/email/get-template-config', () => ({ getTemplateConfig: vi.fn() }))
vi.mock('@/lib/email/get-tenant-owner-emails', () => ({ getTenantOwnerEmails: vi.fn() }))
vi.mock('@/lib/email/templates/order-confirmation', () => ({ orderConfirmationEmail: vi.fn() }))
vi.mock('@/lib/email/templates/order-completed', () => ({ orderCompletedEmail: vi.fn() }))
vi.mock('@/lib/email/templates/order-cancelled', () => ({ orderCancelledEmail: vi.fn() }))
vi.mock('@/lib/utils/storefront-url', () => ({ buildStorefrontUrl: vi.fn() }))

import { PATCH } from '@/app/api/orders/[id]/route'

function callPatch(orderId: string | number, body: unknown) {
    const request = new Request(`http://localhost/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    return PATCH(request, { params: Promise.resolve({ id: String(orderId) }) } as any)
}

describe('[TC-GH1734-API] PATCH order completion', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('records a structured Delivered audit event for Self-delivery shipped → completed', async () => {
        // Arrange
        const existingEvent = {
            status: 'pending_pickup',
            description: 'Order shipped manually',
            eventTime: '2026-08-05T01:00:00.000Z',
        }
        mockFindByID.mockResolvedValue({
            id: 1734,
            status: 'shipped',
            selfDeliveryCourier: 'Pos Laju',
            shippingTrackingHistory: [existingEvent],
        })
        mockUpdate.mockResolvedValue({ id: 1734, status: 'completed' })

        // Act
        const response = await callPatch(1734, { status: 'completed' })
        const body = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(body.success).toBe(true)
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'orders',
            id: '1734',
            user: expect.objectContaining({ id: 'merchant-17' }),
            overrideAccess: false,
            data: expect.objectContaining({
                status: 'completed',
                shippingTrackingStatus: 'delivered',
                shippingTrackingHistory: [
                    existingEvent,
                    expect.objectContaining({
                        status: 'delivered',
                        description: 'Order marked as completed',
                        source: 'cms_manual',
                        actorId: 'merchant-17',
                        actorLabel: 'merchant@example.com',
                        previousStatus: 'shipped',
                        nextStatus: 'completed',
                        eventTime: expect.any(String),
                    }),
                ],
            }),
        }))
    })

    it('preserves the existing EasyParcel completion payload', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({
            id: 1735,
            status: 'shipped',
            selfDeliveryCourier: null,
            shippingTrackingHistory: [{ status: 'in_transit' }],
        })
        mockUpdate.mockResolvedValue({ id: 1735, status: 'completed' })

        // Act
        const response = await callPatch(1735, { status: 'completed' })

        // Assert
        expect(response.status).toBe(200)
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            data: { status: 'completed' },
        }))
    })

    it('rejects completion when the order is already completed without appending another event', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({
            id: 1736,
            status: 'completed',
            selfDeliveryCourier: 'Pos Laju',
            shippingTrackingHistory: [{ status: 'delivered' }],
        })

        // Act
        const response = await callPatch(1736, { status: 'completed' })
        const body = await response.json()

        // Assert
        expect(response.status).toBe(422)
        expect(body.error.code).toBe('INVALID_TRANSITION')
        expect(mockUpdate).not.toHaveBeenCalled()
    })
})
