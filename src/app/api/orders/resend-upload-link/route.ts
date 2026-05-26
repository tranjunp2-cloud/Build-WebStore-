import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { generateUploadToken } from '@/lib/orders/upload-token'
import { resendUploadLinkEmail } from '@/lib/email/templates/resend-upload-link'

/** Minimal shape of a bank-transfer order document for resend-upload-link flow. */
interface BtOrderDoc {
    id: string | number
    orderNumber: string
    customerEmail: string
    customerName?: string | null
    paymentMethod: string
    paymentStatus: string
    status: string
    tenant?: string | number | { id: string | number }
    site?: string | number | { id: string | number; locale?: string }
}

/** Minimal shape of a tenant document for resend-upload-link flow. */
interface TenantDoc {
    id: string | number
    name?: string | null
}

const RESENDABLE_STATUSES = new Set(['awaiting_payment', 'pending_verification'])
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'

/**
 * POST /api/orders/resend-upload-link
 *
 * Sends a new upload-proof link to the buyer's email.
 * Always returns { success: true } to avoid user enumeration.
 * Body: { orderNumber: string, email: string }
 */
export async function POST(req: Request) {
    let body: { orderNumber?: unknown; email?: unknown }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ success: true }) // non-fatal
    }

    const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!orderNumber || !email) {
        return NextResponse.json({ success: true })
    }
    // Reject obviously invalid orderNumber early (anti-DoS, anti-enumeration)
    if (orderNumber.length > 50 || !/^ORD-/.test(orderNumber)) {
        return NextResponse.json({ success: true })
    }

    try {
        const payload = await getPayload({ config })

        const result = await payload.find({
            collection: 'orders',
            where: { orderNumber: { equals: orderNumber } },
            limit: 1,
            overrideAccess: true,
            depth: 1,
        })
        const order = result.docs[0] as unknown as BtOrderDoc | undefined
        if (!order) return NextResponse.json({ success: true })

        // Validate email matches and order is BT pending
        if ((order.customerEmail ?? '').toLowerCase() !== email) return NextResponse.json({ success: true })
        if (order.paymentMethod !== 'bank_transfer') return NextResponse.json({ success: true })
        const TERMINAL_ORDER_STATUSES = new Set(['completed', 'cancelled', 'refunded', 'shipped'])
        if (TERMINAL_ORDER_STATUSES.has(order.status ?? '')) return NextResponse.json({ success: true })
        if (!RESENDABLE_STATUSES.has(order.paymentStatus ?? '')) return NextResponse.json({ success: true })

        // Generate fresh upload token (24h) for the resume route
        const uploadToken = generateUploadToken(order.id)
        const resumeUrl = `${BASE_URL}/api/orders/${order.id}/resume?ut=${encodeURIComponent(uploadToken)}`

        // Resolve shop slug for email context
        const tenantId = typeof order.tenant === 'object' ? (order.tenant as { id: string | number }).id : order.tenant
        const tenantDoc = tenantId
            ? await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true }).catch(() => null)
            : null
        const tenantTyped = tenantDoc as unknown as TenantDoc | null
        const shopName = tenantTyped?.name ?? ''
        const siteLocale = typeof order.site === 'object' ? ((order.site as { locale?: string })?.locale ?? 'ms') : 'ms'

        const emailData = resendUploadLinkEmail({
            shopName,
            orderNumber,
            customerName: order.customerName ?? '',
            resumeUrl,
            locale: siteLocale,
        })

        await payload.sendEmail({
            to: order.customerEmail,
            subject: emailData.subject,
            html: emailData.html,
        }).catch((err: unknown) => payload.logger.error({ err, orderNumber }, '[resend-upload-link] email failed'))

    } catch (err) {
        // Swallow errors — always return success to avoid enumeration
        console.error('[resend-upload-link]', err)
    }

    return NextResponse.json({ success: true })
}
