/**
 * Unit tests for EasyParcel status-code mapping — F36 (GH-1333)
 *
 * mapShipmentStatusCode() maps the canonical NUMERIC shipment_status_code
 * (per EP OpenAPI docs, github.com/easyparcel/OpenAPI, 2026-03 + 2026-06) to
 * the internal tracking enum + buyer-facing label. Verifies all 9 documented
 * codes plus the unknown-code fallback.
 *
 * TC-F36.OD.049: mapShipmentStatusCode numeric code mapping
 */

import { describe, it, expect } from 'vitest'
import { mapShipmentStatusCode, mapTrackingStatus } from '@/lib/shipping/easyparcel/status-map'

describe('[TC-F36.OD.049] mapShipmentStatusCode — numeric shipment_status_code mapping', () => {
  it('[TC-F36.OD.049a] code 0 (Cancel) → cancelled', () => {
    expect(mapShipmentStatusCode(0)).toEqual({ internal: 'cancelled', buyerLabel: 'Shipment Cancelled' })
  })

  it('[TC-F36.OD.049b] code 2 (To Be Collected) → pending_pickup', () => {
    expect(mapShipmentStatusCode(2)).toEqual({ internal: 'pending_pickup', buyerLabel: 'Waiting for Pickup' })
  })

  it('[TC-F36.OD.049c] code 3 (Collected) → picked_up', () => {
    expect(mapShipmentStatusCode(3)).toEqual({ internal: 'picked_up', buyerLabel: 'Parcel Picked Up' })
  })

  it('[TC-F36.OD.049d] code 4 (Delivery In Transit) → in_transit', () => {
    expect(mapShipmentStatusCode(4)).toEqual({ internal: 'in_transit', buyerLabel: 'In Transit' })
  })

  it('[TC-F36.OD.049e] code 5 (Delivered) → delivered', () => {
    expect(mapShipmentStatusCode(5)).toEqual({ internal: 'delivered', buyerLabel: 'Delivered' })
  })

  it('[TC-F36.OD.049f] code 6 (Returned) → returned_to_sender', () => {
    expect(mapShipmentStatusCode(6)).toEqual({ internal: 'returned_to_sender', buyerLabel: 'Returned to Sender' })
  })

  it('[TC-F36.OD.049g] code 7 (Schedule In Arrangement) → pending_pickup', () => {
    expect(mapShipmentStatusCode(7)).toEqual({ internal: 'pending_pickup', buyerLabel: 'Waiting for Pickup' })
  })

  it('[TC-F36.OD.049h] code 8 (On Hold) → exception', () => {
    expect(mapShipmentStatusCode(8)).toEqual({ internal: 'exception', buyerLabel: 'Delivery Exception' })
  })

  it('[TC-F36.OD.049i] code 11 (Drop Off) → picked_up', () => {
    expect(mapShipmentStatusCode(11)).toEqual({ internal: 'picked_up', buyerLabel: 'Parcel Picked Up' })
  })

  it('[TC-F36.OD.049j] unknown code (999) → unknown/Processing fallback', () => {
    expect(mapShipmentStatusCode(999)).toEqual({ internal: 'unknown', buyerLabel: 'Processing' })
  })

  it('[TC-F36.OD.049k] mapTrackingStatus (legacy string map) still resolves "Delivered" → delivered', () => {
    // Guards backward compat: legacy string-status callers (mapTrackingStatus) must
    // keep working alongside the new numeric mapShipmentStatusCode.
    expect(mapTrackingStatus('Delivered')).toEqual({ internal: 'delivered', buyerLabel: 'Delivered' })
  })
})
