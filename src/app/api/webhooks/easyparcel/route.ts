import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { applyTrackingUpdate } from '@/lib/shipping/easyparcel/apply-tracking-update'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * EasyParcel webhook receiver — real-time shipment status updates.
 *
 * EP webhooks are subscribed via the EasyParcel Developer Hub dashboard (topic:
 * "Shipment Status Updates") pointing at:
 *   https://<host>/api/webhooks/easyparcel?secret=<EASYPARCEL_WEBHOOK_SECRET>
 *
 * EP does not document an HMAC signature, so auth = shared secret in the query
 * string (timing-safe compare) + the AWB must match an existing order. The
 * 30-min sync cron (/api/cron/sync-tracking) stays on as a fallback for missed
 * deliveries, sharing the same applyTrackingUpdate() writer (idempotent).
 *
 * EP's exact payload schema is not publicly documented — extraction below is
 * tolerant across the known field-name variants; unmatched payloads are logged
 * (keys only, no values) so the real sandbox shape can be calibrated.
 */

function safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) return false
    return timingSafeEqual(bufA, bufB)
}

type Dict = Record<string, unknown>

// Nesting spots to search: root plus data/shipment/shipments[0].
function scopesOf(body: Dict): Dict[] {
    const scopes: Dict[] = [body]
    if (body.data && typeof body.data === 'object') scopes.push(body.data as Dict)
    if (body.shipment && typeof body.shipment === 'object') scopes.push(body.shipment as Dict)
    const shipments = (body.shipments ?? (body.data as Dict | undefined)?.shipments) as unknown
    if (Array.isArray(shipments) && shipments[0] && typeof shipments[0] === 'object') {
        scopes.push(shipments[0] as Dict)
    }
    return scopes
}

// Pull the first non-empty string among candidate keys.
function extractField(body: Dict, keys: string[]): string | null {
    for (const scope of scopesOf(body)) {
        for (const key of keys) {
            const v = scope[key]
            if (typeof v === 'string' && v.trim()) return v.trim()
        }
    }
    return null
}

// Pull the first numeric value among candidate keys (accepts number or numeric string).
function extractNumber(body: Dict, keys: string[]): number | null {
    for (const scope of scopesOf(body)) {
        for (const key of keys) {
            const v = scope[key]
            if (typeof v === 'number' && Number.isFinite(v)) return v
            if (typeof v === 'string' && v.trim() && !isNaN(Number(v))) return Number(v)
        }
    }
    return null
}

export async function POST(req: Request) {
    // ── Auth: shared secret in query (EP cannot send custom headers) ──
    const secret = process.env.EASYPARCEL_WEBHOOK_SECRET
    if (!secret) {
        // Fail closed — endpoint disabled until the env var is configured
        return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
    }
    const incoming = new URL(req.url).searchParams.get('secret') ?? ''
    if (!incoming || !safeEqual(incoming, secret)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Parse (tolerant) ──
    let body: Dict
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ received: true, matched: false, reason: 'invalid_json' })
    }

    const payload = await getPayload({ config })

    // Topic guard — ondemand.* webhook topics use a CODE TABLE THAT CONFLICTS with the
    // shipment.* tables (e.g. ondemand code 5 = "Cancelled by Driver" vs shipment code
    // 5 = "Delivered"). ECH does not use EP's on-demand courier product, so these
    // payloads must never reach the shipment status mapper.
    const topic = typeof body.topic === 'string' ? body.topic : null
    if (topic && topic.startsWith('ondemand')) {
        payload.logger.info({ topic }, '[ep-webhook] unsupported ondemand topic — skipped')
        return NextResponse.json({ received: true, matched: false, reason: 'unsupported_topic' })
    }

    const awb = extractField(body, ['awb_number', 'awb', 'tracking_number', 'tracking_no'])

    // Status resolution — real EP payloads carry a NUMERIC code (docs 2026-06):
    // topic shipment.status.update → shipment_status_code; topic shipment.tracking.update
    // → latest_shipment_status_code. Pass the number straight to the shared status-map
    // (mapShipmentStatusCode) — do NOT stringify. Fall back to raw strings (legacy
    // mapTrackingStatus) for other/tolerant shapes that carry no numeric code.
    const statusCode = extractNumber(body, ['shipment_status_code', 'latest_shipment_status_code'])
    const epStatus: string | number | null =
        statusCode != null ? statusCode : extractField(body, ['shipment_status', 'status_code', 'status'])

    if (epStatus == null || epStatus === '') {
        // Non-status topics — e.g. "Shipment Created" (docs 2026-06: its payload carries NO
        // topic field and NO awb, only shipment_number + parties). Nothing to write (the
        // order already holds these fields from submit), but log + match so the pipeline is
        // observable end-to-end — this is also the only topic that can fire on SANDBOX
        // (status never progresses there, so status topics never trigger).
        const shipmentNo = extractField(body, ['shipment_number'])
        if (shipmentNo) {
            const found = await payload.find({
                collection: 'orders',
                where: { easyParcelOrderNo: { equals: shipmentNo } },
                limit: 1,
                depth: 0,
                overrideAccess: true,
            })
            const matched = !!found.docs[0]
            payload.logger.info(
                { topic, shipmentNo, matched, keys: Object.keys(body) },
                '[ep-webhook] non-status event received (shipment.created?)',
            )
            return NextResponse.json({ received: true, matched, reason: 'non_status_event' })
        }
        // Keys-only log → calibrate the real EP payload shape without leaking PII
        payload.logger.warn(
            { keys: Object.keys(body) },
            '[ep-webhook] payload missing awb/status — check EP schema',
        )
        return NextResponse.json({ received: true, matched: false, reason: 'missing_fields' })
    }

    if (!awb) {
        payload.logger.warn(
            { keys: Object.keys(body) },
            '[ep-webhook] payload missing awb/status — check EP schema',
        )
        return NextResponse.json({ received: true, matched: false, reason: 'missing_fields' })
    }

    try {
        // Match by awbNo (indexed) or trackingNumber (display alias / legacy)
        const found = await payload.find({
            collection: 'orders',
            where: { or: [{ awbNo: { equals: awb } }, { trackingNumber: { equals: awb } }] },
            limit: 1,
            depth: 0,
            overrideAccess: true,
        })
        const order = found.docs[0] as
            | { id: string | number; status?: string; shippingTrackingStatus?: string | null; shippingTrackingHistory?: { status: string; description: string; eventTime: string }[] | null }
            | undefined

        if (!order) {
            // 200 (not 404) — permanent mismatch must not trigger EP retry storms
            payload.logger.warn({ awb }, '[ep-webhook] no order matches AWB')
            return NextResponse.json({ received: true, matched: false, reason: 'order_not_found' })
        }

        // Courier free-text (topic tracking.update → latest_tracking_status) shown as the
        // timeline entry description; display-only, never used for status mapping.
        const trackingText = extractField(body, [
            'latest_tracking_status',
            'tracking_status',
            'shipment_status',
        ])
        const result = await applyTrackingUpdate(payload, order, epStatus, trackingText ?? undefined)
        payload.logger.info({ orderId: order.id, awb, epStatus, result }, '[ep-webhook] processed')
        return NextResponse.json({ received: true, matched: true, result })
    } catch (error) {
        payload.logger.error({ error, awb }, '[ep-webhook] failed to process')
        // 500 → EP retries; transient DB failures self-heal (cron is the backstop)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
