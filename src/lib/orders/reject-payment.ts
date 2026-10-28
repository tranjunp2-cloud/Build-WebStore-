import crypto from 'crypto'
import { getPayload, type User } from 'payload'
import config from '@payload-config'
import { signOrderToken } from '@/lib/auth/order-token'
import { paymentRejectedEmail } from '@/lib/email/templates/payment-rejected'
import type { z } from 'zod'
import type { rejectPaymentSchema } from '@/lib/validations/orders'
import { type ActionResult, respond } from './action-result'

export type PaymentRejection = z.infer<typeof rejectPaymentSchema>

/**
 * A seller rejects a bank-transfer payment proof, as `user` (access-controlled read). The one
 * implementation of PATCH /api/orders/[id]/reject-payment and of the copilot. Needs paymentMethod
 * 'bank_transfer' and paymentStatus 'pending_verification'. Rotates magicLinkSecret so old upload
 * links stop working, and emails the buyer a new upload link with the reason.
 */
export async function rejectPaymentAs(user: User, id: string, data: PaymentRejection): Promise<ActionResult> {
    const payload = await getPayload({ config })

    const order = await payload.findByID({
        collection: 'orders',
        id,
        depth: 2,
        user,
        overrideAccess: false,
    })

    if (!order) {
        return respond(
            { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
            { status: 404 }
        )
    }

    if (order.paymentMethod !== 'bank_transfer' || order.paymentStatus !== 'pending_verification') {
        return respond(
            { success: false, error: { code: 'INVALID_STATE', message: 'Order is not awaiting payment verification' } },
            { status: 422 }
        )
    }

    const newSecret = crypto.randomBytes(32).toString('hex')
    const newExpires = new Date(Date.now() + 24 * 3600 * 1000)

    await payload.update({
        collection: 'orders',
        id,
        data: {
            paymentStatus: 'awaiting_payment',
            paymentRejectionReason: data.reason as any,
            paymentRejectionDetail: data.detail ?? null,
            magicLinkSecret: newSecret,
            paymentExpiresAt: newExpires.toISOString(),
        },
        overrideAccess: true,
    })

    const token = await signOrderToken({
        orderId: id,
        secret: newSecret,
        expSec: Math.floor(newExpires.getTime() / 1000),
    })

    // Slug lives on the tenant, not the site — sites collection has no slug field
    const siteObj = typeof order.site === 'object' ? (order.site as any) : null
    const tenantObj = siteObj?.tenant && typeof siteObj.tenant === 'object' ? siteObj.tenant : null
    const siteSlug = tenantObj?.slug ?? ''
    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? ''
    const magicLinkUrl = `${baseUrl}/api/orders/${order.id}/confirm-redirect?slug=${siteSlug}&token=${token}`
    const plainUploadUrl = magicLinkUrl

    const emailPayload = paymentRejectedEmail({
        orderNumber: order.orderNumber as string,
        customerName: order.customerName as string,
        rejectionReason: data.reason,
        rejectionDetail: data.detail,
        magicLinkUrl,
        plainUploadUrl,
        expiresAtIso: newExpires.toISOString(),
    })

    payload.sendEmail({
        to: order.customerEmail as string,
        subject: emailPayload.subject,
        html: emailPayload.html,
    }).catch(console.error)

    return respond({ success: true })
}
