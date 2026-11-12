/**
 * TC-AISEC-103 — the receipt sweep (`GET /api/cron/ai-receipts`, every 5 min, lib/ai-platform/receipt-sweep):
 * - the route fails closed: no CRON_SECRET, `Bearer undefined`, a wrong or longer secret → 401 and nothing read;
 * - a receipt `applied` whose card is still pending → decision approve with the stored result and note, as the user
 *   who approved it (their workspace's token); `reverted` + card applied → revert with the stored result;
 * - a card already as the receipt says → marked done without a call; a card that can't follow (rejected / expired,
 *   gone, the approver left the workspace) → logged and marked done; a transient failure → left for the next run;
 * - at most 50 receipts per run, and it stops starting new ones after its time budget;
 * - registered as a Vercel cron (every 5 min) and in the staging cron workflow's frequent routes; the table is a
 *   db-setup migration (CREATE TABLE IF NOT EXISTS, never dropped).
 * Real: the route, receipt-sweep.ts, vercel.json, ai-staging-cron.yml, db-setup MIGRATIONS. Faked: the receipt store
 * (its SQL: integration/ai-apply-receipts-postgres.test.ts), Payload's user read, the token, the AI platform.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const findByID = vi.hoisted(() => vi.fn())
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ findByID })) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/ai-platform/context', () => ({
    AgentAccessError: class AgentAccessError extends Error {
        constructor(message: string, readonly status = 403) { super(message) }
    },
    actorForUserInTenant: vi.fn(),
    signAgentContextToken: vi.fn(async (actor: { tenantId: string }) => `token-for-${actor.tenantId}`),
}))
vi.mock('@/lib/ai-platform/upstream', () => ({
    AiPlatformError: class AiPlatformError extends Error {
        constructor(message: string, readonly status: number) { super(message) }
    },
    aiPlatformJson: vi.fn(),
}))
vi.mock('@/lib/ai-platform/apply-receipts', async () => ({
    SWEEP_LIMIT: 50,
    unrecordedReceipts: vi.fn(),
    markRecorded: vi.fn(),
    deferReceipt: vi.fn(),
}))

import { GET } from '@/app/api/cron/ai-receipts/route'
import { deferReceipt, markRecorded, unrecordedReceipts } from '@/lib/ai-platform/apply-receipts'
import { AgentAccessError, actorForUserInTenant } from '@/lib/ai-platform/context'
import { sweepUnrecordedReceipts } from '@/lib/ai-platform/receipt-sweep'
import { AiPlatformError, aiPlatformJson } from '@/lib/ai-platform/upstream'

const root = path.resolve(__dirname, '../../../..')
const result = { entities: [{ kind: 'blog_post', id: '50' }], links: [] }
const receipt = (id: string, state: 'applied' | 'reverted', extra: Record<string, unknown> = {}) => ({
    changeSetId: id, tenantId: '7', userId: '3', state, result, note: state === 'applied' ? 'ok' : null, requestId: 'r', recordedAt: null, createdAt: '', updatedAt: '', ...extra,
})
const card = (id: string, status: string) => ({
    id, runId: 'run_1', domain: 'cms', title: 'x', summary: '', risk: 'low', blastRadius: { kind: 'blog_post', count: 1, label: '1' },
    diffs: [{ entity: { kind: 'blog_post', id: '50' }, field: 'title', before: null, after: 'Batik care', provenance: 'generated' }], guardrails: [], status, stagedBy: 'agent', stagedAt: '2026-10-22T00:00:00Z', expiresAt: '2999-01-01T00:00:00Z',
})
const sent = () => vi.mocked(aiPlatformJson).mock.calls.filter(([arg]) => arg.method === 'POST').map(([arg]) => ({ path: arg.path, token: arg.token, body: JSON.parse(String(arg.body)) }))
const cron = (authorization?: string) => GET(new Request('http://localhost:3000/api/cron/ai-receipts', { headers: authorization ? { authorization } : {} }))

beforeEach(() => {
    vi.mocked(unrecordedReceipts).mockReset().mockResolvedValue([])
    vi.mocked(markRecorded).mockReset().mockResolvedValue(undefined)
    vi.mocked(deferReceipt).mockReset().mockResolvedValue(undefined)
    vi.mocked(aiPlatformJson).mockReset()
    vi.mocked(actorForUserInTenant).mockReset().mockImplementation((_user, tenantId) => ({ user: { id: '3' }, tenantId: String(tenantId), organizationId: 'org_7', role: 'owner' }) as never)
    findByID.mockReset().mockResolvedValue({ id: 3, email: 'owner@shop.my', tenants: [] })
    vi.stubEnv('CRON_SECRET', 'cron-secret-value')
})
afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
})

describe('the cron route fails closed [TC-AISEC-103]', () => {
    it('refuses no header, a wrong or longer secret, and "Bearer undefined" when CRON_SECRET is unset', async () => {
        const answers = [await cron(), await cron('Bearer nope'), await cron('Bearer cron-secret-value-and-more')]
        vi.stubEnv('CRON_SECRET', '')
        answers.push(await cron('Bearer undefined'), await cron('Bearer '))

        expect(answers.map((r) => r.status)).toEqual([401, 401, 401, 401, 401])
        expect(unrecordedReceipts).not.toHaveBeenCalled()
    })

    it('runs the sweep with the right secret and answers its counts', async () => {
        const res = await cron('Bearer cron-secret-value')

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ success: true, checked: 0, recorded: 0, alreadyRecorded: 0, gaveUp: 0, deferred: 0 })
        expect(unrecordedReceipts).toHaveBeenCalledWith(50, expect.any(Date))
    })

    it('answers 500 without details when the receipts can\'t be read', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        vi.mocked(unrecordedReceipts).mockRejectedValue(new Error('relation "ai_change_set_applies" does not exist'))

        const res = await cron('Bearer cron-secret-value')

        expect(res.status).toBe(500)
        expect(JSON.stringify(await res.json())).not.toContain('relation')
    })
})

describe('what the sweep sends [TC-AISEC-103]', () => {
    it('records a pending card as applied, and an applied card as reverted, with the stored result, as the approver', async () => {
        vi.mocked(unrecordedReceipts).mockResolvedValue([receipt('cs_a', 'applied'), receipt('cs_b', 'reverted')] as never)
        vi.mocked(aiPlatformJson).mockImplementation(async ({ method, path: p }) => {
            if (method === 'GET') return card(p.endsWith('cs_a') ? 'cs_a' : 'cs_b', p.endsWith('cs_a') ? 'pending' : 'applied')
            return {}
        })

        const totals = await sweepUnrecordedReceipts()

        expect(sent()).toEqual([
            { path: '/agent/change-sets/cs_a/decision', token: 'token-for-7', body: { decision: 'approve', note: 'ok', result } },
            { path: '/agent/change-sets/cs_b/revert', token: 'token-for-7', body: { result } },
        ])
        expect(findByID).toHaveBeenCalledWith({ collection: 'users', id: '3', depth: 1, overrideAccess: true })
        expect(markRecorded).toHaveBeenCalledWith('cs_a', 'applied')
        expect(markRecorded).toHaveBeenCalledWith('cs_b', 'reverted')
        expect(totals).toMatchObject({ checked: 2, recorded: 2 })
    })

    it('marks done without a call when the card is already as the receipt says', async () => {
        vi.mocked(unrecordedReceipts).mockResolvedValue([receipt('cs_a', 'applied')] as never)
        vi.mocked(aiPlatformJson).mockResolvedValue(card('cs_a', 'applied'))

        expect(await sweepUnrecordedReceipts()).toMatchObject({ alreadyRecorded: 1 })
        expect(sent()).toEqual([])
        expect(markRecorded).toHaveBeenCalledWith('cs_a', 'applied')
    })

    it('gives up (logged, marked done) on a card rejected meanwhile, a deleted chat, or an approver who left', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        vi.mocked(unrecordedReceipts).mockResolvedValue([receipt('cs_rej', 'applied'), receipt('cs_gone', 'applied'), receipt('cs_left', 'applied', { userId: '9' })] as never)
        vi.mocked(aiPlatformJson).mockImplementation(async ({ path: p }) => {
            if (p.endsWith('cs_gone')) throw new AiPlatformError('Change set not found.', 404)
            return card('cs_rej', 'rejected')
        })
        vi.mocked(actorForUserInTenant).mockImplementation((user) => {
            if ((user as { id: number }).id === 9) throw new AgentAccessError('You are not an active member of this workspace.')
            return { user, tenantId: '7', organizationId: 'org_7', role: 'owner' } as never
        })
        findByID.mockImplementation(async ({ id }: { id: string }) => ({ id: Number(id), tenants: [] }))

        const totals = await sweepUnrecordedReceipts()

        expect(totals).toMatchObject({ checked: 3, gaveUp: 3 })
        expect(sent()).toEqual([])
        expect(vi.mocked(markRecorded).mock.calls.map(([id]) => id).sort()).toEqual(['cs_gone', 'cs_left', 'cs_rej'])
        expect(log.mock.calls.map(([line]) => String(line)).join('\n')).toMatch(/cs_rej[\s\S]*card is rejected[\s\S]*cs_gone[\s\S]*cs_left/)
    })

    it('leaves a receipt for the next run when the platform is down, and goes on with the others', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        vi.mocked(unrecordedReceipts).mockResolvedValue([receipt('cs_down', 'applied'), receipt('cs_ok', 'applied')] as never)
        vi.mocked(aiPlatformJson).mockImplementation(async ({ method, path: p }) => {
            if (p.includes('cs_down')) throw new AiPlatformError('AI platform 503', 503)
            return method === 'GET' ? card('cs_ok', 'pending') : {}
        })

        const totals = await sweepUnrecordedReceipts()

        expect(totals).toMatchObject({ checked: 2, deferred: 1, recorded: 1 })
        expect(deferReceipt).toHaveBeenCalledWith('cs_down')
        expect(markRecorded).toHaveBeenCalledWith('cs_ok', 'applied')
        expect(markRecorded).not.toHaveBeenCalledWith('cs_down', expect.anything())
    })

    it('stops starting receipts after its time budget', async () => {
        vi.mocked(unrecordedReceipts).mockResolvedValue([receipt('cs_1', 'applied'), receipt('cs_2', 'applied')] as never)
        vi.mocked(aiPlatformJson).mockImplementation(async ({ method }) => {
            await new Promise((resolve) => setTimeout(resolve, 15))
            return method === 'GET' ? card('cs_1', 'applied') : {}
        })

        const totals = await sweepUnrecordedReceipts({ budgetMs: 5 })

        expect(totals.checked).toBe(1)
    })
})

describe('a refusal from the platform is final, a timeout or rate limit is not [TC-AISEC-142]', () => {
    it('gives up on a 403 (approver now a viewer) and a 422 on the record call; defers a 429 and a 502', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const ids = ['cs_403', 'cs_422', 'cs_429', 'cs_502']
        vi.mocked(unrecordedReceipts).mockResolvedValue(ids.map((id) => receipt(id, 'applied')) as never)
        vi.mocked(aiPlatformJson).mockImplementation(async ({ method, path: p }) => {
            const id = ids.find((each) => p.includes(each))!
            if (id === 'cs_403' && method === 'GET') throw new AiPlatformError('Viewers cannot decide change sets.', 403)
            if (method === 'GET') return card(id, 'pending')
            const status = Number(id.slice(3))
            throw new AiPlatformError(`refused ${status}`, status)
        })

        const totals = await sweepUnrecordedReceipts()

        expect(totals).toMatchObject({ checked: 4, gaveUp: 2, deferred: 2, recorded: 0 })
        expect(vi.mocked(markRecorded).mock.calls.map(([id]) => id).sort()).toEqual(['cs_403', 'cs_422'])
        expect(vi.mocked(deferReceipt).mock.calls.map(([id]) => id).sort()).toEqual(['cs_429', 'cs_502'])
        expect(log.mock.calls.map(([line]) => String(line)).join('\n')).toContain('the AI platform refused (403): Viewers cannot decide change sets.')
    })
})

describe('schedule and schema [TC-AISEC-103]', () => {
    it('is a Vercel cron every 5 minutes and a frequent staging cron route', () => {
        const vercel = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8')) as { crons: Array<{ path: string; schedule: string }> }
        const staging = readFileSync(path.join(root, '.github/workflows/ai-staging-cron.yml'), 'utf8')
        const frequent = staging.slice(staging.indexOf('if [ "$KIND" = "frequent" ]'), staging.indexOf('if [ "$KIND" = "daily" ]'))

        expect(vercel.crons).toContainEqual({ path: '/api/cron/ai-receipts', schedule: '*/5 * * * *' })
        expect(frequent).toContain('call "$APP_URL/api/cron/ai-receipts"')
    })

    it('creates ai_change_set_applies once, idempotently, with the states and the unrecorded index; nothing dropped', () => {
        const { MIGRATIONS } = createRequire(import.meta.url)(path.join(root, 'scripts/db-setup.js')) as { MIGRATIONS: Array<{ name: string; sql: string }> }
        const table = MIGRATIONS.filter((m) => m.name === 'ai_change_set_applies.create_table')
        const index = MIGRATIONS.filter((m) => m.name === 'ai_change_set_applies.unrecorded_idx')

        expect(table).toHaveLength(1)
        expect(index).toHaveLength(1)
        expect(table[0]!.sql).toMatch(/CREATE TABLE IF NOT EXISTS ai_change_set_applies \(\s*change_set_id varchar PRIMARY KEY/)
        expect(table[0]!.sql).toMatch(/CHECK \(state IN \('applying', 'applied', 'reverted'\)\)/)
        for (const column of ['tenant_id integer NOT NULL', 'result jsonb', 'request_id varchar', 'recorded_at timestamp', 'created_at timestamp', 'updated_at timestamp']) expect(table[0]!.sql).toContain(column)
        expect(index[0]!.sql).toContain('WHERE recorded_at IS NULL')
        expect(MIGRATIONS.some((m) => /DROP\s+TABLE/i.test(m.sql) && m.sql.includes('ai_change_set_applies'))).toBe(false)
    })
})
