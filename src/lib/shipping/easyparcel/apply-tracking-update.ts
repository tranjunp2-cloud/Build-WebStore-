import 'server-only'
import { sql } from 'drizzle-orm'
import type { BasePayload } from 'payload'
import { mapTrackingStatus, mapShipmentStatusCode } from './status-map'

/**
 * Shared tracking-update writer — used by BOTH the 30-min sync cron
 * (src/lib/jobs/sync-tracking.ts) and the EasyParcel webhook receiver
 * (src/app/api/webhooks/easyparcel/route.ts) so status mapping, history
 * append, and the delivered→completed auto-complete rule live in ONE place.
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

// Terminal tracking statuses — once reached, a late/out-of-order webhook or cron tick must
// never regress the order back to a non-terminal status (F7, review #1434). Exported so the
// sync-tracking cron's order query can exclude the same set (single source of truth, DRY).
export const TERMINAL = new Set(['delivered', 'returned_to_sender', 'lost', 'cancelled'])

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
    // An unmapped EP code/string must not clobber a valid tracking state. Guarding here — in the
    // SHARED writer — covers BOTH callers (webhook + cron); the webhook additionally reports the
    // anomaly to Sentry before it reaches here.
    if (mapped.internal === 'unknown') return 'unchanged'

    // F7 (review #1434): a terminal status must never regress to a non-terminal one — e.g. a
    // late "In Transit" (code 4) webhook arriving after "Delivered" (code 5) already landed.
    // Terminal→terminal corrections (e.g. delivered → returned_to_sender) are still allowed.
    // Mirrors the TERMINAL exclusion sync-tracking.ts already applies to its order query.
    if (order.shippingTrackingStatus && TERMINAL.has(order.shippingTrackingStatus) && !TERMINAL.has(mapped.internal)) {
        return 'unchanged'
    }

    // F8 (review #1434): re-read the freshest status + history immediately before writing.
    // The webhook receiver and the 30-min sync cron both call this function and can race on
    // the same order; a plain `[...order.shippingTrackingHistory, newEntry]` read-modify-write
    // can drop an entry written by the other path in between. This re-read shrinks (does not
    // eliminate) that window — a true atomic append needs a DB-level array-append/transaction,
    // which is a bigger change than this fix warrants (YAGNI). Falls back to the caller-supplied
    // `order` if the re-read fails or returns nothing, so behavior stays safe either way.
    const reRead = await payload
        .find({
            collection: 'orders',
            where: { id: { equals: order.id } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
        })
        .catch(() => null)
    const fresh = reRead?.docs?.[0] as OrderLike | undefined
    const freshStatus = fresh?.shippingTrackingStatus ?? order.shippingTrackingStatus
    const collectionMethod = fresh?.collectionMethod ?? order.collectionMethod ?? 'pickup'
    const currentHistory: TrackingHistoryEntry[] = fresh?.shippingTrackingHistory ?? order.shippingTrackingHistory ?? []

    // Re-verify the terminal guard against the freshest read. Lifecycle reconciliation below
    // intentionally still runs when the tracking status itself is unchanged, so orders that
    // received an in-transit webhook before this behavior shipped can self-heal.
    if (freshStatus && TERMINAL.has(freshStatus) && !TERMINAL.has(mapped.internal)) return 'unchanged'

    // F8 (review #1434): gate auto-complete on the FRESH order status, not the stale caller copy.
    // Otherwise a concurrent cancel (status→cancelled) racing a 'delivered' update would be
    // resurrected to 'completed' because the stale copy still reads 'shipped'/'ready_to_ship'.
    const freshOrderStatus = fresh?.status ?? order.status
    const autoComplete =
        mapped.internal === 'delivered' &&
        (freshOrderStatus === 'shipped' || freshOrderStatus === 'ready_to_ship')
    const autoShip =
        freshOrderStatus === 'ready_to_ship' &&
        AUTO_SHIP_TRACKING_STATUSES.has(mapped.internal)

    // EP cancelled the shipment (code 0) — reopen the order to 'confirmed' and drop every EP
    // shipment field so the merchant can re-ship or cancel the order, mirroring the manual
    // "Mark shipment cancelled" flow. Now that EP dispatches cancel webhooks (verified live
    // 2026-07-13), this runs automatically for both the webhook and the sync cron (shared
    // writer). create-label re-seeds shippingTrackingStatus to 'pending_pickup' on re-ship,
    // so leaving it 'cancelled' here does not freeze the next shipment's tracking.
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

    if (autoShip) {
        // The fresh read above is still only a snapshot. A cancel/delivered flow can commit
        // after that read, so promote the lifecycle with a compare-and-swap instead of letting
        // the later Payload update overwrite the newer status. A miss means another writer won;
        // do not persist tracking data assembled from the now-stale snapshot.
        const result = await (payload.db.drizzle as any).execute(sql`
            UPDATE orders
            SET status = 'shipped', updated_at = NOW()
            WHERE id = ${order.id}
              AND status = 'ready_to_ship'
            RETURNING id
        `)
        if (!result.rows?.length) return 'unchanged'
    }

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
    })

    return 'updated'
}
