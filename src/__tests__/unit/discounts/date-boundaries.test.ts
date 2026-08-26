/**
 * Unit tests for date-boundaries helpers (src/lib/discounts/date-boundaries.ts).
 *
 * KL day boundary conversion: calendar day in Asia/Kuala_Lumpur → UTC instant.
 * Pure function, deterministic, no I/O.
 *
 * TC-F33-10-01, TC-F33-10-02
 */

import { describe, it, expect } from 'vitest'
import { startOfDayKL, endOfDayKL } from '@/lib/discounts/date-boundaries'

// ─── TC-F33-10-01: startOfDayKL — start of KL calendar day ───────────────

describe('[TC-F33-10-01] startOfDayKL — start of KL calendar day', () => {
    it('converts KL midnight to UTC instant for a given date string', () => {
        // Arrange: '2026-06-01' = 2026 June 1, 00:00:00 KL
        // KL is UTC+8, so 00:00 KL = 2026-05-31 16:00:00 UTC

        // Act
        const result = startOfDayKL('2026-06-01')

        // Assert
        expect(result).toBeInstanceOf(Date)
        // Convert to ISO to verify the UTC time
        const iso = result.toISOString()
        expect(iso).toBe('2026-05-31T16:00:00.000Z')
    })

    it('returns consistent result for Date input vs string input', () => {
        // Arrange
        const dateInput = new Date('2026-06-15')
        const stringInput = '2026-06-15'

        // Act
        const resultFromDate = startOfDayKL(dateInput)
        const resultFromString = startOfDayKL(stringInput)

        // Assert
        // Both should resolve to the same UTC instant (KL 00:00)
        expect(resultFromDate.getTime()).toBe(resultFromString.getTime())
    })

    it('handles month boundaries correctly (e.g., June 1 start vs May 31 end)', () => {
        // Arrange
        const jun1Start = startOfDayKL('2026-06-01')
        const may31End = endOfDayKL('2026-05-31')

        // Act
        const jun1Instant = jun1Start.getTime()
        const may31Instant = may31End.getTime()

        // Assert
        // Jun 1 00:00 KL should be 1 second after May 31 23:59:59 KL
        expect(jun1Instant).toBeGreaterThan(may31Instant)
        expect(jun1Instant - may31Instant).toBe(1) // 1 ms difference
    })

    it('handles year boundaries (Dec 31 → Jan 1)', () => {
        // Arrange
        const dec31End = endOfDayKL('2025-12-31')
        const jan1Start = startOfDayKL('2026-01-01')

        // Act
        const dec31Instant = dec31End.getTime()
        const jan1Instant = jan1Start.getTime()

        // Assert
        expect(jan1Instant).toBeGreaterThan(dec31Instant)
        expect(jan1Instant - dec31Instant).toBe(1) // 1 ms difference
    })

    it('produces milliseconds of 000 (start of second)', () => {
        // Arrange & Act
        const result = startOfDayKL('2026-08-15')

        // Assert
        expect(result.getMilliseconds()).toBe(0)
    })
})

// ─── TC-F33-10-02: endOfDayKL — end of KL calendar day ────────────────────

describe('[TC-F33-10-02] endOfDayKL — end of KL calendar day', () => {
    it('converts KL 23:59:59.999 to UTC instant for a given date', () => {
        // Arrange: '2026-08-31' = 2026 Aug 31, 23:59:59.999 KL
        // KL is UTC+8, so 23:59:59.999 KL = 2026-08-31 15:59:59.999 UTC

        // Act
        const result = endOfDayKL('2026-08-31')

        // Assert
        expect(result).toBeInstanceOf(Date)
        const iso = result.toISOString()
        expect(iso).toBe('2026-08-31T15:59:59.999Z')
    })

    it('returns consistent result for Date input vs string input', () => {
        // Arrange
        const dateInput = new Date('2026-08-31')
        const stringInput = '2026-08-31'

        // Act
        const resultFromDate = endOfDayKL(dateInput)
        const resultFromString = endOfDayKL(stringInput)

        // Assert
        expect(resultFromDate.getTime()).toBe(resultFromString.getTime())
    })

    it('23:59 same day KL is valid, 00:00 next day KL is expired', () => {
        // Arrange: A code expires at end of Aug 31 KL
        const expiresAt = endOfDayKL('2026-08-31')

        // 23:59:00 KL on Aug 31 = 15:59:00 UTC Aug 31
        const testTime1 = new Date('2026-08-31T15:59:00.000Z')
        // 00:00:00 KL on Sep 1 = 16:00:00 UTC Aug 31
        const testTime2 = new Date('2026-08-31T16:00:00.000Z')

        // Act & Assert
        expect(testTime1.getTime()).toBeLessThanOrEqual(expiresAt.getTime())
        expect(testTime2.getTime()).toBeGreaterThan(expiresAt.getTime())
    })

    it('produces milliseconds of 999 (end of second)', () => {
        // Arrange & Act
        const result = endOfDayKL('2026-08-15')

        // Assert
        expect(result.getMilliseconds()).toBe(999)
    })

    it('handles different months with different day counts', () => {
        // Arrange
        const feb28End = endOfDayKL('2026-02-28')
        const mar1Start = startOfDayKL('2026-03-01')

        // Act
        const feb28Instant = feb28End.getTime()
        const mar1Instant = mar1Start.getTime()

        // Assert
        // Mar 1 start should be exactly 1ms after Feb 28 end
        expect(mar1Instant - feb28Instant).toBe(1)
    })
})

// ─── Boundary condition: KL TZ is fixed UTC+8 (no DST) ────────────────────

describe('[TC-F33-10-01/02] KL timezone fixed UTC+8 (no DST)', () => {
    it('produces consistent 8-hour offset year-round', () => {
        // Arrange: Test dates in different seasons
        const winterDate = startOfDayKL('2026-01-15')
        const summerDate = startOfDayKL('2026-07-15')

        // Act
        // Both should have the same hour offset (UTC-8 for start of day)
        const winterHour = winterDate.getUTCHours()
        const summerHour = summerDate.getUTCHours()

        // Assert
        // Both should be 16:00 UTC (since KL 00:00 = UTC-8 hours = 16:00 prev day)
        expect(winterHour).toBe(16)
        expect(summerHour).toBe(16)
    })
})

// ─── Roundtrip: start → end same day ──────────────────────────────────────

describe('[TC-F33-10-01/02] Roundtrip: startOfDayKL + endOfDayKL same day', () => {
    it('endOfDay is after startOfDay for the same calendar day', () => {
        // Arrange
        const date = '2026-06-15'
        const start = startOfDayKL(date)
        const end = endOfDayKL(date)

        // Act & Assert
        expect(end.getTime()).toBeGreaterThan(start.getTime())
        // Difference should be ~86399999 ms (one day minus 1 ms)
        expect(end.getTime() - start.getTime()).toBe(86399999)
    })

    it('consecutive days: one day end + 1ms = next day start', () => {
        // Arrange
        const day1 = '2026-06-15'
        const day2 = '2026-06-16'

        const day1End = endOfDayKL(day1)
        const day2Start = startOfDayKL(day2)

        // Act & Assert
        expect(day2Start.getTime() - day1End.getTime()).toBe(1)
    })
})
