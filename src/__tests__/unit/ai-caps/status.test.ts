/**
 * TC-AICAP-PW-050..061 — caps status: Malaysia day / month, effective caps, platform %/forecast/state, shops near
 * their limit or blocked, SQL shape (enum-safe), loadCapsStatus end to end on a fake database.
 * Real: malaysia-time, caps-config, status maths, spend queries, effective-limits. Faked: Payload (answers SQL by table).
 */
import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ execute: vi.fn(), find: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ find: mocks.find, db: { drizzle: { execute: mocks.execute } } })) }))

import { clearAiConfigCache } from '@/lib/ai-platform/ai-config'
import { envDailyBudgetUsd, resolveCaps } from '@/lib/admin/ai-caps/caps-config'
import type { LimitContext } from '@/lib/admin/ai-caps/effective-limits'
import { daysInMalaysiaMonth, malaysiaDayKey, malaysiaDayStart, malaysiaMonthKey, malaysiaMonthStart } from '@/lib/admin/ai-caps/malaysia-time'
import { classifyShops, loadCapsStatus, platformStatus } from '@/lib/admin/ai-caps/status'

const dialect = new PgDialect()
const NOW = Date.parse('2026-10-29T10:00:00Z') // 18:00 Malaysia, day 29 of 31

describe('Malaysia time', () => {
    it('TC-AICAP-PW-050 the day and month roll at 16:00 UTC (00:00 +08:00)', () => {
        expect(malaysiaDayKey(Date.parse('2026-10-29T15:59:59Z'))).toBe('2026-10-29')
        expect(malaysiaDayKey(Date.parse('2026-10-29T16:00:00Z'))).toBe('2026-10-30')
        expect(malaysiaMonthKey(Date.parse('2026-10-31T16:00:00Z'))).toBe('2026-11')
        expect(malaysiaMonthKey(Date.parse('2026-10-31T15:00:00Z'))).toBe('2026-10')
        expect(malaysiaDayStart(NOW).toISOString()).toBe('2026-10-28T16:00:00.000Z')
        expect(malaysiaMonthStart(NOW).toISOString()).toBe('2026-09-30T16:00:00.000Z')
        expect(daysInMalaysiaMonth(NOW)).toBe(31)
        expect(daysInMalaysiaMonth(Date.parse('2028-02-10T00:00:00Z'))).toBe(29)
    })
})

describe('effective caps', () => {
    it('TC-AICAP-PW-051 the saved daily cap wins; null/0 turn it off; absent falls back to AI_DAILY_BUDGET_USD (default 20, 0 = off)', () => {
        expect(resolveCaps({ dailyUsd: 30 }, {}).effective.dailyUsd).toBe(30)
        expect(resolveCaps({ dailyUsd: 30 }, {})).toMatchObject({ dailySource: 'settings' })
        expect(resolveCaps({ dailyUsd: null }, { AI_DAILY_BUDGET_USD: '5' })).toMatchObject({ dailySource: 'off', effective: { dailyUsd: null } })
        expect(resolveCaps({ dailyUsd: 0 }, {}).effective.dailyUsd).toBeNull()
        expect(resolveCaps(null, {})).toMatchObject({ dailySource: 'env', envDailyUsd: 20, effective: { dailyUsd: 20 } })
        expect(resolveCaps({}, { AI_DAILY_BUDGET_USD: '7.5' }).effective.dailyUsd).toBe(7.5)
        expect(resolveCaps(undefined, { AI_DAILY_BUDGET_USD: '0' })).toMatchObject({ dailySource: 'off', effective: { dailyUsd: null } })
        for (const junk of ['', 'abc', '-3']) expect(envDailyBudgetUsd({ AI_DAILY_BUDGET_USD: junk })).toBe(20)
    })

    it('TC-AICAP-PW-052 monthly off by default; alert levels default to 50/80/100 and come sorted; pause-Free carried', () => {
        expect(resolveCaps(null, {}).effective).toMatchObject({ monthlyUsd: null, alertPercents: [50, 80, 100], pauseFreeAtPercent: null })
        expect(resolveCaps({ monthlyUsd: 300, alertPercents: [90, 70], pauseFreeAtPercent: 80 }, {}).effective).toMatchObject({ monthlyUsd: 300, alertPercents: [70, 90], pauseFreeAtPercent: 80 })
        expect(resolveCaps({ monthlyUsd: 0 }, {}).effective.monthlyUsd).toBeNull()
    })
})

describe('platformStatus', () => {
    const caps = (extra: Partial<ReturnType<typeof resolveCaps>['effective']> = {}) => ({ dailyUsd: 20, monthlyUsd: 600, alertPercents: [50, 80, 100], pauseFreeAtPercent: 80, ...extra })

    it('TC-AICAP-PW-053 percent of each cap, a month-end forecast (MTD ÷ days elapsed × days in month) and the guard state', () => {
        // Arrange: 28.75 days into a 31-day month, $287.5 spent so far → $10/day → $310 forecast
        const status = platformStatus({ todayUsd: 10, monthUsd: 287.5 }, caps(), NOW)
        // Assert
        expect(status.dailyPercent).toBe(50)
        expect(status.monthlyPercent).toBe(47.9)
        expect(status.daysInMonth).toBe(31)
        expect(status.daysElapsed).toBe(28.75)
        expect(status.forecastMonthUsd).toBeCloseTo(310, 6)
        expect(status.forecastMonthlyPercent).toBe(51.7)
        expect(status.state).toBe('ok')
    })

    it('TC-AICAP-PW-054 Free pauses at the configured share, everyone at 100 %; caps that are off give null percents', () => {
        expect(platformStatus({ todayUsd: 16, monthUsd: 0 }, caps(), NOW).state).toBe('free-paused')
        expect(platformStatus({ todayUsd: 20, monthUsd: 0 }, caps(), NOW).state).toBe('all-paused')
        expect(platformStatus({ todayUsd: 0, monthUsd: 480 }, caps(), NOW).state).toBe('free-paused')
        expect(platformStatus({ todayUsd: 16, monthUsd: 0 }, caps({ pauseFreeAtPercent: null }), NOW).state).toBe('ok')
        const off = platformStatus({ todayUsd: 99, monthUsd: 99 }, caps({ dailyUsd: null, monthlyUsd: null }), NOW)
        expect(off).toMatchObject({ dailyPercent: null, monthlyPercent: null, forecastMonthlyPercent: null, state: 'ok' })
    })

    it('TC-AICAP-PW-055 on the first hours of a month the forecast divides by at least one day', () => {
        const first = Date.parse('2026-10-31T16:30:00Z') // 00:30 on 1 Nov, Malaysia
        const status = platformStatus({ todayUsd: 1, monthUsd: 1 }, caps(), first)
        expect(status.daysElapsed).toBe(1)
        expect(status.forecastMonthUsd).toBe(30) // November has 30 days
    })
})

const context = (over: Partial<LimitContext> = {}): LimitContext => ({
    planValues: new Map<string, Record<string, string>>([['FREEMIUM', { ai_budget_usd_daily: '0.05', ai_budget_usd_monthly: '1' }], ['STANDARD_TM_USER', { ai_budget_usd_daily: '1' }]]),
    overrides: new Map(),
    planByTenant: new Map([[1, 'FREEMIUM'], [2, 'FREEMIUM'], [3, 'STANDARD_TM_USER'], [4, 'FREEMIUM']]),
    ...over,
})
const shop = (tenantId: number, rolling24hUsd: number, monthUsd = 0) => ({ tenantId, name: `Shop ${tenantId}`, rolling24hUsd, monthUsd })

describe('classifyShops', () => {
    it('TC-AICAP-PW-056 near = 80..<100 % of the effective daily or monthly budget; ≥ 100 % = blocked; unlimited shops never appear', () => {
        const { nearLimit, blocked } = classifyShops([shop(1, 0.045), shop(2, 0.05), shop(3, 0.5), shop(4, 0.001, 0.85)], context(), NOW)
        expect(nearLimit.map((r) => [r.tenantId, r.limit, r.percent])).toEqual([[1, 'daily', 90], [4, 'monthly', 85]])
        expect(nearLimit[0]).toMatchObject({ plan: 'FREEMIUM', source: 'plan', spentUsd: 0.045, limitUsd: 0.05 })
        expect(blocked).toEqual([{ tenantId: 2, name: 'Shop 2', plan: 'FREEMIUM', source: 'plan', reason: 'daily-budget' }])
    })

    it('TC-AICAP-PW-057 a shop override changes the budget it is judged against, and a blocked override or an AI-off plan is listed as blocked', () => {
        const overrides = new Map([
            [1, { id: 1, tenantId: 1, shopName: 'Shop 1', mode: 'custom' as const, aiBudgetUsd: 1, picturesPerDay: null, aiBudgetUsdMonthly: null, siteBudgetUsd: null, expiresAt: null, reason: 'VIP', setById: 4, setByEmail: null, updatedAt: null }],
            [2, { id: 2, tenantId: 2, shopName: 'Shop 2', mode: 'blocked' as const, aiBudgetUsd: null, picturesPerDay: null, aiBudgetUsdMonthly: null, siteBudgetUsd: null, expiresAt: null, reason: 'abuse', setById: 4, setByEmail: null, updatedAt: null }],
        ])
        const planValues = new Map<string, Record<string, string>>([['FREEMIUM', { ai_budget_usd_daily: '0.05' }], ['STANDARD_TM_USER', { ai_enabled: 'NO' }]])
        const { nearLimit, blocked } = classifyShops([shop(1, 0.5), shop(2, 0.01), shop(3, 0.01)], context({ overrides, planValues }), NOW)
        expect(nearLimit).toEqual([])
        expect(blocked.map((b) => [b.tenantId, b.reason, b.source])).toEqual([[2, 'shop-blocked', 'shop'], [3, 'plan-off', 'plan']])
    })

    it('TC-AICAP-PW-058 a zero budget is "AI off", not "near the limit"', () => {
        const planValues = new Map([['FREEMIUM', { ai_budget_usd_daily: '0' }]])
        const { nearLimit, blocked } = classifyShops([shop(1, 0)], context({ planValues }), NOW)
        expect(nearLimit).toEqual([])
        expect(blocked).toEqual([expect.objectContaining({ tenantId: 1, reason: 'daily-budget' })])
    })
})

/** Answers each raw SQL by the table it reads. */
function fakeDb(tables: { logs?: Array<Record<string, unknown>>; platform?: Record<string, unknown>; alerts?: Array<Record<string, unknown>>; planRows?: Array<Record<string, unknown>>; overrides?: Array<Record<string, unknown>>; subs?: Array<Record<string, unknown>> }) {
    mocks.execute.mockImplementation(async (query) => {
        const text = dialect.sqlToQuery(query).sql
        if (text.includes('FROM ai_cap_alerts')) return { rows: tables.alerts ?? [] }
        if (text.includes('GROUP BY l.tenant_id')) return { rows: tables.logs ?? [] }
        if (text.includes('FROM ai_usage_logs')) return { rows: [tables.platform ?? { today: 0, month: 0 }] }
        if (text.includes('FROM plan_features')) return { rows: tables.planRows ?? [] }
        if (text.includes('FROM ai_shop_limits')) return { rows: tables.overrides ?? [] }
        if (text.includes('FROM plan_subscriptions')) return { rows: tables.subs ?? [] }
        return { rows: [] }
    })
}

describe('loadCapsStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.unstubAllEnvs()
        clearAiConfigCache()
        mocks.find.mockResolvedValue({ docs: [{ settings: { caps: { dailyUsd: 10, monthlyUsd: 100, pauseFreeAtPercent: 80 } }, updatedAt: '2026-10-01T00:00:00Z' }] })
    })

    it('TC-AICAP-PW-059 assembles caps, platform spend, shops near / at their limit, disabled plans and the latest alerts', async () => {
        fakeDb({
            platform: { today: '8.5', month: '60' },
            logs: [{ tenant_id: 1, name: 'Aroma', day_usd: '0.045', month_usd: '0.3' }, { tenant_id: 2, name: null, day_usd: '0', month_usd: '0' }],
            planRows: [{ plan_code: 'FREEMIUM', feature_code: 'ai_budget_usd_daily', value: '0.05' }, { plan_code: 'STARTER_TM_USER', feature_code: 'ai_enabled', value: 'NO' }],
            subs: [],
            alerts: [{ id: 9, scope: 'platform-daily', period_key: '2026-10-29', threshold: '80', spent_usd: '8.5', cap_usd: '10', tenant_id: null, shop_name: null, notified_lark: true, created_at: '2026-10-29T09:00:00Z' }],
        })
        const status = await loadCapsStatus(NOW)
        expect(status).toMatchObject({ day: '2026-10-29', month: '2026-10', timezone: 'Asia/Kuala_Lumpur', asOf: '2026-10-29T10:00:00.000Z' })
        expect(status.caps.effective).toMatchObject({ dailyUsd: 10, monthlyUsd: 100, pauseFreeAtPercent: 80 })
        expect(status.platform).toMatchObject({ todayUsd: 8.5, monthUsd: 60, dailyPercent: 85, monthlyPercent: 60, state: 'free-paused' })
        expect(status.nearLimit).toEqual([expect.objectContaining({ tenantId: 1, name: 'Aroma', plan: 'FREEMIUM', limit: 'daily', percent: 90 })])
        expect(status.blocked).toEqual([])
        expect(status.disabledPlans).toEqual(['STARTER_TM_USER'])
        expect(status.recentAlerts).toEqual([{
            id: 9, scope: 'platform-daily', periodKey: '2026-10-29', threshold: 80, spentUsd: 8.5, capUsd: 10, tenantId: null, shopName: null, notifiedLark: true, createdAt: '2026-10-29T09:00:00.000Z',
        }])
    })

    it('TC-AICAP-PW-060 lists a blocked override even when the shop has not used AI lately; an expired one is not listed', async () => {
        const base = { reason: 'abuse', set_by_id: 4, set_by_email: 'a@b.test', updated_at: '2026-10-28T00:00:00Z', ai_budget_usd: null, pictures_per_day: null, ai_budget_usd_monthly: null, site_budget_usd: null, mode: 'blocked' }
        fakeDb({
            overrides: [{ ...base, id: 1, tenant_id: 5, shop_name: 'Quiet', expires_at: null }, { ...base, id: 2, tenant_id: 6, shop_name: 'Old', expires_at: '2026-10-01T00:00:00Z' }],
            subs: [{ tenant_id: 5, plan: 'STANDARD_TM_USER', status: 'active', ends_at: '2099-01-01T00:00:00Z', canceled_at: null, canceled_immediately: false }],
        })
        const { blocked } = await loadCapsStatus(NOW)
        expect(blocked).toEqual([{ tenantId: 5, name: 'Quiet', plan: 'STANDARD_TM_USER', source: 'shop', reason: 'shop-blocked' }])
    })

    it('TC-AICAP-PW-061 the SQL is enum-safe and parameterised: ::text casts, no enum compared with \'\', Malaysia-day bounds as bound times', async () => {
        fakeDb({})
        await loadCapsStatus(NOW)
        const queries = mocks.execute.mock.calls.map(([q]) => dialect.sqlToQuery(q))
        const text = queries.map((q) => q.sql).join('\n')
        expect(text).toContain("l.feature::text IS DISTINCT FROM 'pictures'")
        expect(text).toContain('COALESCE(l.battery_cost_usd, l.cost_usd, 0)')
        expect(text).toContain('plan_code::text')
        expect(text).toContain('a.scope::text')
        expect(text).not.toMatch(/(=|<>|!=)\s*''/)
        expect(text).not.toMatch(/feature\s*=\s*'pictures'/)
        const usageQuery = queries.find((q) => q.sql.includes('FROM ai_usage_logs') && !q.sql.includes('GROUP BY'))!
        expect(usageQuery.params).toEqual(['2026-10-28T16:00:00.000Z', '2026-09-30T16:00:00.000Z'])
    })

    it('TC-AICAP-PW-061b an unreadable platform config row falls back to the env default instead of failing the status', async () => {
        mocks.find.mockResolvedValue({ docs: [{ settings: { caps: { alertPercents: [90, 10] } } }] })
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        fakeDb({})
        const status = await loadCapsStatus(NOW)
        expect(status.caps).toMatchObject({ dailySource: 'env', saved: null })
    })
})
