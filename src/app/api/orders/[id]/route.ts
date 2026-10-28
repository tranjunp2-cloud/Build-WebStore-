// NOTE: This file uses `(order as any)` and `(tenant as any)` casts throughout because
// payload-types.ts is not yet generated (Payload CMS generated types do not exist in this project).
// These casts are intentional and will be removed once `npx payload generate:types` is integrated
// into the build pipeline. See docs/tracking/OPEN_BLOCKERS.md for tracking.
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'
import { parseRequest } from '@/lib/validations/helpers'
import { orderStatusUpdateSchema } from '@/lib/validations/orders'
import { updateOrderStatusAs } from '@/lib/orders/update-order-status'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/orders/[id]
 *
 * Update order status with workflow validation.
 * Only allows transitions defined in ORDER_STATUS_TRANSITIONS.
 * The update (and the buyer's email) is lib/orders/update-order-status.ts, shared with the AI copilot.
 */
export const PATCH = withFeatureGuard('order_management')(withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const { id } = await ctx.params
        const { data, errorResponse } = await parseRequest(request, orderStatusUpdateSchema)
        if (errorResponse) return errorResponse

        const result = await updateOrderStatusAs(user, id, data!)
        return NextResponse.json(result.body, { status: result.status })
    } catch (error: unknown) {
        if ((error as { status?: number; name?: string })?.status === 404 || (error as { name?: string })?.name === 'NotFound') {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
                { status: 404 }
            )
        }
        console.error('[Order Update Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Order operation failed' } },
            { status: 500 }
        )
    }
}))

/**
 * GET /api/orders/[id]
 *
 * Get single order details.
 */
export const GET = withAuth<RouteContext>(async (user, _request, ctx) => {
    try {
        const { id } = await ctx.params
        const payload = await getPayload({ config })

        const order = await payload.findByID({
            collection: 'orders',
            id,
            depth: 2,
            user,
            overrideAccess: false,
        })

        if (!order) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true, data: order })
    } catch (error: unknown) {
        if ((error as { status?: number; name?: string })?.status === 404 || (error as { name?: string })?.name === 'NotFound') {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
                { status: 404 }
            )
        }
        console.error('[Order Detail Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Order operation failed' } },
            { status: 500 }
        )
    }
})
