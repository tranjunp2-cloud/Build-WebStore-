import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { verifyOrderToken } from '@/lib/auth/order-token'
import { notifyTenantOwners } from '@/lib/notifications/notify-tenant-owners'
import { runAfterResponse } from '@/lib/runtime/run-after-response'
import { paymentProofAlt } from '@/lib/orders/proof-filename'
import { orderActionUrl } from '@/lib/notifications/order-action-url'

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

    // Only a receipt uploaded for THIS order may be attached (TC-PERF-166): the private media the confirm page upload
    // (upload-proof-direct) created under the order's shop with this order's receipt alt, and not already attached to
    // another order. Anything else — the shop's logo or a product picture, another shop's file, another buyer's
    // receipt — is refused, and no media is ever turned private here (it would break storefront pictures).
    const orderTenant = typeof order.tenant === 'object' ? order.tenant?.id : order.tenant
    const proof = await payload
        .findByID({
            collection: 'media',
            id: proofId,
            depth: 0,
            overrideAccess: true,
            disableErrors: true,
            select: { tenant: true, private: true, alt: true },
        } as Parameters<typeof payload.findByID>[0])
        .catch(() => null) as { tenant?: unknown; private?: unknown; alt?: unknown } | null
    const proofTenant = proof && typeof proof.tenant === 'object' && proof.tenant !== null
        ? (proof.tenant as { id?: unknown }).id
        : proof?.tenant
    const isThisOrdersReceipt = !!proof
        && proof.private === true
        && orderTenant != null
        && String(proofTenant) === String(orderTenant)
        && proof.alt === paymentProofAlt(order.orderNumber)
    if (!isThisOrdersReceipt) {
        return NextResponse.json({ error: 'paymentProofImage not found' }, { status: 400 })
    }
    let attachedElsewhere = true
    try {
        const others = await payload.find({
            collection: 'orders',
            where: { and: [{ paymentProofImage: { equals: proofId } }, { id: { not_equals: order.id } }] },
            limit: 1,
            depth: 0,
            overrideAccess: true,
        })
        attachedElsewhere = others.docs.length > 0
    } catch {
        return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
    }
    if (attachedElsewhere) {
        return NextResponse.json({ error: 'paymentProofImage not found' }, { status: 400 })
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
    runAfterResponse('upload-proof notify', async () => {
        await notifyTenantOwners(payload, tenantId, {
            type: 'ORDER_NEW',
            title: `Payment Proof Uploaded — Order #${order.orderNumber}`,
            message: `${order.customerName} submitted payment proof for order #${order.orderNumber}`,
            actionUrl: orderActionUrl(order.id),
            metadata: {
                orderNumber: order.orderNumber,
                currency: order.currency ?? 'MYR',
                total: String(order.total ?? 0),
                customerName: order.customerName,
            },
            dedupeKey: `PROOF_UPLOADED:${order.orderNumber}`,
        })
    })

    return NextResponse.json({ success: true, data: { paymentStatus: 'pending_verification' } })
}
