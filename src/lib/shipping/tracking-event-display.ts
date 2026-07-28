export interface TrackingEventDisplayInput {
    status?: string | null
    description?: string | null
}

export type TrackingCollectionMethod = 'pickup' | 'dropoff' | null | undefined

export interface TrackingEventDisplayLabels {
    statusOrderCreated: string
    statusPendingPickup: string
    statusPendingDropoff: string
    statusPickedUp: string
    statusInTransit: string
    statusOutForDelivery: string
    statusDelivered: string
    statusFailedDelivery: string
    statusReturnedToSender: string
    statusLost: string
    statusCancelled: string
    statusException: string
    statusProcessing: string
}

export const EN_TRACKING_EVENT_LABELS: TrackingEventDisplayLabels = {
    statusOrderCreated: 'Order Created',
    statusPendingPickup: 'Waiting for Pickup',
    statusPendingDropoff: 'Waiting for Drop-off',
    statusPickedUp: 'Parcel Picked Up',
    statusInTransit: 'In Transit',
    statusOutForDelivery: 'Out for Delivery',
    statusDelivered: 'Delivered',
    statusFailedDelivery: 'Delivery Attempted',
    statusReturnedToSender: 'Returned to Sender',
    statusLost: 'Parcel Lost',
    statusCancelled: 'Shipment Cancelled',
    statusException: 'Delivery Exception',
    statusProcessing: 'Processing',
}

export function formatTrackingEventDisplay(
    event: TrackingEventDisplayInput,
    collectionMethod: TrackingCollectionMethod,
    labels: TrackingEventDisplayLabels = EN_TRACKING_EVENT_LABELS,
): { title: string; note: string | null } {
    const friendly: Record<string, string> = {
        order_created: labels.statusOrderCreated,
        pending_pickup: collectionMethod === 'dropoff'
            ? labels.statusPendingDropoff
            : labels.statusPendingPickup,
        picked_up: labels.statusPickedUp,
        in_transit: labels.statusInTransit,
        out_for_delivery: labels.statusOutForDelivery,
        delivered: labels.statusDelivered,
        failed_delivery: labels.statusFailedDelivery,
        returned_to_sender: labels.statusReturnedToSender,
        lost: labels.statusLost,
        cancelled: labels.statusCancelled,
        exception: labels.statusException,
        processing: labels.statusProcessing,
        unknown: labels.statusProcessing,
    }

    const statusTitle = event.status
        ? (friendly[event.status] ?? event.status)
        : labels.statusProcessing
    const description = event.description ?? ''
    const isShipmentCreated = /^Shipment created(?:\s+—|$)/.test(description)

    if (isShipmentCreated) {
        return { title: description, note: null }
    }

    const note = description
        && description.toLocaleLowerCase() !== statusTitle.toLocaleLowerCase()
        ? description
        : null

    return { title: statusTitle, note }
}
