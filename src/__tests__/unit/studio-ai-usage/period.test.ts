import { describe, expect, it } from 'vitest'
import { bucketLabel, klDay, periodQuery, rangeLabel, resolvePeriod, startOfKlDay } from '@/lib/admin/ai-usage/period'

// 2026-10-29 14:12 in Kuala Lumpur
const NOW = new Date('2026-10-29T06:12:00.000Z')

describe('TC-AIS-OV-001 period presets', () => {
    it('defaults to 7d ending at the end of today in Malaysia time', () => {
        const p = resolvePeriod({}, NOW)
        expect(p.key).toBe('7d')
        expect(p.fromDay).toBe('2026-10-23')
        expect(p.toDay).toBe('2026-10-29')
        expect(p.start.toISOString()).toBe('2026-10-22T16:00:00.000Z')
        expect(p.end.toISOString()).toBe('2026-10-29T16:00:00.000Z')
        expect(p.buckets).toHaveLength(7)
    })

    it.each([['30d', 30], ['90d', 90]])('%s covers %i day buckets', (key, days) => {
        expect(resolvePeriod({ period: key }, NOW).buckets).toHaveLength(days)
    })

    it('24h is a rolling window with hour buckets', () => {
        const p = resolvePeriod({ period: '24h' }, NOW)
        expect(p.bucket).toBe('hour')
        expect(p.end).toEqual(NOW)
        expect(p.start.getTime()).toBe(NOW.getTime() - 24 * 3600 * 1000)
        expect(p.buckets[p.buckets.length - 1]).toBe('2026-10-29 14:00')
    })

    it('falls back to 7d for an unknown preset', () => {
        expect(resolvePeriod({ period: 'forever' }, NOW).key).toBe('7d')
    })

    it('uses the Malaysia day, not the UTC day, near midnight', () => {
        const lateUtc = new Date('2026-10-29T17:30:00.000Z') // 30 Oct 01:30 in KL
        expect(klDay(lateUtc)).toBe('2026-10-30')
        expect(resolvePeriod({}, lateUtc).toDay).toBe('2026-10-30')
        expect(startOfKlDay('2026-10-30').toISOString()).toBe('2026-10-29T16:00:00.000Z')
    })
})

describe('TC-AIS-OV-002 previous period', () => {
    it('is the same length, directly before the period', () => {
        const p = resolvePeriod({ period: '7d' }, NOW)
        expect(p.prevEnd).toEqual(p.start)
        expect(p.prevEnd.getTime() - p.prevStart.getTime()).toBe(p.end.getTime() - p.start.getTime())
        expect(p.prevStart.toISOString()).toBe('2026-10-15T16:00:00.000Z')
    })
})

describe('TC-AIS-OV-003 custom range', () => {
    it('accepts from/to as inclusive Malaysia days', () => {
        const p = resolvePeriod({ from: '2026-10-01', to: '2026-10-10' }, NOW)
        expect(p.key).toBe('custom')
        expect(p.buckets).toHaveLength(10)
        expect(p.prevStart.toISOString()).toBe('2026-09-20T16:00:00.000Z')
        expect(periodQuery(p).toString()).toBe('from=2026-10-01&to=2026-10-10')
    })

    it('clamps an end date after today to today', () => {
        expect(resolvePeriod({ from: '2026-10-25', to: '2026-12-31' }, NOW).toDay).toBe('2026-10-29')
    })

    it.each([
        ['more than 92 days', { from: '2026-06-01', to: '2026-10-29' }],
        ['reversed', { from: '2026-10-10', to: '2026-10-01' }],
        ['not a real date', { from: '2026-02-31', to: '2026-03-02' }],
        ['not a date', { from: 'yesterday', to: 'today' }],
    ])('ignores a range that is %s', (_name, params) => {
        expect(resolvePeriod(params, NOW).key).toBe('7d')
    })
})

describe('TC-AIS-OV-004 labels', () => {
    it('labels buckets and ranges', () => {
        expect(bucketLabel('2026-10-29', 'day', '2026-10-29')).toBe('Today')
        expect(bucketLabel('2026-10-23', 'day', '2026-10-29')).toBe('Fri 23')
        expect(bucketLabel('2026-10-29 14:00', 'hour', '2026-10-29')).toBe('14:00')
        expect(rangeLabel(resolvePeriod({}, NOW))).toBe('23 – 29 Oct 2026')
    })
})
