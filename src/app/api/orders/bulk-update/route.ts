import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { parseRequest } from '@/lib/validations/helpers'
import { orderBulkUpdateSchema } from '@/lib/validations/orders'
import { ORDER_STATUS_TRANSITIONS } from '@/collections/Orders'

/**
 * POST /api/orders/bulk-update
 *
 * Bulk update order statuses (e.g., confirm multiple pending orders at once).
 * Only processes orders that have valid transitions.
 */
export const POST = withAuth(async (user, request) => {
    try {
        const { data, errorResponse } = await parseRequest(request, orderBulkUpdateSchema)
        if (errorResponse) return errorResponse

        const { orderIds, status: newStatus } = data!
        const payload = await getPayload({ config })

        const results: Array<{
            orderId: string
            success: boolean
            orderNumber?: string
            error?: string
        }> = []

        for (const orderId of orderIds) {
            try {
                const order = await payload.findByID({
                    collection: 'orders',
                    id: orderId,
                    user,
                    overrideAccess: false,
                })

                if (!order) {
                    results.push({ orderId, success: false, error: 'Not found' })
                    continue
                }

                const currentStatus = order.status as string
                const allowed = ORDER_STATUS_TRANSITIONS[currentStatus] || []

                if (!allowed.includes(newStatus)) {
                    results.push({
                        orderId,
                        success: false,
                        orderNumber: order.orderNumber,
                        error: `Cannot transition from "${currentStatus}" to "${newStatus}"`,
                    })
                    continue
                }

                await payload.update({
                    collection: 'orders',
                    id: orderId,
                    data: { status: newStatus } as any,
                    user,
                    overrideAccess: false,
                })

                results.push({
                    orderId,
                    success: true,
                    orderNumber: order.orderNumber,
                })
            } catch (err: any) {
                results.push({ orderId, success: false, error: err.message })
            }
        }

        const succeeded = results.filter(r => r.success).length
        const failed = results.filter(r => !r.success).length

        return NextResponse.json({
            success: true,
            data: {
                total: orderIds.length,
                succeeded,
                failed,
                results,
            },
        })
    } catch (error: any) {
        console.error('[Bulk Update Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } },
            { status: 500 }
        )
    }
})
