import { describe, expect, it } from 'vitest'
import {
    getBrowserViewerTimeZone,
    getViewerCustomDateRange,
    getViewerDayRange,
    getViewerPeriodStart,
    normalizeViewerTimeZone,
    shiftViewerDateKey,
} from '@/lib/viewer-timezone'

describe('viewer timezone helpers', () => {
    it('canonicalizes IANA timezone names and safely falls back to UTC', () => {
        const canonicalVietnamTimeZone = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Ho_Chi_Minh',
        }).resolvedOptions().timeZone

        expect(normalizeViewerTimeZone('Asia/Ho_Chi_Minh')).toBe(canonicalVietnamTimeZone)
        expect(normalizeViewerTimeZone('america/new_york')).toBe('America/New_York')
        expect(normalizeViewerTimeZone('AMERICA/NEW_YORK')).toBe('America/New_York')
        expect(normalizeViewerTimeZone('US/Eastern')).toBe('America/New_York')
        expect(normalizeViewerTimeZone('not-a-timezone')).toBe('UTC')
        expect(normalizeViewerTimeZone(undefined)).toBe('UTC')
        expect(normalizeViewerTimeZone(['UTC'])).toBe('UTC')
        expect(normalizeViewerTimeZone({ timeZone: 'UTC' })).toBe('UTC')
        expect(getBrowserViewerTimeZone()).toBe(
            normalizeViewerTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone),
        )
    })

    it('calculates exact local-day boundaries for GMT+7 and GMT+8 viewers', () => {
        const now = new Date('2026-08-03T05:00:00.000Z')

        expect(getViewerDayRange(now, 'Asia/Ho_Chi_Minh')).toEqual({
            start: new Date('2026-08-02T17:00:00.000Z'),
            end: new Date('2026-08-03T17:00:00.000Z'),
            dayKey: '2026-08-03',
        })
        expect(getViewerDayRange(now, 'Asia/Kuala_Lumpur')).toEqual({
            start: new Date('2026-08-02T16:00:00.000Z'),
            end: new Date('2026-08-03T16:00:00.000Z'),
            dayKey: '2026-08-03',
        })
    })

    it('handles daylight-saving days without assuming every day is 24 hours', () => {
        const springForward = getViewerDayRange(
            new Date('2026-03-08T16:00:00.000Z'),
            'America/New_York',
        )

        expect(springForward.start.toISOString()).toBe('2026-03-08T05:00:00.000Z')
        expect(springForward.end.toISOString()).toBe('2026-03-09T04:00:00.000Z')
        expect(springForward.end.getTime() - springForward.start.getTime())
            .toBe(23 * 60 * 60 * 1000)
    })

    it.each([
        {
            timeZone: 'Africa/Cairo',
            now: '2026-04-24T12:00:00.000Z',
            start: '2026-04-23T22:00:00.000Z',
            end: '2026-04-24T21:00:00.000Z',
        },
        {
            timeZone: 'Asia/Beirut',
            now: '2026-03-29T12:00:00.000Z',
            start: '2026-03-28T22:00:00.000Z',
            end: '2026-03-29T21:00:00.000Z',
        },
    ])('uses the first valid instant when $timeZone skips local midnight', ({
        timeZone,
        now,
        start,
        end,
    }) => {
        const range = getViewerDayRange(new Date(now), timeZone)

        expect(range.start.toISOString()).toBe(start)
        expect(range.end.toISOString()).toBe(end)
    })

    it('calculates week, month and year starts in the viewer calendar', () => {
        const now = new Date('2026-08-03T05:00:00.000Z')

        expect(getViewerPeriodStart(now, 'Asia/Ho_Chi_Minh', 'thisWeek').toISOString())
            .toBe('2026-08-01T17:00:00.000Z')
        expect(getViewerPeriodStart(now, 'Asia/Ho_Chi_Minh', 'thisMonth').toISOString())
            .toBe('2026-07-31T17:00:00.000Z')
        expect(getViewerPeriodStart(now, 'Asia/Ho_Chi_Minh', 'thisYear').toISOString())
            .toBe('2025-12-31T17:00:00.000Z')
    })

    it('converts inclusive custom calendar dates without rewriting their timezone', () => {
        const range = getViewerCustomDateRange(
            '2026-08-01',
            '2026-08-03',
            'Asia/Ho_Chi_Minh',
        )

        expect(range?.start.toISOString()).toBe('2026-07-31T17:00:00.000Z')
        expect(range?.endInclusive.toISOString()).toBe('2026-08-03T16:59:59.999Z')
        expect(getViewerCustomDateRange('2026-08-03', '2026-08-01', 'UTC')).toBeNull()
        expect(shiftViewerDateKey('2026-02-28', 1)).toBe('2026-03-01')
    })
})
