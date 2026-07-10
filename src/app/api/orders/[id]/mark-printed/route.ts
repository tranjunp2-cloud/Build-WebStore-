import 'server-only'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/orders/[id]/mark-printed
 *
 * Stamps labelPrintedAt — fired by the print-label modal when "Mark as printed" is
 * checked. Kept as a micro-route (not PATCH /orders/[id]) because that route is a
 * status-transition endpoint and this is an audit stamp, not a lifecycle change.
 * Idempotent: re-printing simply refreshes the timestamp.
 */
export const POST = withFeatureGuard('order_management')(withAuth<RouteContext>(async (user, _request, ctx) => {
    try {
        const { id } = await ctx.params
        const orderId = Number.isFinite(Number(id)) ? Number(id) : id
        const payload = await getPayload({ config })

        // Access-checked read (user scoping) before the overrideAccess write
        const order = await payload.findByID({ collection: 'orders', id: orderId, user, overrideAccess: false, depth: 0 })
        if (!order) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
                { status: 404 },
            )
        }

        const printedAt = new Date().toISOString()
        await payload.update({
            collection: 'orders',
            id: orderId,
            data: { labelPrintedAt: printedAt } as Record<string, unknown>,
            overrideAccess: true,
        })

        return NextResponse.json({ success: true, data: { labelPrintedAt: printedAt } })
    } catch (error: unknown) {
        console.error('[Mark Printed Error]', error instanceof Error ? error.message : 'unknown')
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to mark label as printed' } },
            { status: 500 },
        )
    }
}))
