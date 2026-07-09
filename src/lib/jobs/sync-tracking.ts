import 'server-only'
import type { BasePayload } from 'payload'
import { trackingStatus } from '@/lib/shipping/easyparcel/client'
import { getValidToken } from '@/lib/shipping/easyparcel/token-manager'
import { applyTrackingUpdate, TERMINAL } from '@/lib/shipping/easyparcel/apply-tracking-update'
import type { EpTrackingStatusResult } from '@/lib/shipping/easyparcel/types'

// F9 (review #1434): EP's tracking_status endpoint accepts up to 100 AWBs per call
// (2026-06 docs) — batch instead of one call per order so a large backlog doesn't exceed
// the cron function's maxDuration=60 budget.
const EP_TRACKING_BATCH_SIZE = 100

export async function syncTrackingJob(payload: BasePayload) {
    // Find orders with AWB set and non-terminal tracking status. Oldest-synced-first (F9,
    // review #1434) so a truncated/timed-out run still makes progress across the backlog
    // instead of always re-scanning the same head of the list.
    const result = await payload.find({
        collection: 'orders',
        where: {
            and: [
                { awbNo: { exists: true } },
                { shippingTrackingStatus: { not_in: [...TERMINAL] } },
            ],
        },
        sort: 'shippingTrackingLastUpdated',
        limit: 200,
        overrideAccess: true,
        depth: 0,
    })

    let scanned = 0
    let updated = 0
    let errors = 0

    // Group orders by tenant to avoid N+1 lookups and token refresh races
    const ordersByTenant = new Map<string, any[]>()
    for (const order of result.docs as any[]) {
        const tenantId = typeof order.tenant === 'object' ? order.tenant?.id : order.tenant
        if (!tenantId) {
            payload.logger.warn({ orderId: order.id }, '[sync-tracking] order has no tenant, skipping')
            scanned++
            continue
        }
        const key = String(tenantId)
        if (!ordersByTenant.has(key)) ordersByTenant.set(key, [])
        ordersByTenant.get(key)!.push(order)
    }

    // One tenant fetch + one token resolution per distinct tenant per job run
    for (const [tenantId, orders] of ordersByTenant) {
        const tenantResult = await payload.find({
            collection: 'tenants',
            where: { id: { equals: tenantId } },
            limit: 1,
            overrideAccess: true,
            depth: 0,
        })
        const tenant = tenantResult.docs[0] as any
        if (!tenant) {
            payload.logger.warn({ tenantId }, '[sync-tracking] tenant not found, skipping tenant')
            scanned += orders.length
            continue
        }

        const epIntegration = tenant.easyParcelIntegration
        if (!epIntegration?.accessToken) {
            payload.logger.warn({ tenantId }, '[sync-tracking] tenant has no EP access token, skipping tenant')
            scanned += orders.length
            continue
        }

        let token: string
        try {
            token = await getValidToken(epIntegration, tenantId, payload)
        } catch {
            payload.logger.warn({ tenantId }, '[sync-tracking] token expired or refresh failed, skipping tenant')
            scanned += orders.length
            continue
        }

        // F9 (review #1434): batch AWBs into groups of <=100 and issue one trackingStatus()
        // call per group instead of one single-AWB call per order.
        for (let i = 0; i < orders.length; i += EP_TRACKING_BATCH_SIZE) {
            const batch = orders.slice(i, i + EP_TRACKING_BATCH_SIZE)

            // Prefer trackingNumber (new API field); fall back to awbNo for legacy orders.
            const awbToOrder = new Map<string, any>()
            for (const order of batch) {
                const trackingRef: string = order.trackingNumber || order.awbNo
                if (!trackingRef) continue
                awbToOrder.set(trackingRef, order)
            }
            scanned += batch.length

            const awbNumbers = [...awbToOrder.keys()]
            if (awbNumbers.length === 0) continue

            let results: EpTrackingStatusResult[]
            try {
                const statusResp = await trackingStatus(token, awbNumbers)
                results = statusResp.data?.results ?? []
            } catch (err: unknown) {
                payload.logger.error(
                    { err, tenantId, awbCount: awbNumbers.length },
                    '[sync-tracking] batch tracking_status call failed',
                )
                errors += awbNumbers.length
                continue
            }

            for (const apiResult of results) {
                const order = awbToOrder.get(apiResult.awb_number)
                if (!order) continue

                if (apiResult.status !== 'success' || apiResult.latest_shipment_status_code == null) {
                    payload.logger.warn(
                        { orderId: order.id, awb: apiResult.awb_number, epStatus: apiResult.status },
                        '[sync-tracking] tracking_status returned no usable result, skipping',
                    )
                    errors++
                    continue
                }

                try {
                    // Shared writer: maps the numeric shipment_status_code, skips unchanged,
                    // appends history (using courier free-text as description), and
                    // auto-completes on delivered (same code path as the EP webhook receiver).
                    const result = await applyTrackingUpdate(
                        payload,
                        order,
                        apiResult.latest_shipment_status_code,
                        apiResult.latest_tracking_status,
                    )
                    if (result === 'updated') updated++
                } catch (err: unknown) {
                    // Log without including any secret values in message
                    payload.logger.error(
                        { err, orderId: order.id, awbNo: order.awbNo },
                        '[sync-tracking] failed to sync order',
                    )
                    errors++
                }
            }
        }
    }

    return { scanned, updated, errors }
}
