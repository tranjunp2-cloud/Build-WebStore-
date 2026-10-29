/**
 * TC-AIU-PLAN-001..008 — AI limits per plan (lib/ai-platform/plan-limits) and the `lim` context-token claim.
 * - 001 each of the 7 plans → its plan-features rows; 002 no / expired subscription → FREEMIUM
 * - 003 missing row → that plan's default (never unlimited); junk value → default
 * - 004 UNLIMITED / YES → null, "0" stays 0 (AI off), pictures floored
 * - 005 cached 60 s per tenant, refetched after, bounded map
 * - 006 signAgentContextToken carries lim (decoded payload); no lim on a DB failure
 * - 007 seed rows for 7 plans × 2 features, insert-only; feature codes in FEATURE_CODE_OPTIONS
 * Real: resolver, token signer, db-setup MIGRATIONS, collections, mapper. Faked: Payload (find), session/auth modules.
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { decodeJwt } from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const find = vi.hoisted(() => vi.fn())
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ find })) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn(), isAuthUnavailableError: vi.fn(() => false) }))

import { PLAN_CODES } from '@/collections/PlanSubscriptions'
import { FEATURE_CODE_OPTIONS } from '@/collections/PlanFeatures'
import { signAgentContextToken, type AgentActor } from '@/lib/ai-platform/context'
import { DEFAULT_AI_LIMITS, aiLimitsForTenant, clearAiLimitsCache } from '@/lib/ai-platform/plan-limits'

const root = path.resolve(__dirname, '../../../..')
const FUTURE = new Date(Date.now() + 86_400_000).toISOString()
const PAST = new Date(Date.now() - 86_400_000).toISOString()
const { MIGRATIONS } = createRequire(import.meta.url)(path.join(root, 'scripts/db-setup.js')) as { MIGRATIONS: Array<{ name: string; sql: string }> }
const EXPECTED: Record<string, [number, number]> = {
    FREEMIUM: [0.05, 1],
    STARTER_TM_USER: [0.15, 3], STARTER_NON_TM_USER: [0.15, 3],
    STANDARD_TM_USER: [0.4, 8], STANDARD_NON_TM_USER: [0.4, 8],
    PROFESSIONAL_TM_USER: [0.9, 20], PROFESSIONAL_NON_TM_USER: [0.9, 20],
}

/** Fake store: one subscription (or none) and the plan-features rows to return for whichever plan is asked. */
function store(sub: { plan: string; endsAt?: string; status?: string } | null, features: Record<string, string> = {}) {
    find.mockImplementation(async (args: { collection: string; where: { and: Array<Record<string, { equals?: string }>> } }) => {
        if (args.collection === 'plan-subscriptions') {
            return { docs: sub ? [{ plan: sub.plan, status: sub.status ?? 'active', endsAt: sub.endsAt ?? FUTURE }] : [] }
        }
        return { docs: Object.entries(features).map(([featureCode, value]) => ({ featureCode, value })) }
    })
}

beforeEach(() => {
    find.mockReset()
    clearAiLimitsCache()
    vi.unstubAllEnvs()
})
afterEach(() => vi.useRealTimers())

describe('aiLimitsForTenant', () => {
    it.each(Object.entries(EXPECTED))('TC-AIU-PLAN-001 %s reads its plan-features rows', async (plan, [budget, pictures]) => {
        store({ plan }, { ai_budget_usd_daily: String(budget), ai_pictures_daily: String(pictures) })
        await expect(aiLimitsForTenant(`t-${plan}`)).resolves.toEqual({ plan, aiBudgetUsd: budget, picturesPerDay: pictures })
        const featureQuery = find.mock.calls.find(([a]) => a.collection === 'plan-features')?.[0]
        expect(featureQuery.where.and[0]).toEqual({ planCode: { equals: plan } })
    })

    it('TC-AIU-PLAN-002 no subscription, expired or cancelled → FREEMIUM limits', async () => {
        const freemium = { plan: 'FREEMIUM', aiBudgetUsd: 0.05, picturesPerDay: 1 }
        store(null, { ai_budget_usd_daily: '0.05', ai_pictures_daily: '1' })
        expect(await aiLimitsForTenant('none')).toEqual(freemium)
        store({ plan: 'PROFESSIONAL_TM_USER', endsAt: PAST }, { ai_budget_usd_daily: '0.05', ai_pictures_daily: '1' })
        expect(await aiLimitsForTenant('expired')).toEqual(freemium)
        store({ plan: 'PROFESSIONAL_TM_USER', status: 'canceled' }, { ai_budget_usd_daily: '0.05', ai_pictures_daily: '1' })
        expect(await aiLimitsForTenant('canceled')).toEqual(freemium)
        const lastFeatureQuery = find.mock.calls.filter(([a]) => a.collection === 'plan-features').at(-1)?.[0]
        expect(lastFeatureQuery.where.and[0]).toEqual({ planCode: { equals: 'FREEMIUM' } })
    })

    it('TC-AIU-PLAN-003 a missing or unreadable row falls back to the plan default, never unlimited', async () => {
        store({ plan: 'STANDARD_TM_USER' }, {})
        expect(await aiLimitsForTenant('a')).toEqual({ plan: 'STANDARD_TM_USER', aiBudgetUsd: 0.4, picturesPerDay: 8 })
        store({ plan: 'STARTER_NON_TM_USER' }, { ai_budget_usd_daily: 'lots', ai_pictures_daily: '-2' })
        expect(await aiLimitsForTenant('b')).toEqual({ plan: 'STARTER_NON_TM_USER', aiBudgetUsd: 0.15, picturesPerDay: 3 })
        for (const plan of PLAN_CODES) expect(DEFAULT_AI_LIMITS[plan.value]).toEqual({ aiBudgetUsd: EXPECTED[plan.value]![0], picturesPerDay: EXPECTED[plan.value]![1] })
    })

    it('TC-AIU-PLAN-004 UNLIMITED / YES → null; "0" stays 0 (AI off); pictures are whole numbers', async () => {
        store({ plan: 'PROFESSIONAL_TM_USER' }, { ai_budget_usd_daily: 'unlimited', ai_pictures_daily: 'YES' })
        expect(await aiLimitsForTenant('u')).toEqual({ plan: 'PROFESSIONAL_TM_USER', aiBudgetUsd: null, picturesPerDay: null })
        store({ plan: 'FREEMIUM' }, { ai_budget_usd_daily: '0', ai_pictures_daily: '2.9' })
        expect(await aiLimitsForTenant('z')).toEqual({ plan: 'FREEMIUM', aiBudgetUsd: 0, picturesPerDay: 2 })
    })

    it('TC-AIU-PLAN-005 caches per tenant for 60 s, then refetches; the map stays bounded', async () => {
        vi.useFakeTimers()
        store({ plan: 'FREEMIUM' }, { ai_budget_usd_daily: '0.05', ai_pictures_daily: '1' })
        await aiLimitsForTenant('c1')
        await aiLimitsForTenant('c1')
        expect(find).toHaveBeenCalledTimes(2) // subscription + features, once
        await aiLimitsForTenant('c2')
        expect(find).toHaveBeenCalledTimes(4)
        vi.advanceTimersByTime(60_001)
        await aiLimitsForTenant('c1')
        expect(find).toHaveBeenCalledTimes(6)
        for (let i = 0; i < 600; i++) await aiLimitsForTenant(`bulk-${i}`)
        find.mockClear()
        await aiLimitsForTenant('c1') // evicted long ago (oldest first) → read again
        expect(find).toHaveBeenCalled()
    })

    it('TC-AIU-PLAN-005b a failed read is not cached', async () => {
        find.mockRejectedValueOnce(new Error('db down'))
        await expect(aiLimitsForTenant('f')).rejects.toThrow('db down')
        store({ plan: 'FREEMIUM' }, { ai_budget_usd_daily: '0.05', ai_pictures_daily: '1' })
        await expect(aiLimitsForTenant('f')).resolves.toMatchObject({ plan: 'FREEMIUM' })
    })
})

describe('lim claim', () => {
    const actor = (tenantId: string): AgentActor => ({
        user: { id: 5, email: 'a@b.test' } as AgentActor['user'], tenantId, organizationId: 'org_x', role: 'owner',
    })

    it('TC-AIU-PLAN-006 the signed token carries lim for the actor tenant; none when the limits cannot be read', async () => {
        vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'x'.repeat(40))
        store({ plan: 'STANDARD_NON_TM_USER' }, { ai_budget_usd_daily: '0.40', ai_pictures_daily: 'UNLIMITED' })
        const claims = decodeJwt(await signAgentContextToken(actor('77')))
        expect(claims.lim).toEqual({ plan: 'STANDARD_NON_TM_USER', aiBudgetUsd: 0.4, picturesPerDay: null })
        expect(claims.tenant).toBe('77')

        clearAiLimitsCache()
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        find.mockRejectedValue(new Error('db down'))
        const without = decodeJwt(await signAgentContextToken(actor('78')))
        expect(without).not.toHaveProperty('lim')
        expect(without.tenant).toBe('78')
    })
})

describe('seed and field options', () => {
    it('TC-AIU-PLAN-007 seeds 7 plans × 2 features, insert-only, UNLIMITED while usage is collected', () => {
        const seed = MIGRATIONS.find((m) => m.name === 'f-subscription-plan-features-ai-limits-seed')
        expect(seed).toBeDefined()
        const sql = seed!.sql
        for (const plan of Object.keys(EXPECTED)) {
            expect(sql).toContain(`('${plan}','ai_budget_usd_daily','UNLIMITED')`)
            expect(sql).toContain(`('${plan}','ai_pictures_daily','UNLIMITED')`)
        }
        expect((sql.match(/^\s+\('/gm) ?? []).length).toBe(14)
        // insert-only on both table shapes (db-setup's plan_id + UNIQUE one, Payload's enum one): NOT EXISTS guard, no plan_id
        expect(sql).toContain('IF NOT EXISTS (SELECT 1 FROM plan_features WHERE plan_code::text = r.plan_code AND feature_code = r.feature_code)')
        expect(sql).not.toContain('plan_id')
        expect(sql).not.toMatch(/DO UPDATE|DELETE|DROP|UPDATE plan_features/i)
        const codes = FEATURE_CODE_OPTIONS.map((o) => o.value as string)
        expect(codes).toContain('ai_budget_usd_daily')
        expect(codes).toContain('ai_pictures_daily')
        // the generic seed's row-count guard still holds (it asserts >= 140 and does not count exact codes)
        expect(MIGRATIONS.find((m) => m.name === 'f-subscription-plan-features-seed')!.sql).toContain('< 140')
    })
})
