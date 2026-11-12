import 'server-only'
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'
import { selfDeliverOrderAs } from '@/lib/orders/self-deliver-order'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/orders/[id]/self-deliver
 *
 * Marks an order as self-delivered (no EasyParcel label).
 * Body: { courier: string, trackingNumber: string }
 * Validates the order is in a shippable status, persists courier metadata,
 * and flips status to 'shipped'. The work is lib/orders/self-deliver-order.ts, shared with the AI copilot.
 */
export const POST = withFeatureGuard('order_management')(withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const { id } = await ctx.params

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

        const result = await selfDeliverOrderAs(user, id, courier, trackingNumber)
        return NextResponse.json(result.body, { status: result.status })
    } catch (error: unknown) {
        console.error('[Self Deliver Error]', error instanceof Error ? error.message : 'unknown')
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to mark order as self-delivered' } },
            { status: 500 },
        )
    }
}))
