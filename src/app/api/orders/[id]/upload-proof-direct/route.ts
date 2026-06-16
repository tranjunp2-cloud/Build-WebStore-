import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { notifyTenantOwners } from '@/lib/notifications/notify-tenant-owners'
import { verifyUploadToken } from '@/lib/orders/upload-token'
import { PROOF_ACCEPTED_TYPES, PROOF_MAX_SIZE_BYTES } from '@/lib/storefront/checkout'

const UPLOADABLE_STATUSES = new Set(['awaiting_payment', 'pending_verification'])

// Token-free upload endpoint for the confirm page.
// Accepts multipart/form-data with a 'file' field; creates the Media record
// server-side (overrideAccess: true) so unauthenticated customers can upload.
// Security: order must be in an uploadable state and not expired.
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params
    const orderId = isNaN(Number(id)) ? id : Number(id)

    let file: File | null = null
    let token = ''
    try {
        const form = await req.formData()
        const raw = form.get('file')
        if (raw instanceof File) file = raw
        token = String(form.get('token') ?? '')
    } catch {
        return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }

    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })
    if (!verifyUploadToken(token, orderId)) {
        return NextResponse.json({ error: 'Invalid or expired upload token' }, { status: 403 })
    }
    if (!PROOF_ACCEPTED_TYPES.includes(file.type)) {
        return NextResponse.json({ error: 'Invalid file type. Upload a JPEG, PNG, or PDF.' }, { status: 422 })
    }
    if (file.size > PROOF_MAX_SIZE_BYTES) {
        return NextResponse.json({ error: 'File too large. Maximum size is 5 MB.' }, { status: 422 })
    }

    const payload = await getPayload({ config })

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

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    if (!UPLOADABLE_STATUSES.has(order.paymentStatus)) {
        return NextResponse.json(
            { error: `Cannot upload proof for order with status: ${order.paymentStatus}` },
            { status: 422 },
        )
    }

    if (order.paymentExpiresAt && new Date(order.paymentExpiresAt) < new Date()) {
        return NextResponse.json({ error: 'expired' }, { status: 422 })
    }

    // Upload media server-side — overrideAccess so no user session required
    let mediaId: number | string
    try {
        const buffer = Buffer.from(await file.arrayBuffer())
        const mediaDoc = await payload.create({
            collection: 'media',
            data: { alt: `Payment proof — order ${order.orderNumber}` },
            file: { data: buffer, name: file.name, mimetype: file.type, size: file.size },
            overrideAccess: true,
        })
        mediaId = mediaDoc.id
    } catch {
        return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
    }

    try {
        await payload.update({
            collection: 'orders',
            id: order.id,
            data: {
                paymentProofImage: mediaId,
                paymentStatus: 'pending_verification',
                paymentRejectionReason: null,
                paymentRejectionDetail: null,
            },
            overrideAccess: true,
        })
    } catch {
        // Clean up orphaned media doc before returning error
        payload.delete({ collection: 'media', id: mediaId, overrideAccess: true }).catch(() => {})
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
        dedupeKey: `PROOF_UPLOADED:${order.orderNumber}`,
    }).catch((err) => console.error('[upload-proof-direct] notify failed', err))

    return NextResponse.json({ success: true })
}
