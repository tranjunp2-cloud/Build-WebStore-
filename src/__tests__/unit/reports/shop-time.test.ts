/**
 * TC-AICP-186 — report periods in the shop's time (Asia/Kuala_Lumpur, UTC+8): today / yesterday / 7 / 30 days,
 * this and last month, custom ranges, and the previous period each one is compared with.
 */
import { describe, expect, it } from 'vitest'
import {
    MAX_CUSTOM_DAYS,
    ReportPeriodError,
    addDaysToKey,
    dayKeysOf,
    resolveReportPeriods,
    shopDayKey,
} from '@/lib/reports/shop-time'

// 2026-10-22 12:00 KL
const NOW = new Date('2026-10-22T04:00:00Z')
const span = (r: { fromKey: string; toKey: string; days: number }) => [r.fromKey, r.toKey, r.days]

describe('[TC-AICP-186] report periods', () => {
    it('uses the Kuala Lumpur day, not the UTC day, for "today"', () => {
        // 17:30 UTC on the 21st is already 01:30 on the 22nd in KL
        const late = new Date('2026-10-21T17:30:00Z')

        expect(shopDayKey(late)).toBe('2026-10-22')
        expect(resolveReportPeriods({ period: 'today' }, late).current.fromKey).toBe('2026-10-22')
        expect(resolveReportPeriods({ period: 'today' }, new Date('2026-10-21T15:59:59Z')).current.fromKey).toBe('2026-10-21')
    })

    it('turns each shop day into the right UTC window (00:00 KL = 16:00 UTC the day before)', () => {
        const { current } = resolveReportPeriods({ period: 'today' }, NOW)

        expect(current.start.toISOString()).toBe('2026-10-21T16:00:00.000Z')
        expect(current.end.toISOString()).toBe('2026-10-22T16:00:00.000Z')
    })

    it.each([
        ['today', ['2026-10-22', '2026-10-22', 1], ['2026-10-21', '2026-10-21', 1]],
        ['yesterday', ['2026-10-21', '2026-10-21', 1], ['2026-10-20', '2026-10-20', 1]],
        ['last_7_days', ['2026-10-16', '2026-10-22', 7], ['2026-10-09', '2026-10-15', 7]],
        ['last_30_days', ['2026-09-23', '2026-10-22', 30], ['2026-08-24', '2026-09-22', 30]],
        ['this_month', ['2026-10-01', '2026-10-22', 22], ['2026-09-01', '2026-09-22', 22]],
        ['last_month', ['2026-09-01', '2026-09-30', 30], ['2026-08-01', '2026-08-31', 31]],
    ] as const)('%s compares with the span right before it', (period, current, previous) => {
        const periods = resolveReportPeriods({ period }, NOW)

        expect(span(periods.current)).toEqual(current)
        expect(span(periods.previous)).toEqual(previous)
        expect(periods.current.key).toBe(period)
        expect(periods.previous.key).toBe('previous')
    })

    it('compares month-to-date with the same days of last month, capped at its length', () => {
        // 31 Mar vs February (28 days in 2027)
        const march = resolveReportPeriods({ period: 'this_month' }, new Date('2027-03-31T04:00:00Z'))
        // January -> December of the year before
        const january = resolveReportPeriods({ period: 'last_month' }, new Date('2027-01-10T04:00:00Z'))

        expect(span(march.current)).toEqual(['2027-03-01', '2027-03-31', 31])
        expect(span(march.previous)).toEqual(['2027-02-01', '2027-02-28', 28])
        expect(span(january.current)).toEqual(['2026-12-01', '2026-12-31', 31])
        expect(span(january.previous)).toEqual(['2026-11-01', '2026-11-30', 30])
    })

    it('handles a custom range and compares it with the same number of days before', () => {
        const periods = resolveReportPeriods({ period: 'custom', from: '2026-10-01', to: '2026-10-15' }, NOW)

        expect(span(periods.current)).toEqual(['2026-10-01', '2026-10-15', 15])
        expect(span(periods.previous)).toEqual(['2026-09-16', '2026-09-30', 15])
        expect(periods.current.end.toISOString()).toBe('2026-10-15T16:00:00.000Z')
    })

    it('refuses a custom range that is incomplete, backwards, impossible or too long', () => {
        const bad = (from: string | null, to: string | null) => () => resolveReportPeriods({ period: 'custom', from, to }, NOW)

        expect(bad(null, '2026-10-15')).toThrow(ReportPeriodError)
        expect(bad('2026-10-15', '2026-10-01')).toThrow('before the start')
        expect(bad('2026-02-30', '2026-03-05')).toThrow('not a real calendar date')
        expect(bad('15/10/2026', '2026-10-20')).toThrow('YYYY-MM-DD')
        expect(bad('2025-01-01', '2026-10-01')).toThrow(`at most ${MAX_CUSTOM_DAYS} days`)
        expect(bad('2026-01-01', '2026-12-31')).not.toThrow()
    })

    it('lists every shop day of a range, across a month end', () => {
        const { current } = resolveReportPeriods({ period: 'custom', from: '2026-10-29', to: '2026-11-02' }, NOW)

        expect(dayKeysOf(current)).toEqual(['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
        expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01')
        expect(addDaysToKey('2028-03-01', -1)).toBe('2028-02-29')
    })
})

describe('sales definition does not promise a match with the dashboard card [TC-AICP-278]', () => {
    it('says the report days are Malaysia time and the card cuts days in UTC', async () => {
        const { SALES_DEFINITION } = await import('@/lib/reports/shop-reports')

        expect(SALES_DEFINITION).toMatch(/Malaysia time/)
        expect(SALES_DEFINITION).toMatch(/UTC/)
        expect(SALES_DEFINITION).toMatch(/do not tell the merchant the two must match/)
        expect(SALES_DEFINITION).not.toMatch(/\(the dashboard revenue card\)/)
    })
})
