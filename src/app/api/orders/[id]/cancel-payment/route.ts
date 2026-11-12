import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import { verifyConfirmToken } from '@/lib/orders/upload-token'
import { verifyOrderToken } from '@/lib/auth/order-token'
import { generateOrderViewToken, orderViewCookieName, orderViewCookieOptions } from '@/lib/orders/order-view-token'
import { restockItem, type RestockResult } from '../../lib/stock-utils'
import { releaseDiscountRedemption } from '@/lib/discounts/release-discount-redemption'

type RouteContext = { params: Promise<{ id: string }> }

/** Minimal shape of an order line at depth:0 (product is stored as ID or populated object). */
type OrderItemDoc = {
    product: number | string | { id: number | string } | null
    variant?: string | null
    quantity: number
}

/**
 * POST /api/orders/[id]/cancel-payment
 *
 * Buyer-facing cancel for an UNPAID, awaiting-payment order (Stripe or Bank Transfer).
 * Auth: HttpOnly ct_ cookie (confirm token) OR magic-link token in body — same model as
 * retry-payment. Distinct from the seller-only `/cancel` route which uses withAuth.
 *
 * Stock IS decremented at checkout (BT: checkout/route.ts) / session creation (Stripe:
 * stripe-checkout/route.ts). Cancel must therefore restock — mirrors the seller /cancel
 * route pattern (cancel/route.ts:106-140). Restock runs only on the CAS-winning path
 * to guarantee no double-restock on concurrent cancel attempts.
 */
export async function POST(request: Request, ctx: RouteContext) {
    const { id } = await ctx.params
    const orderId = isNaN(Number(id)) ? id : Number(id)
    const rawBody = await request.json().catch(() => ({})) as { token?: string }
    const bodyToken = typeof rawBody?.token === 'string' ? rawBody.token : undefined

    const payload = await getPayload({ config })

    let order: any
    try {
        order = await payload.findByID({ collection: 'orders', id: orderId, depth: 0, overrideAccess: true })
    } catch {
        order = null
    }
    if (!order) {
        return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } }, { status: 404 })
    }

    // Auth — ct_ cookie OR magic-link token
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get(`ct_${order.id}`)?.value ?? ''
    const cookieValid = cookieToken ? verifyConfirmToken(cookieToken, order.id, order.orderNumber) : false
    let tokenValid = false
    if (!cookieValid && bodyToken && order.magicLinkSecret) {
        const result = await verifyOrderToken({ token: bodyToken, secret: order.magicLinkSecret })
        tokenValid = result.ok
    }
    if (!cookieValid && !tokenValid) {
        return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authorized' } }, { status: 401 })
    }

    // Atomic CAS — only an unpaid, still-cancellable order transitions; first request wins.
    // status is a Postgres enum (cast explicitly); payment_status is varchar.
    const cas = await (payload.db.drizzle as any).execute(sql`
        UPDATE orders
        SET status = 'cancelled'::enum_orders_status,
            payment_status = 'cancelled',
            cancel_reason = 'Cancelled by customer'
        WHERE id = ${order.id}
        AND status::text IN ('pending', 'payment_failed')
        AND payment_status NOT IN ('paid', 'refunded', 'cancelled')
        RETURNING id
    `)
    if (!cas.rows?.length) {
        const fresh = await payload.findByID({ collection: 'orders', id: orderId, depth: 0, overrideAccess: true }).catch(() => null) as any
        if (fresh?.status === 'cancelled') {
            return NextResponse.json({ success: true, data: { alreadyCancelled: true } })
        }
        return NextResponse.json(
            { success: false, error: { code: 'NOT_CANCELLABLE', message: 'This order can no longer be cancelled' } },
            { status: 409 },
        )
    }

    // Release the reserved discount slot (F33) — runs only on the CAS winner. The slot is reserved at
    // PLACE ORDER for every gateway (incl. pending Stripe/Xendit), so this is a real release, not a no-op.
    await releaseDiscountRedemption(payload, Number(order.id))

    // Xendit orders: no remote payment request void (KISS — an uncaptured invoice expires on Xendit's
    // side automatically; a captured one would already be 'paid' and guarded out by CAS above).

    // Restock inventory for each order line — stock was decremented at checkout.
    // restockItem is variant-aware and atomic; never throws (returns skipped result on failure).
    const items = (order.items ?? []) as OrderItemDoc[]
    const restockResults: RestockResult[] = []

    for (const item of items) {
        const rawProductId = typeof item.product === 'object' && item.product !== null
            ? item.product.id
            : item.product
        if (!rawProductId) {
            restockResults.push({ productId: 'unknown', restocked: 0, skipped: true, reason: 'product_not_found' })
            continue
        }
        const productId = Number.isFinite(Number(rawProductId)) ? Number(rawProductId) : rawProductId
        const result = await restockItem(payload, productId, item.variant ?? null, item.quantity)
        restockResults.push(result)
    }

    // Alert ops for failures requiring manual inventory reconciliation.
    const alertable = restockResults.filter(
        r => r.skipped && (r.reason === 'write_failed' || r.reason === 'product_not_found' || r.reason === 'variant_not_found')
    )
    if (alertable.length > 0) {
        payload.logger.error(
            { orderId: order.id, failedProducts: alertable.map(r => ({ id: r.productId, reason: r.reason })) },
            '[cancel-payment] Restock failed — manual inventory reconciliation required',
        )
    }

    // restockResults intentionally not returned — buyer-facing endpoint should not
    // expose inventory details. Ops alerts above handle any restock failures.

    // Invalidate the confirm cookie — the order is now terminal. The buyer is sent on to the tracking page,
    // so hand this browser a short-lived view cookie to keep seeing their own details there (TC-PERF-177).
    const res = NextResponse.json({ success: true, data: { cancelled: true } })
    res.cookies.set(`ct_${order.id}`, '', { maxAge: 0, path: '/' })
    try {
        res.cookies.set(orderViewCookieName(order.id), generateOrderViewToken(order.id, order.orderNumber), orderViewCookieOptions())
    } catch {
        // The order is already cancelled; without the view cookie the tracking page just shows the masked view.
    }
    return res
}
