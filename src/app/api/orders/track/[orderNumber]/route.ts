import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'

// Map internal tracking enum → buyer-facing label
// (we store internal enum in shippingTrackingStatus, not raw EP string)
const INTERNAL_TO_LABEL: Record<string, string> = {
    order_created: 'Order Created',
    pending_pickup: 'Waiting for Pickup',
    picked_up: 'Parcel Picked Up',
    in_transit: 'In Transit',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    failed_delivery: 'Delivery Attempted',
    returned_to_sender: 'Returned to Sender',
    lost: 'Parcel Lost',
    cancelled: 'Shipment Cancelled',
    exception: 'Delivery Exception',
    processing: 'Processing',
    unknown: 'Processing',
}

const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'refunded', 'payment_failed'])

export async function GET(
    request: Request,
    { params }: { params: Promise<{ orderNumber: string }> },
) {
    const { orderNumber } = await params
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug) {
        return NextResponse.json({ error: 'missing_slug' }, { status: 400 })
    }

    try {
        const payload = await getPayload({ config })

        const tenantResult = await payload.find({
            collection: 'tenants',
            where: { slug: { equals: slug } },
            limit: 1,
            overrideAccess: true,
            depth: 0,
        })
        const tenant = tenantResult.docs[0] as any
        if (!tenant) return NextResponse.json({ error: 'not_found' }, { status: 404 })

        const trackSub = await getActivePlanSubscription(payload, tenant.id)
        if (trackSub && !await canUse(payload, trackSub.plan as PlanCode, 'allowing_buyer_tracking_order')) {
            return NextResponse.json({ error: 'Order tracking is currently unavailable' }, { status: 403 })
        }

        const siteResult = await payload.find({
            collection: 'sites',
            where: { tenant: { equals: tenant.id } },
            limit: 1,
            overrideAccess: true,
            depth: 0,
        })
        const site = siteResult.docs[0] as any
        if (!site) return NextResponse.json({ error: 'not_found' }, { status: 404 })

        const where: Where = {
            orderNumber: { equals: orderNumber },
            site: { equals: site.id },
        }

        const result = await payload.find({
            collection: 'orders',
            where,
            limit: 1,
            overrideAccess: true,
            depth: 0,
        })

        const order = result.docs[0] as any
        if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 })

        const trackingStatus: string | undefined = (order as any).shippingTrackingStatus

        return NextResponse.json({
            status: order.status,
            paymentStatus: order.paymentStatus,
            trackingNumber: order.trackingNumber ?? null,
            terminal: TERMINAL_STATUSES.has(order.status),
            // EP shipping fields — buyer-safe only (no labelUrl, easyParcelOrderNo, apiKey, authKey)
            awbNo: (order as any).awbNo ?? null,
            shippingCourier: (order as any).shippingCourier ?? null,
            shippingTrackingBuyerLabel: trackingStatus
                ? (INTERNAL_TO_LABEL[trackingStatus] ?? 'Processing')
                : null,
            shippingTrackingHistory: ((order as any).shippingTrackingHistory ?? []).map((h: any) => ({
                description: h.description ?? '',
                eventTime: h.eventTime ?? '',
            })),
        })
    } catch {
        return NextResponse.json({ error: 'server_error' }, { status: 500 })
    }
}
