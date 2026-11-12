import { getPayload, type User } from 'payload'
import config from '@payload-config'
import { ORDER_STATUS_TRANSITIONS } from '@/collections/Orders'
import type { z } from 'zod'
import type { orderStatusUpdateSchema } from '@/lib/validations/orders'
import { type ActionResult, respond } from './action-result'
import { sendStatusEmail } from './update-order-status-email'

export type OrderStatusUpdate = z.infer<typeof orderStatusUpdateSchema>

/**
 * Moves an order to a new status along ORDER_STATUS_TRANSITIONS, as `user` (access-controlled). The one
 * implementation of PATCH /api/orders/[id] and of the copilot's confirm / complete steps. Shipping needs a
 * tracking number. Sends the buyer's confirmed / completed / cancelled email. It does NOT move money, put
 * stock back or release a discount: cancelling and refunding go through cancel-order.ts / refund-order.ts.
 */
export async function updateOrderStatusAs(user: User, id: string, update: OrderStatusUpdate): Promise<ActionResult> {
    const { status: newStatus, trackingNumber, notes } = update
    const payload = await getPayload({ config })

    // Get current order (access-controlled by collection)
    const order = await payload.findByID({
        collection: 'orders',
        id,
        user,
        overrideAccess: false,
    })

    if (!order) {
        return respond(
            { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
            { status: 404 }
        )
    }

    // Validate status transition
    const currentStatus = order.status as string
    const allowedTransitions = ORDER_STATUS_TRANSITIONS[currentStatus] || []
    if (!allowedTransitions.includes(newStatus)) {
        return respond(
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
        return respond(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Tracking number is required when shipping' } },
            { status: 422 }
        )
    }

    // Build update data
    // Payload update data type is overly strict; cast required until generated types exist
    const updateData: Record<string, unknown> = { status: newStatus }
    if (trackingNumber) updateData.trackingNumber = trackingNumber
    if (notes) updateData.notes = notes
    if (newStatus === 'cancelled' && notes) updateData.cancelReason = notes

    // GH-1734: Self-delivery has no courier webhook to close the lifecycle.
    // Keep the visible event buyer-safe while retaining structured audit metadata.
    const isSelfDeliveryCompletion =
        currentStatus === 'shipped'
        && newStatus === 'completed'
        && Boolean((order as any).selfDeliveryCourier)
    if (isSelfDeliveryCompletion) {
        const actor = user as { id?: string | number; email?: string | null; name?: string | null }
        const eventTime = new Date().toISOString()
        const currentHistory = Array.isArray((order as any).shippingTrackingHistory)
            ? (order as any).shippingTrackingHistory
            : []

        updateData.shippingTrackingStatus = 'delivered'
        updateData.shippingTrackingHistory = [
            ...currentHistory,
            {
                status: 'delivered',
                description: 'Order marked as completed',
                eventTime,
                source: 'cms_manual',
                actorId: actor.id != null ? String(actor.id) : null,
                actorLabel: actor.email ?? actor.name ?? 'Authenticated merchant',
                previousStatus: currentStatus,
                nextStatus: newStatus,
            },
        ]
    }

    const updated = await payload.update({
        collection: 'orders',
        id,
        data: updateData,
        user,
        overrideAccess: false,
    })

    await sendStatusEmail(payload, order, id, newStatus, notes)

    return respond({
        success: true,
        data: updated,
    })
}
