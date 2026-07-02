import 'server-only'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'
import { ORDER_STATUS_TRANSITIONS } from '@/collections/Orders'

type RouteContext = { params: Promise<{ id: string }> }

const SHIPPABLE_STATUSES = new Set(['confirmed', 'ready_to_ship'])

/**
 * POST /api/orders/[id]/self-deliver
 *
 * Marks an order as self-delivered (no EasyParcel label).
 * Body: { courier: string, trackingNumber: string }
 * Validates the order is in a shippable status, persists courier metadata,
 * and flips status to 'shipped'.
 */
export const POST = withFeatureGuard('order_management')(withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const { id } = await ctx.params
        const orderId = Number.isFinite(Number(id)) ? Number(id) : id

        let courier: string | undefined
        let trackingNumber: string | undefined
        try {
            const body = await request.json()
            if (typeof body?.courier === 'string' && body.courier.trim()) courier = body.courier.trim()
            if (typeof body?.trackingNumber === 'string' && body.trackingNumber.trim()) trackingNumber = body.trackingNumber.trim()
        } catch {
            return NextResponse.json(
                { success: false, error: { code: 'INVALID_BODY', message: 'Request body must be JSON with courier and trackingNumber' } },
                { status: 400 },
            )
        }

        if (!courier) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'courier is required' } },
                { status: 422 },
            )
        }
        if (!trackingNumber) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'trackingNumber is required' } },
                { status: 422 },
            )
        }

        const payload = await getPayload({ config })

        const order = await payload.findByID({
            collection: 'orders',
            id: orderId,
            user,
            overrideAccess: false,
        })

        if (!order) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
                { status: 404 },
            )
        }

        const currentStatus = order.status as string

        if (!SHIPPABLE_STATUSES.has(currentStatus)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_TRANSITION',
                        message: `Cannot self-deliver order in "${currentStatus}" status. Order must be in confirmed or ready_to_ship status.`,
                    },
                },
                { status: 422 },
            )
        }

        // NOTE: Self-deliver is intentionally exempt from the shared ORDER_STATUS_TRANSITIONS
        // cross-check. The transition table defines the normal ship flow (confirmed →
        // ready_to_ship → shipped), but a merchant fulfilling manually skips the
        // ready_to_ship step entirely.  SHIPPABLE_STATUSES above is the gate;
        // do NOT add confirmed → shipped to ORDER_STATUS_TRANSITIONS (that would
        // allow the normal ship action to skip ready_to_ship, breaking EP label flow).

        await payload.update({
            collection: 'orders',
            id: orderId,
            data: {
                selfDeliveryCourier: courier,
                trackingNumber,
                shippingTrackingStatus: 'pending_pickup',
                status: 'shipped',
            } as any,
        })

        return NextResponse.json({
            success: true,
            data: {
                status: 'shipped',
                selfDeliveryCourier: courier,
                trackingNumber,
                shippingTrackingStatus: 'pending_pickup',
            },
        })
    } catch (error: unknown) {
        console.error('[Self Deliver Error]', error instanceof Error ? error.message : 'unknown')
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to mark order as self-delivered' } },
            { status: 500 },
        )
    }
}))
