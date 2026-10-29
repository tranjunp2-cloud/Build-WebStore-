/**
 * TC-AIREL-305 — the proxy's Undo is idempotent and says which newer change blocks it.
 * TC-AIREL-267 — two tabs Undo at once: the one that loses (its put-back refused, or its record answered 409) reads the
 *   change set again and answers 200 when it is reverted; otherwise the refusal stands.
 * Real: handleAgentProxy (undo route), undo-touches. Faked: the AI platform, the appliers, next/cache.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ai-platform/apply-receipts', () => import('./apply-receipts-off'))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
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
vi.mock('@/lib/ai-platform/appliers/record-edits', () => ({ applyUndo: vi.fn() }))
vi.mock('@/lib/ai-platform/appliers/site-undo-verdict', () => ({ undoVerdict: vi.fn() }))

import { handleAgentProxy } from '@/lib/ai-platform/agent-proxy'
import { ChangeSetApplyError } from '@/lib/ai-platform/appliers/errors'
import { applyUndo } from '@/lib/ai-platform/appliers/record-edits'
import { undoVerdict } from '@/lib/ai-platform/appliers/site-undo-verdict'
import { aiPlatformJson, AiPlatformError } from '@/lib/ai-platform/upstream'

const restore = (blockId: string) => ({ kind: 'site.page_restore', payload: { siteId: '1', pageId: '12', restore: [{ blockId, before: {}, position: 1, after: 'h' }] }, until: '2999-01-01T00:00:00Z' })
const card = (id: string, status: string, at: string, blockId = 'hero', title = `Change ${id}`) => ({
    id,
    runId: 'run_1',
    domain: 'webbuilder',
    title,
    summary: '',
    risk: 'low',
    blastRadius: { kind: 'site_page', count: 1, label: '1 section' },
    diffs: [{ entity: { kind: 'site_page', id: '12' }, field: 'headline', before: 'a', after: 'b', provenance: 'generated' }],
    guardrails: [],
    status,
    stagedBy: 'agent',
    stagedAt: at,
    decidedAt: at,
    expiresAt: '2999-01-01T00:00:00Z',
    action: { kind: 'site.page_patch', payload: {} },
    result: { entities: [], links: [], undo: restore(blockId) },
})
const undoRequest = () =>
    handleAgentProxy(
        new NextRequest('http://localhost:3000/api/agent/change-sets/cs_a/undo', { method: 'POST', headers: { host: 'localhost:3000', 'content-type': 'application/json' }, body: '{}' }),
        ['change-sets', 'cs_a', 'undo'],
    )

beforeEach(() => {
    vi.mocked(aiPlatformJson).mockReset()
    vi.mocked(applyUndo).mockReset()
    vi.mocked(undoVerdict).mockReset()
})

describe('Undo through the proxy [TC-AIREL-305]', () => {
    it('a change that is already undone answers 200 with it, and nothing is applied again', async () => {
        vi.mocked(aiPlatformJson).mockResolvedValueOnce(card('cs_a', 'reverted', '2026-10-22T01:00:00Z'))

        const response = await undoRequest()

        expect(response.status).toBe(200)
        expect((await response.json()).status).toBe('reverted')
        expect(applyUndo).not.toHaveBeenCalled()
    })

    it('a refusal because a newer change touched the same section names that change', async () => {
        vi.mocked(aiPlatformJson)
            .mockResolvedValueOnce(card('cs_a', 'applied', '2026-10-22T01:00:00Z'))
            .mockResolvedValueOnce(card('cs_a', 'applied', '2026-10-22T01:00:00Z'))
            .mockResolvedValueOnce([card('cs_a', 'applied', '2026-10-22T01:00:00Z'), card('cs_b', 'applied', '2026-10-22T02:00:00Z', 'hero', 'Shorter headline')])
        vi.mocked(applyUndo).mockRejectedValue(new ChangeSetApplyError('The Hero section was edited after the assistant changed it.', 409))

        const response = await undoRequest()

        expect(response.status).toBe(409)
        expect((await response.json()).detail).toBe('Undo “Shorter headline” first — it changed the same part after this one.')
    })

    it('a refusal with no newer change on that part keeps the applier\'s own words', async () => {
        vi.mocked(aiPlatformJson)
            .mockResolvedValueOnce(card('cs_a', 'applied', '2026-10-22T01:00:00Z'))
            .mockResolvedValueOnce(card('cs_a', 'applied', '2026-10-22T01:00:00Z'))
            .mockResolvedValueOnce([card('cs_a', 'applied', '2026-10-22T01:00:00Z'), card('cs_b', 'applied', '2026-10-22T02:00:00Z', 'about')])
        vi.mocked(applyUndo).mockRejectedValue(new ChangeSetApplyError('The Hero section was edited after the assistant changed it.', 409))

        const response = await undoRequest()

        expect(response.status).toBe(409)
        expect((await response.json()).detail).toBe('The Hero section was edited after the assistant changed it.')
    })
})

describe('two tabs Undo at once [TC-AIREL-267]', () => {
    const undoneCard = card('cs_a', 'reverted', '2026-10-22T01:00:00Z')

    it('the put-back is refused because the other tab already did it: 200 with the reverted card, no newer-change lookup', async () => {
        vi.mocked(aiPlatformJson).mockResolvedValueOnce(card('cs_a', 'applied', '2026-10-22T01:00:00Z')).mockResolvedValueOnce(undoneCard)
        vi.mocked(applyUndo).mockRejectedValue(new ChangeSetApplyError('The Hero section was edited after the assistant changed it.', 409))

        const response = await undoRequest()

        expect(response.status).toBe(200)
        expect((await response.json()).status).toBe('reverted')
        expect(vi.mocked(aiPlatformJson).mock.calls.map(([arg]) => arg.path)).toEqual(['/agent/change-sets/cs_a', '/agent/change-sets/cs_a'])
    })

    it('the revert record answers 409 because the other tab recorded first: 200 with the reverted card', async () => {
        vi.mocked(applyUndo).mockResolvedValue({ entities: [], links: [] })
        vi.mocked(aiPlatformJson)
            .mockResolvedValueOnce(card('cs_a', 'applied', '2026-10-22T01:00:00Z'))
            .mockRejectedValueOnce(Object.assign(new AiPlatformError('This change set is not applied.'), { status: 409 }))
            .mockResolvedValueOnce(undoneCard)

        const response = await undoRequest()

        expect(response.status).toBe(200)
        expect((await response.json()).status).toBe('reverted')
    })

    it('a 409 on the record while the card is still applied stays a 409', async () => {
        vi.mocked(applyUndo).mockResolvedValue({ entities: [], links: [] })
        vi.mocked(aiPlatformJson)
            .mockResolvedValueOnce(card('cs_a', 'applied', '2026-10-22T01:00:00Z'))
            .mockRejectedValueOnce(Object.assign(new AiPlatformError('Undo window closed.'), { status: 409 }))
            .mockResolvedValueOnce(card('cs_a', 'applied', '2026-10-22T01:00:00Z'))

        const response = await undoRequest()

        expect(response.status).toBe(409)
        expect((await response.json()).detail).toBe('Undo window closed.')
    })
})

const reconcileRequest = () =>
    handleAgentProxy(
        new NextRequest('http://localhost:3000/api/agent/change-sets/cs_a/reconcile', { method: 'POST', headers: { host: 'localhost:3000', 'content-type': 'application/json' }, body: '{}' }),
        ['change-sets', 'cs_a', 'reconcile'],
    )
const calls = () => vi.mocked(aiPlatformJson).mock.calls.map(([arg]) => `${arg.method} ${arg.path}${arg.body ? ' ' + arg.body : ''}`)

describe('Reconcile through the proxy [TC-AIREL-313]', () => {
    it('an applied change the editor took back becomes reverted and keeps its undo data', async () => {
        vi.mocked(aiPlatformJson).mockResolvedValueOnce(card('cs_a', 'applied', '2026-10-22T01:00:00Z')).mockResolvedValueOnce(card('cs_a', 'reverted', '2026-10-22T01:00:00Z'))
        vi.mocked(undoVerdict).mockResolvedValue('reverted')

        const body = await (await reconcileRequest()).json()

        expect(body).toMatchObject({ verdict: 'reverted', changeSet: { status: 'reverted' } })
        expect(calls()[1]).toBe('POST /agent/change-sets/cs_a/revert {"keepUndo":true}')
    })

    it('a reverted change the editor put back (Redo) becomes applied again', async () => {
        vi.mocked(aiPlatformJson).mockResolvedValueOnce(card('cs_a', 'reverted', '2026-10-22T01:00:00Z')).mockResolvedValueOnce(card('cs_a', 'applied', '2026-10-22T01:00:00Z'))
        vi.mocked(undoVerdict).mockResolvedValue('applied')

        const body = await (await reconcileRequest()).json()

        expect(body).toMatchObject({ verdict: 'applied', changeSet: { status: 'applied' } })
        expect(calls()[1]).toBe('POST /agent/change-sets/cs_a/reinstate {}')
    })

    it('nothing is written when the card already tells the truth, or the page diverged', async () => {
        vi.mocked(aiPlatformJson).mockResolvedValue(card('cs_a', 'applied', '2026-10-22T01:00:00Z'))
        vi.mocked(undoVerdict).mockResolvedValueOnce('applied').mockResolvedValueOnce('diverged')

        expect((await (await reconcileRequest()).json()).verdict).toBe('applied')
        expect((await (await reconcileRequest()).json()).verdict).toBe('diverged')

        expect(calls().every((call) => call.startsWith('GET'))).toBe(true)
    })

    it('a change without undo data, or not applied / reverted, is unknown without comparing anything', async () => {
        vi.mocked(aiPlatformJson).mockResolvedValueOnce({ ...card('cs_a', 'pending', '2026-10-22T01:00:00Z'), result: undefined })

        expect(await (await reconcileRequest()).json()).toMatchObject({ verdict: 'unknown' })
        expect(undoVerdict).not.toHaveBeenCalled()
    })

    it('a second tab settled it first (409): answers with what is stored now', async () => {
        vi.mocked(aiPlatformJson)
            .mockResolvedValueOnce(card('cs_a', 'applied', '2026-10-22T01:00:00Z'))
            .mockRejectedValueOnce(Object.assign(new AiPlatformError('This change can\'t be undone.'), { status: 409 }))
            .mockResolvedValueOnce(card('cs_a', 'reverted', '2026-10-22T01:00:00Z'))
        vi.mocked(undoVerdict).mockResolvedValue('reverted')

        expect(await (await reconcileRequest()).json()).toMatchObject({ verdict: 'reverted', changeSet: { status: 'reverted' } })
    })
})
