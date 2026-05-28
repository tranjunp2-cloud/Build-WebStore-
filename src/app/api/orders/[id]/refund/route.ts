import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { getStripeClient } from '@/lib/payment/stripe'
import { orderRefundedEmail } from '@/lib/email/templates/order-refunded'
import type { User } from 'payload'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/orders/[id]/refund
 *
 * Initiates a full Stripe refund for a paid order.
 * Auth required — only the tenant owner can refund their own orders (IDOR protection).
 *
 * Returns: { success, data: { refundId } }
 */
export const POST = withAuth<RouteContext>(async (user: User, request: Request, ctx: RouteContext) => {
    const { id } = await ctx.params
    const payload = await getPayload({ config })

    // Fetch order with tenant expanded (depth: 1)
    let order: any
    try {
        order = await payload.findByID({ collection: 'orders', id, depth: 1 })
    } catch {
        order = null
    }
    if (!order) {
        return NextResponse.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
            { status: 404 },
        )
    }

    // IDOR: verify the order belongs to the requesting user's tenant
    const userTenantIds: (string | number)[] = ((user as any).tenants ?? []).map((t: any) =>
        typeof t.tenant === 'object' ? t.tenant.id : t.tenant,
    )
    const orderTenantId = typeof order.tenant === 'object' ? order.tenant.id : order.tenant
    if (!userTenantIds.includes(orderTenantId)) {
        return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN' } },
            { status: 403 },
        )
    }

    // Only shipped/completed orders can be refunded — mirrors the dashboard UI gate
    if (order.status === 'refunded') {
        return NextResponse.json(
            { success: false, error: { code: 'ALREADY_REFUNDED', message: 'Order has already been refunded' } },
            { status: 400 },
        )
    }
    const refundableStatuses = ['shipped', 'completed']
    if (!refundableStatuses.includes(order.status)) {
        return NextResponse.json(
            {
                success: false,
                error: { code: 'ORDER_NOT_REFUNDABLE', message: 'Order cannot be refunded in its current status' },
            },
            { status: 400 },
        )
    }

    // Helper: build and fire refund confirmation email (fire-and-forget)
    function fireRefundEmail() {
        if (!order.customerEmail) return
        const tenant = typeof order.tenant === 'object' ? order.tenant : null
        const shopName = tenant?.name ?? 'Shop'
        const siteSlug = tenant?.slug ?? ''
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
        const email = orderRefundedEmail({
            shopName,
            orderNumber: order.orderNumber,
            customerName: order.customerName ?? '',
            customerEmail: order.customerEmail,
            customerPhone: order.customerPhone ?? null,
            customerAddress: order.shippingAddress ?? null,
            items: (order.items ?? []).map((item: any) => ({
                name: item.productName ?? item.name ?? '',
                variant: item.variantName ?? null,
                quantity: item.quantity ?? 1,
                unitPrice: item.unitPrice ?? 0,
                lineTotal: item.lineTotal ?? 0,
            })),
            subtotal: order.subtotal ?? 0,
            shippingFee: order.shippingFee ?? 0,
            total: order.total ?? 0,
            refundAmount: order.total ?? 0,
            paymentMethod: order.paymentMethod ?? 'stripe',
            orderDate: order.createdAt,
            refundDate: new Date().toISOString(),
            shopUrl: `${baseUrl}/sites/${siteSlug}`,
            currency: order.currency ?? 'MYR',
            locale: ((typeof order.site === 'object' ? (order.site as any)?.locale : null) ?? 'ms') as 'en' | 'ms',
        })
        payload.sendEmail({ to: order.customerEmail, subject: email.subject, html: email.html })
            .catch((err: unknown) => payload.logger.error({ err }, '[Refund] sendEmail failed'))
    }

    // Bank transfer / COD — manual refund, no Stripe call needed.
    // No webhook race for non-Stripe orders, so payload.update() is safe here.
    if (['bank_transfer', 'cod'].includes(order.paymentMethod)) {
        if (order.status === 'refunded') {
            return NextResponse.json(
                { success: false, error: { code: 'ALREADY_REFUNDED', message: 'Order has already been refunded' } },
                { status: 400 },
            )
        }
        try {
            await payload.update({
                collection: 'orders',
                id,
                data: { status: 'refunded', paymentStatus: 'refunded' } as any,
            })
            console.log(`[Refund] Order ${id} refunded manually (${order.paymentMethod})`)
            fireRefundEmail()
            return NextResponse.json({ success: true, data: { refundId: null } })
        } catch (err: any) {
            console.error('[Refund] Manual refund failed:', err?.message ?? err)
            return NextResponse.json(
                { success: false, error: { code: 'REFUND_FAILED', message: 'Refund could not be processed' } },
                { status: 502 },
            )
        }
    }

    // Stripe orders — resolve connected account
    const stripeAccountId =
        typeof order.tenant === 'object' ? order.tenant.stripeAccountId : undefined
    if (!stripeAccountId) {
        return NextResponse.json(
            { success: false, error: { code: 'PAYMENT_NOT_CONFIGURED' } },
            { status: 400 },
        )
    }

    let stripePaymentIntentId: string | undefined = order.stripePaymentIntentId

    // If payment intent not cached (e.g. webhook didn't fire yet), fetch it from Stripe via session
    if (!stripePaymentIntentId && order.stripeSessionId) {
        try {
            const stripe = getStripeClient()
            const session = await stripe.checkout.sessions.retrieve(
                order.stripeSessionId,
                { expand: ['payment_intent'] },
                { stripeAccount: stripeAccountId },
            )
            const pi = session.payment_intent
            stripePaymentIntentId = typeof pi === 'string' ? pi : (pi as any)?.id
            if (stripePaymentIntentId) {
                // Backfill so future calls don't need to fetch again
                await payload.update({
                    collection: 'orders',
                    id,
                    data: { stripePaymentIntentId } as any,
                })
            }
        } catch (err: any) {
            console.error('[Refund] Failed to retrieve Stripe session:', err.message)
        }
    }

    if (!stripePaymentIntentId) {
        return NextResponse.json(
            {
                success: false,
                error: { code: 'NO_PAYMENT_INTENT', message: 'No Stripe payment found for this order' },
            },
            { status: 400 },
        )
    }

    const originalStatus = order.status
    const originalPaymentStatus = order.paymentStatus

    // Atomic CAS: only the first concurrent request wins — prevents double-email if merchant double-clicks.
    // Update DB to 'refunded' BEFORE calling Stripe so the charge.refunded webhook
    // (which fires moments after the Stripe API call) sees the order as already refunded
    // and skips sending a duplicate confirmation email.
    const casResult = await (payload.db.drizzle as any).execute(sql`
        UPDATE orders SET status = 'refunded', payment_status = 'refunded'
        WHERE id = ${order.id}
        AND status = ANY(ARRAY['shipped','completed'])
        RETURNING id
    `)
    if (!casResult.rows?.length) {
        return NextResponse.json(
            { success: false, error: { code: 'ALREADY_REFUNDED', message: 'Order has already been refunded' } },
            { status: 400 },
        )
    }

    try {
        const stripe = getStripeClient()
        const refund = await stripe.refunds.create(
            { payment_intent: stripePaymentIntentId },
            { stripeAccount: stripeAccountId, idempotencyKey: `refund-${id}` },
        )

        console.log(`[Refund] Order ${id} refunded — Stripe refund ${refund.id}`)
        fireRefundEmail()

        return NextResponse.json({ success: true, data: { refundId: refund.id } })
    } catch (err: any) {
        // Before rolling back, re-fetch the order — the charge.refunded webhook may have already
        // arrived and set status to 'refunded' (network timeout on our side, but Stripe processed it).
        // Rolling back in that case would silently undo the webhook's state update.
        const currentOrder = await payload.findByID({ collection: 'orders', id }).catch(() => null) as any
        if (!currentOrder || currentOrder.status === 'refunded') {
            console.log('[Refund] Stripe call failed but order already refunded (webhook race) — skipping rollback')
            return NextResponse.json({ success: true, data: { refundId: null } })
        }
        await payload.update({
            collection: 'orders',
            id,
            data: { status: originalStatus, paymentStatus: originalPaymentStatus } as any,
        }).catch(() => {})
        console.error('[Refund] Stripe refund failed:', err.message)
        return NextResponse.json(
            { success: false, error: { code: 'REFUND_FAILED', message: 'Refund could not be processed' } },
            { status: 502 },
        )
    }
})
