import 'server-only'
import type { BasePayload } from 'payload'
import { tracking } from '@/lib/shipping/easyparcel/client'
import { getValidToken } from '@/lib/shipping/easyparcel/token-manager'
import { applyTrackingUpdate } from '@/lib/shipping/easyparcel/apply-tracking-update'

const TERMINAL = new Set(['delivered', 'returned_to_sender', 'lost', 'cancelled'])

export async function syncTrackingJob(payload: BasePayload) {
    // Find orders with AWB set and non-terminal tracking status
    const result = await payload.find({
        collection: 'orders',
        where: {
            and: [
                { awbNo: { exists: true } },
                { shippingTrackingStatus: { not_in: [...TERMINAL] } },
            ],
        },
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

        for (const order of orders) {
            scanned++
            try {
                const awbNo: string = order.awbNo
                if (!awbNo) continue

                // Prefer trackingNumber (new API field); fall back to awbNo for legacy orders
                const trackingRef: string = order.trackingNumber || awbNo
                if (!trackingRef) continue

                // Documented tracking_status endpoint returns { data: { results: [...] } } —
                // one result per requested AWB (single-AWB call here, so index 0).
                const statusResp = await tracking(token, trackingRef)
                const apiResult = statusResp.data?.results?.[0]
                if (!apiResult || apiResult.status !== 'success' || apiResult.latest_shipment_status_code == null) {
                    payload.logger.warn(
                        { orderId: order.id, trackingRef, epStatus: apiResult?.status },
                        '[sync-tracking] tracking_status returned no usable result, skipping',
                    )
                    errors++
                    continue
                }

                // Shared writer: maps the numeric shipment_status_code, skips unchanged,
                // appends history (using courier free-text as description), and
                // auto-completes on delivered (same code path as the EP webhook receiver).
                const result = await applyTrackingUpdate(
                    payload,
                    order,
                    apiResult.latest_shipment_status_code,
                    apiResult.latest_tracking_status,
                )
                if (result === 'unchanged') continue

                updated++
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

    return { scanned, updated, errors }
}
