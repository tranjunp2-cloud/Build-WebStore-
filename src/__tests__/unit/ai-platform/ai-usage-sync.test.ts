/**
 * TC-AIU-SYNC-001..014 — copy of the ai-platform usage ledger into `ai-usage-logs`
 * (lib/ai-platform/usage-sync*, GET /api/cron/ai-usage-sync, collection + db-setup migrations).
 * - 001 feature derivation; 002 null cost / model 'unknown' / null tokens; 003 success from outcome
 * - 004 org → tenant (derived hash and metaData.platformOrgId override); 005 user → users.id, unknown → null
 * - 006 cursor = MAX(platform_event_id), a full page continues, a short page stops, rows upserted on platform_event_id
 * - 007 page / time caps; 008 malformed event: rows before it copied, the run fails, the cursor stays before it
 * - 009 cron fails closed without CRON_SECRET; 010 unconfigured platform → 200 skipped; 011 failure → 500
 * - 012 collection fields + migrations (nullable endpoint/cost, unique event id, tenant index) + vercel cron; nothing dropped
 * - 013 readable detail: summary, task label, area (run page, else task family), page/thread, totals, cache %, battery cost
 * - 014 backfill: `from` starts at the given id (route ?from=0) and refreshes rows already copied
 * Real: mapping, sync loop, route, collection, MIGRATIONS, vercel.json. Faked: Payload's drizzle handle (records the
 * SQL), the upstream HTTP call, the token signer is real (needs a secret).
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SQL } from 'drizzle-orm'
import { toPlatformOrganizationId, toPlatformUserId } from '@/lib/auth/bridge-token'

const execute = vi.hoisted(() => vi.fn())
const aiPlatformJson = vi.hoisted(() => vi.fn())
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ db: { drizzle: { execute } } })) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/ai-platform/upstream', () => ({ aiPlatformJson }))

import { GET } from '@/app/api/cron/ai-usage-sync/route'
import { USAGE_MAX_PAGES, USAGE_PAGE_SIZE, syncUsageEvents } from '@/lib/ai-platform/usage-sync'
import { areaOf, featureOf, summaryOf, taskLabel, tenantOrgMap, toLogRow, userPlatformMap, type UsageEvent } from '@/lib/ai-platform/usage-sync-map'

const root = path.resolve(__dirname, '../../../..')
const event = (id: number, extra: Partial<UsageEvent> = {}): UsageEvent => ({
    id, organizationId: 'org_x', userId: null, surface: 'merchant', task: 'agent.chat', runId: null, provider: 'openai',
    model: 'gpt-5-mini', inputTokens: 10, outputTokens: 5, cachedInputTokens: 2, costUsdMicros: 1500, latencyMs: 800,
    outcome: 'ok', errorCode: null, createdAt: '2026-10-26T01:00:00.000Z', ...extra,
})
const noMaps = [new Map<string, number>(), new Map<string, number>()] as const

describe('usage mapping', () => {
    it('TC-AIU-SYNC-001 derives the feature from task and surface', () => {
        expect(featureOf({ task: 'agent.chat', surface: 'merchant' })).toBe('assistant')
        expect(featureOf({ task: 'agent.suggest-next', surface: 'system' })).toBe('assistant')
        expect(featureOf({ task: 'media.generate-image', surface: 'system' })).toBe('pictures')
        expect(featureOf({ task: 'content.translate', surface: 'system' })).toBe('writing')
        expect(featureOf({ task: 'content.translate', surface: 'merchant' })).toBe('other')
    })

    it('TC-AIU-SYNC-002 keeps null cost as null, converts micros, defaults model and tokens', () => {
        expect(toLogRow(event(1), ...noMaps).cost_usd).toBe(0.0015)
        const bare = toLogRow(event(2, { costUsdMicros: null, model: null, inputTokens: null, outputTokens: null, latencyMs: null, cachedInputTokens: null }), ...noMaps)
        expect(bare).toMatchObject({ cost_usd: null, model: 'unknown', tokens_in: 0, tokens_out: 0, duration_ms: 0, cached_tokens_in: null })
        expect(toLogRow(event(3), ...noMaps).created_at).toBe('2026-10-26T01:00:00.000Z')
    })

    it('TC-AIU-SYNC-003 success is outcome !== error, error code copied', () => {
        expect(toLogRow(event(1, { outcome: 'refused' }), ...noMaps).success).toBe(true)
        const failed = toLogRow(event(2, { outcome: 'error', errorCode: 'provider_timeout' }), ...noMaps)
        expect(failed).toMatchObject({ success: false, error_code: 'provider_timeout', outcome: 'error' })
    })

    it('TC-AIU-SYNC-004 maps organization to tenant: derived hash and platformOrgId override; unknown stays null', () => {
        const override = 'org_abcdefghij0123456789ab'
        const map = tenantOrgMap([{ id: 7, meta_data: null }, { id: 8, meta_data: { platformOrgId: override } }, { id: 9, meta_data: JSON.stringify({ platformOrgId: 'bad' }) }])
        expect(map.get(toPlatformOrganizationId(7))).toBe(7)
        expect(map.get(override)).toBe(8)
        expect(map.get(toPlatformOrganizationId(9))).toBe(9)
        expect(toLogRow(event(1, { organizationId: toPlatformOrganizationId(7) }), map, new Map()).tenant_id).toBe(7)
        expect(toLogRow(event(2, { organizationId: 'org_unknown' }), map, new Map()).tenant_id).toBeNull()
    })

    it('TC-AIU-SYNC-005 maps platform user id back to users.id; unknown or absent → null', () => {
        const users = userPlatformMap([{ id: 41 }, { id: '42' }])
        expect(toLogRow(event(1, { userId: toPlatformUserId(41) }), new Map(), users).user_id).toBe(41)
        expect(toLogRow(event(2, { userId: 'user_nobody' }), new Map(), users).user_id).toBeNull()
        expect(toLogRow(event(3), new Map(), users).user_id).toBeNull()
    })
})

describe('syncUsageEvents', () => {
    const queries: string[] = []
    // string chunks as written, nested SQL (sql.raw, sql.join) rendered recursively, bound params as '?'
    const text = (q: SQL): string => q.queryChunks.map((c): string => {
        if (typeof c === 'object' && c && 'queryChunks' in c) return text(c as SQL)
        if (typeof c === 'object' && c && 'value' in c && Array.isArray(c.value)) return (c.value as string[]).join('')
        return '?'
    }).join('')
    let cursorRow: unknown

    beforeEach(() => {
        process.env.AI_PLATFORM_CONTEXT_SECRET = 's'.repeat(40)
        queries.length = 0
        cursorRow = { cursor: null }
        execute.mockReset()
        aiPlatformJson.mockReset()
        execute.mockImplementation(async (q: SQL) => {
            const sqlText = text(q)
            queries.push(sqlText)
            if (sqlText.includes('MAX(platform_event_id)')) return { rows: [cursorRow] }
            if (sqlText.includes('FROM tenants')) return { rows: [{ id: 7, meta_data: null }] }
            if (sqlText.includes('FROM users')) return { rows: [{ id: 41 }] }
            // one new row and one refreshed (xmax <> 0) per page
            if (sqlText.includes('INSERT INTO ai_usage_logs')) return { rows: [{ inserted: true }, { inserted: true }, { inserted: false }] }
            return { rows: [] }
        })
    })
    afterEach(() => { delete process.env.AI_PLATFORM_CONTEXT_SECRET })

    const events = (from: number, count: number) => Array.from({ length: count }, (_, i) => event(from + i))

    it('TC-AIU-SYNC-006 starts at MAX(platform_event_id), pages while full, inserts idempotently', async () => {
        cursorRow = { cursor: '120' }
        aiPlatformJson
            .mockResolvedValueOnce({ events: events(121, USAGE_PAGE_SIZE), nextAfter: 120 + USAGE_PAGE_SIZE })
            .mockResolvedValueOnce({ events: events(121 + USAGE_PAGE_SIZE, 3), nextAfter: 123 + USAGE_PAGE_SIZE })

        const result = await syncUsageEvents()

        expect(result).toEqual({ fetched: USAGE_PAGE_SIZE + 3, inserted: 4, pages: 2, cursor: 123 + USAGE_PAGE_SIZE })
        expect(aiPlatformJson.mock.calls[0]![0]).toMatchObject({ method: 'GET', path: `/internal/usage-events?after=120&limit=${USAGE_PAGE_SIZE}` })
        expect(aiPlatformJson.mock.calls[1]![0].path).toContain(`after=${120 + USAGE_PAGE_SIZE}`)
        const inserts = queries.filter((q) => q.includes('INSERT INTO ai_usage_logs'))
        expect(inserts).toHaveLength(2)
        expect(inserts[0]).toContain('ON CONFLICT (platform_event_id) DO UPDATE SET')
        expect(inserts[0]).toContain('summary = EXCLUDED.summary')
        expect(inserts[0]).not.toContain('platform_event_id = EXCLUDED')
        expect(inserts[0]).not.toContain('created_at = EXCLUDED')
        // maps are built once per run, not per page
        expect(queries.filter((q) => q.includes('FROM tenants'))).toHaveLength(1)
    })

    it('TC-AIU-SYNC-006 an empty ledger starts from 0 and inserts nothing', async () => {
        aiPlatformJson.mockResolvedValueOnce({ events: [], nextAfter: 0 })
        expect(await syncUsageEvents()).toEqual({ fetched: 0, inserted: 0, pages: 1, cursor: 0 })
        expect(aiPlatformJson.mock.calls[0]![0].path).toContain('after=0')
        expect(queries.some((q) => q.includes('INSERT'))).toBe(false)
        const token = aiPlatformJson.mock.calls[0]![0].token as string
        expect(JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString())).toMatchObject({ iss: 'prime-web', aud: 'ai-platform:internal', sub: 'usage-sync' })
    })

    it('TC-AIU-SYNC-007 stops after the page cap and after the time budget', async () => {
        aiPlatformJson.mockImplementation(async ({ path: p }: { path: string }) => {
            const after = Number(/after=(\d+)/.exec(p)![1])
            return { events: events(after + 1, USAGE_PAGE_SIZE), nextAfter: after + USAGE_PAGE_SIZE }
        })
        expect((await syncUsageEvents()).pages).toBe(USAGE_MAX_PAGES)

        aiPlatformJson.mockClear()
        let t = 0
        const result = await syncUsageEvents(() => (t += 30_000))
        expect(result.pages).toBe(1)
    })

    it('TC-AIU-SYNC-008 a malformed event fails the run after copying the rows before it (never skipped)', async () => {
        aiPlatformJson.mockResolvedValueOnce({ events: [event(1), { id: 'nope' }, event(3)], nextAfter: 3 })
        await expect(syncUsageEvents()).rejects.toThrow(/malformed usage event after ledger id 1/)
        expect(queries.filter((q) => q.includes('INSERT INTO ai_usage_logs'))).toHaveLength(1)
        expect(aiPlatformJson).toHaveBeenCalledTimes(1)
    })
})

describe('GET /api/cron/ai-usage-sync', () => {
    const call = (auth?: string) => GET(new Request('http://x/api/cron/ai-usage-sync', { headers: auth ? { authorization: auth } : {} }))
    beforeEach(() => {
        process.env.CRON_SECRET = 'cron-secret'
        process.env.AI_PLATFORM_URL = 'https://ai.example'
        process.env.AI_PLATFORM_CONTEXT_SECRET = 's'.repeat(40)
        execute.mockReset()
        aiPlatformJson.mockReset()
    })
    afterEach(() => { for (const k of ['CRON_SECRET', 'AI_PLATFORM_URL', 'AI_PLATFORM_CONTEXT_SECRET']) delete process.env[k] })

    it('TC-AIU-SYNC-009 fails closed: no secret configured, no header, wrong or Bearer undefined → 401, nothing read', async () => {
        expect((await call('Bearer wrong')).status).toBe(401)
        expect((await call()).status).toBe(401)
        delete process.env.CRON_SECRET
        expect((await call('Bearer undefined')).status).toBe(401)
        expect(execute).not.toHaveBeenCalled()
    })

    it('TC-AIU-SYNC-010 returns 200 skipped when the platform is not configured', async () => {
        delete process.env.AI_PLATFORM_URL
        const res = await call('Bearer cron-secret')
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ skipped: true, reason: 'AI_PLATFORM_URL is not configured' })
        expect(aiPlatformJson).not.toHaveBeenCalled()
    })

    it('TC-AIU-SYNC-011 returns the sync result, and 500 (logged) when the sync fails', async () => {
        execute.mockResolvedValue({ rows: [] })
        aiPlatformJson.mockResolvedValueOnce({ events: [], nextAfter: 0 })
        const ok = await call('Bearer cron-secret')
        expect(await ok.json()).toEqual({ success: true, fetched: 0, inserted: 0, pages: 1, cursor: 0 })

        const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        aiPlatformJson.mockRejectedValueOnce(new Error('AI platform 502'))
        const bad = await call('Bearer cron-secret')
        expect(bad.status).toBe(500)
        expect(spy).toHaveBeenCalled()
        spy.mockRestore()
    })
})

describe('schema wiring', () => {
    it('TC-AIU-SYNC-012 collection fields, migrations and the cron are in place; nothing dropped', async () => {
        const { MIGRATIONS } = createRequire(import.meta.url)(path.join(root, 'scripts/db-setup.js')) as { MIGRATIONS: Array<{ name: string; sql: string }> }
        const mine = MIGRATIONS.filter((m) => m.name.startsWith('ai_usage_logs.'))
        const all = mine.map((m) => m.sql).join('\n')
        for (const column of ['source', 'feature', 'task', 'provider', 'outcome', 'cached_tokens_in', 'run_id', 'organization_id', 'platform_event_id']) {
            expect(all).toContain(`ADD COLUMN IF NOT EXISTS ${column} `)
        }
        expect(all).toContain('ALTER COLUMN endpoint DROP NOT NULL')
        expect(all).toContain('ALTER COLUMN cost_usd DROP NOT NULL')
        expect(all).toContain('CREATE UNIQUE INDEX IF NOT EXISTS ai_usage_logs_platform_event_id_idx')
        expect(all).toContain('ai_usage_logs_tenant_idx ON ai_usage_logs (tenant_id)')
        expect(MIGRATIONS.some((m) => /DROP\s+TABLE/i.test(m.sql) && m.sql.includes('ai_usage_logs'))).toBe(false)

        const { AiUsageLogs } = await import('@/collections/AiUsageLogs')
        type AnyField = { name?: string; fields?: AnyField[]; tabs?: Array<{ fields: AnyField[] }>; required?: boolean; unique?: boolean }
        const flat = (fields: AnyField[]): AnyField[] => fields.flatMap((f) => [f, ...flat(f.fields ?? []), ...flat((f.tabs ?? []).flatMap((t) => t.fields))])
        const all_fields = flat(AiUsageLogs.fields as AnyField[])
        const names = all_fields.map((f) => f.name ?? '')
        for (const name of ['source', 'feature', 'task', 'provider', 'outcome', 'cachedTokensIn', 'runId', 'organizationId', 'platformEventId', 'endpoint', 'costUsd',
            'summary', 'area', 'taskLabel', 'pageTitle', 'pagePath', 'threadId', 'totalTokens', 'cacheHitPercent', 'batteryCostUsd', 'priced', 'errorLabel']) expect(names).toContain(name)
        const field = (n: string) => all_fields.find((f) => f.name === n) as AnyField
        expect(AiUsageLogs.admin?.useAsTitle).toBe('summary')
        for (const column of ['summary', 'area', 'task_label', 'page_title', 'page_path', 'thread_id', 'total_tokens', 'cache_hit_percent', 'battery_cost_usd', 'priced', 'error_label']) {
            expect(all).toContain(`ADD COLUMN IF NOT EXISTS ${column} `)
        }
        expect(field('endpoint').required).toBeFalsy()
        expect(field('costUsd').required).toBeFalsy()
        expect(field('platformEventId').unique).toBe(true)
        expect(AiUsageLogs.access?.create?.({} as never)).toBe(false)

        const vercel = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8')) as { crons: Array<{ path: string; schedule: string }> }
        expect(vercel.crons).toContainEqual({ path: '/api/cron/ai-usage-sync', schedule: '*/5 * * * *' })
    })
})

describe('readable detail', () => {
    const run = { domain: 'webbuilder', threadId: 'thr_1', pagePath: '/editor/1', pageTitle: 'Online Store › Editor › page "Home"', pageModule: 'editor' }

    it('TC-AIU-SYNC-013 summary, task label, area, page/thread, totals, cache %, battery cost and error words', () => {
        const chat = toLogRow(event(1, { task: 'agent.merchant-copilot', runId: 'run_1', run, inputTokens: 80_000, cachedInputTokens: 76_000, outputTokens: 500, batteryUsdMicros: 3_100 }), ...noMaps)
        expect(chat).toMatchObject({
            summary: 'Assistant · Assistant reply · Web editor', task_label: 'Assistant reply', area: 'web-editor',
            page_title: run.pageTitle, page_path: '/editor/1', thread_id: 'thr_1', total_tokens: 80_500, cache_hit_percent: 95, battery_cost_usd: 0.0031,
        })
        // module wins over domain; unknown module falls back to the domain; settings/* pages are Settings
        expect(areaOf({ task: 'agent.merchant-copilot', run: { ...run, pageModule: 'discounts', domain: 'campaigns' } })).toBe('discounts')
        expect(areaOf({ task: 'agent.merchant-copilot', run: { ...run, pageModule: 'mystery', domain: 'products' } })).toBe('products')
        expect(areaOf({ task: 'agent.merchant-copilot', run: { ...run, pageModule: 'settings-payments', domain: null } })).toBe('settings')
        // no run: the task family
        expect(areaOf({ task: 'sitegen.page-blocks', run: null })).toBe('website-setup')
        expect(areaOf({ task: 'media.generate-image' })).toBe('media')
        expect(areaOf({ task: 'seo.generate-meta' })).toBe('background')
        expect(areaOf({ task: 'agent.merchant-copilot', run: null })).toBe('chat-deleted')
        expect(taskLabel('agent.decide.clarify')).toBe('Auto-answer (clarify)')
        expect(taskLabel('brand.new-task')).toBe('brand.new-task')

        const failed = toLogRow(event(2, { task: 'seo.generate-meta', surface: 'system', outcome: 'error', errorCode: 'TimeoutError', costUsdMicros: null, inputTokens: 0, cachedInputTokens: null }), ...noMaps)
        expect(failed).toMatchObject({ summary: 'Writing tools · SEO title & description · Tool / background · Error', error_label: 'Timed out', priced: false, cost_usd: null, cache_hit_percent: null, battery_cost_usd: null, page_title: null, thread_id: null })
        expect(summaryOf(event(3, { outcome: 'refused' }))).toBe('Assistant · agent.chat · Chat deleted · No result')
        expect(toLogRow(event(4, { errorCode: 'SomethingNew' }), ...noMaps).error_label).toBe('SomethingNew')
    })
})

describe('backfill', () => {
    beforeEach(() => {
        process.env.AI_PLATFORM_CONTEXT_SECRET = 's'.repeat(40)
        process.env.CRON_SECRET = 'cron-secret'
        process.env.AI_PLATFORM_URL = 'https://ai.example'
        execute.mockReset()
        aiPlatformJson.mockReset()
        execute.mockResolvedValue({ rows: [{ cursor: '900' }] })
    })
    afterEach(() => { for (const k of ['CRON_SECRET', 'AI_PLATFORM_URL', 'AI_PLATFORM_CONTEXT_SECRET']) delete process.env[k] })

    it('TC-AIU-SYNC-014 `from` starts at the given id (route ?from=0), not the cursor; bad values are ignored', async () => {
        aiPlatformJson.mockResolvedValue({ events: [], nextAfter: 0 })
        await syncUsageEvents(Date.now, { from: 0 })
        expect(aiPlatformJson.mock.calls[0]![0].path).toContain('after=0&')

        await GET(new Request('http://x/api/cron/ai-usage-sync?from=0', { headers: { authorization: 'Bearer cron-secret' } }))
        expect(aiPlatformJson.mock.calls[1]![0].path).toContain('after=0&')
        await GET(new Request('http://x/api/cron/ai-usage-sync?from=-5', { headers: { authorization: 'Bearer cron-secret' } }))
        expect(aiPlatformJson.mock.calls[2]![0].path).toContain('after=900&')
    })
})
