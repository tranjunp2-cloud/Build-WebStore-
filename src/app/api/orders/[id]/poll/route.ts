import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/orders/[id]/poll — lightweight change-cursor for the order-detail poll.
 *
 * The order-detail screen polls this every ~20s while the order is in-flight so a
 * webhook-driven change (async AWB backfill, tracking status, cancel auto-reopen)
 * surfaces without a manual refresh. Returns ONLY the fields the fulfillment card
 * watches via a `select`ed depth-0 read — a tiny single-row query instead of the
 * full depth=2 order fetch (`GET /api/orders/[id]`). The client compares `updatedAt`
 * and only re-pulls the full order when it changed, so the frequent poll stays cheap.
 * Access-controlled (overrideAccess:false) so a merchant only ever polls own orders.
 */
export const GET = withAuth<RouteContext>(async (user, _request, ctx) => {
    try {
        const { id } = await ctx.params
        const payload = await getPayload({ config })

        const order = await payload.findByID({
            collection: 'orders',
            id,
            depth: 0,
            user,
            overrideAccess: false,
            select: { updatedAt: true, status: true, awbNo: true, shippingTrackingStatus: true },
        })

        if (!order) {
            return NextResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 })
        }

        return NextResponse.json({
            success: true,
            data: {
                updatedAt: (order as { updatedAt?: string }).updatedAt ?? null,
                status: (order as { status?: string }).status ?? null,
                awbNo: (order as { awbNo?: string | null }).awbNo ?? null,
                shippingTrackingStatus: (order as { shippingTrackingStatus?: string | null }).shippingTrackingStatus ?? null,
            },
        })
    } catch (error: unknown) {
        const e = error as { status?: number; name?: string }
        if (e?.status === 404 || e?.name === 'NotFound') {
            return NextResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 })
        }
        return NextResponse.json({ success: false, error: { code: 'POLL_FAILED' } }, { status: 500 })
    }
})
