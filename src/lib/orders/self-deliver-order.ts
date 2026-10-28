import { getPayload, type User } from 'payload'
import config from '@payload-config'
import { type ActionResult, respond } from './action-result'

const SHIPPABLE_STATUSES = new Set(['confirmed', 'ready_to_ship'])

/**
 * Marks an order as self-delivered (no EasyParcel label): saves the courier and tracking number and
 * flips the status to 'shipped', as `user` (access-controlled read). The one implementation of
 * POST /api/orders/[id]/self-deliver and of the copilot's ship step. The order must be confirmed or
 * ready to ship and must not have an EasyParcel label.
 */
export async function selfDeliverOrderAs(user: User, id: string, courier: string, trackingNumber: string): Promise<ActionResult> {
    const orderId = Number.isFinite(Number(id)) ? Number(id) : id
    const payload = await getPayload({ config })

    const order = await payload.findByID({
        collection: 'orders',
        id: orderId,
        user,
        overrideAccess: false,
    })

    if (!order) {
        return respond(
            { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
            { status: 404 },
        )
    }

    const currentStatus = order.status as string

    if (!SHIPPABLE_STATUSES.has(currentStatus)) {
        return respond(
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

    // F4: never let self-deliver clobber a purchased EasyParcel shipment — if the order
    // already has an EP shipment/AWB number, the EP wallet has already been charged and a
    // label bought. Overwriting with self-delivery would orphan that paid shipment.
    if ((order as any).easyParcelOrderNo || (order as any).awbNo) {
        return respond(
            {
                success: false,
                error: { code: 'EP_LABEL_EXISTS', message: 'This order already has an EasyParcel label — self-delivery is not allowed' },
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

    return respond({
        success: true,
        data: {
            status: 'shipped',
            selfDeliveryCourier: courier,
            trackingNumber,
            shippingTrackingStatus: 'pending_pickup',
        },
    })
}
