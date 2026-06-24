import 'server-only'
import type { BasePayload } from 'payload'
import { parcelStatus } from '@/lib/shipping/easyparcel/client'
import { mapTrackingStatus } from '@/lib/shipping/easyparcel/status-map'
import type { EasyParcelConfig } from '@/lib/shipping/easyparcel/types'

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

    for (const order of result.docs as any[]) {
        scanned++
        try {
            const awbNo: string = (order as any).awbNo
            if (!awbNo) continue

            // Resolve tenant to get EP credentials
            const tenantId = typeof order.tenant === 'object' ? order.tenant?.id : order.tenant
            if (!tenantId) {
                payload.logger.warn({ orderId: order.id }, '[sync-tracking] order has no tenant, skipping')
                continue
            }

            const tenantResult = await payload.find({
                collection: 'tenants',
                where: { id: { equals: tenantId } },
                limit: 1,
                overrideAccess: true, // needed: apiKey has read: () => false
                depth: 0,
            })
            const tenant = tenantResult.docs[0] as any
            if (!tenant) {
                payload.logger.warn({ orderId: order.id, tenantId }, '[sync-tracking] tenant not found, skipping')
                continue
            }

            const epIntegration = (tenant as any).easyParcelIntegration
            if (!epIntegration?.apiKey || !epIntegration?.authKey) {
                payload.logger.warn({ orderId: order.id, tenantId }, '[sync-tracking] tenant has no EP credentials, skipping')
                continue
            }

            const epConfig: EasyParcelConfig = {
                apiKey: epIntegration.apiKey,
                authKey: epIntegration.authKey,
                env: epIntegration.detectedEnv ?? 'production',
            }

            const statusResp = await parcelStatus(epConfig, { awb_no: awbNo })
            if (!statusResp.tracking_status) continue

            const mapped = mapTrackingStatus(statusResp.tracking_status)
            const currentStatus: string | undefined = (order as any).shippingTrackingStatus

            // Only update if status changed
            if (currentStatus === mapped.internal) continue

            const currentHistory: Array<{ status: string; description: string; eventTime: string }> =
                ((order as any).shippingTrackingHistory ?? [])

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
                { err, orderId: (order as any).id, awbNo: (order as any).awbNo },
                '[sync-tracking] failed to sync order',
            )
            errors++
        }
    }

    return { scanned, updated, errors }
}
