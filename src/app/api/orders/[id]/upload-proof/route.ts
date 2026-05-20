import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { verifyOrderToken } from '@/lib/auth/order-token'
import { notifyTenantOwners } from '@/lib/notifications/notify-tenant-owners'

const UPLOADABLE_STATUSES = new Set(['awaiting_payment', 'pending_verification'])

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params

    let body: { token?: unknown; paymentProofImage?: unknown }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { token, paymentProofImage } = body

    if (!token || !paymentProofImage) {
        return NextResponse.json({ error: 'token and paymentProofImage are required' }, { status: 400 })
    }

    const proofId = Number(paymentProofImage)
    if (!Number.isInteger(proofId) || proofId <= 0) {
        return NextResponse.json({ error: 'paymentProofImage must be a positive integer' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    const orderId = isNaN(Number(id)) ? id : Number(id)
    let order: any = null
    try {
        const result = await payload.find({
            collection: 'orders',
            where: { id: { equals: orderId } },
            limit: 1,
            overrideAccess: true,
            depth: 0,
        })
        order = result.docs[0] ?? null
    } catch {
        return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
    }

    if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const v = await verifyOrderToken({
        token: String(token),
        secret: order.magicLinkSecret ?? '',
    })

    if (!v.ok) {
        return NextResponse.json({ error: v.error }, { status: 401 })
    }

    if (String(v.orderId) !== String(orderId)) {
        return NextResponse.json({ error: 'invalid' }, { status: 401 })
    }

    if (!UPLOADABLE_STATUSES.has(order.paymentStatus)) {
        return NextResponse.json(
            { error: `Cannot upload proof for order with status: ${order.paymentStatus}` },
            { status: 422 },
        )
    }

    if (order.paymentExpiresAt && new Date(order.paymentExpiresAt) < new Date()) {
        return NextResponse.json({ error: 'expired' }, { status: 422 })
    }

    try {
        await payload.update({
            collection: 'orders',
            id: order.id,
            data: {
                paymentProofImage: proofId,
                paymentStatus: 'pending_verification',
                paymentRejectionReason: null,
                paymentRejectionDetail: null,
            },
            overrideAccess: true,
        })
    } catch {
        return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
    }

    const tenantId = typeof order.tenant === 'object' ? order.tenant.id : order.tenant
    notifyTenantOwners(payload, tenantId, {
        type: 'ORDER_NEW',
        title: `Payment Proof Uploaded — Order #${order.orderNumber}`,
        message: `${order.customerName} submitted payment proof for order #${order.orderNumber}`,
        actionUrl: '/orders',
        metadata: {
            orderNumber: order.orderNumber,
            currency: order.currency ?? 'MYR',
            total: String(order.total ?? 0),
            customerName: order.customerName,
        },
    }).catch((err) => console.error('[upload-proof] notify failed', err))

    return NextResponse.json({ success: true, data: { paymentStatus: 'pending_verification' } })
}
