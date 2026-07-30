export interface TrackingHistoryEntry {
    status: string
    description: string
    eventTime: string
    collectionMethod?: 'pickup' | 'dropoff' | null
}

/**
 * History entry written when a label is bought.
 *
 * Without it, re-shipping after an EP cancel leaves a hole in the buyer's timeline: create-label
 * seeds `shippingTrackingStatus` to 'pending_pickup', and EP's first webhook for the NEW shipment
 * (code 2 → also 'pending_pickup') then hits applyTrackingUpdate's idempotency guard and appends
 * nothing. The newest event the buyer sees would still read "Shipment Cancelled" — while the card
 * right above it already shows a fresh AWB — until the courier physically picks the parcel up.
 *
 * The AWB goes in the description because entries carry no shipment id: when one order has been
 * shipped twice, it is the only thing telling the old parcel's events apart from the new one's.
 * Collection method is snapshotted for the same reason: re-labelling must not rewrite old events.
 * It is nullable — EP issues the AWB asynchronously for some couriers.
 */
export function shipmentCreatedEntry(
    awbNo: string | null,
    at: Date = new Date(),
    collectionMethod?: 'pickup' | 'dropoff' | null,
): TrackingHistoryEntry {
    return {
        status: 'pending_pickup',
        description: awbNo ? `Shipment created — ${awbNo}` : 'Shipment created',
        eventTime: at.toISOString(),
        collectionMethod: collectionMethod ?? 'pickup',
    }
}
