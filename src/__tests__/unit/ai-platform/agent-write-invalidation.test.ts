/**
 * TC-AICP-321 — after the copilot applies, fails to apply, or undoes a change, the server forgets what the dashboard
 * remembers about the workspace: the To do list and the sidebar badge counts (`sidebar-badge-counts:<tenant>` tag, the
 * same tag the orders / products collection hooks bust). Outside a request scope the tag call is swallowed.
 * Real: invalidateAfterAgentWrite, handleAgentProxy decision + undo, todo-cache. Faked: next/cache, the AI platform, appliers.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const cache = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock('@/lib/ai-platform/apply-receipts', () => import('./apply-receipts-off'))
vi.mock('next/cache', () => ({ revalidateTag: cache.revalidateTag }))
vi.mock('@/lib/ai-platform/config', () => ({ isAiAgentEnabled: vi.fn(() => true) }))
vi.mock('@/lib/ai-platform/context', () => ({
    AgentAccessError: class AgentAccessError extends Error {},
    resolveAgentActor: vi.fn(async () => ({ user: { id: 3, email: 'owner@shop.my' }, tenantId: '1', organizationId: 'org_1', role: 'owner' })),
    signAgentContextToken: vi.fn(async () => 'ctx-token'),
}))
vi.mock('@/lib/ai-platform/upstream', () => ({
    AiPlatformError: class AiPlatformError extends Error {},
    callAiPlatform: vi.fn(),
    aiPlatformJson: vi.fn(),
}))
vi.mock('@/lib/ai-platform/appliers', async () => ({
    ...(await vi.importActual<object>('@/lib/ai-platform/appliers')),
    applyChangeSet: vi.fn(),
}))
vi.mock('@/lib/ai-platform/appliers/record-edits', () => ({ applyUndo: vi.fn() }))

import { handleAgentProxy } from '@/lib/ai-platform/agent-proxy'
import { applyChangeSet } from '@/lib/ai-platform/appliers'
import { ChangeSetApplyError } from '@/lib/ai-platform/appliers/errors'
import { applyUndo } from '@/lib/ai-platform/appliers/record-edits'
import { invalidateAfterAgentWrite } from '@/lib/ai-platform/invalidate-after-write'
import { aiPlatformJson } from '@/lib/ai-platform/upstream'
import { cachedTodos, clearTodoCache, todoCacheKey } from '@/lib/dashboard/todo-cache'

const changeSet = {
    id: 'cs_1',
    runId: 'run_1',
    domain: 'crm',
    title: 'Create discount',
    summary: '',
    risk: 'low',
    blastRadius: { kind: 'store_discount', count: 1, label: '1 code' },
    diffs: [{ entity: { kind: 'store_discount', id: 'new' }, field: 'code', before: null, after: 'RAYA', provenance: 'generated' }],
    guardrails: [],
    status: 'pending',
    stagedBy: 'agent',
    stagedAt: '2026-10-22T00:00:00Z',
    expiresAt: '2026-10-23T00:00:00Z',
    action: { kind: 'store.discounts_patch', payload: {} },
}
const post = (path: string, body: unknown) =>
    new NextRequest(`http://localhost:3000/api/agent/${path}`, {
        method: 'POST',
        headers: { host: 'localhost:3000', 'content-type': 'application/json' },
        body: JSON.stringify(body),
    })

beforeEach(() => {
    cache.revalidateTag.mockReset()
    vi.mocked(aiPlatformJson).mockReset()
    vi.mocked(applyChangeSet).mockReset()
    vi.mocked(applyUndo).mockReset()
    clearTodoCache()
})

describe('invalidateAfterAgentWrite [TC-AICP-321]', () => {
    it('busts the badge-counts tag of the workspace and the To do list', async () => {
        const key = todoCacheKey({ tenantId: '9', siteId: null, locale: 'en', areas: {} })
        const load = vi.fn(async () => [])
        await cachedTodos(key, load)
        invalidateAfterAgentWrite(9)
        expect(cache.revalidateTag).toHaveBeenCalledWith('sidebar-badge-counts:9', { expire: 0 })
        await cachedTodos(key, load)
        expect(load).toHaveBeenCalledTimes(2)
    })

    it('swallows the tag call outside a request scope', () => {
        cache.revalidateTag.mockImplementation(() => {
            throw new Error('static generation store missing')
        })
        expect(() => invalidateAfterAgentWrite('1')).not.toThrow()
    })
})

describe('approve and undo clear the dashboard memory [TC-AICP-321]', () => {
    it('after an applied change', async () => {
        vi.mocked(aiPlatformJson).mockResolvedValueOnce(changeSet).mockResolvedValueOnce(changeSet).mockResolvedValueOnce({ ...changeSet, status: 'applied' })
        vi.mocked(applyChangeSet).mockResolvedValue({ entities: [], links: [] })
        await handleAgentProxy(post('change-sets/cs_1/decision', { decision: 'approve' }), ['change-sets', 'cs_1', 'decision'])
        expect(cache.revalidateTag).toHaveBeenCalledWith('sidebar-badge-counts:1', { expire: 0 })
    })

    it('after a failed apply (it may have written part of it)', async () => {
        vi.mocked(aiPlatformJson).mockResolvedValueOnce(changeSet).mockResolvedValueOnce(changeSet).mockResolvedValueOnce({ released: true })
        vi.mocked(applyChangeSet).mockRejectedValue(new ChangeSetApplyError('The code changed.'))
        await handleAgentProxy(post('change-sets/cs_1/decision', { decision: 'approve' }), ['change-sets', 'cs_1', 'decision'])
        expect(cache.revalidateTag).toHaveBeenCalledWith('sidebar-badge-counts:1', { expire: 0 })
    })

    it('after an undo, but not after a reject', async () => {
        vi.mocked(aiPlatformJson).mockResolvedValueOnce({ ...changeSet, status: 'rejected' })
        await handleAgentProxy(post('change-sets/cs_1/decision', { decision: 'reject' }), ['change-sets', 'cs_1', 'decision'])
        expect(cache.revalidateTag).not.toHaveBeenCalled()

        const applied = { ...changeSet, status: 'applied', result: { entities: [], links: [], undo: { kind: 'store.discounts_restore', payload: {}, until: '2999-01-01T00:00:00Z' } } }
        vi.mocked(aiPlatformJson).mockResolvedValueOnce(applied).mockResolvedValueOnce({ ...applied, status: 'reverted' })
        vi.mocked(applyUndo).mockResolvedValue({ entities: [], links: [] })
        await handleAgentProxy(post('change-sets/cs_1/undo', {}), ['change-sets', 'cs_1', 'undo'])
        expect(cache.revalidateTag).toHaveBeenCalledWith('sidebar-badge-counts:1', { expire: 0 })
    })
})
