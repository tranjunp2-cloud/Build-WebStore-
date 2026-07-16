/**
 * Unit tests for FulfillmentZone state derivation logic — F36 (GH-1333)
 * Tests the pure state machine that maps order properties to UI fulfillment states.
 *
 * TC-F36.F01–F36.F25: State derivation rules, COD blocking, EP readiness, self-delivery, H1 regression.
 */

import { describe, it, expect } from 'vitest'
import { deriveFulfillState, FulfillmentOrder } from '@/app/(dashboard)/orders/_components/detail/fulfillment-zone'

// ─── Tests ────────────────────────────────────────────────────────────

describe('FulfillmentZone state derivation', () => {
  // TC-F36.F01: Cancelled status → 'cancelled' state
  it('[TC-F36.F01] status=cancelled → "cancelled" state', () => {
    const order: FulfillmentOrder = { status: 'cancelled' }
    expect(deriveFulfillState(order)).toBe('cancelled')
  })

  // TC-F36.F02: Refunded status → 'cancelled' state
  it('[TC-F36.F02] status=refunded → "cancelled" state', () => {
    const order: FulfillmentOrder = { status: 'refunded' }
    expect(deriveFulfillState(order)).toBe('cancelled')
  })

  // TC-F36.F03: Completed status → 'completed' state
  it('[TC-F36.F03] status=completed → "completed" state', () => {
    const order: FulfillmentOrder = { status: 'completed' }
    expect(deriveFulfillState(order)).toBe('completed')
  })

  // TC-F36.F04: Shipped with selfDeliveryCourier → 'self-shipped'
  it('[TC-F36.F04] status=shipped + selfDeliveryCourier set → "self-shipped"', () => {
    const order: FulfillmentOrder = {
      status: 'shipped',
      selfDeliveryCourier: 'J&T Express',
    }
    expect(deriveFulfillState(order)).toBe('self-shipped')
  })

  // TC-F36.F05: Shipped without selfDeliveryCourier → 'shipping' (EP-shipped)
  it('[TC-F36.F05] status=shipped, no selfDeliveryCourier → "shipping" (EP in transit)', () => {
    const order: FulfillmentOrder = {
      status: 'shipped',
      selfDeliveryCourier: null,
    }
    expect(deriveFulfillState(order)).toBe('shipping')
  })

  // TC-F36.F06: Ready to ship with AWB → 'success' (label created)
  it('[TC-F36.F06] status=ready_to_ship + awbNo set → "success" (label created)', () => {
    const order: FulfillmentOrder = {
      status: 'ready_to_ship',
      awbNo: 'EP-12345',
    }
    expect(deriveFulfillState(order)).toBe('success')
  })

  // TC-F36.157: async-AWB — shipment created (wallet charged) but the courier hasn't
  // generated the AWB yet. Success must key on the shipment number, or the zone
  // re-offers "Ready to Ship" for a label that was already bought.
  it('[TC-F36.157] status=ready_to_ship + easyParcelOrderNo set + awbNo null → "success" (async AWB)', () => {
    const order: FulfillmentOrder = {
      status: 'ready_to_ship',
      awbNo: null,
      easyParcelOrderNo: 'EI-77XYZ',
    }
    expect(deriveFulfillState(order)).toBe('success')
  })

  it('[TC-F36.157] CLAIM: sentinel (in-flight create-label) is NOT a created shipment → not "success"', () => {
    const order: FulfillmentOrder = {
      status: 'ready_to_ship',
      awbNo: null,
      easyParcelOrderNo: 'CLAIM:1760000000000:ab12cd',
    }
    expect(deriveFulfillState(order)).not.toBe('success')
  })

  // TC-F36.162: after mark-shipment-cancelled clears the EP fields, the order returns to
  // 'confirmed' (re-opens /cancel per BR-Cancel-02) and the zone must derive 'ready' so
  // the merchant re-creates a label via the normal existing flow.
  it('[TC-F36.162] confirmed + EP fields cleared (post mark-cancelled) + courier still set → "ready"', () => {
    const order: FulfillmentOrder = {
      status: 'confirmed',
      awbNo: null,
      easyParcelOrderNo: null,
      shippingCourier: 'EP-CR0A',
      parcelWeight: 500,
      tenant: { easyParcelIntegration: { enabled: true } },
    }
    expect(deriveFulfillState(order)).toBe('ready')
  })

  // TC-F36.F07: EP disabled → 'self-delivery' (no courier available)
  it('[TC-F36.F07] EP disabled (enabled=false) + confirmed → "self-delivery"', () => {
    const order: FulfillmentOrder = {
      status: 'confirmed',
      tenant: { easyParcelIntegration: { enabled: false } },
      shippingCourier: 'EP-STD', // Courier set but EP disabled
    }
    expect(deriveFulfillState(order)).toBe('self-delivery')
  })

  // TC-F36.F08: EP enabled but no courier selected → 'self-delivery'
  it('[TC-F36.F08] EP enabled but no shippingCourier → "self-delivery"', () => {
    const order: FulfillmentOrder = {
      status: 'confirmed',
      tenant: { easyParcelIntegration: { enabled: true } },
      shippingCourier: null, // Missing courier
    }
    expect(deriveFulfillState(order)).toBe('self-delivery')
  })

  // TC-F36.F09 (PD-021): NO static region block — East MY COD derives 'ready' like any
  // other route; 'cod-blocked' is only entered live via COD_NOT_ELIGIBLE from /create-label.
  it('[TC-F36.F09] status=confirmed + COD to East MY → "ready" (no static region block, PD-021)', () => {
    const order: FulfillmentOrder = {
      status: 'confirmed',
      codAmount: 5000,
      shippingAddress: { state: 'Sabah' },
      tenant: { easyParcelIntegration: { enabled: true } },
      shippingCourier: 'EP-STD',
      parcelWeight: 500,
      awbNo: null,
    }
    expect(deriveFulfillState(order)).toBe('ready')
  })

  // TC-F36.F10: COD West Malaysia → ready
  it('[TC-F36.F10] status=confirmed + COD to West MY → "ready" (not blocked)', () => {
    const order: FulfillmentOrder = {
      status: 'confirmed',
      codAmount: 5000,
      shippingAddress: { state: 'Selangor' },
      tenant: { easyParcelIntegration: { enabled: true } },
      shippingCourier: 'EP-STD',
      parcelWeight: 500,
      awbNo: null,
    }
    expect(deriveFulfillState(order)).toBe('ready')
  })

  // TC-F36.F11: Missing parcel weight → 'missing-data'
  it('[TC-F36.F11] status=confirmed + EP ready but no parcelWeight → "missing-data"', () => {
    const order: FulfillmentOrder = {
      status: 'confirmed',
      tenant: { easyParcelIntegration: { enabled: true } },
      shippingCourier: 'EP-STD',
      parcelWeight: null,
      awbNo: null,
    }
    expect(deriveFulfillState(order)).toBe('missing-data')
  })

  // TC-F36.F12: Ready to ship with EP, no AWB yet → 'ready'
  it('[TC-F36.F12] status=confirmed + EP ready + weight + no AWB → "ready" (create label)', () => {
    const order: FulfillmentOrder = {
      status: 'confirmed',
      tenant: { easyParcelIntegration: { enabled: true } },
      shippingCourier: 'EP-STD',
      parcelWeight: 500,
      awbNo: null,
    }
    expect(deriveFulfillState(order)).toBe('ready')
  })

  // TC-F36.F13: Pending status → 'pending'
  it('[TC-F36.F13] status=pending → "pending"', () => {
    const order: FulfillmentOrder = {
      status: 'pending',
      tenant: { easyParcelIntegration: { enabled: true } },
      shippingCourier: 'EP-STD',
    }
    expect(deriveFulfillState(order)).toBe('pending')
  })

  // TC-F36.F14: New status → 'pending'
  it('[TC-F36.F14] status=new → "pending"', () => {
    const order: FulfillmentOrder = {
      status: 'new',
      tenant: { easyParcelIntegration: { enabled: true } },
      shippingCourier: 'EP-STD',
    }
    expect(deriveFulfillState(order)).toBe('pending')
  })

  // TC-F36.F15: Self-delivery with both selfDeliveryCourier + status=shipped → 'self-shipped'
  it('[TC-F36.F15] selfDeliveryCourier + shipped (no EP) → "self-shipped"', () => {
    const order: FulfillmentOrder = {
      status: 'shipped',
      selfDeliveryCourier: 'Custom Courier',
      tenant: { easyParcelIntegration: { enabled: false } },
    }
    expect(deriveFulfillState(order)).toBe('self-shipped')
  })

  // TC-F36.F16: Tenant as string/number (depth=1, not resolved) → EP disabled
  it('[TC-F36.F16] tenant as string (not object) → EP disabled, fallback to self-delivery', () => {
    const order: FulfillmentOrder = {
      status: 'confirmed',
      tenant: 'tenant-id-string', // Shallow, not resolved
      shippingCourier: null,
    }
    expect(deriveFulfillState(order)).toBe('self-delivery')
  })

  // TC-F36.F17: Null tenant → EP disabled
  it('[TC-F36.F17] tenant=null → EP disabled, fallback to self-delivery', () => {
    const order: FulfillmentOrder = {
      status: 'confirmed',
      tenant: null,
      shippingCourier: null,
    }
    expect(deriveFulfillState(order)).toBe('self-delivery')
  })

  // TC-F36.F18 (PD-021): all East MY states derive 'ready' — region is never a static gate
  it('[TC-F36.F18] All East MY states derive "ready" with confirmed+cod (no region hardcode, PD-021)', () => {
    const eastStates = ['Sabah', 'Sarawak', 'Labuan']
    eastStates.forEach((state) => {
      const order: FulfillmentOrder = {
        status: 'confirmed',
        codAmount: 1000,
        shippingAddress: { state },
        tenant: { easyParcelIntegration: { enabled: true } },
        shippingCourier: 'EP-STD',
        parcelWeight: 500,
        awbNo: null,
      }
      expect(deriveFulfillState(order)).toBe('ready')
    })
  })

  // TC-F36.F19: COD zero amount → not blocked (doesn't trigger codAmount > 0 check)
  it('[TC-F36.F19] COD zero amount → not blocked, continues to ready', () => {
    const order: FulfillmentOrder = {
      status: 'confirmed',
      codAmount: 0,
      shippingAddress: { state: 'Sabah' },
      tenant: { easyParcelIntegration: { enabled: true } },
      shippingCourier: 'EP-STD',
      parcelWeight: 500,
      awbNo: null,
    }
    expect(deriveFulfillState(order)).toBe('ready')
  })

  // TC-F36.F20: No COD → not blocked
  it('[TC-F36.F20] No COD (codAmount null) → not blocked', () => {
    const order: FulfillmentOrder = {
      status: 'confirmed',
      codAmount: null,
      shippingAddress: { state: 'Sabah' },
      tenant: { easyParcelIntegration: { enabled: true } },
      shippingCourier: 'EP-STD',
      parcelWeight: 500,
      awbNo: null,
    }
    expect(deriveFulfillState(order)).toBe('ready')
  })

  // TC-F36.F21: COD without state → not blocked (no state to check)
  it('[TC-F36.F21] COD but no state in address → not blocked', () => {
    const order: FulfillmentOrder = {
      status: 'confirmed',
      codAmount: 5000,
      shippingAddress: { city: 'Kota Kinabalu' }, // State missing
      tenant: { easyParcelIntegration: { enabled: true } },
      shippingCourier: 'EP-STD',
      parcelWeight: 500,
      awbNo: null,
    }
    expect(deriveFulfillState(order)).toBe('ready')
  })

  // TC-F36.F22: Partial EP config (no enabled field) → treats as disabled
  it('[TC-F36.F22] EP config missing "enabled" field → treats as disabled', () => {
    const order: FulfillmentOrder = {
      status: 'confirmed',
      tenant: { easyParcelIntegration: { selectedCourier: 'EP-STD' } }, // No enabled field
      shippingCourier: 'EP-STD',
    }
    expect(deriveFulfillState(order)).toBe('self-delivery')
  })

  // TC-F36.F23: Empty easyParcelIntegration object → disabled
  it('[TC-F36.F23] easyParcelIntegration empty object → disabled', () => {
    const order: FulfillmentOrder = {
      status: 'confirmed',
      tenant: { easyParcelIntegration: {} },
      shippingCourier: 'EP-STD',
    }
    expect(deriveFulfillState(order)).toBe('self-delivery')
  })

  // ──────────────────────────────────────────────────────────────────────────────
  // H1 Regression: Pending states BEFORE EP-config branch (GH-1333 H1 bug fix)
  // ──────────────────────────────────────────────────────────────────────────────

  // TC-F36.F24: H1 regression — status=pending + EP off → 'pending' NOT 'self-delivery'
  it('[TC-F36.F24] H1 fix: status=pending + EP off + no courier → "pending" (not self-delivery)', () => {
    const order: FulfillmentOrder = {
      status: 'pending',
      tenant: { easyParcelIntegration: { enabled: false } },
      shippingCourier: null, // No courier set
    }
    expect(deriveFulfillState(order)).toBe('pending')
  })

  // TC-F36.F25: H1 regression — status=new + EP off → 'pending' NOT 'self-delivery'
  it('[TC-F36.F25] H1 fix: status=new + EP off + no courier → "pending" (not self-delivery)', () => {
    const order: FulfillmentOrder = {
      status: 'new',
      tenant: { easyParcelIntegration: { enabled: false } },
      shippingCourier: null, // No courier set
    }
    expect(deriveFulfillState(order)).toBe('pending')
  })
})
