import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { parseRequest } from '@/lib/validations/helpers'
import { orderCancelSchema } from '@/lib/validations/orders'
import { ORDER_STATUS_TRANSITIONS } from '@/collections/Orders'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/orders/[id]/cancel
 *
 * Cancel an order with a required reason.
 * Auto-restocks inventory for each item in the order.
 */
export const POST = withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const { id } = await ctx.params
        const { data, errorResponse } = await parseRequest(request, orderCancelSchema)
        if (errorResponse) return errorResponse

        const { reason } = data!
        const payload = await getPayload({ config })

        // Get current order
        const order = await payload.findByID({
            collection: 'orders',
            id,
            user,
            overrideAccess: false,
        })

        if (!order) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
                { status: 404 }
            )
        }

        // Validate that cancellation is allowed
        const currentStatus = order.status as string
        const allowed = ORDER_STATUS_TRANSITIONS[currentStatus] || []
        if (!allowed.includes('cancelled')) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_TRANSITION',
                        message: `Cannot cancel order in "${currentStatus}" status. Cancellation is only allowed for: ${Object.entries(ORDER_STATUS_TRANSITIONS)
                            .filter(([, v]) => v.includes('cancelled'))
                            .map(([k]) => k)
                            .join(', ')}`,
                    },
                },
                { status: 422 }
            )
        }

        // Cancel the order
        const updated = await payload.update({
            collection: 'orders',
            id,
            data: {
                status: 'cancelled',
                cancelReason: reason,
            } as any,
            user,
            overrideAccess: false,
        })

        // Auto-restock inventory
        const restockResults: Array<{ productId: string; restocked: number; skipped?: boolean }> = []
        const items = (order as any).items || []

        for (const item of items) {
            const productId = typeof item.product === 'object' ? item.product?.id : item.product
            if (!productId) {
                restockResults.push({ productId: 'unknown', restocked: 0, skipped: true })
                continue
            }

            try {
                const product = await payload.findByID({
                    collection: 'products',
                    id: productId,
                    depth: 0,
                })

                if (!product) {
                    // Product deleted — skip safely (per AC-2 of US-F10-03)
                    restockResults.push({ productId, restocked: item.quantity, skipped: true })
                    continue
                }

                const currentStock = (product as any).stock || 0
                await payload.update({
                    collection: 'products',
                    id: productId,
                    data: { stock: currentStock + item.quantity } as any,
                })

                restockResults.push({ productId, restocked: item.quantity })
            } catch (err) {
                // If product was deleted between check and update, skip
                console.warn(`[Restock] Failed for product ${productId}:`, err)
                restockResults.push({ productId, restocked: 0, skipped: true })
            }
        }

        // TODO: Send cancellation email to customer

        return NextResponse.json({
            success: true,
            data: updated,
            restock: restockResults,
        })
    } catch (error: any) {
        console.error('[Order Cancel Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } },
            { status: 500 }
        )
    }
})
