import { describe, expect, it } from 'vitest'
import { getBreakdown, getCostByArea, getErrorBreakdown, getKpiTotals, getPlanTable, getSeries, getTopShops } from '@/lib/admin/ai-usage/overview-queries'
import { resolvePeriod } from '@/lib/admin/ai-usage/period'
import { fakeDb } from './fake-db'

const NOW = new Date('2026-10-29T06:12:00.000Z')
const period = resolvePeriod({}, NOW)

describe('TC-AIS-OV-007 KPI totals and previous-period deltas', () => {
    it('queries the current and the previous window with their own bounds', async () => {
        const { db, calls } = fakeDb([{ cost: '38.42', calls: '9184', shops: '138', errors: '114', refused: '37', tokens_in: '1000', cached: '610', unpriced: '12' }], [{ cost: '31.10', calls: '8000' }])

        const current = await getKpiTotals(db, period.start, period.end)
        const previous = await getKpiTotals(db, period.prevStart, period.prevEnd)

        expect(current).toMatchObject({ cost: 38.42, calls: 9184, shops: 138, errors: 114, refused: 37, unpriced: 12, cachedTokensIn: 610 })
        expect(previous).toMatchObject({ cost: 31.1, calls: 8000, shops: 0 })
        expect(calls[0].params).toEqual([period.start.toISOString(), period.end.toISOString()])
        expect(calls[1].params).toEqual([period.prevStart.toISOString(), period.prevEnd.toISOString()])
        expect(calls[0].sql).toContain("outcome = 'error'")
        expect(calls[0].sql).toContain('cost_usd IS NULL')
    })

    it('zero-fills the series so every bucket of the period has a point', async () => {
        const { db, calls } = fakeDb([{ bucket: '2026-10-25', cost: '4.85', calls: '10', shops: '3', errors: '1', tokens_in: '100', cached: '50' }])

        const series = await getSeries(db, period)

        expect(series).toHaveLength(7)
        expect(series.find((s) => s.key === '2026-10-25')).toMatchObject({ cost: 4.85, calls: 10 })
        expect(series.find((s) => s.key === '2026-10-26')).toMatchObject({ cost: 0, calls: 0 })
        expect(calls[0].sql).toContain('GROUP BY 1')
        expect(calls[0].sql).toContain('Asia/Kuala_Lumpur')
    })

    it('splits cost per bucket by area group', async () => {
        const { db } = fakeDb([{ bucket: '2026-10-29', grp: 'pictures', cost: '1.5' }, { bucket: '2026-10-29', grp: 'website-setup', cost: '2' }, { bucket: '2026-01-01', grp: 'pictures', cost: '9' }])

        const buckets = await getCostByArea(db, period)

        const today = buckets.find((b) => b.key === '2026-10-29')
        expect(today?.byArea.pictures).toBe(1.5)
        expect(today?.total).toBe(3.5)
        expect(buckets.reduce((s, b) => s + b.total, 0)).toBe(3.5) // the out-of-period bucket is ignored
    })
})

describe('TC-AIS-OV-008 percentile query shape', () => {
    it('takes p50 / p90 / max of cost per shop per active day, grouped by plan', async () => {
        const { db, calls } = fakeDb([
            { plan_group: 'free', shops: '92', cost: '14.2', p50: '0.006', p90: '0.09', max: '4.85' },
            { plan_group: 'unknown', shops: '3', cost: '0.1', p50: null, p90: null, max: null },
        ])

        const rows = await getPlanTable(db, period)

        expect(rows[0]).toEqual({ plan: 'free', shops: 92, cost: 14.2, p50: 0.006, p90: 0.09, max: 4.85 })
        expect(rows[1]).toMatchObject({ plan: 'unknown', p50: null })
        const sql = calls[0].sql
        expect(sql).toContain('WITH per_day AS')
        expect(sql).toContain('GROUP BY 1, 2, 3') // tenant, plan group, day
        expect(sql).toContain('percentile_cont(0.5) WITHIN GROUP (ORDER BY cost)')
        expect(sql).toContain('percentile_cont(0.9) WITHIN GROUP (ORDER BY cost)')
        expect(sql).toContain('tenant_id IS NOT NULL')
        expect(calls[0].params).toContain(period.start.toISOString())
    })
})

describe('TC-AIS-OV-009 top shops, breakdowns and errors', () => {
    it('orders top shops by the whitelisted sort column and parameterises the limit', async () => {
        const { db, calls } = fakeDb([{ tenant_id: 412, name: null, plan_group: 'starter', cost: '5.62', calls: '214', errors: '9', avg_day: '0.8', max_day: '4.85', max_day_key: '2026-10-25', total: '138' }])

        const { shops, totalShops } = await getTopShops(db, period, 'errors', 10)

        expect(calls[0].sql).toContain('ORDER BY errors DESC')
        expect(calls[0].params).toContain(10)
        expect(totalShops).toBe(138)
        expect(shops[0]).toMatchObject({ tenantId: 412, name: 'Shop #412', plan: 'starter', cost: 5.62, maxDayKey: '2026-10-25' })
    })

    it('computes avg per priced call, cache hit and error rate; null cache stays n/a', async () => {
        const { db } = fakeDb([
            { k: 'page-blocks', label: 'Page blocks', sub: 'website-setup', calls: '280', unpriced: '0', cost: '10.46', priced_calls: '280', cached: '670', tokens_in: '1000', errors: '9' },
            { k: 'generate-picture', label: 'Generate picture', sub: 'pictures', calls: '240', unpriced: '0', cost: '9.6', priced_calls: '240', cached: null, tokens_in: '100', errors: '6' },
        ])

        const rows = await getBreakdown(db, period, 'task')

        expect(rows[0].avgPerCall).toBeCloseTo(10.46 / 280)
        expect(rows[0].cacheHit).toBe(67)
        expect(rows[0].errorRate).toBeCloseTo((9 / 280) * 100)
        expect(rows[1].cacheHit).toBeNull()
    })

    it('scopes a breakdown to one shop when asked', async () => {
        const { db, calls } = fakeDb([])
        await getBreakdown(db, period, 'model', 8, 412)
        expect(calls[0].sql).toContain('AND tenant_id = $3')
        expect(calls[0].params).toContain(412)
    })

    it('groups errors by code and model and builds provider:model', async () => {
        const { db } = fakeDb([{ code: 'rate_limited', model: 'claude-haiku-5-5', provider: 'anthropic', label: 'Rate limited (429)', n: '41', last_seen: '2026-10-29T05:52:00.000Z' }])
        const [row] = await getErrorBreakdown(db, period)
        expect(row).toEqual({ code: 'rate_limited', label: 'Rate limited (429)', model: 'anthropic:claude-haiku-5-5', count: 41, lastSeen: '2026-10-29T05:52:00.000Z', detail: null })
    })

    it('TC-AIS-LOG-008 gives the latest status + provider message of each error group', async () => {
        const detail = 'AI_APICallError 400: This model does not support assistant message prefill.'
        const { db } = fakeDb([{ code: 'AI_APICallError', model: 'claude-haiku-5-5', provider: 'anthropic', label: 'Model provider error', n: '3', last_seen: '2026-11-03T07:52:58.000Z', detail }])
        const [row] = await getErrorBreakdown(db, period)
        expect(row?.detail).toBe(detail)
    })
})
