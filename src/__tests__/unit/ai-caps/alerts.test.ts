/**
 * TC-AICAP-PW-070..082 — cap alerts and the cron hook.
 * - 070 platform candidates: every alert level crossed, per period; caps off → none
 * - 071 shop candidates: 100 % of the effective daily budget only; unlimited / disabled / zero-budget shops skipped
 * - 072 insert is idempotent: the same crossing twice inserts once (unique key emulated), a new period inserts again
 * - 073 messages: one per platform scope (highest new level), one for all shops; capped list
 * - 074 runCapAlerts end to end: rows written, Lark called only for new rows, marked notified
 * - 075 second run adds nothing and sends nothing
 * - 076 without LARK_WEBHOOK_AI_ALERTS rows are still written, nothing is sent
 * - 077 a failing Lark post never throws and leaves notified_lark false
 * - 078 postLarkAlert: plain JSON text body, ok / code≠0 / HTTP error / network error / timeout signal
 * - 079 the cron route reports alerts and survives an alerts failure
 * Real: alerts, spend queries, effective limits, caps, lark-notify, cron route. Faked: Payload SQL handle (by table), fetch.
 */
import { PgDialect } from 'drizzle-orm/pg-core'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ execute: vi.fn(), find: vi.fn(), syncUsageEvents: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ find: mocks.find, db: { drizzle: { execute: mocks.execute } } })) }))
vi.mock('@/lib/ai-platform/usage-sync', () => ({ syncUsageEvents: mocks.syncUsageEvents, usageSyncUnconfigured: () => null }))

import { GET as cron } from '@/app/api/cron/ai-usage-sync/route'
import { alertMessages, insertNewAlerts, platformCandidates, runCapAlerts, shopCandidates, type AlertCandidate } from '@/lib/admin/ai-caps/alerts'
import type { LimitContext } from '@/lib/admin/ai-caps/effective-limits'
import { postLarkAlert } from '@/lib/admin/ai-caps/lark-notify'
import { clearAiConfigCache } from '@/lib/ai-platform/ai-config'

const dialect = new PgDialect()
const NOW = Date.parse('2026-10-29T10:00:00Z')
const caps = { dailyUsd: 20, monthlyUsd: 500, alertPercents: [50, 80, 100], pauseFreeAtPercent: null }
const noOverrides = new Map()
const context = (planValues: Record<string, Record<string, string>> = {}): LimitContext => ({
    planValues: new Map(Object.entries(planValues)), overrides: noOverrides, planByTenant: new Map([[1, 'FREEMIUM'], [2, 'STANDARD_TM_USER'], [3, 'FREEMIUM']]),
})

/** Fake database: usage queries return fixed numbers; ai_cap_alerts keeps rows in memory and enforces the unique key. */
function fakeDb(opts: { today?: number; month?: number; shops?: Array<{ tenant_id: number; name: string; day_usd: number; month_usd: number }>; planRows?: Array<Record<string, unknown>> } = {}) {
    const alerts: Array<{ id: number; key: string; scope: string; threshold: number; notified: boolean; params: unknown[] }> = []
    mocks.execute.mockImplementation(async (query) => {
        const { sql, params } = dialect.sqlToQuery(query)
        if (sql.includes('INSERT INTO ai_cap_alerts')) {
            const [scope, period, threshold, , , tenant] = params
            const key = [scope, period, threshold, tenant ?? 0].join('|')
            if (alerts.some((a) => a.key === key)) return { rows: [] }
            alerts.push({ id: alerts.length + 1, key, scope: String(scope), threshold: Number(threshold), notified: false, params })
            return { rows: [{ id: alerts.length }] }
        }
        if (sql.includes('UPDATE ai_cap_alerts')) {
            for (const id of params) { const row = alerts.find((a) => a.id === Number(id)); if (row) row.notified = true }
            return { rows: [] }
        }
        if (sql.includes('GROUP BY l.tenant_id')) return { rows: opts.shops ?? [] }
        if (sql.includes('FROM ai_usage_logs')) return { rows: [{ today: opts.today ?? 0, month: opts.month ?? 0 }] }
        if (sql.includes('FROM plan_features')) return { rows: opts.planRows ?? [] }
        return { rows: [] }
    })
    return alerts
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    clearAiConfigCache()
    mocks.find.mockResolvedValue({ docs: [{ settings: { caps: { dailyUsd: 20, monthlyUsd: 500 } }, updatedAt: '2026-10-01T00:00:00Z' }] })
})

describe('candidates', () => {
    it('TC-AICAP-PW-070 one candidate per alert level reached, keyed by Malaysia day / month; off caps give none', () => {
        const found = platformCandidates({ todayUsd: 17, monthUsd: 260 }, caps, NOW)
        expect(found.map((c) => [c.scope, c.periodKey, c.threshold])).toEqual([
            ['platform-daily', '2026-10-29', 50], ['platform-daily', '2026-10-29', 80], ['platform-monthly', '2026-10', 50],
        ])
        expect(found[1]).toMatchObject({ spentUsd: 17, capUsd: 20, tenantId: null })
        expect(platformCandidates({ todayUsd: 99, monthUsd: 999 }, { ...caps, dailyUsd: null, monthlyUsd: null }, NOW)).toEqual([])
        expect(platformCandidates({ todayUsd: 0, monthUsd: 0 }, caps, NOW)).toEqual([])
        // exactly at a level counts; the day key follows Malaysia time, not UTC
        expect(platformCandidates({ todayUsd: 20, monthUsd: 0 }, { ...caps, alertPercents: [100] }, Date.parse('2026-10-29T17:00:00Z'))[0]).toMatchObject({ periodKey: '2026-10-30', threshold: 100 })
    })

    it('TC-AICAP-PW-071 a shop alerts once, at 100 % of its effective daily budget; unlimited, AI-off and zero-budget shops never do', () => {
        const shops = [
            { tenantId: 1, name: 'At limit', rolling24hUsd: 0.05, monthUsd: 0 },
            { tenantId: 3, name: 'Under', rolling24hUsd: 0.049, monthUsd: 0 },
            { tenantId: 2, name: 'Unlimited', rolling24hUsd: 50, monthUsd: 0 },
        ]
        const found = shopCandidates(shops, context({ FREEMIUM: { ai_budget_usd_daily: '0.05' }, STANDARD_TM_USER: { ai_budget_usd_daily: 'UNLIMITED' } }), NOW)
        expect(found).toEqual([expect.objectContaining({ scope: 'shop-daily', periodKey: '2026-10-29', threshold: 100, tenantId: 1, spentUsd: 0.05, capUsd: 0.05, shopLabel: 'At limit (#1, FREEMIUM)' })])
        const off = shopCandidates([shops[0]!, shops[1]!], context({ FREEMIUM: { ai_enabled: 'NO', ai_budget_usd_daily: '0.05' } }), NOW)
        expect(off).toEqual([])
        expect(shopCandidates([shops[0]!], context({ FREEMIUM: { ai_budget_usd_daily: '0' } }), NOW)).toEqual([])
    })
})

describe('insertNewAlerts', () => {
    const candidate: AlertCandidate = { scope: 'platform-daily', periodKey: '2026-10-29', threshold: 80, spentUsd: 17, capUsd: 20, tenantId: null }

    it('TC-AICAP-PW-072 inserts a crossing once; the same one again adds nothing; the next day or another shop is new', async () => {
        const rows = fakeDb()
        const handle = { db: { drizzle: { execute: mocks.execute } } }
        expect(await insertNewAlerts(handle, [candidate])).toHaveLength(1)
        expect(await insertNewAlerts(handle, [candidate])).toHaveLength(0)
        expect(await insertNewAlerts(handle, [{ ...candidate, periodKey: '2026-10-30' }, { ...candidate, scope: 'shop-daily', tenantId: 5 }, { ...candidate, scope: 'shop-daily', tenantId: 6 }])).toHaveLength(3)
        expect(rows).toHaveLength(4)
        const sql = dialect.sqlToQuery(mocks.execute.mock.calls[0]![0]).sql
        expect(sql).toContain('ON CONFLICT DO NOTHING')
        expect(sql).toContain('RETURNING id')
    })
})

describe('messages', () => {
    const fresh = (scope: AlertCandidate['scope'], threshold: number, id: number, extra: Partial<AlertCandidate> = {}) => ({
        id, candidate: { scope, periodKey: '2026-10-29', threshold, spentUsd: 17, capUsd: 20, tenantId: null, ...extra },
    })

    it('TC-AICAP-PW-073 one message per platform scope at its highest new level; one for all shops, capped at ten names', () => {
        const shops = Array.from({ length: 12 }, (_, i) => fresh('shop-daily', 100, 10 + i, { tenantId: i + 1, shopLabel: `Shop ${i + 1} (#${i + 1}, FREEMIUM)`, spentUsd: 0.05, capUsd: 0.05 }))
        const messages = alertMessages([fresh('platform-daily', 50, 1), fresh('platform-daily', 80, 2), fresh('platform-monthly', 50, 3, { periodKey: '2026-10' }), ...shops])
        expect(messages).toHaveLength(3)
        expect(messages[0]).toEqual({ text: '[AI spend] Platform daily cap (today 2026-10-29, Malaysia time) is at 80%: $17.00 of $20.00.', ids: [1, 2] })
        expect(messages[1]!.text).toContain('monthly cap (2026-10) is at 50%')
        expect(messages[2]!.ids).toHaveLength(12)
        expect(messages[2]!.text).toContain('12 shops reached their 24 h AI budget')
        expect(messages[2]!.text).toContain('Shop 10 (#10, FREEMIUM): $0.0500 of $0.0500')
        expect(messages[2]!.text).not.toContain('Shop 11')
        expect(messages[2]!.text.endsWith('and 2 more')).toBe(true)
        expect(alertMessages([])).toEqual([])
    })
})

describe('runCapAlerts', () => {
    const shopRow = { tenant_id: 1, name: 'Aroma', day_usd: 0.05, month_usd: 0.05 }
    const planRows = [{ plan_code: 'FREEMIUM', feature_code: 'ai_budget_usd_daily', value: '0.05' }]
    // 85 % of the $20 day (levels 50 and 80), 20 % of the $500 month (none), one Free shop at its $0.05 budget
    const scene = { today: 17, month: 100, shops: [shopRow], planRows }

    it('TC-AICAP-PW-074 writes the crossings, announces only new rows (one message per scope) and marks them notified', async () => {
        const rows = fakeDb(scene)
        const notify = vi.fn(async (_text: string) => true)
        const result = await runCapAlerts(NOW, notify)
        expect(result).toEqual({ crossed: 3, created: 3, notified: 3 })
        expect(rows.map((r) => [r.scope, r.threshold])).toEqual([['platform-daily', 50], ['platform-daily', 80], ['shop-daily', 100]])
        expect(rows.every((r) => r.notified)).toBe(true)
        expect(notify).toHaveBeenCalledTimes(2)
        expect(notify.mock.calls[0]![0]).toContain('Platform daily cap')
        expect(notify.mock.calls[1]![0]).toContain('Aroma (#1, FREEMIUM): $0.0500 of $0.0500')
    })

    it('TC-AICAP-PW-075 the next run (nothing new) adds no row and sends no message; a higher level later is announced alone', async () => {
        const state = { ...scene }
        const rows = fakeDb(state)
        const notify = vi.fn(async (_text: string) => true)
        await runCapAlerts(NOW, notify)
        notify.mockClear()
        expect(await runCapAlerts(NOW + 300_000, notify)).toEqual({ crossed: 3, created: 0, notified: 0 })
        expect(notify).not.toHaveBeenCalled()
        expect(rows).toHaveLength(3)

        state.today = 20 // the day's cap is reached
        const third = await runCapAlerts(NOW + 600_000, notify)
        expect(third).toEqual({ crossed: 4, created: 1, notified: 1 })
        expect(notify).toHaveBeenCalledTimes(1)
        expect(notify.mock.calls[0]![0]).toContain('is at 100%')
        expect(rows.at(-1)).toMatchObject({ scope: 'platform-daily', threshold: 100 })
    })

    it('TC-AICAP-PW-076 without LARK_WEBHOOK_AI_ALERTS the rows are still recorded and nothing is sent', async () => {
        const rows = fakeDb(scene)
        const fetchSpy = vi.fn()
        vi.stubGlobal('fetch', fetchSpy)
        const result = await runCapAlerts(NOW) // default notifier = postLarkAlert, env unset
        expect(result).toEqual({ crossed: 3, created: 3, notified: 0 })
        expect(fetchSpy).not.toHaveBeenCalled()
        expect(rows.some((r) => r.notified)).toBe(false)
    })

    it('TC-AICAP-PW-077 a Lark failure never throws and leaves the rows un-notified', async () => {
        const rows = fakeDb(scene)
        vi.stubEnv('LARK_WEBHOOK_AI_ALERTS', 'https://open.larksuite.com/open-apis/bot/v2/hook/abc')
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const result = await runCapAlerts(NOW)
        expect(result).toEqual({ crossed: 3, created: 3, notified: 0 })
        expect(rows.some((r) => r.notified)).toBe(false)
    })

    it('TC-AICAP-PW-077b a Lark success marks the rows through the default notifier', async () => {
        const rows = fakeDb(scene)
        vi.stubEnv('LARK_WEBHOOK_AI_ALERTS', 'https://open.larksuite.com/open-apis/bot/v2/hook/abc')
        const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ code: 0, msg: 'success' }), { status: 200 }))
        vi.stubGlobal('fetch', fetchSpy)
        expect(await runCapAlerts(NOW)).toEqual({ crossed: 3, created: 3, notified: 3 })
        expect(fetchSpy).toHaveBeenCalledTimes(2)
        expect(rows.every((r) => r.notified)).toBe(true)
    })
})

describe('postLarkAlert', () => {
    const url = 'https://open.larksuite.com/open-apis/bot/v2/hook/abc'

    it('TC-AICAP-PW-078 posts a plain text message when the webhook is set; false when it is not', async () => {
        const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ code: 0 }), { status: 200 }))
        expect(await postLarkAlert('hello', fetchImpl as unknown as typeof fetch)).toBe(false)
        expect(fetchImpl).not.toHaveBeenCalled()

        vi.stubEnv('LARK_WEBHOOK_AI_ALERTS', url)
        expect(await postLarkAlert('hello', fetchImpl as unknown as typeof fetch)).toBe(true)
        const [calledUrl, init] = fetchImpl.mock.calls[0]!
        expect(calledUrl).toBe(url)
        expect(init.method).toBe('POST')
        expect(JSON.parse(String(init.body))).toEqual({ msg_type: 'text', content: { text: 'hello' } })
        expect(init.signal).toBeInstanceOf(AbortSignal)
    })

    it('TC-AICAP-PW-078b HTTP errors, Lark error codes and network failures all return false without throwing', async () => {
        vi.stubEnv('LARK_WEBHOOK_AI_ALERTS', url)
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const respond = (body: BodyInit | null, status = 200) => (async () => new Response(body, { status })) as unknown as typeof fetch
        expect(await postLarkAlert('x', respond('oops', 500))).toBe(false)
        expect(await postLarkAlert('x', respond(JSON.stringify({ code: 19001, msg: 'param invalid' })))).toBe(false)
        expect(await postLarkAlert('x', respond(JSON.stringify({ StatusCode: 0 })))).toBe(true)
        expect(await postLarkAlert('x', respond('not json'))).toBe(true) // 200 without a body we can read: Lark accepted it
        expect(await postLarkAlert('x', (async () => { throw new Error('timeout') }) as unknown as typeof fetch)).toBe(false)
    })
})

describe('cron hook', () => {
    const call = () => cron(new NextRequest('https://prime.test/api/cron/ai-usage-sync', { headers: { authorization: 'Bearer cron-secret' } }))

    beforeEach(() => {
        vi.stubEnv('CRON_SECRET', 'cron-secret')
        mocks.syncUsageEvents.mockResolvedValue({ fetched: 0, inserted: 0, pages: 1, cursor: 0 })
    })

    it('TC-AICAP-PW-079 the cron evaluates the caps after the copy and reports the result', async () => {
        fakeDb({ today: 11, month: 0 })
        const body = await (await call()).json()
        expect(body).toMatchObject({ success: true, fetched: 0, alerts: { crossed: 1, created: 1, notified: 0 } })
        expect(mocks.syncUsageEvents.mock.invocationCallOrder[0]).toBeLessThan(mocks.execute.mock.invocationCallOrder[0]!)
    })

    it('TC-AICAP-PW-079b an alerts failure is reported but never fails the sync', async () => {
        mocks.execute.mockRejectedValue(new Error('db down'))
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        const res = await call()
        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({ success: true, alerts: { error: 'Cap alerts failed' } })
    })

    it('TC-AICAP-PW-079c nothing is evaluated when the copy itself fails', async () => {
        mocks.syncUsageEvents.mockRejectedValue(new Error('upstream 502'))
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        expect((await call()).status).toBe(500)
        expect(mocks.execute).not.toHaveBeenCalled()
    })
})
