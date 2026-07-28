import 'server-only'
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/orders/[id]/mark-shipment-cancelled
 *
 * Merchant attests they cancelled the EP shipment on the EasyParcel dashboard.
 * Needed because EP does NOT dispatch a webhook for dashboard-initiated cancels
 * (verified live 2026-07-10: EP delivery log empty, receive pipeline proven healthy)
 * and the sync cron can't poll AWB-less shipments — without this action the order
 * shows "Label created" forever with no self-service way out.
 *
 * Clears the EP label fields so the order derives the normal 'ready' state and the
 * merchant re-creates a label through the EXISTING create-label flow (idempotency
 * key easy_parcel_order_no returns to NULL — no create-label changes needed). The
 * old shipment/AWB numbers are preserved in the tracking history for audit.
 *
 * Trust model: the merchant self-attests. The freight refund is their own EP wallet
 * money; a false attest only risks their own wallet (double booking) — the UI warns.
 */
export const POST = withFeatureGuard('order_management')(withAuth<RouteContext>(async (user, _request, ctx) => {
    try {
        const { id } = await ctx.params
        const orderId = Number.isFinite(Number(id)) ? Number(id) : id
        const payload = await getPayload({ config })

        // Access-checked read (tenant scoping) — raw SQL below never sees foreign orders.
        const order = await payload.findByID({
            collection: 'orders',
            id: orderId,
            user,
            overrideAccess: false,
            depth: 0,
        })

        if (!order) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
                { status: 404 },
            )
        }

        const shipmentNo = (order as any).easyParcelOrderNo as string | null | undefined
        const awbNo = (order as any).awbNo as string | null | undefined

        // Only a real created shipment can be marked cancelled — a CLAIM: sentinel is an
        // in-flight create-label request, and no shipment number means nothing to cancel.
        if (!shipmentNo || shipmentNo.startsWith('CLAIM:')) {
            return NextResponse.json(
                { success: false, error: { code: 'NO_EP_SHIPMENT', message: 'This order has no EasyParcel shipment to mark as cancelled' } },
                { status: 422 },
            )
        }

        if ((order as any).status !== 'ready_to_ship') {
            return NextResponse.json(
                { success: false, error: { code: 'INVALID_TRANSITION', message: 'Only ready-to-ship orders can have their shipment marked as cancelled' } },
                { status: 422 },
            )
        }

        // Atomic clear — compares the exact shipment number read above so concurrent
        // requests (double click, parallel tab) have a single winner; the loser sees the
        // idempotent success below. Clearing easy_parcel_order_no re-arms the existing
        // create-label idempotency/CLAIM CAS for the re-ship.
        // Status returns to 'confirmed' — truthful "no label bought" state: it re-opens
        // BOTH exits (create-label derives 'ready' from confirmed, and /cancel allows
        // confirmed → cancelled per BR-Cancel-02), whereas ready_to_ship allows neither.
        const cas = await (payload.db.drizzle as any).execute(sql`
            UPDATE orders SET
                status = 'confirmed',
                easy_parcel_order_no = NULL,
                awb_no = NULL,
                tracking_number = NULL,
                label_url = NULL,
                label_urls = NULL,
                pickup_scheduled_at = NULL,
                collection_method = NULL,
                cod_status = NULL,
                shipping_tracking_status = 'cancelled',
                shipping_tracking_last_updated = NOW(),
                updated_at = NOW()
            WHERE id = ${orderId} AND status = 'ready_to_ship' AND easy_parcel_order_no = ${shipmentNo}
            RETURNING id
        `)
        if (!cas.rows?.length) {
            // Lost the race — a concurrent mark already cleared it (idempotent success),
            // or the order moved on. Re-read to answer truthfully.
            const recheck = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true, depth: 0 }).catch(() => null)
            if (recheck && !(recheck as any).easyParcelOrderNo) {
                return NextResponse.json({ success: true, data: { alreadyMarked: true } })
            }
            return NextResponse.json(
                { success: false, error: { code: 'CONFLICT', message: 'Order changed while marking — reload and try again' } },
                { status: 409 },
            )
        }

        // Audit trail: the cleared shipment/AWB numbers live on in the tracking timeline.
        // Best-effort (separate array-table write) — a failure here leaves the fields
        // cleared and the flow usable, just without the history line.
        const history = ((order as any).shippingTrackingHistory ?? []) as Array<Record<string, unknown>>
        await payload.update({
            collection: 'orders',
            id: orderId,
            data: {
                shippingTrackingHistory: [
                    ...history,
                    {
                        status: 'cancelled',
                        description: `Shipment ${shipmentNo}${awbNo ? ` (AWB ${awbNo})` : ''} cancelled by merchant on EasyParcel`,
                        eventTime: new Date().toISOString(),
                    },
                ],
            } as Record<string, unknown>,
            overrideAccess: true,
        }).catch((err: unknown) => {
            payload.logger.warn(
                { orderId, err: err instanceof Error ? err.message : String(err) },
                '[mark-shipment-cancelled] history append failed (fields already cleared)',
            )
        })

        payload.logger.info({ orderId, shipmentNo, awbNo }, '[mark-shipment-cancelled] EP fields cleared by merchant attest')

        return NextResponse.json({ success: true, data: { clearedShipmentNo: shipmentNo, status: 'confirmed' } })
    } catch (error: unknown) {
        console.error('[Mark Shipment Cancelled Error]', error instanceof Error ? error.message : 'unknown')
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to mark shipment as cancelled' } },
            { status: 500 },
        )
    }
}))
