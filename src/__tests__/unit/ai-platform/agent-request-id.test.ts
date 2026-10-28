// @vitest-environment node
/**
 * TC-AISEC-035 — every BFF call to ai-platform carries `x-request-id`: the browser request's own `x-request-id`, else
 * Vercel's `x-vercel-id`, else a new uuid; all calls made for one request (an approve: read, claim, decision) share
 * it and the proxied answer echoes it; an id that is not safe to log is replaced. Task calls (`runAiTaskForUser`)
 * send it too, and the tool facade logs its failures with the id ai-platform sent.
 * TC-AISEC-059 (attachment bytes) — the proxy keeps ai-platform's `x-content-type-options: nosniff` and serves a
 * document (PDF / CSV / XLSX) as a download (`content-disposition: attachment`); pictures stay inline.
 * Real: agent-proxy, upstream.ts, request-id.ts, task-client.ts, ai-tasks.ts, handle-agent-tool.ts, the
 * @ech/ai-contracts client. Faked: the agent flag, the merchant (context / tool actor), ai-platform (fetch),
 * the appliers, next/cache.
 */
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ai-platform/apply-receipts', () => import('./apply-receipts-off'))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/ai-platform/config', () => ({ isAiAgentEnabled: vi.fn(() => true), getAiPlatformUrl: vi.fn(() => 'http://ai-platform.test') }))
vi.mock('@/lib/ai-platform/context', () => ({
    AgentAccessError: class AgentAccessError extends Error {
        constructor(message: string, readonly status: number) { super(message) }
    },
    resolveAgentActor: vi.fn(async () => ({ user: { id: 3, email: 'owner@shop.my' }, tenantId: '7', organizationId: 'org_1', role: 'owner' })),
    resolveActorForUser: vi.fn(async () => ({ user: { id: 3, email: 'owner@shop.my' }, tenantId: '7', organizationId: 'org_1', role: 'owner' })),
    signAgentContextToken: vi.fn(async () => 'ctx-token'),
}))
vi.mock('@/lib/ai-platform/agent-tools/tool-actor', () => ({ resolveToolActor: vi.fn(async () => { throw new Error('database is down') }) }))
vi.mock('@/lib/ai-platform/appliers', async () => ({
    ...(await vi.importActual<object>('@/lib/ai-platform/appliers')),
    applyChangeSet: vi.fn(async () => ({ entities: [{ kind: 'blog_post', id: '9' }], links: [] })),
}))

import { handleAgentProxy } from '@/lib/ai-platform/agent-proxy'
import { handleAgentTool } from '@/lib/ai-platform/agent-tools/handle-agent-tool'
import { runAiTaskForUser } from '@/lib/ai-platform/ai-tasks'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const fetchMock = vi.fn()
const card = (status: string) => ({
    id: 'cs_1', runId: 'run_1', domain: 'cms', title: 'Create blog draft', summary: '', risk: 'low',
    blastRadius: { kind: 'blog_post', count: 1, label: '1 new draft post' },
    diffs: [{ entity: { kind: 'blog_post', id: 'new-1' }, field: 'title', before: null, after: 'Batik care', provenance: 'generated' }],
    guardrails: [], status, stagedBy: 'agent', stagedAt: '2026-10-22T00:00:00Z', expiresAt: '2999-01-01T00:00:00Z',
    action: { kind: 'blog.create_draft', payload: {} },
})
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const sentIds = () => fetchMock.mock.calls.map(([, init]) => new Headers(init?.headers).get('x-request-id'))
const proxy = (path: string, headers: Record<string, string> = {}, init: { method?: string; body?: string } = {}) =>
    handleAgentProxy(
        new NextRequest(`http://localhost:3000/api/agent/${path}`, { method: init.method ?? 'GET', headers: { host: 'localhost:3000', ...headers }, body: init.body }),
        path.split('/'),
    )

beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue(json([]))
    vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('request id on every ai-platform call [TC-AISEC-035]', () => {
    it('reuses the browser request\'s x-request-id and echoes it on the answer', async () => {
        // Act
        const res = await proxy('threads', { 'x-request-id': 'req-abc.123' })

        // Assert
        expect(sentIds()).toEqual(['req-abc.123'])
        expect(res.headers.get('x-request-id')).toBe('req-abc.123')
    })

    it('falls back to Vercel\'s x-vercel-id', async () => {
        // Act
        await proxy('threads', { 'x-vercel-id': 'sin1::sin1::abc12-1761100000000-0123456789ab' })

        // Assert
        expect(sentIds()).toEqual(['sin1::sin1::abc12-1761100000000-0123456789ab'])
    })

    it.each([
        ['no id', {}],
        ['an id that is not safe to log', { 'x-request-id': 'x'.repeat(200) }],
        ['an id with spaces', { 'x-request-id': 'req 1; drop' }],
        ['an id shorter than 8 characters', { 'x-request-id': 'r1' }],
    ])('makes a uuid when the request has %s', async (_case, headers) => {
        // Act
        await proxy('threads', headers as Record<string, string>)

        // Assert
        expect(sentIds()[0]).toMatch(UUID)
    })

    it('uses one id for every call of an approve (read, claim, record)', async () => {
        // Arrange
        fetchMock.mockImplementation(async (url: string) => {
            if (url.endsWith('/decision')) return json(card('applied'))
            return json(card('pending'))
        })

        // Act
        const res = await proxy('change-sets/cs_1/decision', { 'content-type': 'application/json' }, { method: 'POST', body: JSON.stringify({ decision: 'approve' }) })

        // Assert
        expect(res.status).toBe(200)
        const ids = sentIds()
        expect(ids.length).toBeGreaterThanOrEqual(3)
        expect(new Set(ids).size).toBe(1)
        expect(ids[0]).toMatch(UUID)
    })

    it('sends the request\'s id on AI task calls (runAiTaskForUser)', async () => {
        // Arrange
        fetchMock.mockResolvedValue(json({ output: { text: 'x' } }, 500))
        const req = new Request('http://localhost:3000/api/ai/rewrite-text', { headers: { 'x-request-id': 'req-task-9' } })

        // Act
        await runAiTaskForUser({ id: 3 } as never, req, 'content.translate', {} as never).catch(() => undefined)

        // Assert
        expect(String(fetchMock.mock.calls[0]![0])).toContain('/v1/tasks/')
        expect(sentIds()).toEqual(['req-task-9'])
    })

    it('the tool facade logs a failure with the id ai-platform sent', async () => {
        // Arrange
        const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)

        // Act
        const res = await handleAgentTool(new Request('http://localhost:3000/api/agent-tools/store.orders', { method: 'POST', headers: { 'x-request-id': 'run-req-77' }, body: '{}' }), 'store.orders')

        // Assert
        expect(res.status).toBe(500)
        expect(logged).toHaveBeenCalledWith('[agent-tools] failure (tool store.orders, request run-req-77)', expect.any(Error))
    })
})

describe('attachment bytes headers [TC-AISEC-059]', () => {
    const bytes = (contentType: string) => new Response('a,b\n1,2', { status: 200, headers: { 'content-type': contentType, 'x-content-type-options': 'nosniff' } })

    it.each(['text/csv', 'application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/html'])('serves %s as a download, never sniffed', async (type) => {
        // Arrange
        fetchMock.mockResolvedValue(bytes(type))

        // Act
        const res = await proxy('attachments/att_1/content')

        // Assert
        expect(res.headers.get('x-content-type-options')).toBe('nosniff')
        expect(res.headers.get('content-disposition')).toBe('attachment')
    })

    it('keeps a picture inline (chat thumbnails) with nosniff', async () => {
        // Arrange
        fetchMock.mockResolvedValue(bytes('image/jpeg'))

        // Act
        const res = await proxy('attachments/att_1/content')

        // Assert
        expect(res.headers.get('x-content-type-options')).toBe('nosniff')
        expect(res.headers.get('content-disposition')).toBeNull()
    })

    it('sets nosniff on the bytes even when ai-platform left it out', async () => {
        // Arrange
        fetchMock.mockResolvedValue(new Response('x', { status: 200, headers: { 'content-type': 'text/csv' } }))

        // Act
        const res = await proxy('attachments/att_1/content')

        // Assert
        expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    })
})
