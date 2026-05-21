import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { parseRequest } from '@/lib/validations/helpers'
import { orderStatusUpdateSchema } from '@/lib/validations/orders'
import { ORDER_STATUS_TRANSITIONS } from '@/collections/Orders'
import { orderStatusEmail } from '@/lib/email/templates/order-status'

// Map order workflow statuses to email template statuses
const STATUS_EMAIL_MAP: Record<string, 'processing' | 'shipped' | 'cancelled'> = {
    confirmed: 'processing',
    shipped: 'shipped',
    cancelled: 'cancelled',
}

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/orders/[id]
 *
 * Update order status with workflow validation.
 * Only allows transitions defined in ORDER_STATUS_TRANSITIONS.
 */
export const PATCH = withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const { id } = await ctx.params
        const { data, errorResponse } = await parseRequest(request, orderStatusUpdateSchema)
        if (errorResponse) return errorResponse

        const { status: newStatus, trackingNumber, notes } = data!

        const payload = await getPayload({ config })

        // Get current order (access-controlled by collection)
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

        // Validate status transition
        const currentStatus = order.status as string
        const allowedTransitions = ORDER_STATUS_TRANSITIONS[currentStatus] || []
        if (!allowedTransitions.includes(newStatus)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_TRANSITION',
                        message: `Cannot transition from "${currentStatus}" to "${newStatus}". Allowed: ${allowedTransitions.join(', ') || 'none'}`,
                    },
                },
                { status: 422 }
            )
        }

        // Tracking number required when transitioning to shipped
        if (newStatus === 'shipped' && !trackingNumber) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'Tracking number is required when shipping' } },
                { status: 422 }
            )
        }

        // Build update data
        const updateData: any = { status: newStatus }
        if (trackingNumber) updateData.trackingNumber = trackingNumber
        if (notes) updateData.notes = notes



        const updated = await payload.update({
            collection: 'orders',
            id,
            data: updateData,
            user,
            overrideAccess: false,
        })

        // Fire-and-forget status update email — isolated so a crash here never fails the update response
        try {
            const emailStatus = STATUS_EMAIL_MAP[newStatus]
            if (emailStatus && order.customerEmail) {
                const emailPayload = orderStatusEmail({
                    customerName: order.customerName as string,
                    orderNumber: order.orderNumber as string,
                    status: emailStatus,
                    trackingNumber: trackingNumber ?? (order.trackingNumber as string | undefined),
                })
                payload.sendEmail({
                    to: order.customerEmail as string,
                    subject: emailPayload.subject,
                    html: emailPayload.html,
                }).catch((err) => payload.logger.error({ err, orderId: id, status: newStatus }, '[order-update] sendEmail failed'))
            }
        } catch (emailErr) {
            payload.logger.error({ emailErr, orderId: id, status: newStatus }, '[order-update] email construction failed')
        }

        return NextResponse.json({
            success: true,
            data: updated,
        })
    } catch (error: any) {
        if (error?.status === 404 || error?.name === 'NotFound') {
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
})

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
    } catch (error: any) {
        if (error?.status === 404 || error?.name === 'NotFound') {
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
