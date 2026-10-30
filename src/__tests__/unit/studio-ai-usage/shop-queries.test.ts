import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({ getActivePlanSubscription: vi.fn() }))

import { resolvePeriod } from '@/lib/admin/ai-usage/period'
import { groupLimits, limitsForCode } from '@/lib/admin/ai-usage/plan-limits-read'
import { getShopAreas, getShopErrors, getShopHeader, getShopRolling24h, getShopSeries } from '@/lib/admin/ai-usage/shop-queries'
import { tenantIdParam } from '@/lib/admin/ai-usage/sql-parts'
import { fakeDb, fakeDbBy } from './fake-db'

const NOW = new Date('2026-10-29T06:12:00.000Z')
const period = resolvePeriod({}, NOW)

describe('TC-AIS-SHOP-001 shop id and header', () => {
    it.each([['412', 412], ['0', null], ['-1', null], ['abc', null], ['1.5', null], ['', null]])('tenantIdParam(%j) = %s', (raw, expected) => {
        expect(tenantIdParam(raw)).toBe(expected)
    })

    it('returns null for a shop that does not exist', async () => {
        const { db, calls } = fakeDb([])
        expect(await getShopHeader(db, 999)).toBeNull()
        expect(calls).toHaveLength(1) // nothing else is queried
        expect(calls[0].params).toEqual([999])
    })

    it('takes plan and contact from the latest call; no plan means Unknown', async () => {
        const known = fakeDbBy([['FROM tenants', [{ id: 412, name: 'Kedai Runcit Pak Mat' }]], ['AS plan', [{ plan: 'STARTER_NON_TM_USER', email: 'pakmat@kedairuncit.my' }]]])
        expect(await getShopHeader(known.db, 412)).toEqual({ tenantId: 412, name: 'Kedai Runcit Pak Mat', ownerEmail: 'pakmat@kedairuncit.my', plan: 'starter', planCode: 'STARTER_NON_TM_USER' })
        const old = fakeDbBy([['FROM tenants', [{ id: 7, name: null }]], ['AS plan', [{ plan: null, email: null }]]])
        expect(await getShopHeader(old.db, 7)).toMatchObject({ name: 'Shop #7', plan: 'unknown', planCode: null })
    })
})

describe('TC-AIS-SHOP-002 every shop query is scoped to the shop', () => {
    it('rolling 24h spend uses the battery cost and counts pictures separately', async () => {
        const { db, calls } = fakeDb([{ battery: '0.09', pictures: '2' }])
        const spend = await getShopRolling24h(db, 412, NOW)
        expect(spend).toEqual({ batteryUsd: 0.09, pictures: 2 })
        expect(calls[0].sql).toContain('battery_cost_usd')
        expect(calls[0].params[0]).toBe(412)
        expect(calls[0].params[1]).toBe(new Date(NOW.getTime() - 86_400_000).toISOString())
    })

    it('series, areas and errors filter on the tenant', async () => {
        const { db, calls } = fakeDbBy([['GROUP BY 1 ORDER BY cost', [{ grp: 'website-setup', cost: '4.92' }, { grp: 'bogus', cost: '1' }]], ['COUNT(*) AS n', [{ code: 'rate_limited', label: 'Rate limited (429)', n: '5', last_seen: '2026-10-29T05:52:00Z' }]]])
        const series = await getShopSeries(db, 412, period)
        const areas = await getShopAreas(db, 412, period)
        const errors = await getShopErrors(db, 412, period)
        expect(series).toHaveLength(7)
        expect(areas).toEqual([{ group: 'website-setup', cost: 4.92 }]) // unknown group dropped
        expect(errors[0]).toMatchObject({ code: 'rate_limited', count: 5 })
        for (const c of calls) { expect(c.sql).toContain('tenant_id = $'); expect(c.params).toContain(412) }
    })
})

describe('TC-AIS-SHOP-003 plan limits', () => {
    const rows = [
        { planCode: 'FREEMIUM', featureCode: 'ai_budget_usd_daily', value: 'UNLIMITED' },
        { planCode: 'FREEMIUM', featureCode: 'ai_pictures_daily', value: '5' },
        { planCode: 'STARTER_TM_USER', featureCode: 'ai_budget_usd_daily', value: '0.2' },
        { planCode: 'STARTER_NON_TM_USER', featureCode: 'ai_budget_usd_daily', value: '0.3' },
    ]

    it('reads UNLIMITED as null and a number as a number', () => {
        expect(limitsForCode(rows, 'FREEMIUM')).toEqual({ budgetUsd: null, picturesPerDay: 5 })
        expect(limitsForCode(rows, 'STARTER_TM_USER').budgetUsd).toBe(0.2)
    })

    it('falls back to the plan default when a row is missing', () => {
        expect(limitsForCode([], 'STANDARD_TM_USER')).toEqual({ budgetUsd: 0.4, picturesPerDay: 8 })
    })

    it('flags a group whose codes disagree', () => {
        expect(groupLimits(rows, 'starter')).toMatchObject({ budgetUsd: 0.2, varies: true })
        expect(groupLimits(rows, 'free')).toMatchObject({ budgetUsd: null, varies: false })
    })
})
