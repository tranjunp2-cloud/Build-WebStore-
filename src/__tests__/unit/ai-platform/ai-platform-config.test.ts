/**
 * TC-AIU-PLAN-009..014 — platform-wide AI config in `plan-features` (feature `ai_platform_config`) and its endpoint.
 * - 009 PlanFeatures hook: accepts a valid config / limits, rejects bad shapes, negatives, bad limit values
 * - 010 seed: config row inserted once (insert-only), valid against the schema, with the agreed prices and models
 * - 011 GET /api/internal/ai-config: 401 (same body) for no / wrong-secret / wrong iss, aud, sub / expired / non-HS256 token
 * - 012 endpoint payload: prices, images, models, updatedAt; most recently updated row wins; empty when missing
 * - 013 invalid stored row → 503 (ai-platform keeps its last good copy), not cached; DB failure → 503
 * - 014 the cache-write column is NOT added (no ai_usage_logs.cache_write migration / field)
 * Real: hook, schema, resolver, route, db-setup MIGRATIONS. Faked: Payload find.
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { SignJWT } from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const find = vi.hoisted(() => vi.fn())
vi.mock('payload', async (orig) => ({ ...(await orig<typeof import('payload')>()), getPayload: vi.fn(async () => ({ find })) }))
vi.mock('@payload-config', () => ({ default: {} }))

import { PlanFeatures } from '@/collections/PlanFeatures'
import { GET } from '@/app/api/internal/ai-config/route'
import { AiPlatformConfigSchema } from '@/lib/ai-platform/ai-config-schema'
import { clearAiConfigCache } from '@/lib/ai-platform/ai-config'

const root = path.resolve(__dirname, '../../../..')
const { MIGRATIONS } = createRequire(import.meta.url)(path.join(root, 'scripts/db-setup.js')) as { MIGRATIONS: Array<{ name: string; sql: string }> }
const SECRET = 's'.repeat(40)
const key = new TextEncoder().encode(SECRET)

type Hook = (args: { data?: Record<string, unknown>; originalDoc?: Record<string, unknown>; collection: { slug: string } }) => unknown
const beforeChange = PlanFeatures.hooks!.beforeChange![0] as unknown as Hook
const run = (data: Record<string, unknown>, originalDoc?: Record<string, unknown>) => beforeChange({ data, originalDoc, collection: { slug: 'plan-features' } })
const goodConfig = { prices: { 'anthropic:claude-haiku-5-5': { input: 0.1, output: 0.5, cacheWrite: 0.125, longContext: { aboveInputTokens: 100000, input: 0.5, output: 2.5 } } }, images: { 'openai:gpt-image-1': 0.042 }, models: { fast: 'anthropic:claude-haiku-5-5, openai:gpt-4.1-nano' } }

/** Payload's ValidationError keeps the admin-facing sentence in data.errors. */
const messageOf = (fn: () => unknown): string => {
    try {
        fn()
    } catch (error) {
        const e = error as { name: string; data?: { errors?: Array<{ message: string }> } }
        expect(e.name).toBe('ValidationError')
        return e.data?.errors?.[0]?.message ?? ''
    }
    return ''
}

describe('PlanFeatures AI validation hook', () => {
    it('TC-AIU-PLAN-009 accepts valid config and limits', () => {
        expect(() => run({ featureCode: 'ai_platform_config', value: 'YES', settings: goodConfig })).not.toThrow()
        for (const value of ['0.05', '0', 'UNLIMITED', ' unlimited ', 'YES']) expect(() => run({ featureCode: 'ai_budget_usd_daily', value })).not.toThrow()
        for (const value of ['3', '0', 'UNLIMITED']) expect(() => run({ featureCode: 'ai_pictures_daily', value })).not.toThrow()
        expect(() => run({ featureCode: 'staff_limit', value: 'whatever' })).not.toThrow()
    })

    it('TC-AIU-PLAN-009 rejects bad config shapes and limit values with a clear message', () => {
        const bad = (settings: unknown) => messageOf(() => run({ featureCode: 'ai_platform_config', settings }))
        expect(bad({ prices: { 'anthropic:x': { input: -1, output: 1 } } })).toMatch(/prices\.anthropic:x\.input/)
        expect(bad({ prices: { nocolon: { input: 1, output: 1 } } })).toMatch(/provider:model/)
        expect(bad({ prices: { 'a:b': { input: 1 } } })).toMatch(/output/)
        expect(bad({ prices: { 'a:b': { input: 1, output: 1, surprise: 1 } } })).toMatch(/prices\.a:b/)
        expect(bad({ images: { 'openai:img': 'cheap' } })).toMatch(/images/)
        expect(bad({ models: { fast: '' } })).toMatch(/models\.fast/)
        expect(bad({ extra: {} })).toMatch(/invalid/)
        expect(bad(null)).toMatch(/invalid/)
        const limit = (featureCode: string, value: string) => messageOf(() => run({ featureCode, value }))
        expect(limit('ai_budget_usd_daily', '-1')).toMatch(/ai_budget_usd_daily/)
        expect(limit('ai_budget_usd_daily', 'lots')).toMatch(/UNLIMITED/)
        expect(limit('ai_pictures_daily', '2.5')).toMatch(/whole number/)
        expect(limit('ai_pictures_daily', '')).toMatch(/ai_pictures_daily/)
    })

    it('TC-AIU-PLAN-009 a partial update is judged on the merged document', () => {
        expect(() => run({ value: 'junk' }, { featureCode: 'ai_pictures_daily', value: '3' })).toThrow()
        expect(() => run({ value: '4' }, { featureCode: 'ai_pictures_daily', value: '3' })).not.toThrow()
        expect(() => run({ value: 'YES' }, { featureCode: 'ai_platform_config', settings: { prices: { 'a:b': { input: -1, output: 1 } } } })).toThrow()
    })
})

describe('seed', () => {
    const seed = MIGRATIONS.find((m) => m.name === 'f-subscription-plan-features-ai-platform-config-seed')

    it('TC-AIU-PLAN-010 inserts the config row once, never overwrites, and the JSON passes the schema', () => {
        expect(seed).toBeDefined()
        expect(seed!.sql).toContain("NOT EXISTS (SELECT 1 FROM plan_features WHERE feature_code = 'ai_platform_config')")
        expect(seed!.sql).not.toContain('plan_id')
        expect(seed!.sql).not.toMatch(/DO UPDATE|DELETE|DROP|UPDATE plan_features/i)
        const json = /'(\{.*\})'\);/s.exec(seed!.sql)![1]!.replace(/''/g, "'")
        const config = AiPlatformConfigSchema.parse(JSON.parse(json))
        expect(config.prices['anthropic:claude-haiku-5-5']).toMatchObject({ input: 0.1, output: 0.5, cachedInput: 0.01, cacheWrite: 0.125, longContext: { aboveInputTokens: 100000, input: 0.5, output: 2.5, cachedInput: 0.05, cacheWrite: 0.625 } })
        expect(config.prices['anthropic:claude-opus-4-6']).toMatchObject({ input: 5, output: 25, cachedInput: 0.5, cacheWrite: 6.25 })
        expect(config.prices['deepseek:deepseek-v4-pro']).toMatchObject({ input: 1.32, output: 3.96, cachedInput: 0.044, offPeakFactor: 0.5 })
        expect(config.prices['typesafe:jev-latest']).toMatchObject({ input: 0.042, output: 0, cachedInput: 0.042 })
        expect(Object.keys(config.prices)).toHaveLength(19)
        expect(config.images).toEqual({ 'openai:gpt-image-1': 0.042, 'openai:gpt-image-1-mini': 0.011 })
        expect(config.models.image).toBe('openai:gpt-image-1')
        expect(config.models.quality).toBe('anthropic:claude-sonnet-5-5, openai:gpt-5.4-mini')
    })

    it('TC-AIU-PLAN-014 no cache-write column on ai_usage_logs', () => {
        expect(MIGRATIONS.some((m) => /cache_write/.test(m.name + m.sql))).toBe(false)
    })
})

const token = (claims: { iss?: string; aud?: string; sub?: string; iat?: number; alg?: string } = {}, secret = key) =>
    new SignJWT({}).setProtectedHeader({ alg: claims.alg ?? 'HS256' })
        .setIssuer(claims.iss ?? 'ai-platform').setAudience(claims.aud ?? 'prime-web:internal').setSubject(claims.sub ?? 'ai-config')
        .setIssuedAt(claims.iat).setExpirationTime('1h').sign(secret)
const call = (bearer?: string) => GET(new Request('http://x/api/internal/ai-config', { headers: bearer ? { authorization: `Bearer ${bearer}` } : {} }))
const row = (settings: unknown, updatedAt = '2026-10-26T01:00:00.000Z') => ({ featureCode: 'ai_platform_config', settings, updatedAt })

describe('GET /api/internal/ai-config', () => {
    beforeEach(() => {
        find.mockReset()
        clearAiConfigCache()
        vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', SECRET)
    })
    afterEach(() => vi.unstubAllEnvs())

    it('TC-AIU-PLAN-011 401 with one fixed body unless the token is right; nothing is read', async () => {
        const old = Math.floor(Date.now() / 1000) - 600
        const attempts = [
            await call(),
            await call('garbage'),
            await call(await token({}, new TextEncoder().encode('t'.repeat(40)))),
            await call(await token({ iss: 'prime-web' })),
            await call(await token({ aud: 'ai-platform' })),
            await call(await token({ sub: 'other' })),
            await call(await token({ iat: old })),
            await call(await token({ alg: 'HS512' })),
        ]
        for (const response of attempts) {
            expect(response.status).toBe(401)
            expect(await response.json()).toEqual({ error: 'Unauthorized' })
        }
        vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', '')
        expect((await call(await token())).status).toBe(401)
        expect(find).not.toHaveBeenCalled()
    })

    it('TC-AIU-PLAN-012 returns the config with updatedAt; empty when there is no row; newest row wins', async () => {
        find.mockResolvedValue({ docs: [row(goodConfig)] })
        const ok = await call(await token())
        expect(ok.status).toBe(200)
        expect(await ok.json()).toEqual({ ...goodConfig, updatedAt: '2026-10-26T01:00:00.000Z' })
        const query = find.mock.calls[0]![0]
        expect(query).toMatchObject({ collection: 'plan-features', sort: '-updatedAt', limit: 1, where: { featureCode: { equals: 'ai_platform_config' } } })

        clearAiConfigCache()
        find.mockResolvedValue({ docs: [] })
        expect(await (await call(await token())).json()).toEqual({ prices: {}, images: {}, models: {}, updatedAt: null })
    })

    it('TC-AIU-PLAN-013 invalid row → 503, not cached; DB failure → 503', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        find.mockResolvedValue({ docs: [row({ prices: 'x' })] })
        const invalid = await call(await token())
        expect(invalid.status).toBe(503)
        expect(await invalid.json()).toEqual({ error: 'Unavailable' })
        await call(await token())
        expect(find).toHaveBeenCalledTimes(2)

        clearAiConfigCache()
        find.mockRejectedValue(new Error('db down'))
        const failed = await call(await token())
        expect(failed.status).toBe(503)
        expect(await failed.json()).toEqual({ error: 'Unavailable' })
    })
})
