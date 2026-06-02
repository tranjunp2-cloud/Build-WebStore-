import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import { verifyConfirmToken } from '@/lib/orders/upload-token'
import { verifyOrderToken } from '@/lib/auth/order-token'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/orders/[id]/cancel-payment
 *
 * Buyer-facing cancel for an UNPAID, awaiting-payment order (Stripe or Bank Transfer).
 * Auth: HttpOnly ct_ cookie (confirm token) OR magic-link token in body — same model as
 * retry-payment. Distinct from the seller-only `/cancel` route which uses withAuth.
 *
 * No stock restore: Stripe + BT orders do not decrement inventory until payment is
 * captured (Stripe webhook) / approved (BT), so an awaiting order never reserved stock.
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
        AND status::text IN ('pending', 'new', 'payment_failed')
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

    // Invalidate the confirm cookie — the order is now terminal.
    const res = NextResponse.json({ success: true, data: { cancelled: true } })
    res.cookies.set(`ct_${order.id}`, '', { maxAge: 0, path: '/' })
    return res
}
