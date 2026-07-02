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

    const currentHistory: TrackingHistoryEntry[] = order.shippingTrackingHistory ?? []
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
