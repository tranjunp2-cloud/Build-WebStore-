// Single source of truth for order status groupings.
// Import from here — never duplicate this mapping in components or API routes.
//
// Open PM questions (issue #1286, deferred):
//   - 'paid' in completed group: Stripe legacy — confirm correct grouping
//   - 'processing': confirm group placement (currently ungrouped)
//   - 'payment_failed' in pending: confirm UX intent

export type OrderStatus =
    | 'pending' | 'new' | 'confirmed' | 'ready_to_ship'
    | 'shipped' | 'completed' | 'cancelled' | 'refunded'
    | 'paid' | 'payment_failed' | 'processing'

// Maps filter/metric key → DB statuses in that group.
// Used by: metrics API (count), orders list API (filter).
export const ORDER_STATUS_GROUPS: Record<string, OrderStatus[]> = {
    pending:       ['pending', 'new', 'payment_failed'],
    confirmed:     ['confirmed'],
    ready_to_ship: ['ready_to_ship'],
    shipped:       ['shipped'],
    completed:     ['completed', 'paid'],
    cancelled:     ['cancelled'],
    refunded:      ['refunded'],
}

// Maps DB status → i18n key used by the orders table for badge label display.
export const ORDER_STATUS_LABEL_KEY: Record<OrderStatus, string> = {
    pending:        'pending',
    new:            'pending',
    payment_failed: 'pending',
    confirmed:      'confirmed',
    ready_to_ship:  'readyToShip',
    shipped:        'shipped',
    completed:      'completed',
    cancelled:      'cancelled',
    refunded:       'refunded',
    paid:           'paid',
    processing:     'processing',
}
