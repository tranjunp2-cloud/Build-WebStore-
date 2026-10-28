import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks (top-level) ─────────────────────────────────────────────────────
vi.mock('@/lib/ai-platform/apply-receipts', () => import('./apply-receipts-off'))
vi.mock('@/lib/ai-platform/config', () => ({ isAiAgentEnabled: vi.fn(() => true) }))
vi.mock('@/lib/ai-platform/context', () => ({
    AgentAccessError: class AgentAccessError extends Error {
        constructor(message: string, readonly status: number) { super(message) }
    },
    resolveAgentActor: vi.fn(async () => ({ user: { id: 3, email: 'owner@shop.my' }, tenantId: '1', organizationId: 'org_1', role: 'owner' })),
    signAgentContextToken: vi.fn(async () => 'ctx-token'),
}))
vi.mock('@/lib/ai-platform/upstream', () => ({
    AiPlatformError: class AiPlatformError extends Error {
        constructor(message: string, readonly status: number) { super(message) }
    },
    callAiPlatform: vi.fn(),
    aiPlatformJson: vi.fn(),
}))
vi.mock('@/lib/ai-platform/appliers', async () => {
    const actual = await vi.importActual<typeof import('@/lib/ai-platform/appliers')>('@/lib/ai-platform/appliers')
    return { ...actual, applyChangeSet: vi.fn() }
})

import { handleAgentProxy } from '@/lib/ai-platform/agent-proxy'
import { applyChangeSet as realApplyChangeSet, UnsupportedChangeSetError } from '@/lib/ai-platform/appliers'
import { ChangeSetApplyError } from '@/lib/ai-platform/appliers/errors'
import { isAiAgentEnabled } from '@/lib/ai-platform/config'
import { aiPlatformJson, callAiPlatform } from '@/lib/ai-platform/upstream'
import { cachedTodos, clearTodoCache, todoCacheKey } from '@/lib/dashboard/todo-cache'

const changeSet = {
    id: 'cs_1',
    runId: 'run_1',
    domain: 'cms',
    title: 'Create blog draft: Batik care',
    summary: '',
    risk: 'low',
    blastRadius: { kind: 'blog_post', count: 1, label: '1 new draft post' },
    diffs: [{ entity: { kind: 'blog_post', id: 'new-1' }, field: 'title', before: null, after: 'Batik care', provenance: 'generated' }],
    guardrails: [],
    status: 'pending',
    stagedBy: 'agent',
    stagedAt: '2026-10-20T00:00:00Z',
    expiresAt: '2026-10-21T00:00:00Z',
    action: { kind: 'blog.create_draft', payload: {} },
}

function request(path: string, init: { method?: string; body?: unknown; origin?: string } = {}) {
    const headers: Record<string, string> = { host: 'localhost:3000', 'content-type': 'application/json' }
    if (init.origin) headers.origin = init.origin
    return new NextRequest(`http://localhost:3000/api/agent/${path}`, {
        method: init.method ?? 'GET',
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
}

beforeEach(() => {
    vi.mocked(isAiAgentEnabled).mockReturnValue(true)
    vi.mocked(aiPlatformJson).mockReset()
    vi.mocked(callAiPlatform).mockReset()
})

describe('applyChangeSet [TC-AICP-10]', () => {
    it('fails closed on an unknown action kind', async () => {
        const unknown = { ...changeSet, action: { kind: 'orders.refund', payload: {} } }
        const { applyChangeSet } = await vi.importActual<typeof import('@/lib/ai-platform/appliers')>('@/lib/ai-platform/appliers')
        await expect(applyChangeSet(unknown as never, {} as never)).rejects.toBeInstanceOf(UnsupportedChangeSetError)
    })

    // TC-AIREL-75 — Product Master, inventory and store kinds are gone (blog.* are applied since phase 5: blog-edits tests)
    it.each(['product.create_drafts', 'product.update', 'product.set_status', 'product_master.update', 'inventory.apply', 'store.add_products'])(
        '[TC-AIREL-75] refuses %s as an unknown kind',
        async (kind) => {
            const { applyChangeSet } = await vi.importActual<typeof import('@/lib/ai-platform/appliers')>('@/lib/ai-platform/appliers')
            await expect(applyChangeSet({ ...changeSet, action: { kind, payload: {} } } as never, {} as never)).rejects.toBeInstanceOf(UnsupportedChangeSetError)
        },
    )
})

describe('handleAgentProxy routing [TC-AICP-11]', () => {
    it('returns 404 when the AI platform is not enabled', async () => {
        vi.mocked(isAiAgentEnabled).mockReturnValue(false)
        const res = await handleAgentProxy(request('runs'), ['runs'])
        expect(res.status).toBe(404)
    })

    it('never exposes the internal claim route to the browser', async () => {
        const res = await handleAgentProxy(request('change-sets/cs_1/claim', { method: 'POST', body: {} }), ['change-sets', 'cs_1', 'claim'])
        expect(res.status).toBe(404)
        expect(callAiPlatform).not.toHaveBeenCalled()
    })

    it('[TC-AIREL-75] has no shop-asset picture route (picture generation: TC-AIREL-202)', async () => {
        const asset = await handleAgentProxy(request('media/assets/dam-1/preview'), ['media', 'assets', 'dam-1', 'preview'])

        expect(asset.status).toBe(404)
        expect(callAiPlatform).not.toHaveBeenCalled()
    })

    it('rejects cross-origin state changes', async () => {
        const res = await handleAgentProxy(request('runs', { method: 'POST', body: { prompt: 'x' }, origin: 'https://evil.example' }), ['runs'])
        expect(res.status).toBe(403)
    })

    it('streams allowed routes through with the signed context token', async () => {
        vi.mocked(callAiPlatform).mockResolvedValue(new Response('data: {}\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } }))
        const res = await handleAgentProxy(request('runs', { method: 'POST', body: { prompt: 'x' } }), ['runs'])
        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toBe('text/event-stream')
        expect(vi.mocked(callAiPlatform).mock.calls[0]?.[0]).toMatchObject({ method: 'POST', path: '/agent/runs', token: 'ctx-token' })
    })
})

describe('handleAgentProxy chat threads [TC-AICP-11]', () => {
    it('forwards thread list and detail reads to the platform', async () => {
        vi.mocked(callAiPlatform).mockImplementation(async () => new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }))
        const list = await handleAgentProxy(request('threads?limit=20'), ['threads'])
        const detail = await handleAgentProxy(request('threads/thr_1'), ['threads', 'thr_1'])
        expect(list.status).toBe(200)
        expect(detail.status).toBe(200)
        expect(vi.mocked(callAiPlatform).mock.calls.map((c) => [c[0].method, c[0].path])).toEqual([
            ['GET', '/agent/threads?limit=20'],
            ['GET', '/agent/threads/thr_1'],
        ])
    })

    it('renames with PATCH and deletes with DELETE, passing an empty 204 through', async () => {
        vi.mocked(callAiPlatform)
            .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'thr_1', title: 'Renamed' }), { status: 200 }))
            .mockResolvedValueOnce(new Response(null, { status: 204 }))
        const renamed = await handleAgentProxy(request('threads/thr_1', { method: 'PATCH', body: { title: 'Renamed' } }), ['threads', 'thr_1'])
        const deleted = await handleAgentProxy(request('threads/thr_1', { method: 'DELETE' }), ['threads', 'thr_1'])
        expect(renamed.status).toBe(200)
        expect(deleted.status).toBe(204)
        expect(await deleted.text()).toBe('')
        const [patchCall, deleteCall] = vi.mocked(callAiPlatform).mock.calls.map((c) => c[0])
        expect(patchCall).toMatchObject({ method: 'PATCH', path: '/agent/threads/thr_1', token: 'ctx-token', body: JSON.stringify({ title: 'Renamed' }) })
        expect(deleteCall).toMatchObject({ method: 'DELETE', path: '/agent/threads/thr_1', body: undefined })
    })

    it('rejects cross-origin thread deletes and unknown thread routes', async () => {
        const csrf = await handleAgentProxy(request('threads/thr_1', { method: 'DELETE', origin: 'https://evil.example' }), ['threads', 'thr_1'])
        const nested = await handleAgentProxy(request('threads/thr_1/runs', { method: 'DELETE' }), ['threads', 'thr_1', 'runs'])
        const listDelete = await handleAgentProxy(request('threads', { method: 'DELETE' }), ['threads'])
        const badId = await handleAgentProxy(request('threads/..%2Fruns'), ['threads', '..%2Fruns'])
        expect(csrf.status).toBe(403)
        expect([nested.status, listDelete.status, badId.status]).toEqual([404, 404, 404])
        expect(callAiPlatform).not.toHaveBeenCalled()
    })
})

describe('handleAgentProxy approvals [TC-AICP-12]', () => {
    it('claims, applies with the user, then reports the result', async () => {
        // Arrange
        const result = { entities: [{ kind: 'blog_post', id: '7' }], links: [{ label: 'Open blog draft', href: '/blog/7' }] }
        vi.mocked(aiPlatformJson)
            .mockResolvedValueOnce(changeSet) // read (typed-confirm check)
            .mockResolvedValueOnce(changeSet) // claim
            .mockResolvedValueOnce({ ...changeSet, status: 'applied', result }) // decision
        vi.mocked(realApplyChangeSet).mockResolvedValue(result)
        // Act
        const res = await handleAgentProxy(request('change-sets/cs_1/decision', { method: 'POST', body: { decision: 'approve' } }), ['change-sets', 'cs_1', 'decision'])
        // Assert
        expect(res.status).toBe(200)
        expect(vi.mocked(aiPlatformJson).mock.calls.map((c) => c[0].path)).toEqual([
            '/agent/change-sets/cs_1',
            '/agent/change-sets/cs_1/claim',
            '/agent/change-sets/cs_1/decision',
        ])
        expect(JSON.parse(String(vi.mocked(aiPlatformJson).mock.calls[2]?.[0].body))).toMatchObject({ decision: 'approve', result })
    })

    // TC-AICP-277 — what the copilot applied is on the dashboard To do card at once, not a minute later
    it('drops the workspace\'s remembered To do list after an applied change, and after a failed apply', async () => {
        const key = todoCacheKey({ tenantId: '1', siteId: null, locale: 'en', areas: {} })
        const load = vi.fn(async () => [])
        clearTodoCache()
        await cachedTodos(key, load)
        vi.mocked(aiPlatformJson).mockResolvedValueOnce(changeSet).mockResolvedValueOnce(changeSet).mockResolvedValueOnce({ ...changeSet, status: 'applied' })
        vi.mocked(realApplyChangeSet).mockResolvedValue({ entities: [], links: [] })

        await handleAgentProxy(request('change-sets/cs_1/decision', { method: 'POST', body: { decision: 'approve' } }), ['change-sets', 'cs_1', 'decision'])
        await cachedTodos(key, load)
        expect(load).toHaveBeenCalledTimes(2)

        vi.mocked(aiPlatformJson).mockResolvedValueOnce(changeSet).mockResolvedValueOnce(changeSet).mockResolvedValueOnce({ released: true })
        vi.mocked(realApplyChangeSet).mockRejectedValue(new ChangeSetApplyError('The page changed.'))
        await handleAgentProxy(request('change-sets/cs_1/decision', { method: 'POST', body: { decision: 'approve' } }), ['change-sets', 'cs_1', 'decision'])
        await cachedTodos(key, load)
        expect(load).toHaveBeenCalledTimes(3)
        clearTodoCache()
    })

    it('releases the claim and returns the domain reason when applying fails', async () => {
        vi.mocked(aiPlatformJson).mockResolvedValueOnce(changeSet).mockResolvedValueOnce(changeSet).mockResolvedValueOnce({ released: true })
        vi.mocked(realApplyChangeSet).mockRejectedValue(new ChangeSetApplyError('Content management is not available on your current plan.'))
        const res = await handleAgentProxy(request('change-sets/cs_1/decision', { method: 'POST', body: { decision: 'approve' } }), ['change-sets', 'cs_1', 'decision'])
        expect(res.status).toBe(422)
        expect((await res.json()).detail).toMatch(/not available on your current plan/)
        expect(vi.mocked(aiPlatformJson).mock.calls[2]?.[0].path).toBe('/agent/change-sets/cs_1/release')
    })

    // TC-AIWB-45 — an unexpected failure never shows its internals (a failed SQL query) on the card
    it('answers an internal failure with a plain message and a reference, keeping the details in the log', async () => {
        vi.mocked(aiPlatformJson).mockResolvedValueOnce(changeSet).mockResolvedValueOnce(changeSet).mockResolvedValueOnce({ released: true })
        vi.mocked(realApplyChangeSet).mockRejectedValue(new Error('Failed query: SELECT p.locale_content FROM pages p JOIN sites s ON s.id = p.site_id\nparams: 1,1'))
        const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)

        const res = await handleAgentProxy(request('change-sets/cs_1/decision', { method: 'POST', body: { decision: 'approve' } }), ['change-sets', 'cs_1', 'decision'])

        expect(res.status).toBe(500)
        const detail = (await res.json()).detail as string
        expect(detail).not.toMatch(/SELECT|Failed query|params/)
        expect(detail).toMatch(/nothing was changed.*\(ref [a-z0-9-]+\)/)
        const ref = detail.match(/ref ([a-z0-9-]+)/)![1]!
        expect(logged).toHaveBeenCalledWith(expect.stringContaining(ref), expect.objectContaining({ message: expect.stringContaining('Failed query') }))
        expect(vi.mocked(aiPlatformJson).mock.calls[2]?.[0].path).toBe('/agent/change-sets/cs_1/release')
        logged.mockRestore()
    })

    // TC-AICP-88 — an edit that ran and was put back is closed, not offered again with stale versions
    it('closes a change that was rolled back instead of offering it again', async () => {
        vi.mocked(aiPlatformJson).mockResolvedValue(changeSet)
        vi.mocked(realApplyChangeSet).mockRejectedValue(new ChangeSetApplyError('Nothing was changed: Barcode already used. Ask again so the assistant drafts from the latest version.', 422, true))
        const res = await handleAgentProxy(request('change-sets/cs_1/decision', { method: 'POST', body: { decision: 'approve' } }), ['change-sets', 'cs_1', 'decision'])
        expect(res.status).toBe(422)
        const calls = vi.mocked(aiPlatformJson).mock.calls.map((c) => c[0])
        expect(calls.map((c) => c.path).slice(2)).toEqual(['/agent/change-sets/cs_1/release', '/agent/change-sets/cs_1/decision'])
        expect(JSON.parse(String(calls[3]?.body))).toMatchObject({ decision: 'reject', note: expect.stringContaining('Nothing was changed') })
    })

    // TC-AICP-68 — a destructive change needs the record's name typed, checked here too
    it('refuses a destructive change without the typed name, before claiming anything', async () => {
        const destructive = { ...changeSet, risk: 'high', confirmText: 'Batik care', action: { kind: 'blog.set_status', payload: {} } }
        vi.mocked(realApplyChangeSet).mockClear()
        vi.mocked(aiPlatformJson).mockResolvedValue(destructive)
        const missing = await handleAgentProxy(request('change-sets/cs_1/decision', { method: 'POST', body: { decision: 'approve' } }), ['change-sets', 'cs_1', 'decision'])
        const wrong = await handleAgentProxy(
            request('change-sets/cs_1/decision', { method: 'POST', body: { decision: 'approve', confirm: 'Batik' } }),
            ['change-sets', 'cs_1', 'decision'],
        )
        expect([missing.status, wrong.status]).toEqual([400, 400])
        expect((await wrong.json()).detail).toBe('Type “Batik care” to confirm.')
        expect(vi.mocked(aiPlatformJson).mock.calls.map((c) => c[0].path)).not.toContain('/agent/change-sets/cs_1/claim')
        expect(realApplyChangeSet).not.toHaveBeenCalled()
    })

    it('applies a destructive change when the name is typed (case and spaces ignored)', async () => {
        const destructive = { ...changeSet, risk: 'high', confirmText: 'Batik care', action: { kind: 'blog.set_status', payload: {} } }
        vi.mocked(aiPlatformJson).mockResolvedValueOnce(destructive).mockResolvedValueOnce(destructive).mockResolvedValueOnce({ ...destructive, status: 'applied' })
        vi.mocked(realApplyChangeSet).mockResolvedValue({ entities: [], links: [] })
        const res = await handleAgentProxy(
            request('change-sets/cs_1/decision', { method: 'POST', body: { decision: 'approve', confirm: '  batik  CARE ' } }),
            ['change-sets', 'cs_1', 'decision'],
        )
        expect(res.status).toBe(200)
        expect(realApplyChangeSet).toHaveBeenCalled()
    })
})

describe('a card flagged requiresClick needs the merchant\'s own click, checked on the server [TC-AISEC-141]', () => {
    const flagged = { ...changeSet, requiresClick: true }

    it('refuses an approve without `manual: true` (Auto-approve, an old bundle, a script) before claiming anything', async () => {
        vi.mocked(realApplyChangeSet).mockClear()
        vi.mocked(aiPlatformJson).mockResolvedValue(flagged)

        const auto = await handleAgentProxy(request('change-sets/cs_1/decision', { method: 'POST', body: { decision: 'approve' } }), ['change-sets', 'cs_1', 'decision'])
        const truthy = await handleAgentProxy(request('change-sets/cs_1/decision', { method: 'POST', body: { decision: 'approve', manual: 'yes' } }), ['change-sets', 'cs_1', 'decision'])

        expect([auto.status, truthy.status]).toEqual([409, 409])
        expect((await auto.json()).detail).toBe('This change needs your own click: press Approve on the card. If you just updated, reload the page.')
        expect(vi.mocked(aiPlatformJson).mock.calls.map((c) => c[0].path)).toEqual(['/agent/change-sets/cs_1', '/agent/change-sets/cs_1'])
        expect(realApplyChangeSet).not.toHaveBeenCalled()
    })

    it('applies it when the approve says it was a hand click', async () => {
        vi.mocked(aiPlatformJson).mockResolvedValueOnce(flagged).mockResolvedValueOnce(flagged).mockResolvedValueOnce({ ...flagged, status: 'applied' })
        vi.mocked(realApplyChangeSet).mockResolvedValue({ entities: [], links: [] })

        const res = await handleAgentProxy(request('change-sets/cs_1/decision', { method: 'POST', body: { decision: 'approve', manual: true } }), ['change-sets', 'cs_1', 'decision'])

        expect(res.status).toBe(200)
        expect(vi.mocked(aiPlatformJson).mock.calls.map((c) => c[0].path)).toContain('/agent/change-sets/cs_1/claim')
        expect(realApplyChangeSet).toHaveBeenCalled()
    })
})
