import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import crypto from 'crypto'
import { withAuth } from '@/lib/auth'
import { parseRequest } from '@/lib/validations/helpers'
import { rejectPaymentSchema } from '@/lib/validations/orders'
import { signOrderToken } from '@/lib/auth/order-token'
import { paymentRejectedEmail } from '@/lib/email/templates/payment-rejected'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/orders/[id]/reject-payment
 * Seller rejects a bank-transfer payment proof.
 * Guards: paymentMethod==='bank_transfer' + paymentStatus==='pending_verification'
 * Rotates magicLinkSecret so old upload links are invalidated.
 */
export const PATCH = withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const { id } = await ctx.params

        const { data, errorResponse } = await parseRequest(request, rejectPaymentSchema)
        if (errorResponse) return errorResponse

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

        if (order.paymentMethod !== 'bank_transfer' || order.paymentStatus !== 'pending_verification') {
            return NextResponse.json(
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
                paymentRejectionReason: data!.reason as any,
                paymentRejectionDetail: data!.detail ?? null,
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
        const magicLinkUrl = `${baseUrl}/sites/${siteSlug}/orders/${order.orderNumber}?token=${token}`
        const plainUploadUrl = `${baseUrl}/sites/${siteSlug}/orders/${order.orderNumber}`

        const emailPayload = paymentRejectedEmail({
            orderNumber: order.orderNumber as string,
            customerName: order.customerName as string,
            rejectionReason: data!.reason,
            rejectionDetail: data!.detail,
            magicLinkUrl,
            plainUploadUrl,
            expiresAtIso: newExpires.toISOString(),
        })

        payload.sendEmail({
            to: order.customerEmail as string,
            subject: emailPayload.subject,
            html: emailPayload.html,
        }).catch(console.error)

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('[reject-payment] error', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Rejection failed' } },
            { status: 500 }
        )
    }
})
