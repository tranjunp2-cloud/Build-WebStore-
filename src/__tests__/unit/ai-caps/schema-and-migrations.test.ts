/**
 * TC-AICAP-PW-001..009 — AI caps in layers, prime-web data model.
 * - 001 seeds: 7 plans × 3 new codes, insert-only, both plan_features shapes; separate from the old seed
 * - 002 ai_shop_limits / ai_cap_alerts migrations: tables, unique tenant, dedupe index, rels columns, never DROP, slugs registered
 * - 003 FEATURE_CODE_OPTIONS lists the new codes; PlanFeatures hook validates them
 * - 004 aiLimitProblem for ai_enabled (YES/NO) and the new budgets
 * - 005 caps schema: numbers ≥ 0 or null, percents 1..100 ascending unique, strict
 * - 006 AiPlatformConfigSchema accepts caps; the hook rejects bad caps
 * - 007 collections: super-admin only, group AI, fields per contract
 * - 008 shop override input schema (modes, custom needs a value, reason required)
 * - 009 env examples document LARK_WEBHOOK_AI_ALERTS (optional)
 * Real: schemas, collections, MIGRATIONS. No fakes.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { ValidationError } from 'payload'
import { describe, expect, it } from 'vitest'
import { AiCapAlerts } from '@/collections/AiCapAlerts'
import { AiShopLimits } from '@/collections/AiShopLimits'
import { FEATURE_CODE_OPTIONS, PlanFeatures } from '@/collections/PlanFeatures'
import { PLAN_CODES } from '@/collections/PlanSubscriptions'
import { AiCapsSchema, AiPlatformConfigSchema, aiConfigProblem, aiLimitProblem } from '@/lib/ai-platform/ai-config-schema'
import { ShopLimitInputSchema, normalizeShopLimit, shopLimitProblem } from '@/lib/ai-platform/shop-limit-schema'

const root = path.resolve(__dirname, '../../../..')
const require_ = createRequire(import.meta.url)
const { MIGRATIONS } = require_(path.join(root, 'scripts/db-setup.js')) as { MIGRATIONS: Array<{ name: string; sql: string }> }
const dbSetup = readFileSync(path.join(root, 'scripts/db-setup.js'), 'utf8')
const migration = (name: string) => MIGRATIONS.find((m) => m.name === name)

describe('seeds', () => {
    const seed = migration('f-subscription-plan-features-ai-caps-seed')

    it('TC-AICAP-PW-001 seeds ai_enabled=YES and both new budgets=UNLIMITED for the 7 plan codes, insert-only', () => {
        // Arrange
        const sql = seed!.sql
        // Assert
        expect(seed).toBeDefined()
        for (const plan of PLAN_CODES.map((p) => p.value)) {
            expect(sql).toContain(`('${plan}','ai_enabled','YES')`)
            expect(sql).toContain(`('${plan}','ai_budget_usd_monthly','UNLIMITED')`)
            expect(sql).toContain(`('${plan}','ai_site_budget_usd_daily','UNLIMITED')`)
        }
        expect((sql.match(/^\s+\('/gm) ?? []).length).toBe(21)
        // works on the db-setup shape (plan_id + varchar) and the Payload shape (enum, no unique): NOT EXISTS guard, enum-safe ::text
        expect(sql).toContain('IF NOT EXISTS (SELECT 1 FROM plan_features WHERE plan_code::text = r.plan_code AND feature_code = r.feature_code)')
        expect(sql).not.toContain('plan_id')
        expect(sql).not.toMatch(/DO UPDATE|DELETE|DROP|UPDATE plan_features/i)
    })

    it('TC-AICAP-PW-001b leaves the existing ai-limits seed untouched (14 rows) and runs after it', () => {
        const old = migration('f-subscription-plan-features-ai-limits-seed')!
        expect((old.sql.match(/^\s+\('/gm) ?? []).length).toBe(14)
        expect(old.sql).not.toContain('ai_enabled')
        expect(MIGRATIONS.indexOf(seed!)).toBeGreaterThan(MIGRATIONS.indexOf(old))
    })
})

describe('tables', () => {
    it('TC-AICAP-PW-002 creates ai_shop_limits and ai_cap_alerts with the contract columns, indexes and rels columns', () => {
        const shop = migration('ai_shop_limits.create_table')!.sql
        for (const column of ['tenant_id integer NOT NULL', 'mode varchar', 'ai_budget_usd numeric', 'pictures_per_day numeric', 'ai_budget_usd_monthly numeric', 'site_budget_usd numeric', 'reason varchar NOT NULL', 'expires_at timestamp', 'set_by_id integer']) {
            expect(shop).toContain(column)
        }
        expect(shop).toContain('CREATE TABLE IF NOT EXISTS ai_shop_limits')
        expect(migration('ai_shop_limits.tenant_unique_idx')!.sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS ai_shop_limits_tenant_idx ON ai_shop_limits (tenant_id)')

        const alerts = migration('ai_cap_alerts.create_table')!.sql
        for (const column of ['scope varchar NOT NULL', 'period_key varchar NOT NULL', 'threshold numeric NOT NULL', 'spent_usd numeric NOT NULL', 'cap_usd numeric NOT NULL', 'tenant_id integer', 'notified_lark boolean']) {
            expect(alerts).toContain(column)
        }
        // NULL tenants (platform alerts) must still collide: the tenant is folded to 0 in the unique index
        expect(migration('ai_cap_alerts.dedupe_unique_idx')!.sql).toContain('(scope, period_key, threshold, (COALESCE(tenant_id, 0)))')
        expect(migration('payload_locked_documents_rels.ai_shop_limits_id')!.sql).toContain('"ai_shop_limits_id" integer')
        expect(migration('payload_locked_documents_rels.ai_cap_alerts_id')!.sql).toContain('"ai_cap_alerts_id" integer')
    })

    it('TC-AICAP-PW-002b is idempotent, never drops, and registers both slugs for the rels sync', () => {
        const mine = MIGRATIONS.filter((m) => /ai_shop_limits|ai_cap_alerts|ai-caps-seed/.test(m.name))
        expect(mine.length).toBeGreaterThan(20)
        for (const m of mine) {
            expect(m.sql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i)
            expect(m.sql).toMatch(/IF NOT EXISTS|IF EXISTS/)
        }
        const slugs = dbSetup.slice(dbSetup.indexOf('const COLLECTION_SLUGS'))
        expect(slugs).toContain("'ai-shop-limits'")
        expect(slugs).toContain("'ai-cap-alerts'")
    })
})

describe('plan-feature codes', () => {
    it('TC-AICAP-PW-003 the three new codes are selectable, and the PlanFeatures hook validates them', () => {
        const codes = FEATURE_CODE_OPTIONS.map((o) => o.value as string)
        for (const code of ['ai_enabled', 'ai_budget_usd_monthly', 'ai_site_budget_usd_daily']) expect(codes).toContain(code)

        const hook = PlanFeatures.hooks!.beforeChange![0] as (args: Record<string, unknown>) => unknown
        const run = (featureCode: string, value: string) => hook({ data: { featureCode, value }, originalDoc: undefined, collection: { slug: 'plan-features' } })
        expect(run('ai_enabled', 'NO')).toEqual({ featureCode: 'ai_enabled', value: 'NO' })
        expect(run('ai_budget_usd_monthly', '12.5')).toBeTruthy()
        expect(() => run('ai_enabled', 'maybe')).toThrow(ValidationError)
        expect(() => run('ai_budget_usd_monthly', '-1')).toThrow(ValidationError)
        expect(() => run('ai_site_budget_usd_daily', 'lots')).toThrow(ValidationError)
    })

    it('TC-AICAP-PW-004 ai_enabled takes YES / NO only; the budgets take UNLIMITED or a number ≥ 0', () => {
        expect(aiLimitProblem('ai_enabled', 'yes')).toBeNull()
        expect(aiLimitProblem('ai_enabled', ' NO ')).toBeNull()
        expect(aiLimitProblem('ai_enabled', 'UNLIMITED')).toMatch(/YES or NO/)
        expect(aiLimitProblem('ai_enabled', '')).toMatch(/YES or NO/)
        for (const code of ['ai_budget_usd_monthly', 'ai_site_budget_usd_daily']) {
            expect(aiLimitProblem(code, 'UNLIMITED')).toBeNull()
            expect(aiLimitProblem(code, '0')).toBeNull()
            expect(aiLimitProblem(code, '12.5')).toBeNull()
            expect(aiLimitProblem(code, '-3')).toMatch(code)
            expect(aiLimitProblem(code, 'abc')).toMatch(code)
        }
        // the old codes keep their rules (pictures stay whole numbers)
        expect(aiLimitProblem('ai_pictures_daily', '1.5')).toMatch(/whole number/)
    })
})

describe('caps schema', () => {
    it('TC-AICAP-PW-005 accepts numbers ≥ 0 or null and ascending unique percents 1..100', () => {
        expect(AiCapsSchema.safeParse({}).success).toBe(true)
        expect(AiCapsSchema.safeParse({ dailyUsd: 20, monthlyUsd: null, alertPercents: [50, 80, 100], pauseFreeAtPercent: 80 }).success).toBe(true)
        expect(AiCapsSchema.safeParse({ dailyUsd: 0, pauseFreeAtPercent: null }).success).toBe(true)
    })

    it.each([
        ['negative daily', { dailyUsd: -1 }],
        ['non-numeric monthly', { monthlyUsd: '5' }],
        ['percent 0', { alertPercents: [0, 50] }],
        ['percent 101', { alertPercents: [50, 101] }],
        ['not ascending', { alertPercents: [80, 50] }],
        ['repeated', { alertPercents: [50, 50] }],
        ['fractional', { alertPercents: [50.5] }],
        ['more than 10', { alertPercents: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }],
        ['pause 0', { pauseFreeAtPercent: 0 }],
        ['unknown key', { weeklyUsd: 5 }],
    ])('TC-AICAP-PW-005b rejects %s', (_label, caps) => {
        expect(AiCapsSchema.safeParse(caps).success).toBe(false)
    })

    it('TC-AICAP-PW-006 the platform config carries caps (optional) and its hook names the bad field', () => {
        expect(AiPlatformConfigSchema.safeParse({}).data?.caps).toBeUndefined()
        expect(AiPlatformConfigSchema.parse({ caps: { dailyUsd: 5 } }).caps).toEqual({ dailyUsd: 5 })
        expect(aiConfigProblem({ caps: { alertPercents: [90, 10] } })).toMatch(/caps\.alertPercents/)
        expect(aiConfigProblem({ prices: {}, caps: { monthlyUsd: 100 } })).toBeNull()

        const hook = PlanFeatures.hooks!.beforeChange![0] as (args: Record<string, unknown>) => unknown
        const run = (settings: unknown) => hook({ data: { featureCode: 'ai_platform_config', value: 'YES', settings }, collection: { slug: 'plan-features' } })
        expect(() => run({ caps: { dailyUsd: -5 } })).toThrow(ValidationError)
        expect(run({ caps: { dailyUsd: 5 } })).toBeTruthy()
    })
})

describe('collections', () => {
    const asUser = (roles: string[] | null) => ({ req: { user: roles ? { roles } : null } }) as never

    it('TC-AICAP-PW-007 ai-shop-limits and ai-cap-alerts are super-admin only, in the AI admin group, with the contract fields', () => {
        for (const collection of [AiShopLimits, AiCapAlerts]) {
            expect(collection.admin?.group).toBe('AI')
            const read = collection.access!.read as (a: never) => boolean
            expect(read(asUser(['super-admin']))).toBe(true)
            expect(read(asUser(['tenant-owner']))).toBe(false)
            expect(read(asUser(null))).toBe(false)
        }
        type Loose = { name?: string; fields?: Loose[] }
        const names = (c: { fields: unknown[] }) => (c.fields as Loose[]).flatMap((f) => f.fields ?? [f]).map((f) => f.name)
        expect(names(AiShopLimits)).toEqual(expect.arrayContaining(['tenant', 'mode', 'aiBudgetUsd', 'picturesPerDay', 'aiBudgetUsdMonthly', 'siteBudgetUsd', 'reason', 'expiresAt', 'setBy']))
        expect(names(AiCapAlerts)).toEqual(expect.arrayContaining(['scope', 'periodKey', 'threshold', 'spentUsd', 'capUsd', 'tenant', 'notifiedLark']))
        const tenant = AiShopLimits.fields.find((f) => 'name' in f && f.name === 'tenant') as { unique?: boolean; required?: boolean }
        expect(tenant).toMatchObject({ unique: true, required: true })
        // alerts are written by the cron with SQL: nobody creates or edits them in the admin
        expect((AiCapAlerts.access!.create as () => boolean)()).toBe(false)
        expect((AiCapAlerts.access!.update as () => boolean)()).toBe(false)
        expect((AiShopLimits.access!.update as (a: never) => boolean)(asUser(['super-admin']))).toBe(true)
        expect((AiShopLimits.access!.update as (a: never) => boolean)(asUser(['tenant-owner']))).toBe(false)
    })

    it('TC-AICAP-PW-007b the collection hook rejects a custom override with no limit and stamps setBy from the session', () => {
        const hook = AiShopLimits.hooks!.beforeChange![0] as (args: Record<string, unknown>) => unknown
        expect(() => hook({ data: { mode: 'custom' }, originalDoc: undefined, req: {} })).toThrow(ValidationError)
        expect(hook({ data: { mode: 'custom', aiBudgetUsd: 1 }, originalDoc: undefined, req: { user: { id: 9 } } })).toEqual({ mode: 'custom', aiBudgetUsd: 1, setBy: 9 })
        expect(hook({ data: { mode: 'blocked' }, originalDoc: { mode: 'custom', aiBudgetUsd: 1 }, req: {} })).toEqual({ mode: 'blocked' })
    })
})

describe('shop override input', () => {
    const base = { mode: 'custom', aiBudgetUsd: 1, reason: 'VIP' }

    it('TC-AICAP-PW-008 requires a reason and a valid mode, numbers ≥ 0, whole pictures, an ISO expiry', () => {
        expect(ShopLimitInputSchema.safeParse(base).success).toBe(true)
        expect(ShopLimitInputSchema.safeParse({ ...base, reason: '   ' }).success).toBe(false)
        expect(ShopLimitInputSchema.safeParse({ ...base, mode: 'free' }).success).toBe(false)
        expect(ShopLimitInputSchema.safeParse({ ...base, aiBudgetUsd: -1 }).success).toBe(false)
        expect(ShopLimitInputSchema.safeParse({ ...base, picturesPerDay: 1.5 }).success).toBe(false)
        expect(ShopLimitInputSchema.safeParse({ ...base, expiresAt: 'tomorrow' }).success).toBe(false)
        expect(ShopLimitInputSchema.safeParse({ ...base, expiresAt: '2026-12-01T00:00:00Z' }).success).toBe(true)
        expect(ShopLimitInputSchema.safeParse({ ...base, expiresAt: null }).success).toBe(true)
        expect(ShopLimitInputSchema.safeParse({ ...base, extra: 1 }).success).toBe(false)
    })

    it('TC-AICAP-PW-008b custom needs at least one limit; unlimited / blocked drop any numbers sent with them', () => {
        expect(shopLimitProblem({ mode: 'custom' })).toMatch(/at least one limit/)
        expect(shopLimitProblem({ mode: 'custom', picturesPerDay: 0 })).toBeNull()
        expect(shopLimitProblem({ mode: 'blocked' })).toBeNull()
        const parsed = ShopLimitInputSchema.parse({ ...base, mode: 'unlimited', reason: ' because ' })
        expect(normalizeShopLimit(parsed)).toEqual({
            mode: 'unlimited', aiBudgetUsd: null, picturesPerDay: null, aiBudgetUsdMonthly: null, siteBudgetUsd: null, reason: 'because', expiresAt: null,
        })
    })
})

describe('env examples', () => {
    it.each(['.env.staging.example', '.env.production.example'])('TC-AICAP-PW-009 %s documents LARK_WEBHOOK_AI_ALERTS as optional (empty)', (file) => {
        const lines = readFileSync(path.join(root, file), 'utf8').split('\n')
        expect(lines).toContain('LARK_WEBHOOK_AI_ALERTS=')
        expect(lines).toContain('AI_DAILY_BUDGET_USD=')
    })
})
