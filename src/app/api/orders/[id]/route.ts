import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { parseRequest } from '@/lib/validations/helpers'
import { orderStatusUpdateSchema } from '@/lib/validations/orders'
import { ORDER_STATUS_TRANSITIONS } from '@/collections/Orders'
import { orderStatusEmail } from '@/lib/email/templates/order-status'

// Statuses that trigger a buyer notification email
const BUYER_EMAIL_STATUSES = new Set(['confirmed', 'shipped', 'completed', 'cancelled', 'refunded'])

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

        // Send buyer notification for relevant status changes
        if (BUYER_EMAIL_STATUSES.has(newStatus) && (order as any).customerEmail) {
            try {
                const statusEmailData = orderStatusEmail({
                    customerName: (order as any).customerName ?? '',
                    orderNumber: (order as any).orderNumber ?? id,
                    status: newStatus as any,
                    trackingNumber: trackingNumber ?? (order as any).trackingNumber ?? undefined,
                })
                payload.sendEmail({ to: (order as any).customerEmail, subject: statusEmailData.subject, html: statusEmailData.html })
                    .catch((err: unknown) => console.error('[Email status notify]', err))
            } catch (err) {
                console.error('[Email status build]', err)
            }
        }

        return NextResponse.json({
            success: true,
            data: updated,
        })
    } catch (error: any) {
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
        console.error('[Order Detail Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Order operation failed' } },
            { status: 500 }
        )
    }
})
