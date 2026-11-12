/**
 * TC-AICAP-PW-010..021 — limit resolution (plan rows + shop override → `lim`), its cache, the signed claim and the
 * ai-config `caps` passthrough.
 * - 010 plan only: new rows read, missing rows → on / unlimited, old defaults kept
 * - 011 ai_enabled NO → enabled false; junk → on
 * - 012 override custom replaces only what it sets (0 counts), turns AI on, source shop
 * - 013 override unlimited → all budgets null; blocked → enabled false; both source shop
 * - 014 expired override ignored (source plan); no expiry = active; unparseable date = expired
 * - 015 aiLimitsForTenant reads plan + override, queries ai-shop-limits by tenant
 * - 016 clearAiLimitsCacheFor drops one tenant only
 * - 017 override read failure is not cached and surfaces
 * - 018 the token carries the full lim (all new fields)
 * - 019 GET /api/internal/ai-config returns caps; absent when none saved
 * - 020 invalid caps row → 503 (ai-platform keeps its last good copy)
 * Real: resolver, plan-limits, token signer, ai-config + route. Faked: Payload find, session modules.
 */
import { SignJWT, decodeJwt } from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const find = vi.hoisted(() => vi.fn())
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ find })) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn(), isAuthUnavailableError: vi.fn(() => false) }))

import { GET as getAiConfig } from '@/app/api/internal/ai-config/route'
import { clearAiConfigCache } from '@/lib/ai-platform/ai-config'
import { signAgentContextToken, type AgentActor } from '@/lib/ai-platform/context'
import { resolveAiLimits, toShopOverride, type ShopOverride } from '@/lib/ai-platform/limit-resolution'
import { aiLimitsForTenant, clearAiLimitsCache, clearAiLimitsCacheFor } from '@/lib/ai-platform/plan-limits'

const NOW = Date.parse('2026-10-29T10:00:00Z')
const FUTURE = new Date(NOW + 86_400_000)
const PAST = new Date(NOW - 86_400_000)
const override = (extra: Partial<ShopOverride>): ShopOverride => ({
    mode: 'custom', aiBudgetUsd: null, picturesPerDay: null, aiBudgetUsdMonthly: null, siteBudgetUsd: null, expiresAt: null, ...extra,
})
const PLAN_ROWS = { ai_budget_usd_daily: '0.4', ai_pictures_daily: '8', ai_enabled: 'YES', ai_budget_usd_monthly: '10', ai_site_budget_usd_daily: '0.2' }

describe('resolveAiLimits (pure)', () => {
    it('TC-AICAP-PW-010 reads the plan rows; missing new rows mean on / unlimited, missing old rows the plan default', () => {
        // Act
        const full = resolveAiLimits({ plan: 'STANDARD_TM_USER', values: PLAN_ROWS, now: NOW })
        const empty = resolveAiLimits({ plan: 'STANDARD_TM_USER', values: {}, now: NOW })
        // Assert
        expect(full).toEqual({ plan: 'STANDARD_TM_USER', aiBudgetUsd: 0.4, picturesPerDay: 8, enabled: true, aiBudgetUsdMonthly: 10, siteBudgetUsd: 0.2, source: 'plan' })
        expect(empty).toEqual({ plan: 'STANDARD_TM_USER', aiBudgetUsd: 0.4, picturesPerDay: 8, enabled: true, aiBudgetUsdMonthly: null, siteBudgetUsd: null, source: 'plan' })
        expect(resolveAiLimits({ plan: 'FREEMIUM', values: { ai_budget_usd_monthly: 'UNLIMITED', ai_site_budget_usd_daily: 'unlimited' } })).toMatchObject({ aiBudgetUsdMonthly: null, siteBudgetUsd: null })
        expect(resolveAiLimits({ plan: 'FREEMIUM', values: { ai_budget_usd_monthly: '0' } }).aiBudgetUsdMonthly).toBe(0)
    })

    it('TC-AICAP-PW-011 ai_enabled NO switches the plan off; anything else (junk, blank, missing) leaves it on', () => {
        expect(resolveAiLimits({ plan: 'FREEMIUM', values: { ai_enabled: 'NO' } }).enabled).toBe(false)
        expect(resolveAiLimits({ plan: 'FREEMIUM', values: { ai_enabled: ' no ' } }).enabled).toBe(false)
        for (const value of ['YES', '', 'maybe', undefined, null]) {
            expect(resolveAiLimits({ plan: 'FREEMIUM', values: { ai_enabled: value } }).enabled).toBe(true)
        }
    })

    it('TC-AICAP-PW-012 a custom override replaces only the values it sets (0 included), turns AI on and marks source shop', () => {
        const planOff = { ...PLAN_ROWS, ai_enabled: 'NO' }
        const partial = resolveAiLimits({ plan: 'STANDARD_TM_USER', values: planOff, override: override({ aiBudgetUsd: 2 }), now: NOW })
        expect(partial).toEqual({ plan: 'STANDARD_TM_USER', aiBudgetUsd: 2, picturesPerDay: 8, enabled: true, aiBudgetUsdMonthly: 10, siteBudgetUsd: 0.2, source: 'shop' })
        const zeros = resolveAiLimits({ plan: 'STANDARD_TM_USER', values: PLAN_ROWS, override: override({ aiBudgetUsd: 0, picturesPerDay: 0, siteBudgetUsd: 0 }), now: NOW })
        expect(zeros).toMatchObject({ aiBudgetUsd: 0, picturesPerDay: 0, siteBudgetUsd: 0, aiBudgetUsdMonthly: 10 })
        // a shop may be raised above its plan (VIP)
        expect(resolveAiLimits({ plan: 'FREEMIUM', values: {}, override: override({ aiBudgetUsd: 5, picturesPerDay: 50.9 }), now: NOW })).toMatchObject({ aiBudgetUsd: 5, picturesPerDay: 50 })
    })

    it('TC-AICAP-PW-013 unlimited removes every budget; blocked turns AI off and keeps the plan numbers', () => {
        const unlimited = resolveAiLimits({ plan: 'FREEMIUM', values: { ...PLAN_ROWS, ai_enabled: 'NO' }, override: override({ mode: 'unlimited' }), now: NOW })
        expect(unlimited).toEqual({ plan: 'FREEMIUM', aiBudgetUsd: null, picturesPerDay: null, enabled: true, aiBudgetUsdMonthly: null, siteBudgetUsd: null, source: 'shop' })
        const blocked = resolveAiLimits({ plan: 'STANDARD_TM_USER', values: PLAN_ROWS, override: override({ mode: 'blocked', aiBudgetUsd: 99 }), now: NOW })
        expect(blocked).toMatchObject({ enabled: false, aiBudgetUsd: 0.4, source: 'shop' })
    })

    it('TC-AICAP-PW-014 an expired override is ignored; no expiry stays active; an unreadable date counts as expired', () => {
        const values = PLAN_ROWS
        const expired = resolveAiLimits({ plan: 'STANDARD_TM_USER', values, override: override({ mode: 'blocked', expiresAt: PAST }), now: NOW })
        expect(expired).toMatchObject({ enabled: true, source: 'plan' })
        expect(resolveAiLimits({ plan: 'STANDARD_TM_USER', values, override: override({ mode: 'blocked', expiresAt: FUTURE }), now: NOW })).toMatchObject({ enabled: false, source: 'shop' })
        expect(resolveAiLimits({ plan: 'STANDARD_TM_USER', values, override: override({ mode: 'blocked' }), now: NOW }).source).toBe('shop')
        expect(toShopOverride({ mode: 'blocked', expiresAt: 'not a date' })!.expiresAt!.getTime()).toBe(0)
        expect(toShopOverride({ mode: 'nope' })).toBeNull()
        expect(toShopOverride({ mode: 'custom', aiBudgetUsd: '1.5', picturesPerDay: '', aiBudgetUsdMonthly: null, siteBudgetUsd: -1 })).toMatchObject({ aiBudgetUsd: 1.5, picturesPerDay: null, aiBudgetUsdMonthly: null, siteBudgetUsd: null })
    })
})

/** Fake store: the tenant's subscription, plan-features rows and an optional ai-shop-limits row. */
function store(plan: string, rows: Record<string, string>, shopRow: Record<string, unknown> | null = null) {
    find.mockImplementation(async (args: { collection: string }) => {
        if (args.collection === 'plan-subscriptions') return { docs: [{ plan, status: 'active', endsAt: new Date(Date.now() + 86_400_000).toISOString() }] }
        if (args.collection === 'ai-shop-limits') return { docs: shopRow ? [shopRow] : [] }
        return { docs: Object.entries(rows).map(([featureCode, value]) => ({ featureCode, value })) }
    })
}

beforeEach(() => {
    find.mockReset()
    clearAiLimitsCache()
    clearAiConfigCache()
    vi.unstubAllEnvs()
})
afterEach(() => vi.useRealTimers())

describe('aiLimitsForTenant', () => {
    it('TC-AICAP-PW-015 reads the plan rows (all five codes) and the tenant override', async () => {
        // Arrange
        store('STANDARD_TM_USER', PLAN_ROWS, { mode: 'custom', aiBudgetUsd: '3', expiresAt: new Date(Date.now() + 3_600_000).toISOString() })
        // Act
        const limits = await aiLimitsForTenant('42')
        // Assert
        expect(limits).toMatchObject({ plan: 'STANDARD_TM_USER', aiBudgetUsd: 3, picturesPerDay: 8, aiBudgetUsdMonthly: 10, source: 'shop' })
        const featureQuery = find.mock.calls.find(([a]) => a.collection === 'plan-features')![0]
        expect(featureQuery.where.and[1].featureCode.in).toEqual(['ai_budget_usd_daily', 'ai_pictures_daily', 'ai_enabled', 'ai_budget_usd_monthly', 'ai_site_budget_usd_daily'])
        const shopQuery = find.mock.calls.find(([a]) => a.collection === 'ai-shop-limits')![0]
        expect(shopQuery).toMatchObject({ overrideAccess: true, where: { tenant: { equals: '42' } }, limit: 1 })
    })

    it('TC-AICAP-PW-015b an expired override row from the DB is ignored', async () => {
        store('FREEMIUM', {}, { mode: 'blocked', expiresAt: new Date(Date.now() - 1000).toISOString() })
        expect(await aiLimitsForTenant('7')).toMatchObject({ plan: 'FREEMIUM', enabled: true, source: 'plan' })
    })

    it('TC-AICAP-PW-016 clearAiLimitsCacheFor drops that tenant only', async () => {
        store('FREEMIUM', {})
        await aiLimitsForTenant('a')
        await aiLimitsForTenant('b')
        find.mockClear()
        await aiLimitsForTenant('a')
        await aiLimitsForTenant('b')
        expect(find).not.toHaveBeenCalled()
        // an override saved for "a" must show at once
        store('FREEMIUM', {}, { mode: 'blocked' })
        clearAiLimitsCacheFor('a')
        expect((await aiLimitsForTenant('a')).enabled).toBe(false)
        expect((await aiLimitsForTenant('b')).enabled).toBe(true)
        clearAiLimitsCacheFor(99) // unknown tenant: no throw
    })

    it('TC-AICAP-PW-017 a failed override read throws and is not cached', async () => {
        find.mockImplementation(async (args: { collection: string }) => {
            if (args.collection === 'ai-shop-limits') throw new Error('relation "ai_shop_limits" does not exist')
            return { docs: [] }
        })
        await expect(aiLimitsForTenant('z')).rejects.toThrow(/ai_shop_limits/)
        store('FREEMIUM', {})
        await expect(aiLimitsForTenant('z')).resolves.toMatchObject({ plan: 'FREEMIUM' })
    })
})

describe('lim claim', () => {
    it('TC-AICAP-PW-018 the signed token carries enabled, both new budgets and the source', async () => {
        vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'x'.repeat(40))
        store('STANDARD_NON_TM_USER', PLAN_ROWS, { mode: 'custom', siteBudgetUsd: '1' })
        const actor: AgentActor = { user: { id: 5, email: 'a@b.test' } as unknown as AgentActor['user'], tenantId: '77', organizationId: 'org_x', role: 'owner' }
        const claims = decodeJwt(await signAgentContextToken(actor))
        expect(claims.lim).toEqual({
            plan: 'STANDARD_NON_TM_USER', aiBudgetUsd: 0.4, picturesPerDay: 8, enabled: true, aiBudgetUsdMonthly: 10, siteBudgetUsd: 1, source: 'shop',
        })
    })
})

describe('GET /api/internal/ai-config caps', () => {
    const secret = 'y'.repeat(40)
    const call = async () => {
        vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', secret)
        const token = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setIssuer('ai-platform').setAudience('prime-web:internal')
            .setSubject('ai-config').setIssuedAt().setExpirationTime('2m').sign(new TextEncoder().encode(secret))
        return getAiConfig(new Request('https://prime.test/api/internal/ai-config', { headers: { authorization: `Bearer ${token}` } }))
    }
    const configRow = (settings: unknown) => find.mockResolvedValue({ docs: [{ settings, updatedAt: '2026-10-29T01:00:00.000Z' }] })

    it('TC-AICAP-PW-019 returns the saved caps next to prices / models, and no caps key when none is saved', async () => {
        configRow({ prices: {}, caps: { dailyUsd: 30, monthlyUsd: null, alertPercents: [60, 90], pauseFreeAtPercent: 80 } })
        const withCaps = await (await call()).json()
        expect(withCaps).toMatchObject({ caps: { dailyUsd: 30, monthlyUsd: null, alertPercents: [60, 90], pauseFreeAtPercent: 80 }, prices: {}, images: {}, models: {} })

        clearAiConfigCache()
        configRow({ prices: {} })
        const without = await (await call()).json()
        expect(without).not.toHaveProperty('caps')
        expect(without.updatedAt).toBe('2026-10-29T01:00:00.000Z')
    })

    it('TC-AICAP-PW-020 an invalid caps block makes the route answer 503 (ai-platform keeps its last good copy)', async () => {
        configRow({ caps: { alertPercents: [90, 10] } })
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        expect((await call()).status).toBe(503)
    })
})
