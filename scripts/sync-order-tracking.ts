/**
 * DEV helper — pull the REAL EasyParcel tracking status for ONE order and apply it
 * through the exact same writer the webhook uses (applyTrackingUpdate:
 * status mapping, history append, delivered→completed auto-complete). No fake data:
 * whatever EP's tracking_status endpoint reports is what lands on the order.
 *
 * NOTE: on SANDBOX EP shipments never progress ("Shipment status will not update"),
 * so this will faithfully keep reporting the initial status — that is the truth.
 * To exercise the delivered→completed flow locally, POST a tracking payload to
 * /api/webhooks/easyparcel instead (see docs/architecture F14 webhook section).
 *
 * Usage:
 *   npx tsx --require ./scripts/seed-preload.cjs scripts/sync-order-tracking.ts <orderId>
 */
import { getPayload } from 'payload'
import configPromise from '../src/payload.config'
import { tracking } from '../src/lib/shipping/easyparcel/client'
import { getValidToken } from '../src/lib/shipping/easyparcel/token-manager'
import { applyTrackingUpdate } from '../src/lib/shipping/easyparcel/apply-tracking-update'

const orderId = Number(process.argv[2])
if (!Number.isFinite(orderId)) {
    console.error('Usage: sync-order-tracking.ts <orderId>')
    process.exit(1)
}

async function main() {
    const payload = await getPayload({ config: configPromise })

    const order = await payload.findByID({ collection: 'orders', id: orderId, depth: 0, overrideAccess: true }).catch(() => null) as
        | { id: number; status?: string; tenant?: number | { id: number }; awbNo?: string | null; trackingNumber?: string | null; shippingTrackingStatus?: string | null; shippingTrackingHistory?: { status: string; description: string; eventTime: string }[] | null }
        | null
    if (!order) {
        console.error(`Order ${orderId} not found`)
        process.exit(1)
    }

    const trackingRef = order.trackingNumber || order.awbNo
    if (!trackingRef) {
        console.error(`Order ${orderId} has no AWB/tracking number — create the label first`)
        process.exit(1)
    }

    const tenantId = typeof order.tenant === 'object' ? order.tenant?.id : order.tenant
    const tenantDoc = await payload.findByID({ collection: 'tenants', id: tenantId!, depth: 0, overrideAccess: true }) as
        { easyParcelIntegration?: { accessToken?: string } }
    const epIntegration = tenantDoc?.easyParcelIntegration
    if (!epIntegration?.accessToken) {
        console.error(`Tenant ${tenantId} has no EasyParcel access token`)
        process.exit(1)
    }
    const token = await getValidToken(epIntegration, String(tenantId), payload)

    console.log(`→ EP tracking_status for ${trackingRef} (order ${orderId}, status='${order.status}', tracking='${order.shippingTrackingStatus ?? '—'}')`)
    const resp = await tracking(token, trackingRef)
    const result = resp.data?.results?.[0]
    if (!result || result.status !== 'success' || result.latest_shipment_status_code == null) {
        console.error('EP returned no usable result:', JSON.stringify(result ?? resp, null, 2).slice(0, 800))
        process.exit(1)
    }

    console.log(`← latest_shipment_status_code=${result.latest_shipment_status_code} ("${result.latest_tracking_status ?? ''}")`)
    for (const log of result.status_log ?? []) {
        console.log(`   ${log.event_date}  code=${log.shipment_status_code}  ${log.tracking_status}`)
    }

    // Same code path as the webhook — includes the delivered→completed auto-complete
    const outcome = await applyTrackingUpdate(payload, order, result.latest_shipment_status_code, result.latest_tracking_status)

    const after = await payload.findByID({ collection: 'orders', id: orderId, depth: 0, overrideAccess: true }) as
        { status?: string; shippingTrackingStatus?: string | null }
    console.log(`✅ ${outcome}: order ${orderId} → status='${after.status}', tracking='${after.shippingTrackingStatus}'`)
    process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
