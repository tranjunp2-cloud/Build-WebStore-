/**
 * Unit tests for the shared checkout order-total math (F33).
 *
 * Imports the REAL source — `computeOrderTotal` / `effectiveSubtotalSen` (`@/lib/orders/order-total`)
 * and `getShippingRate` (`@/lib/shipping`) — so a regression in the formula or the free-ship gate
 * actually fails here. No inline re-implementation of the route arithmetic.
 *
 * Post phase-06: total = (subtotal − discount) + shipping (NO tax). All money in sen. The discount is
 * pre-clamped to ≤ subtotal by applyDiscount, so production totals never go negative.
 *
 * TC-F33-06-04, 06-05, 06-06, 10-08, 06-13b, 07-09, 07-NEW
 */

import { describe, it, expect } from 'vitest'
import { computeOrderTotal, effectiveSubtotalSen } from '@/lib/orders/order-total'
import { getShippingRate } from '@/lib/shipping'
import type { ShippingConfig } from '@/lib/shipping/types'

// Base cart: subtotal RM100 (10000 sen), shipping RM10 (1000 sen).
const SUBTOTAL_SEN = 10000
const SHIPPING_SEN = 1000

describe('[TC-F33-06-04] percentage discount 50% — total without tax', () => {
    it('subtotal RM100, −50% (5000 sen), shipping RM10 → total RM60.00', () => {
        // Arrange — discount already computed by applyDiscount upstream (50% of 10000)
        const discountSen = 5000

        // Act
        const { total, totalSen } = computeOrderTotal({
            subtotalSen: SUBTOTAL_SEN,
            discountSen,
            shippingFeeSen: SHIPPING_SEN,
        })

        // Assert — (10000 − 5000) + 1000 = 6000 sen
        expect(totalSen).toBe(6000)
        expect(total).toBe(60.0)
    })
})

describe('[TC-F33-06-05] fixed discount RM25 — total without tax', () => {
    it('subtotal RM100, −RM25 (2500 sen), shipping RM10 → total RM85.00', () => {
        const { total, totalSen } = computeOrderTotal({
            subtotalSen: SUBTOTAL_SEN,
            discountSen: 2500,
            shippingFeeSen: SHIPPING_SEN,
        })

        expect(totalSen).toBe(8500)
        expect(total).toBe(85.0)
    })
})

describe('[TC-F33-06-06] discount clamped to subtotal (free-ship gate never negative)', () => {
    it('discount larger than subtotal → effective subtotal clamps to 0', () => {
        // applyDiscount upstream does Math.min(discountSen, subtotalSen); the free-ship gate input
        // mirrors that clamp so a negative value never reads as "above the free-ship threshold".
        expect(effectiveSubtotalSen(5000, 10000)).toBe(0)
    })

    it('fully-clamped discount (== subtotal) → total is shipping only, never negative', () => {
        const { total, totalSen } = computeOrderTotal({
            subtotalSen: 5000,
            discountSen: 5000, // clamped value (== subtotal)
            shippingFeeSen: SHIPPING_SEN,
        })

        expect(totalSen).toBe(1000) // shipping only
        expect(total).toBe(10.0)
        expect(total).toBeGreaterThanOrEqual(0)
    })
})

describe('[TC-F33-10-08] 100% discount → total is shipping only', () => {
    it('discount equals subtotal → total = shipping', () => {
        const { total } = computeOrderTotal({
            subtotalSen: SUBTOTAL_SEN,
            discountSen: SUBTOTAL_SEN, // 100% of subtotal
            shippingFeeSen: SHIPPING_SEN,
        })

        expect(total).toBe(10.0)
    })
})

describe('[TC-F33-06-13b] total is sen-exact (2dp, no float artifacts)', () => {
    it('odd-sen inputs sum exactly without 109.00500…1 drift', () => {
        // 10001 − 96 = 9905, + 1000 shipping = 10905 sen → RM109.05 exactly
        const { total, totalSen } = computeOrderTotal({
            subtotalSen: 10001,
            discountSen: 96,
            shippingFeeSen: SHIPPING_SEN,
        })

        expect(totalSen).toBe(10905)
        expect(total).toBe(109.05)
        // No more than 2 decimal places
        expect((total.toString().split('.')[1] ?? '').length).toBeLessThanOrEqual(2)
    })
})

describe('[TC-F33-07-09] gateway parity — one formula, identical total', () => {
    it('same (subtotal, discount, shipping) → identical total regardless of gateway', () => {
        const input = { subtotalSen: SUBTOTAL_SEN, discountSen: 5000, shippingFeeSen: SHIPPING_SEN }

        // COD/QR and Stripe both call the SAME computeOrderTotal → parity is structural.
        const cod = computeOrderTotal(input)
        const stripe = computeOrderTotal(input)

        expect(cod.totalSen).toBe(stripe.totalSen)
        expect(cod.total).toBe(stripe.total)
        // Stripe charges total*100 sen as its consolidated line item amount
        expect(Math.round(stripe.total * 100)).toBe(stripe.totalSen)
    })
})

describe('[TC-F33-07-NEW] free-ship gate uses POST-discount subtotal', () => {
    const cfg: ShippingConfig = { enabled: true, freeAbove: 10000, westRate: 1000, eastRate: 1500 }

    it('cart clears freeAbove but discount drops it below → shipping re-charged', () => {
        // Cart RM150 (15000 sen) clears freeAbove RM100; −RM90 discount → effective RM60 (6000 sen)
        const subtotalSen = 15000
        const discountSen = 9000
        const eff = effectiveSubtotalSen(subtotalSen, discountSen)
        expect(eff).toBe(6000)

        // Free-ship gate fed the discounted subtotal → below threshold → zone rate charged
        const shippingFeeSen = getShippingRate('Selangor', cfg, eff)
        expect(shippingFeeSen).toBe(1000) // NOT free

        const { total } = computeOrderTotal({ subtotalSen, discountSen, shippingFeeSen })
        expect(total).toBe(70.0) // 60 + 10 shipping
    })

    it('same cart WITHOUT discount → still free shipping', () => {
        const shippingFeeSen = getShippingRate('Selangor', cfg, effectiveSubtotalSen(15000, 0))
        expect(shippingFeeSen).toBe(0) // 15000 ≥ freeAbove → free
    })

    it('discount keeps effective subtotal at/above threshold → free shipping kept', () => {
        // RM150 − RM40 = RM110 (11000 sen) ≥ freeAbove → still free
        const shippingFeeSen = getShippingRate('Selangor', cfg, effectiveSubtotalSen(15000, 4000))
        expect(shippingFeeSen).toBe(0)
    })
})
