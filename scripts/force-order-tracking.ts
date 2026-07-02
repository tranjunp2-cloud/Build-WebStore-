/**
 * DEV-ONLY test helper — force an order through EasyParcel tracking milestones
 * (Picked Up → In Transit → Out for Delivery → Delivered) so the order-detail
 * tracking timeline can be exercised locally WITHOUT a real EP shipment.
 *
 * Mirrors exactly what src/lib/jobs/sync-tracking.ts writes:
 *   shippingTrackingStatus (internal enum), shippingTrackingLastUpdated,
 *   shippingTrackingHistory[] = { status: internal, description: buyerLabel, eventTime }
 *
 * Usage:
 *   npx tsx --require ./scripts/seed-preload.cjs scripts/force-order-tracking.ts [orderId] [finalStatus]
 *     orderId      — numeric order id (default 116)
 *     finalStatus  — order.status to set: 'shipped' (default) | 'completed'
 *
 * NOTE: the sync cron does NOT auto-complete orders on delivery, so by default this
 * leaves order.status = 'shipped' (tracking shows Delivered while status stays shipped).
 * Pass 'completed' to also mark the order completed.
 */
import { getPayload } from 'payload'
import configPromise from '../src/payload.config'

const orderId = Number(process.argv[2] ?? 116)
const finalStatus = (process.argv[3] as 'shipped' | 'completed') ?? 'shipped'

// internal enum + buyer-facing label (matches src/lib/shipping/easyparcel/status-map.ts)
const MILESTONES: Array<{ status: string; description: string; hoursAgo: number }> = [
    { status: 'order_created',     description: 'Order Created',     hoursAgo: 52 },
    { status: 'pending_pickup',    description: 'Waiting for Pickup', hoursAgo: 50 },
    { status: 'picked_up',         description: 'Parcel Picked Up',   hoursAgo: 44 },
    { status: 'in_transit',        description: 'In Transit',         hoursAgo: 20 },
    { status: 'out_for_delivery',  description: 'Out for Delivery',   hoursAgo: 6 },
    { status: 'delivered',         description: 'Delivered',          hoursAgo: 1 },
]

async function main() {
    const payload = await getPayload({ config: configPromise })

    const order = await payload.findByID({ collection: 'orders', id: orderId, depth: 0, overrideAccess: true }).catch(() => null)
    if (!order) {
        console.error(`Order ${orderId} not found`)
        process.exit(1)
    }

    const now = Date.now()
    const history = MILESTONES.map((m) => ({
        status: m.status,
        description: m.description,
        eventTime: new Date(now - m.hoursAgo * 3600_000).toISOString(),
    }))

    await payload.update({
        collection: 'orders',
        id: orderId,
        data: {
            status: finalStatus,
            shippingTrackingStatus: 'delivered',
            shippingTrackingLastUpdated: new Date().toISOString(),
            shippingTrackingHistory: history,
        } as Record<string, unknown>,
        overrideAccess: true,
    })

    console.log(`✅ Order ${orderId}: status='${finalStatus}', tracking='delivered', ${history.length} timeline events written.`)
    console.log(`   Open /orders/${orderId} to see the timeline.`)
    process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
