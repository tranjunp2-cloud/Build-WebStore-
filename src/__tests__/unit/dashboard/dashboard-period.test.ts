import { describe, expect, it } from 'vitest'
import { dashboardDayKey, getDashboardPeriodRange } from '@/lib/dashboard/dashboard-period'
import { DASHBOARD_TIME_ZONE } from '@/lib/dashboard/timezone'

describe('[TC-F03.05] shared dashboard UTC period contract', () => {
    it('exports UTC as the single shared dashboard timezone', () => {
        // Arrange — the shared constant has no runtime setup

        // Act
        const timezone = DASHBOARD_TIME_ZONE

        // Assert
        expect(timezone).toBe('UTC')
    })

    it('builds one exact UTC day for today', () => {
        // Arrange
        const now = new Date('2026-07-27T23:59:59.999Z')

        // Act
        const range = getDashboardPeriodRange('today', now)

        // Assert
        expect(range).toEqual({
            rangeLabel: '27 Jul 2026',
            currentStart: new Date('2026-07-27T00:00:00.000Z'),
            currentEnd: new Date('2026-07-28T00:00:00.000Z'),
            previousStart: new Date('2026-07-26T00:00:00.000Z'),
            dayKeys: ['2026-07-27'],
        })
    })

    it('builds equal non-overlapping seven-day UTC windows', () => {
        // Arrange
        const now = new Date('2026-07-27T12:00:00.000Z')

        // Act
        const range = getDashboardPeriodRange('7d', now)

        // Assert
        expect(range.currentStart.toISOString()).toBe('2026-07-21T00:00:00.000Z')
        expect(range.currentEnd.toISOString()).toBe('2026-07-28T00:00:00.000Z')
        expect(range.previousStart.toISOString()).toBe('2026-07-14T00:00:00.000Z')
        expect(range.rangeLabel).toBe('21 – 27 Jul 2026')
        expect(range.dayKeys).toEqual([
            '2026-07-21',
            '2026-07-22',
            '2026-07-23',
            '2026-07-24',
            '2026-07-25',
            '2026-07-26',
            '2026-07-27',
        ])
    })

    it('builds exactly thirty UTC keys across month boundaries', () => {
        // Arrange
        const now = new Date('2026-03-01T01:30:00.000Z')

        // Act
        const range = getDashboardPeriodRange('30d', now)

        // Assert
        expect(range.currentStart.toISOString()).toBe('2026-01-31T00:00:00.000Z')
        expect(range.currentEnd.toISOString()).toBe('2026-03-02T00:00:00.000Z')
        expect(range.previousStart.toISOString()).toBe('2026-01-01T00:00:00.000Z')
        expect(range.rangeLabel).toBe('31 Jan – 1 Mar 2026')
        expect(range.dayKeys).toHaveLength(30)
        expect(range.dayKeys[0]).toBe('2026-01-31')
        expect(range.dayKeys.at(-1)).toBe('2026-03-01')
    })

    it('uses the UTC day for instants expressed with a non-UTC offset', () => {
        // Arrange — 06:59 in GMT+7 is still the previous UTC calendar day
        const offsetInstant = new Date('2026-07-28T06:59:59+07:00')

        // Act
        const dayKey = dashboardDayKey(offsetInstant)
        const range = getDashboardPeriodRange('today', offsetInstant)

        // Assert
        expect(dayKey).toBe('2026-07-27')
        expect(range.currentStart.toISOString()).toBe('2026-07-27T00:00:00.000Z')
    })
})
