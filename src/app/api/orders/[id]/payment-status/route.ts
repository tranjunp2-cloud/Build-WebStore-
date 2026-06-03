/**
 * POST /api/orders/[id]/payment-status
 *
 * Active-reconcile endpoint: fetches the current Stripe Checkout Session and, if paid,
 * calls reconcileOrderPaid to heal the DB when the webhook is late or missing.
 *
 * Auth: HttpOnly ct_ cookie (confirm token).
 * Returns the current order status/paymentStatus so the confirm page can react.
 */
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import { verifyConfirmToken } from '@/lib/orders/upload-token'
import { retrieveCheckoutSession } from '@/lib/payment/stripe'
import { reconcileOrderPaid } from '@/lib/payment/reconcile-order-paid'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, ctx: RouteContext) {
    const { id } = await ctx.params
    const orderId = isNaN(Number(id)) ? id : Number(id)

    try {
        const payload = await getPayload({ config })

        // Step 1: Load order (depth:1 — populate tenant to get stripeAccountId)
        let order: any
        try {
            order = await payload.findByID({
                collection: 'orders',
                id: orderId,
                depth: 1,
                overrideAccess: true,
            })
        } catch {
            order = null
        }
        if (!order) {
            return NextResponse.json(
                { error: { code: 'NOT_FOUND', message: 'Order not found' } },
                { status: 404 },
            )
        }

        // Step 2: Auth — ct_ cookie only (no body token for this lightweight endpoint)
        const cookieStore = await cookies()
        const token = cookieStore.get(`ct_${order.id}`)?.value ?? ''
        const valid = token ? verifyConfirmToken(token, order.id, order.orderNumber) : false
        if (!valid) {
            return NextResponse.json(
                { error: { code: 'UNAUTHORIZED', message: 'Not authorized' } },
                { status: 401 },
            )
        }

        // Step 3: Already resolved — nothing to heal
        if (order.status !== 'pending') {
            return NextResponse.json({
                status: order.status,
                paymentStatus: order.paymentStatus,
                reconciled: false,
            })
        }

        // Step 4: Resolve Stripe identifiers from populated tenant (depth:1)
        const tenant = typeof order.tenant === 'object' ? order.tenant : null
        const connectedAccountId: string | undefined = tenant?.stripeAccountId ?? undefined
        if (!order.stripeSessionId || !connectedAccountId) {
            return NextResponse.json({ status: 'pending', reconciled: false })
        }

        // Step 5: Fetch Stripe session — return gracefully on error (SSE / cron will retry)
        const session = await retrieveCheckoutSession(order.stripeSessionId, connectedAccountId)
        if (!session) {
            return NextResponse.json({ status: 'pending', reconciled: false })
        }

        // Step 6: Reconcile only when Stripe has actually CAPTURED payment. Gate strictly on
        // payment_status==='paid' — NOT session.status==='complete', which a delayed-notification
        // method (e.g. async wallets) can reach while still unpaid → would mark paid before capture.
        let reconcileResult: { status: string } | undefined
        if (session.payment_status === 'paid') {
            reconcileResult = await reconcileOrderPaid(payload, {
                orderId: Number(order.id),
                session,
                connectedAccountId,
                source: 'poll',
            })
        }

        // Step 7: Re-read and return fresh state
        const fresh = await payload.findByID({
            collection: 'orders',
            id: orderId,
            depth: 0,
            overrideAccess: true,
        }).catch(() => null) as any

        return NextResponse.json({
            status: fresh?.status ?? order.status,
            paymentStatus: fresh?.paymentStatus ?? order.paymentStatus,
            reconciled: reconcileResult?.status === 'reconciled',
        })
    } catch (err: unknown) {
        console.error('[payment-status] Unexpected error:', err instanceof Error ? err.message : err)
        return NextResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Status check failed' } },
            { status: 500 },
        )
    }
}
