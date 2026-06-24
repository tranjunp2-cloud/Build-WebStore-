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

interface StatusEntry {
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
