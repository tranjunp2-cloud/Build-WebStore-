/**
 * Unit tests for pickup-schedule helpers — US-F36-07 (GH-1333)
 * Shared client/server collection-date math (AC-3b: ONE helper for picker + server clamp):
 * cut-off-aware earliest date, business-day checks, and the server-side clamp.
 *
 * TC-F14.155–F14.157 (docs/qa/F14-shipping.md § Pickup/Dropoff Collection Date).
 * All fixtures use fixed UTC instants (MYT = UTC+8) — no reliance on wall-clock.
 */

import { describe, it, expect } from 'vitest'
import {
  earliestPickupDate,
  clampCollectionDate,
  isBusinessDateString,
  courierCutoffLabel,
  maxCollectionDate,
} from '@/lib/shipping/easyparcel/pickup-schedule'

// Mon 2026-07-06 10:00 MYT (02:00 UTC) — weekday, before every cut-off
const MON_MORNING = new Date('2026-07-06T02:00:00Z')
// Mon 2026-07-06 14:30 MYT (06:30 UTC) — after every cut-off (max is flash 14:00)
const MON_AFTERNOON = new Date('2026-07-06T06:30:00Z')
// Fri 2026-07-10 15:00 MYT — after cut-off, next business day is Monday
const FRI_AFTERNOON = new Date('2026-07-10T07:00:00Z')

describe('earliestPickupDate', () => {
  // TC-F14.155: cut-off aware same-day vs next-business-day
  it('[TC-F14.155] before cut-off on a weekday → same day', () => {
    expect(earliestPickupDate('jnt', MON_MORNING)).toBe('2026-07-06')
  })

  it('[TC-F14.155] after cut-off → next business day', () => {
    expect(earliestPickupDate('jnt', MON_AFTERNOON)).toBe('2026-07-07')
  })

  it('[TC-F14.155] Friday after cut-off → skips weekend to Monday', () => {
    expect(earliestPickupDate('jnt', FRI_AFTERNOON)).toBe('2026-07-13')
  })

  it('[TC-F14.155] unknown courier code (EP-CR*) falls back to default 12:00 cut-off', () => {
    // 12:30 MYT — past the default cut-off but before J&T's 13:50
    const halfPastNoon = new Date('2026-07-06T04:30:00Z')
    expect(earliestPickupDate('EP-CR0DW', halfPastNoon)).toBe('2026-07-07')
    expect(earliestPickupDate('jnt', halfPastNoon)).toBe('2026-07-06')
  })
})

describe('isBusinessDateString / courierCutoffLabel', () => {
  // TC-F14.156: weekday/weekend classification in MYT
  it('[TC-F14.156] Mon–Fri true, Sat/Sun false', () => {
    expect(isBusinessDateString('2026-07-06')).toBe(true)  // Mon
    expect(isBusinessDateString('2026-07-10')).toBe(true)  // Fri
    expect(isBusinessDateString('2026-07-11')).toBe(false) // Sat
    expect(isBusinessDateString('2026-07-12')).toBe(false) // Sun
  })

  it('[TC-F14.156] cut-off label per courier, default for unknown codes', () => {
    expect(courierCutoffLabel('jnt')).toBe('13:50')
    expect(courierCutoffLabel('EP-CR0DW')).toBe('12:00')
  })
})

describe('clampCollectionDate (AC-3b server clamp)', () => {
  // TC-F14.157: server never trusts the client's date
  it('[TC-F14.157] no requested date → earliest, not shifted (default path)', () => {
    expect(clampCollectionDate('jnt', undefined, MON_MORNING))
      .toEqual({ date: '2026-07-06', shifted: false })
  })

  it('[TC-F14.157] past date → clamped up to earliest, shifted', () => {
    expect(clampCollectionDate('jnt', '2026-07-01', MON_MORNING))
      .toEqual({ date: '2026-07-06', shifted: true })
  })

  it('[TC-F14.157] picker-opened-before-cutoff, submitted-after → clamped to next business day', () => {
    // Client still sends "today" but the request arrives after cut-off
    expect(clampCollectionDate('jnt', '2026-07-06', MON_AFTERNOON))
      .toEqual({ date: '2026-07-07', shifted: true })
  })

  it('[TC-F14.157] valid future weekday → kept as-is, not shifted', () => {
    expect(clampCollectionDate('jnt', '2026-07-09', MON_MORNING))
      .toEqual({ date: '2026-07-09', shifted: false })
  })

  it('[TC-F36.193] weekend date within window → KEPT as-is, not shifted (EP allows weekends)', () => {
    // Was previously bumped to Monday; now mirrors EP dashboard which accepts weekend pickup.
    expect(clampCollectionDate('jnt', '2026-07-11', MON_MORNING)) // Sat, within 2-week window
      .toEqual({ date: '2026-07-11', shifted: false })

    expect(clampCollectionDate('jnt', '2026-07-12', MON_MORNING)) // Sun
      .toEqual({ date: '2026-07-12', shifted: false })
  })

  it('[TC-F36.193] date beyond the ~2-week window → clamped down to max, shifted', () => {
    // now = 2026-07-06, max = today + 13 = 2026-07-19 (14-day inclusive window)
    expect(maxCollectionDate(MON_MORNING)).toBe('2026-07-19')
    expect(clampCollectionDate('jnt', '2026-08-15', MON_MORNING)) // far future
      .toEqual({ date: '2026-07-19', shifted: true })
  })
})
