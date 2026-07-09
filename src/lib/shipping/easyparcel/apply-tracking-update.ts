import 'server-only'
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
}

interface OrderLike {
    id: string | number
    status?: string
    shippingTrackingStatus?: string | null
    shippingTrackingHistory?: TrackingHistoryEntry[] | null
}

export type ApplyTrackingResult = 'updated' | 'unchanged'

// Terminal tracking statuses — once reached, a late/out-of-order webhook or cron tick must
// never regress the order back to a non-terminal status (F7, review #1434). Exported so the
// sync-tracking cron's order query can exclude the same set (single source of truth, DRY).
export const TERMINAL = new Set(['delivered', 'returned_to_sender', 'lost', 'cancelled'])

/**
 * Map an EP raw status (numeric shipment_status_code or legacy status string) and
 * persist it onto the order.
 * - `epRawStatus` number → canonical numeric mapping (mapShipmentStatusCode); string →
 *   legacy string mapping (mapTrackingStatus, kept for tolerant/legacy payload shapes).
 * - `descriptionOverride` — optional courier free-text (e.g. EP's latest_tracking_status)
 *   to show as the history entry description instead of the generic buyerLabel. Never
 *   used for status mapping — courier free text is display-only.
 * - Skips the write when the mapped status equals the current one (idempotent).
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

    if (order.shippingTrackingStatus === mapped.internal) return 'unchanged'

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
    const currentHistory: TrackingHistoryEntry[] = fresh?.shippingTrackingHistory ?? order.shippingTrackingHistory ?? []

    // Re-verify idempotency + terminal-guard against the freshest read — closes most of the
    // race window opened between the initial checks above and this re-read.
    if (freshStatus === mapped.internal) return 'unchanged'
    if (freshStatus && TERMINAL.has(freshStatus) && !TERMINAL.has(mapped.internal)) return 'unchanged'

    const newEntry: TrackingHistoryEntry = {
        status: mapped.internal,
        description: descriptionOverride?.trim() || mapped.buyerLabel,
        eventTime: new Date().toISOString(),
    }

    const autoComplete =
        mapped.internal === 'delivered' &&
        (order.status === 'shipped' || order.status === 'ready_to_ship')

    await payload.update({
        collection: 'orders',
        id: order.id,
        data: {
            shippingTrackingStatus: mapped.internal,
            shippingTrackingLastUpdated: new Date().toISOString(),
            shippingTrackingHistory: [...currentHistory, newEntry],
            ...(autoComplete ? { status: 'completed' } : {}),
        } as Record<string, unknown>,
        overrideAccess: true,
    })

    return 'updated'
}
