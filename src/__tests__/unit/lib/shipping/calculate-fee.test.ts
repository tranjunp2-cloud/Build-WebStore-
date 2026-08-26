import { describe, it, expect } from 'vitest'
import { getShippingRate, shippingRateToRM } from '@/lib/shipping'

describe('shippingRateToRM [TC-F14.159]', () => {
    it('converts an exact sen RateOption price to RM for checkout display', () => {
        // Arrange
        const rate = { priceSen: 801 }

        // Act
        const feeRM = shippingRateToRM(rate, 8)

        // Assert
        expect(feeRM).toBe(8.01)
    })

    it('falls back safely when the response price is malformed', () => {
        // Arrange
        const rate = { priceSen: Number.NaN }

        // Act
        const feeRM = shippingRateToRM(rate, 8.01)

        // Assert
        expect(feeRM).toBe(8.01)
    })

    it('preserves an explicit zero-sen free-shipping quote', () => {
        // Arrange
        const rate = { priceSen: 0 }

        // Act
        const feeRM = shippingRateToRM(rate, 8.01)

        // Assert
        expect(feeRM).toBe(0)
    })

    it.each([
        ['missing rate', undefined],
        ['negative sen', { priceSen: -1 }],
        ['fractional sen', { priceSen: 801.5 }],
    ])('uses the RM fallback for %s', (_caseName, rate) => {
        // Arrange
        const fallbackRM = 5

        // Act
        const feeRM = shippingRateToRM(rate, fallbackRM)

        // Assert
        expect(feeRM).toBe(fallbackRM)
    })
})

describe('getShippingRate [TC-F14]', () => {
    it('[TC-F14.01] charges west rate (800 sen) for Selangor with default config', () => {
        expect(getShippingRate('Selangor', null, 5000)).toBe(800)
    })

    it('[TC-F14.02] charges east rate (1500 sen) for Sabah with default config', () => {
        expect(getShippingRate('Sabah', null, 5000)).toBe(1500)
    })

    it('[TC-F14.03] charges east rate for Labuan (East-MY boundary)', () => {
        expect(getShippingRate('Labuan', null, 5000)).toBe(1500)
    })

    it('[TC-F14.04] empty state falls back to west rate (defensive default)', () => {
        expect(getShippingRate('', null, 5000)).toBe(800)
    })

    it('[TC-F14.06] returns 0 when subtotal exceeds freeAbove threshold', () => {
        const cfg = { enabled: true, westRate: 800, eastRate: 1500, freeAbove: 10_000 }
        expect(getShippingRate('Selangor', cfg, 15_000)).toBe(0)
    })

    it('[TC-F14.08] free-shipping threshold is inclusive (subtotal === freeAbove)', () => {
        const cfg = { enabled: true, westRate: 800, eastRate: 1500, freeAbove: 10_000 }
        expect(getShippingRate('Selangor', cfg, 10_000)).toBe(0)
    })

    it('[TC-F14.20] subtotal=0 still charges east rate (no free without freeAbove)', () => {
        const cfg = { enabled: true, westRate: 800, eastRate: 1500, freeAbove: 10_000 }
        expect(getShippingRate('Sabah', cfg, 0)).toBe(1500)
    })

    it('returns 0 when shipping is disabled (enabled=false)', () => {
        const cfg = { enabled: false, westRate: 800, eastRate: 1500 }
        expect(getShippingRate('Selangor', cfg, 5000)).toBe(0)
    })

    it('honors custom westRate override', () => {
        const cfg = { enabled: true, westRate: 1000, eastRate: 1500 }
        expect(getShippingRate('Selangor', cfg, 5000)).toBe(1000)
    })

    it('honors custom eastRate override', () => {
        const cfg = { enabled: true, westRate: 800, eastRate: 2000 }
        expect(getShippingRate('Sabah', cfg, 5000)).toBe(2000)
    })
})
