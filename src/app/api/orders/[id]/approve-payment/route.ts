import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { paymentConfirmedEmail } from '@/lib/email/templates/payment-confirmed'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/orders/[id]/approve-payment
 * Seller approves a bank-transfer payment proof.
 * Guards: paymentMethod==='bank_transfer' + paymentStatus==='pending_verification'
 */
export const PATCH = withAuth<RouteContext>(async (user, _request, ctx) => {
    try {
        const { id } = await ctx.params
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

        const now = new Date()
        const newStatus = order.status === 'pending' ? 'confirmed' : order.status

        const updated = await payload.update({
            collection: 'orders',
            id,
            data: {
                paymentStatus: 'paid',
                paymentVerifiedAt: now.toISOString(),
                paymentVerifiedBy: user.id as any,
                verificationSource: 'manual',
                status: newStatus as any,
            },
            user,
            overrideAccess: false,
        })

        // Decrement inventory per item — per-item try/catch, non-blocking
        const items = (order.items as any[]) ?? []
        for (const item of items) {
            try {
                const productId = typeof item.product === 'object' ? item.product?.id : item.product
                if (!productId) continue
                const product = await payload.findByID({
                    collection: 'products',
                    id: productId,
                    overrideAccess: true,
                })
                if (product && typeof (product as any).inventory === 'number') {
                    const newInventory = Math.max(0, (product as any).inventory - (item.quantity ?? 0))
                    await payload.update({
                        collection: 'products',
                        id: productId,
                        data: { inventory: newInventory } as any,
                        overrideAccess: true,
                    })
                }
            } catch (err) {
                payload.logger.error({ err }, '[approve-payment] inventory decrement failed for item')
            }
        }

        // Slug lives on the tenant, not the site — sites collection has no slug field
        const siteObj = typeof order.site === 'object' ? (order.site as any) : null
        const tenantObj = siteObj?.tenant && typeof siteObj.tenant === 'object' ? siteObj.tenant : null
        const siteSlug = tenantObj?.slug ?? ''
        const orderPageUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/sites/${siteSlug}/orders/${order.orderNumber}`

        const emailPayload = paymentConfirmedEmail({
            orderNumber: order.orderNumber as string,
            customerName: order.customerName as string,
            total: order.total as number,
            currency: (order.currency as string) ?? 'MYR',
            orderPageUrl,
        })

        payload.sendEmail({
            to: order.customerEmail as string,
            subject: emailPayload.subject,
            html: emailPayload.html,
        }).catch((err) => payload.logger.error({ err }, '[approve-payment] sendEmail failed'))

        return NextResponse.json({ success: true, data: updated })
    } catch (error: any) {
        console.error('[approve-payment] error', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Approval failed' } },
            { status: 500 }
        )
    }
})
