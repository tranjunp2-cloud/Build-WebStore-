import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'
import { parseRequest } from '@/lib/validations/helpers'
import { orderCancelSchema } from '@/lib/validations/orders'
import { cancelOrderAs } from '@/lib/orders/cancel-order'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/orders/[id]/cancel
 *
 * Cancel an order with a required reason.
 * Auto-restocks inventory for each item in the order.
 * The cancel itself (refund of a paid order, stock, discount slot, emails) is lib/orders/cancel-order.ts,
 * shared with the AI copilot.
 */
export const POST = withFeatureGuard('order_management')(withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const { id } = await ctx.params
        const { data, errorResponse } = await parseRequest(request, orderCancelSchema)
        if (errorResponse) return errorResponse

        const result = await cancelOrderAs(user, id, data!.reason)
        return NextResponse.json(result.body, { status: result.status })
    } catch (error: any) {
        console.error('[Order Cancel Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Order cancellation failed' } },
            { status: 500 }
        )
    }
}))
