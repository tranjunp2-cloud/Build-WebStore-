import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { verifyConfirmToken } from '@/lib/orders/upload-token'
import { generateOrderViewToken, orderViewCookieName, orderViewCookieOptions } from '@/lib/orders/order-view-token'

/**
 * DELETE /api/orders/[id]/clear-confirm-token — the buyer leaves the confirm page (Track order, Continue
 * shopping). Drops `ct_<id>` so Back can't reopen it. When this browser held a valid confirm cookie, it gets
 * a short-lived `ov_<id>` view cookie so the tracking page still shows the buyer their own name, phone and
 * address (TC-PERF-177). Without a valid confirm cookie nothing is granted.
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const res = NextResponse.json({ ok: true })
    const confirmToken = req.cookies.get(`ct_${id}`)?.value
    res.cookies.delete(`ct_${id}`)
    if (!confirmToken) return res

    try {
        const payload = await getPayload({ config })
        const orderId = isNaN(Number(id)) ? id : Number(id)
        const order = await payload.findByID({ collection: 'orders', id: orderId, depth: 0, overrideAccess: true })
            .catch(() => null) as { id: string | number; orderNumber?: string | null } | null
        if (order?.orderNumber && verifyConfirmToken(confirmToken, order.id, order.orderNumber)) {
            res.cookies.set(orderViewCookieName(order.id), generateOrderViewToken(order.id, order.orderNumber), orderViewCookieOptions())
        }
    } catch {
        // Clearing the confirm cookie must still succeed; the tracking page then shows the masked view.
    }
    return res
}
