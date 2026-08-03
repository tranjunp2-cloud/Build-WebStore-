/**
 * Shipment-created history entry — F36 (GH-1333), TC-F36.200
 * docs/qa/F36-easyparcel-delivery.md § 3.18l
 *
 * Re-shipping after an EP cancel left a hole: create-label seeds shippingTrackingStatus to
 * 'pending_pickup', and EP's first webhook for the new shipment (code 2 → 'pending_pickup') is
 * then dropped by applyTrackingUpdate's idempotency guard. The buyer's newest event stayed
 * "Shipment Cancelled" while the card above already showed the new AWB.
 */

import { describe, it, expect } from 'vitest'
import { shipmentCreatedEntry } from '@/lib/shipping/easyparcel/tracking-history'
import { mapShipmentStatusCode } from '@/lib/shipping/easyparcel/status-map'

const AT = new Date('2026-07-14T08:00:00.000Z')

describe('[TC-F36.200] shipment-created history entry', () => {
    it('[TC-F36.200] carries the AWB so a re-shipped order tells its two parcels apart', () => {
        const entry = shipmentCreatedEntry('RMC002322989MY', AT, 'dropoff')

        expect(entry.description).toContain('RMC002322989MY')
        expect(entry.status).toBe('pending_pickup')
        expect(entry.eventTime).toBe('2026-07-14T08:00:00.000Z')
        expect(entry.collectionMethod).toBe('dropoff')
    })

    it('[TC-F36.200] still logs the shipment when EP has not issued the AWB yet', () => {
        // Some couriers get their AWB asynchronously — the label exists, the number does not.
        const entry = shipmentCreatedEntry(null, AT)

        expect(entry.description).toBe('Shipment created')
        expect(entry.status).toBe('pending_pickup')
        expect(entry.collectionMethod).toBe('pickup')
    })

    // This is WHY the entry has to exist: EP's own "To Be Collected" webhook maps to the exact
    // status create-label just seeded, so applyTrackingUpdate treats it as unchanged and appends
    // nothing. Assert the collision from the shipped map — if EP ever re-maps code 2, this fails
    // and the entry can be reconsidered rather than silently duplicating a real webhook event.
    it('[TC-F36.200] EP code 2 collides with the status create-label seeds', () => {
        expect(mapShipmentStatusCode(2).internal).toBe('pending_pickup')
        expect(shipmentCreatedEntry('AWB1', AT).status).toBe('pending_pickup')
    })

    it('[TC-F36.200] appends after a cancelled shipment instead of replacing its history', () => {
        // The buyer already saw these two events — a re-ship must not erase them.
        const priorHistory = [
            { status: 'pending_pickup', description: 'Waiting for Pickup', eventTime: '2026-07-13T02:24:53.000Z' },
            { status: 'cancelled', description: 'Shipment Cancelled', eventTime: '2026-07-13T10:25:27.000Z' },
        ]

        const merged = [...priorHistory, shipmentCreatedEntry('RMC002302879MY', AT)]

        expect(merged).toHaveLength(3)
        expect(merged[0].description).toBe('Waiting for Pickup')
        expect(merged[1].description).toBe('Shipment Cancelled')
        // Newest last — the buyer's timeline renders the final entry as "latest".
        expect(merged[2].description).toContain('RMC002302879MY')
    })
})
