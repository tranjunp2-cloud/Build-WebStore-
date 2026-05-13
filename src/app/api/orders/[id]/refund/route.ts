import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getStripeClient } from '@/lib/payment/stripe'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/orders/[id]/refund
 *
 * Initiates a full Stripe refund for a paid order.
 * Auth required — only the tenant owner can refund their own orders (IDOR protection).
 *
 * Returns: { success, data: { refundId } }
 */
export async function POST(request: NextRequest, ctx: RouteContext) {
    const { id } = await ctx.params
    const payload = await getPayload({ config })

    // Auth: require dashboard session
    const { user } = await payload.auth({ headers: request.headers })
    if (!user) {
        return NextResponse.json(
            { success: false, error: { code: 'UNAUTHORIZED' } },
            { status: 401 },
        )
    }

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
    const userTenantIds: (string | number)[] = (user.tenants ?? []).map((t: any) =>
        typeof t.tenant === 'object' ? t.tenant.id : t.tenant,
    )
    const orderTenantId = typeof order.tenant === 'object' ? order.tenant.id : order.tenant
    if (!userTenantIds.includes(orderTenantId)) {
        return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN' } },
            { status: 403 },
        )
    }

    // Only paid orders can be refunded
    if (order.status === 'refunded') {
        return NextResponse.json(
            { success: false, error: { code: 'ALREADY_REFUNDED', message: 'Order has already been refunded' } },
            { status: 400 },
        )
    }
    if (order.status !== 'paid') {
        return NextResponse.json(
            {
                success: false,
                error: { code: 'ORDER_NOT_PAID', message: 'Order must be in paid status to refund' },
            },
            { status: 400 },
        )
    }

    const stripePaymentIntentId = order.stripePaymentIntentId
    if (!stripePaymentIntentId) {
        return NextResponse.json(
            {
                success: false,
                error: { code: 'NO_PAYMENT_INTENT', message: 'No Stripe payment found for this order' },
            },
            { status: 400 },
        )
    }

    // Resolve merchant's connected Stripe account
    const stripeAccountId =
        typeof order.tenant === 'object' ? order.tenant.stripeAccountId : undefined
    if (!stripeAccountId) {
        return NextResponse.json(
            { success: false, error: { code: 'PAYMENT_NOT_CONFIGURED' } },
            { status: 400 },
        )
    }

    try {
        const stripe = getStripeClient()
        const refund = await stripe.refunds.create(
            { payment_intent: stripePaymentIntentId },
            { stripeAccount: stripeAccountId },
        )

        await payload.update({
            collection: 'orders',
            id,
            data: { status: 'refunded' } as any,
        })

        console.log(`[Refund] Order ${id} refunded — Stripe refund ${refund.id}`)
        return NextResponse.json({ success: true, data: { refundId: refund.id } })
    } catch (err: any) {
        console.error('[Refund] Stripe refund failed:', err.message)
        return NextResponse.json(
            { success: false, error: { code: 'REFUND_FAILED', message: 'Refund could not be processed' } },
            { status: 502 },
        )
    }
}
