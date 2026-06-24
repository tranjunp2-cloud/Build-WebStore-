import 'server-only'
import type { BasePayload } from 'payload'
import { tracking } from '@/lib/shipping/easyparcel/client'
import { getValidToken } from '@/lib/shipping/easyparcel/token-manager'
import { mapTrackingStatus } from '@/lib/shipping/easyparcel/status-map'

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

                const statusResp = await tracking(token, trackingRef)
                if (!statusResp.data) continue

                // Map via status_code if available, else fall back to status string
                const mapped = mapTrackingStatus(statusResp.data.status_code ?? statusResp.data.status)
                const currentStatus: string | undefined = order.shippingTrackingStatus

                // Only update if status changed
                if (currentStatus === mapped.internal) continue

                const currentHistory: Array<{ status: string; description: string; eventTime: string }> =
                    (order.shippingTrackingHistory ?? [])

                const newEntry = {
                    status: mapped.internal,
                    description: mapped.buyerLabel,
                    eventTime: new Date().toISOString(),
                }

                await payload.update({
                    collection: 'orders',
                    id: order.id,
                    data: {
                        shippingTrackingStatus: mapped.internal,
                        shippingTrackingLastUpdated: new Date().toISOString(),
                        shippingTrackingHistory: [...currentHistory, newEntry],
                    } as any,
                    overrideAccess: true,
                })

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
