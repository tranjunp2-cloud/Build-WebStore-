/**
 * @fileoverview Regression guard for scripts/data/malaysia-geo.json state names.
 * TC-IDs: TC-F37-01-23 (provisional — docs/qa/F37-local-seo.md backfills official ID)
 *
 * Bug this prevents: the seed previously wrote official long-form names
 * ('W.P. Kuala Lumpur', 'Pulau Pinang', 'W.P. Putrajaya', 'W.P. Labuan') for 4/16
 * states, which don't match the `z.enum(MY_STATES)` used to validate
 * `localBusiness.state` (src/lib/validations/sites.ts) and order `customer.address.state`
 * (src/lib/validations/orders.ts). Any consumer that reads a state name straight from
 * this seed data (geo-cascade-fields.tsx, checkout's CheckoutAddressForm) and persists
 * it verbatim would fail Zod validation for those 4 states on a freshly-seeded DB.
 */
import { describe, it, expect } from 'vitest'
import { MY_STATES } from '@/lib/shipping/constants'
import geoData from '../../../../scripts/data/malaysia-geo.json'

describe('[TC-F37-01-23] scripts/data/malaysia-geo.json — state names match MY_STATES enum', () => {
    it('every seeded state name is an exact member of MY_STATES (no drift from official/long-form names)', () => {
        const seedNames = geoData.states.map(s => s.name).sort()
        const expected = [...MY_STATES].sort()
        expect(seedNames).toEqual(expected)
    })

    it('seeds exactly 16 states, one per MY_STATES entry, with no duplicates', () => {
        expect(geoData.states).toHaveLength(MY_STATES.length)
        const uniqueNames = new Set(geoData.states.map(s => s.name))
        expect(uniqueNames.size).toBe(geoData.states.length)
    })
})
