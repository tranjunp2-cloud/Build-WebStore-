import 'server-only'

// Internal tracking status values (match Orders.ts shippingTrackingStatus options)
export type TrackingStatus =
    | 'order_created'
    | 'pending_pickup'
    | 'picked_up'
    | 'in_transit'
    | 'out_for_delivery'
    | 'delivered'
    | 'failed_delivery'
    | 'returned_to_sender'
    | 'lost'
    | 'cancelled'
    | 'exception'
    | 'processing'
    | 'unknown'

export interface StatusEntry {
    internal: TrackingStatus
    buyerLabel: string
}

// 13 EP raw status codes → internal enum + buyer-facing label
// P1: verify all inferred codes (non-Delivered ones) against sandbox
const STATUS_MAP: Record<string, StatusEntry> = {
    'Order Created':      { internal: 'order_created',      buyerLabel: 'Order Created' },
    'Pending Pickup':     { internal: 'pending_pickup',     buyerLabel: 'Waiting for Pickup' },
    'Picked Up':          { internal: 'picked_up',          buyerLabel: 'Parcel Picked Up' },
    'In Transit':         { internal: 'in_transit',         buyerLabel: 'In Transit' },
    'Out for Delivery':   { internal: 'out_for_delivery',   buyerLabel: 'Out for Delivery' },
    'Delivered':          { internal: 'delivered',          buyerLabel: 'Delivered' },
    'Failed Delivery':    { internal: 'failed_delivery',    buyerLabel: 'Delivery Attempted' },
    'Returned to Sender': { internal: 'returned_to_sender', buyerLabel: 'Returned to Sender' },
    'Lost':               { internal: 'lost',               buyerLabel: 'Parcel Lost' },
    'Cancelled':          { internal: 'cancelled',          buyerLabel: 'Shipment Cancelled' },
    'Exception':          { internal: 'exception',          buyerLabel: 'Delivery Exception' },
    'Processing':         { internal: 'processing',         buyerLabel: 'Processing' },
}

/** Map an EP raw status string to internal enum + buyer label. Defaults to 'unknown'. */
export function mapTrackingStatus(epRaw: string): StatusEntry {
    return STATUS_MAP[epRaw] ?? { internal: 'unknown', buyerLabel: 'Processing' }
}

// Canonical numeric shipment_status_code → internal enum + buyer label.
// Source of truth: EP OpenAPI docs (github.com/easyparcel/OpenAPI, 2026-03 + 2026-06).
// 0=Cancel, 2=To Be Collected, 3=Collected, 4=Delivery In Transit, 5=Delivered,
// 6=Returned, 7=Schedule In Arrangement, 8=On Hold, 11=Drop Off.
// NOTE: ondemand.* webhook topics use a CONFLICTING code table (e.g. ondemand 5 =
// "Cancelled by Driver") — callers must never feed ondemand codes into this map.
const SHIPMENT_STATUS_CODE_MAP: Record<number, StatusEntry> = {
    0: { internal: 'cancelled', buyerLabel: 'Shipment Cancelled' },
    2: { internal: 'pending_pickup', buyerLabel: 'Waiting for Pickup' },
    3: { internal: 'picked_up', buyerLabel: 'Parcel Picked Up' },
    4: { internal: 'in_transit', buyerLabel: 'In Transit' },
    5: { internal: 'delivered', buyerLabel: 'Delivered' },
    6: { internal: 'returned_to_sender', buyerLabel: 'Returned to Sender' },
    7: { internal: 'pending_pickup', buyerLabel: 'Waiting for Pickup' },
    8: { internal: 'exception', buyerLabel: 'Delivery Exception' },
    11: { internal: 'picked_up', buyerLabel: 'Parcel Picked Up' },
}

/** Map an EP numeric shipment_status_code to internal enum + buyer label. Defaults to 'unknown'. */
export function mapShipmentStatusCode(code: number): StatusEntry {
    return SHIPMENT_STATUS_CODE_MAP[code] ?? { internal: 'unknown', buyerLabel: 'Processing' }
}
