import { describe, it, expect } from 'vitest'
import { formatBadgeCount } from '@/lib/sidebar/format-badge-count'

/**
 * TC-F18-SB-BADGE-01 — compact international short scale (K/M/B/T) for sidebar badge counts.
 * Guards against large counts overflowing the pill. Imported from source (no re-implementation).
 */
describe('formatBadgeCount (TC-F18-SB-BADGE-01)', () => {
    it.each([
        [0, '0'],
        [9, '9'],
        [999, '999'],
        [1_000, '1K'],
        [1_500, '1.5K'],
        [12_000, '12K'],
        [999_000, '999K'],
        [1_000_000, '1M'],
        [1_500_000, '1.5M'],
        [1_000_000_000, '1B'],
        [2_300_000_000, '2.3B'],
        [1_000_000_000_000, '1T'],
    ])('formats %i as "%s"', (input, expected) => {
        expect(formatBadgeCount(input)).toBe(expected)
    })

    it('drops the trailing .0 (1000 → "1K", not "1.0K")', () => {
        expect(formatBadgeCount(1_000)).not.toContain('.0')
    })

    it('guards non-finite input (Infinity/NaN → "0", never "∞"/"NaN")', () => {
        expect(formatBadgeCount(Infinity)).toBe('0')
        expect(formatBadgeCount(-Infinity)).toBe('0')
        expect(formatBadgeCount(NaN)).toBe('0')
    })
})
