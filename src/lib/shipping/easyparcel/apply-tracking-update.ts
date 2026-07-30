import 'server-only'
import type { BasePayload } from 'payload'
import { withOrderRowLock } from '@/lib/payload/order-row-lock'
import { mapTrackingStatus, mapShipmentStatusCode } from './status-map'

/**
 * Shared tracking-update writer used by the EasyParcel webhook receiver and
 * the one-off local sync script. Status mapping, history append, and lifecycle
 * transitions live in one place.
 */

interface TrackingHistoryEntry {
    status: string
    description: string
    eventTime: string
    collectionMethod?: 'pickup' | 'dropoff' | null
}

interface OrderLike {
    id: string | number
    status?: string
    collectionMethod?: 'pickup' | 'dropoff' | null
    shippingTrackingStatus?: string | null
    shippingTrackingHistory?: TrackingHistoryEntry[] | null
}

export type ApplyTrackingResult = 'updated' | 'unchanged'

// Terminal tracking statuses — once reached, a late/out-of-order webhook must
// never regress the order back to a non-terminal status (F7, review #1434).
const TERMINAL = new Set(['delivered', 'returned_to_sender', 'lost', 'cancelled'])

// Once the courier has possession of the parcel, the merchant lifecycle must leave the
// ready-to-ship holding state. Code 3/11 map to picked_up and code 4 maps to in_transit;
// legacy string payloads may also map directly to out_for_delivery.
const AUTO_SHIP_TRACKING_STATUSES = new Set(['picked_up', 'in_transit', 'out_for_delivery'])

// Order statuses from which an EP shipment cancel (tracking → 'cancelled') should reopen the
// order back to 'confirmed'. Mirrors the manual "Mark shipment cancelled" flow: once EP cancels
// the shipment (freight refunded to the merchant's EP wallet — no buyer-payment impact), the
// order must drop its EP shipment fields so the merchant can create a new label OR cancel the
// order (both exits are gated on easy_parcel_order_no being NULL). Excludes terminal order
// states (cancelled/completed/refunded) so a late cancel never resurrects a closed order.
const REOPEN_ON_CANCEL_FROM = new Set(['ready_to_ship', 'shipped', 'processing', 'paid', 'confirmed'])

/**
 * Map an EP raw status (numeric shipment_status_code or legacy status string) and
 * persist it onto the order.
 * - `epRawStatus` number → canonical numeric mapping (mapShipmentStatusCode); string →
 *   legacy string mapping (mapTrackingStatus, kept for tolerant/legacy payload shapes).
 * - `descriptionOverride` — optional courier free-text (e.g. EP's latest_tracking_status)
 *   to show as the history entry description instead of the generic buyerLabel. Never
 *   used for status mapping — courier free text is display-only.
 * - Same mapped status can still append a new courier message; exact retries stay idempotent.
 * - Appends a history entry `{status: internal, description, eventTime}`.
 * - Auto-completes the order on 'delivered' when it is in an in-fulfillment status
 *   (design: "Completed — automatically marked after successful delivery").
 *   Never touches terminal states (cancelled/refunded) or already-completed orders.
 *   COD paymentStatus=paid is handled by the update-payment-status hook on 'completed'.
 */
export async function applyTrackingUpdate(
    payload: BasePayload,
    order: OrderLike,
    epRawStatus: string | number,
    descriptionOverride?: string,
): Promise<ApplyTrackingResult> {
    const mapped = typeof epRawStatus === 'number'
        ? mapShipmentStatusCode(epRawStatus)
        : mapTrackingStatus(epRawStatus)

    // F6 (review #1434): never overwrite a real status with 'unknown' (buyer label "Processing").
    // The webhook reports unknown statuses to Sentry before they reach this shared writer.
    if (mapped.internal === 'unknown') return 'unchanged'

    return withOrderRowLock(payload, order.id, async (req) => {
        // Re-read after acquiring the row lock so lifecycle decisions and the array-history
        // append use one committed snapshot.
        const reRead = await payload.find({
            collection: 'orders',
            where: { id: { equals: order.id } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
            req,
        })
        const fresh = reRead?.docs?.[0] as OrderLike | undefined
        const freshStatus = fresh?.shippingTrackingStatus ?? order.shippingTrackingStatus
        const collectionMethod = fresh?.collectionMethod ?? order.collectionMethod ?? 'pickup'
        const currentHistory: TrackingHistoryEntry[] = fresh?.shippingTrackingHistory ?? order.shippingTrackingHistory ?? []

        // A terminal tracking state must never regress to a non-terminal state. This check runs
        // against the locked snapshot, so an earlier concurrent terminal update is always visible.
        if (freshStatus && TERMINAL.has(freshStatus) && !TERMINAL.has(mapped.internal)) return 'unchanged'

        const freshOrderStatus = fresh?.status ?? order.status
        const autoComplete =
            mapped.internal === 'delivered' &&
            (freshOrderStatus === 'shipped' || freshOrderStatus === 'ready_to_ship')
        const autoShip =
            freshOrderStatus === 'ready_to_ship' &&
            AUTO_SHIP_TRACKING_STATUSES.has(mapped.internal)

        // EP cancelled the shipment (code 0) — reopen the order to 'confirmed' and drop every EP
        // shipment field so the merchant can re-ship or cancel the order.
        const reopenOnCancel = mapped.internal === 'cancelled' && REOPEN_ON_CANCEL_FROM.has(freshOrderStatus ?? '')
        const trackingChanged = freshStatus !== mapped.internal
        const rawDescription = descriptionOverride?.trim()
        const eventDescription = rawDescription || mapped.buyerLabel
        const latestHistoryEntry = currentHistory.at(-1)
        const rawDescriptionChanged = Boolean(rawDescription) && (
            latestHistoryEntry?.status !== mapped.internal ||
            latestHistoryEntry?.description !== eventDescription
        )
        const historyNeedsAppend = trackingChanged || rawDescriptionChanged

        if (!historyNeedsAppend && !autoShip && !autoComplete && !reopenOnCancel) return 'unchanged'

        const eventTime = new Date().toISOString()
        const trackingData = historyNeedsAppend
            ? {
                ...(trackingChanged ? { shippingTrackingStatus: mapped.internal } : {}),
                shippingTrackingLastUpdated: eventTime,
                shippingTrackingHistory: [
                    ...currentHistory,
                    {
                        status: mapped.internal,
                        description: eventDescription,
                        eventTime,
                        collectionMethod,
                    },
                ],
            }
            : {}

        await payload.update({
            collection: 'orders',
            id: order.id,
            data: {
                ...trackingData,
                ...(autoShip ? { status: 'shipped' } : {}),
                ...(autoComplete ? { status: 'completed' } : {}),
                ...(reopenOnCancel ? {
                    status: 'confirmed',
                    easyParcelOrderNo: null,
                    awbNo: null,
                    trackingNumber: null,
                    labelUrl: null,
                    labelUrls: null,
                    pickupScheduledAt: null,
                    collectionMethod: null,
                    codStatus: null,
                } : {}),
            } as Record<string, unknown>,
            overrideAccess: true,
            req,
        })

        return 'updated'
    })
}
