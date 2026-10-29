/**
 * TC-AICAP-PW-040..047 — shop override store (lib/admin/ai-caps/shop-overrides): list, one-shop view, save (create /
 * update / validation / 404), remove, cache clearing. Real: store, effective-limits SQL mapping, resolver, schemas.
 * Faked: Payload (local API + drizzle execute answering by SQL text), plan-limits cache.
 */
import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ find: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), execute: vi.fn(), clearFor: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({ find: mocks.find, create: mocks.create, update: mocks.update, delete: mocks.delete, db: { drizzle: { execute: mocks.execute } } })),
}))
vi.mock('@/lib/ai-platform/plan-limits', () => ({ clearAiLimitsCacheFor: mocks.clearFor }))

import { getShopLimitView, listShopOverrides, removeShopOverride, saveShopOverride } from '@/lib/admin/ai-caps/shop-overrides'

const NOW = Date.parse('2026-10-29T10:00:00Z')
const dialect = new PgDialect()

interface Db {
    tenants?: Array<{ id: number; name: string | null }>
    planRows?: Array<{ plan_code: string; feature_code: string; value: string }>
    overrides?: Array<Record<string, unknown>>
    subscriptions?: Array<Record<string, unknown>>
}

/** Answers each raw SQL by the table it reads. */
function db({ tenants = [], planRows = [], overrides = [], subscriptions = [] }: Db) {
    mocks.execute.mockImplementation(async (query) => {
        const text = dialect.sqlToQuery(query).sql
        if (text.includes('FROM plan_features')) return { rows: planRows }
        if (text.includes('FROM ai_shop_limits')) return { rows: overrides }
        if (text.includes('FROM plan_subscriptions')) return { rows: subscriptions }
        if (text.includes('FROM tenants')) return { rows: tenants }
        return { rows: [] }
    })
}

const sub = (tenant: number, plan: string) => ({
    tenant_id: tenant, plan, status: 'active', ends_at: '2099-01-01T00:00:00Z', canceled_at: null, canceled_immediately: false,
})
const row = (extra: Record<string, unknown>) => ({
    id: 1, tenant_id: 12, mode: 'custom', ai_budget_usd: null, pictures_per_day: null, ai_budget_usd_monthly: null, site_budget_usd: null,
    reason: 'VIP', expires_at: null, set_by_id: 4, set_by_email: 'boss@x.test', updated_at: '2026-10-28T00:00:00Z', shop_name: 'Demo', ...extra,
})
const PLAN = [{ plan_code: 'STANDARD_TM_USER', feature_code: 'ai_budget_usd_daily', value: '0.4' }, { plan_code: 'STANDARD_TM_USER', feature_code: 'ai_budget_usd_monthly', value: '10' }]
const input = { mode: 'custom' as const, aiBudgetUsd: 2, reason: ' VIP ' }

beforeEach(() => {
    vi.clearAllMocks()
    mocks.find.mockResolvedValue({ docs: [] })
    mocks.create.mockResolvedValue({})
    mocks.update.mockResolvedValue({})
    mocks.delete.mockResolvedValue({})
})

describe('reads', () => {
    it('TC-AICAP-PW-040 lists active and expired overrides with shop name, plan, setBy and the expired flag', async () => {
        db({
            planRows: PLAN, subscriptions: [sub(12, 'STANDARD_TM_USER'), sub(13, 'FREEMIUM')],
            overrides: [row({ ai_budget_usd: '2.5' }), row({ id: 2, tenant_id: 13, shop_name: null, mode: 'blocked', expires_at: '2026-10-01T00:00:00Z', set_by_id: null, set_by_email: null })],
        })
        const list = await listShopOverrides(NOW)
        expect(list).toHaveLength(2)
        expect(list[0]).toMatchObject({
            tenantId: 12, shopName: 'Demo', plan: 'STANDARD_TM_USER', mode: 'custom', aiBudgetUsd: 2.5, expired: false, expiresAt: null,
            setBy: { id: 4, email: 'boss@x.test' }, reason: 'VIP',
        })
        expect(list[1]).toMatchObject({ tenantId: 13, plan: 'FREEMIUM', mode: 'blocked', expired: true, setBy: null, expiresAt: '2026-10-01T00:00:00.000Z' })
    })

    it('TC-AICAP-PW-041 one shop: plan limits alone vs effective with the override; null for an unknown shop', async () => {
        db({ tenants: [{ id: 12, name: 'Demo' }], planRows: PLAN, subscriptions: [sub(12, 'STANDARD_TM_USER')], overrides: [row({ ai_budget_usd: '2', mode: 'custom' })] })
        const view = await getShopLimitView(12, NOW)
        expect(view).toMatchObject({ tenantId: 12, shopName: 'Demo', plan: 'STANDARD_TM_USER', override: { mode: 'custom', aiBudgetUsd: 2 } })
        expect(view!.planLimits).toMatchObject({ aiBudgetUsd: 0.4, aiBudgetUsdMonthly: 10, source: 'plan' })
        expect(view!.effective).toMatchObject({ aiBudgetUsd: 2, aiBudgetUsdMonthly: 10, source: 'shop' })

        db({ tenants: [] })
        expect(await getShopLimitView(404, NOW)).toBeNull()
    })

    it('TC-AICAP-PW-041b an expired override shows in the view but the effective limits are the plan\'s', async () => {
        db({ tenants: [{ id: 12, name: 'Demo' }], planRows: PLAN, subscriptions: [sub(12, 'STANDARD_TM_USER')], overrides: [row({ mode: 'blocked', expires_at: '2026-10-01T00:00:00Z' })] })
        const view = await getShopLimitView(12, NOW)
        expect(view!.override).toMatchObject({ mode: 'blocked', expired: true })
        expect(view!.effective).toMatchObject({ enabled: true, source: 'plan' })
    })

    it('TC-AICAP-PW-041c the SQL is enum-safe: enum columns are cast to text', async () => {
        db({ tenants: [{ id: 12, name: 'Demo' }] })
        await getShopLimitView(12, NOW)
        const sql = mocks.execute.mock.calls.map(([q]) => dialect.sqlToQuery(q).sql).join('\n')
        expect(sql).toContain('plan_code::text')
        expect(sql).toContain('o.mode::text')
        expect(sql).toContain('plan::text')
        expect(sql).toContain('status::text')
        expect(sql).not.toMatch(/(=|<>|!=)\s*''/)
    })
})

describe('saveShopOverride', () => {
    it('TC-AICAP-PW-042 creates the row (trimmed reason, setBy, tenant) and drops that shop\'s cached limits', async () => {
        db({ tenants: [{ id: 12, name: 'Demo' }] })
        const result = await saveShopOverride(12, input, 4, NOW)
        expect(result).toEqual({ ok: true })
        expect(mocks.create).toHaveBeenCalledWith({
            collection: 'ai-shop-limits', overrideAccess: true,
            data: { tenant: 12, mode: 'custom', aiBudgetUsd: 2, picturesPerDay: null, aiBudgetUsdMonthly: null, siteBudgetUsd: null, reason: 'VIP', expiresAt: null, setBy: 4 },
        })
        expect(mocks.update).not.toHaveBeenCalled()
        expect(mocks.clearFor).toHaveBeenCalledWith(12)
    })

    it('TC-AICAP-PW-043 updates the existing row instead of creating a second one; switching to blocked clears the numbers', async () => {
        db({ tenants: [{ id: 12, name: 'Demo' }] })
        mocks.find.mockResolvedValueOnce({ docs: [{ id: 77 }] })
        await saveShopOverride(12, { mode: 'blocked', aiBudgetUsd: 9, reason: 'abuse' }, 4, NOW)
        expect(mocks.create).not.toHaveBeenCalled()
        expect(mocks.update).toHaveBeenCalledWith({
            collection: 'ai-shop-limits', id: 77, overrideAccess: true,
            data: { mode: 'blocked', aiBudgetUsd: null, picturesPerDay: null, aiBudgetUsdMonthly: null, siteBudgetUsd: null, reason: 'abuse', expiresAt: null, setBy: 4 },
        })
        expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'ai-shop-limits', where: { tenant: { equals: 12 } } }))
    })

    it('TC-AICAP-PW-044 rejects a custom override with no limit, an end time in the past and an unknown shop, writing nothing', async () => {
        db({ tenants: [{ id: 12, name: 'Demo' }] })
        expect(await saveShopOverride(12, { mode: 'custom', reason: 'x' }, 4, NOW)).toMatchObject({ ok: false, status: 422, message: expect.stringMatching(/at least one limit/) })
        expect(await saveShopOverride(12, { ...input, expiresAt: '2026-10-29T09:00:00Z' }, 4, NOW)).toEqual({ ok: false, status: 422, message: 'The end time must be in the future.' })
        db({ tenants: [] })
        expect(await saveShopOverride(999, input, 4, NOW)).toEqual({ ok: false, status: 404, message: 'Shop not found.' })
        expect(mocks.create).not.toHaveBeenCalled()
        expect(mocks.update).not.toHaveBeenCalled()
        expect(mocks.clearFor).not.toHaveBeenCalled()
    })
})

describe('removeShopOverride', () => {
    it('TC-AICAP-PW-045 deletes the row and clears the cache; false (nothing cleared) when the shop had none', async () => {
        mocks.find.mockResolvedValueOnce({ docs: [{ id: 5 }] })
        expect(await removeShopOverride(12)).toBe(true)
        expect(mocks.delete).toHaveBeenCalledWith({ collection: 'ai-shop-limits', id: 5, overrideAccess: true })
        expect(mocks.clearFor).toHaveBeenCalledWith(12)

        mocks.delete.mockClear()
        mocks.clearFor.mockClear()
        expect(await removeShopOverride(12)).toBe(false)
        expect(mocks.delete).not.toHaveBeenCalled()
        expect(mocks.clearFor).not.toHaveBeenCalled()
    })
})
