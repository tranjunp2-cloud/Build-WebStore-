import { describe, expect, it } from 'vitest'
import { buildLogWhere, hasActiveFilters, logsQuery, parseLimit, parseLogFilters } from '@/lib/admin/ai-usage/log-filters'
import { getLogRows, getLogTotals, getRunSiblings, mapLogRow } from '@/lib/admin/ai-usage/log-queries'
import { resolvePeriod } from '@/lib/admin/ai-usage/period'
import { fakeDb, render } from './fake-db'

const period = resolvePeriod({}, new Date('2026-10-29T06:12:00.000Z'))

describe('TC-AIS-LOG-001 parse filters from search params', () => {
    it('keeps valid values and drops unknown ones', () => {
        const f = parseLogFilters({ q: ' kedai ', plan: 'starter', area: 'pictures', task: 'page-blocks', model: 'gpt-5-mini', outcome: 'error', unpriced: '1', shop: '412' })
        expect(f).toEqual({ q: 'kedai', plan: 'starter', area: 'pictures', task: 'page-blocks', model: 'gpt-5-mini', outcome: 'error', unpriced: true, tenantId: 412 })
        const bad = parseLogFilters({ plan: 'platinum', area: 'products', outcome: 'maybe', unpriced: 'yes', shop: '-3' })
        expect(bad).toEqual({ q: undefined, plan: undefined, area: undefined, task: undefined, model: undefined, outcome: undefined, unpriced: false, tenantId: undefined })
        expect(hasActiveFilters(bad)).toBe(false)
    })

    it('pages by 25 up to 500', () => {
        expect(parseLimit({})).toBe(25)
        expect(parseLimit({ limit: '50' })).toBe(50)
        expect(parseLimit({ limit: '51' })).toBe(75)
        expect(parseLimit({ limit: '99999' })).toBe(500)
        expect(parseLimit({ limit: 'abc' })).toBe(25)
    })

    it('round-trips through the query string', () => {
        const filters = parseLogFilters({ plan: 'free', outcome: 'refused' })
        expect(logsQuery(period, filters, { limit: '50' }).toString()).toBe('plan=free&outcome=refused&limit=50')
    })
})

describe('TC-AIS-LOG-002 filters become parameterised SQL', () => {
    it('adds one parameter per filter and never inlines user text', () => {
        const filters = parseLogFilters({ q: "x'; DROP TABLE users;--", plan: 'free', area: 'pictures', task: 't1', model: 'm1', outcome: 'ok', unpriced: '1', shop: '5' })
        const { sql, params } = render(buildLogWhere(filters, period))
        expect(sql).not.toContain('DROP TABLE')
        expect(params).toContain("%x'; DROP TABLE users;--%")
        expect(params).toEqual(expect.arrayContaining(['free', 'pictures', 't1', 'm1', 5]))
        expect(sql).toContain('cost_usd IS NULL')
        expect(sql).toContain("outcome = 'ok'")
        expect(sql).toContain('name ILIKE')
        expect(sql).toContain('email ILIKE')
    })

    it('escapes LIKE wildcards in the shop search', () => {
        const { params } = render(buildLogWhere(parseLogFilters({ q: '50%_off' }), period))
        expect(params).toContain('%50\\%\\_off%')
    })

    it('maps the error and no-result outcomes', () => {
        expect(render(buildLogWhere(parseLogFilters({ outcome: 'error' }), period)).sql).toContain("outcome IS NULL AND success = false")
        expect(render(buildLogWhere(parseLogFilters({ outcome: 'refused' }), period)).sql).toContain("outcome = 'refused'")
    })

    it('without filters only the period applies', () => {
        const { sql, params } = render(buildLogWhere(parseLogFilters({}), period))
        expect(params).toEqual([period.start.toISOString(), period.end.toISOString()])
        expect(sql).not.toContain('ILIKE')
    })
})

describe('TC-AIS-LOG-003 rows, totals and pagination', () => {
    it('limits and orders newest first with a stable tie-break', async () => {
        const { db, calls } = fakeDb([])
        await getLogRows(db, parseLogFilters({}), period, 50)
        expect(calls[0].sql).toContain('ORDER BY created_at DESC, id DESC LIMIT $3')
        expect(calls[0].params[2]).toBe(50)
    })

    it('totals cover the whole filtered set', async () => {
        const { db, calls } = fakeDb([{ calls: '9184', cost: '38.42', errors: '114', unpriced: '12' }])
        const totals = await getLogTotals(db, parseLogFilters({ plan: 'free' }), period)
        expect(totals).toEqual({ calls: 9184, cost: 38.42, errors: 114, unpriced: 12 })
        expect(calls[0].sql).not.toContain('LIMIT')
        expect(calls[0].params).toContain('free')
    })

    it('keeps an unpriced call as null cost, never 0', () => {
        const row = mapLogRow({ id: '1', created_at: '2026-10-29T05:00:00Z', model: 'claude-haiku-5-5-20261015', cost_usd: null, outcome: 'ok', plan: null, area: 'products', feature: 'writing', tokens_in: '10', tokens_out: '5' })
        expect(row.costUsd).toBeNull()
        expect(row.plan).toBe('unknown')
        expect(row.areaGroup).toBe('writing')
        expect(row.taskLabel).toBe('AI call')
    })

    it('treats a legacy row without outcome and success=false as an error', () => {
        expect(mapLogRow({ id: 1, created_at: '2026-10-29T05:00:00Z', model: 'm', outcome: null, success: false }).outcome).toBe('error')
    })
})

describe('TC-AIS-LOG-004 drawer: other calls in the same reply', () => {
    it('loads calls with the same run id, excluding the opened one, oldest first', async () => {
        const { db, calls } = fakeDb([
            { id: 11, created_at: '2026-10-29T05:00:01Z', model: 'm', task_label: 'Chat reply', run_id: 'run_1', outcome: 'ok' },
            { id: 12, created_at: '2026-10-29T05:00:02Z', model: 'm', task_label: 'Summarize chat', run_id: 'run_1', outcome: 'ok' },
        ])

        const siblings = await getRunSiblings(db, 'run_1', 10)

        expect(siblings.map((s) => s.id)).toEqual([11, 12])
        expect(calls[0].sql).toContain('run_id = $1 AND id <> $2')
        expect(calls[0].sql).toContain('ORDER BY created_at ASC')
        expect(calls[0].params.slice(0, 2)).toEqual(['run_1', 10])
    })
})
