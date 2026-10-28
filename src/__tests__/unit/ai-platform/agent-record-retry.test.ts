/**
 * TC-AISEC-023 — after prime-web applied an approved change, recording it on ai-platform is retried (300 ms, 1 s, 3 s)
 * on 502/503/504 only; a 409 after a lost try reads the stored card instead of failing.
 * TC-AISEC-024 — when recording still fails, the merchant gets 200 with the applied (or undone) card and a
 * "will update shortly" flag, never a 502; the log names the change set and workspace, not the token.
 * Real: handleAgentProxy (decision + undo), recordWithRetry. Faked: the AI platform, the appliers, next/cache, timers.
 */
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ai-platform/apply-receipts', () => import('./apply-receipts-off'))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@/lib/ai-platform/config', () => ({ isAiAgentEnabled: vi.fn(() => true) }))
vi.mock('@/lib/ai-platform/context', () => ({
    AgentAccessError: class AgentAccessError extends Error {},
    resolveAgentActor: vi.fn(async () => ({ user: { id: '3', email: 'owner@shop.my' }, tenantId: '7', organizationId: 'org_1', role: 'owner' })),
    signAgentContextToken: vi.fn(async () => 'ctx-token'),
}))
vi.mock('@/lib/ai-platform/upstream', () => ({
    AiPlatformError: class AiPlatformError extends Error {
        constructor(message: string, readonly status: number) { super(message) }
    },
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
import { applyUndo } from '@/lib/ai-platform/appliers/record-edits'
import { AiPlatformError, aiPlatformJson } from '@/lib/ai-platform/upstream'

const result = { entities: [{ kind: 'blog_post', id: '9' }], links: [] }
const undo = { kind: 'blog.restore', payload: { id: '9' }, until: '2999-01-01T00:00:00Z' }
const card = (status: string, extra: Record<string, unknown> = {}) => ({
    id: 'cs_1',
    runId: 'run_1',
    domain: 'cms',
    title: 'Create blog draft',
    summary: '',
    risk: 'low',
    blastRadius: { kind: 'blog_post', count: 1, label: '1 new draft post' },
    diffs: [{ entity: { kind: 'blog_post', id: 'new-1' }, field: 'title', before: null, after: 'Batik care', provenance: 'generated' }],
    guardrails: [],
    status,
    stagedBy: 'agent',
    stagedAt: '2026-10-22T00:00:00Z',
    expiresAt: '2999-01-01T00:00:00Z',
    action: { kind: 'blog.create_draft', payload: {} },
    ...extra,
})
const failure = (status: number) => new AiPlatformError(`AI platform ${status}`, status)
const post = (action: 'decision' | 'undo', body: unknown) =>
    handleAgentProxy(
        new NextRequest(`http://localhost:3000/api/agent/change-sets/cs_1/${action}`, {
            method: 'POST',
            headers: { host: 'localhost:3000', 'content-type': 'application/json' },
            body: JSON.stringify(body),
        }),
        ['change-sets', 'cs_1', action],
    )
/** run a request to the end, letting the retry waits pass; returns the response and the waited time */
async function settle(pending: Promise<Response>): Promise<{ response: Response; waited: number }> {
    const started = Date.now()
    await vi.runAllTimersAsync()
    const response = await pending
    return { response, waited: Date.now() - started }
}
const paths = () => vi.mocked(aiPlatformJson).mock.calls.map(([arg]) => `${arg.method} ${arg.path}`)

beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-10-22T05:00:00Z') })
    vi.mocked(aiPlatformJson).mockReset()
    vi.mocked(applyChangeSet).mockReset().mockResolvedValue(result)
    vi.mocked(applyUndo).mockReset().mockResolvedValue({ entities: [], links: [] })
})
afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
})

describe('recording an applied approval [TC-AISEC-023]', () => {
    it('retries a 503 / 504 with 300 ms then 1 s, and answers with what the platform recorded', async () => {
        vi.mocked(aiPlatformJson)
            .mockResolvedValueOnce(card('pending')) // read
            .mockResolvedValueOnce(card('pending')) // claim
            .mockRejectedValueOnce(failure(503))
            .mockRejectedValueOnce(failure(504))
            .mockResolvedValueOnce(card('applied', { result }))

        const { response, waited } = await settle(post('decision', { decision: 'approve' }))

        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({ status: 'applied', result })
        expect(waited).toBe(1_300)
        expect(paths().filter((p) => p === 'POST /agent/change-sets/cs_1/decision')).toHaveLength(3)
        expect(applyChangeSet).toHaveBeenCalledTimes(1)
    })

    it('does not retry a 4xx: the platform\'s answer is passed on as before', async () => {
        vi.mocked(aiPlatformJson)
            .mockResolvedValueOnce(card('pending'))
            .mockResolvedValueOnce(card('pending'))
            .mockRejectedValueOnce(failure(422))

        const { response } = await settle(post('decision', { decision: 'approve' }))

        expect(response.status).toBe(422)
        expect(paths().filter((p) => p === 'POST /agent/change-sets/cs_1/decision')).toHaveLength(1)
    })

    it('a 409 after a lost try reads the card: already applied means the first try landed', async () => {
        vi.mocked(aiPlatformJson)
            .mockResolvedValueOnce(card('pending'))
            .mockResolvedValueOnce(card('pending'))
            .mockRejectedValueOnce(failure(504))
            .mockRejectedValueOnce(failure(409))
            .mockResolvedValueOnce(card('applied', { result }))

        const { response } = await settle(post('decision', { decision: 'approve' }))

        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({ status: 'applied' })
        expect(paths().at(-1)).toBe('GET /agent/change-sets/cs_1')
    })
})

describe('recording that keeps failing [TC-AISEC-024]', () => {
    it('approve: answers 200 with the applied card and a "will update shortly" flag after 3 retries, and logs it', async () => {
        const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        vi.mocked(aiPlatformJson)
            .mockResolvedValueOnce(card('pending'))
            .mockResolvedValueOnce(card('pending'))
            .mockRejectedValue(failure(502))

        const { response, waited } = await settle(post('decision', { decision: 'approve', note: 'ok' }))

        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({
            id: 'cs_1',
            status: 'applied',
            decidedBy: 'owner@shop.my',
            note: 'ok',
            result,
            recordPending: true,
            detail: 'Applied — the card will update shortly.',
        })
        expect(waited).toBe(4_300)
        expect(paths().filter((p) => p === 'POST /agent/change-sets/cs_1/decision')).toHaveLength(4)
        const line = String(logged.mock.calls[0]?.[0])
        expect(line).toContain('cs_1')
        expect(line).toContain('tenant 7')
        expect(JSON.stringify(logged.mock.calls)).not.toContain('ctx-token')
    })

    it('undo: answers 200 with the undone card when recording the revert keeps failing', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        vi.mocked(aiPlatformJson)
            .mockResolvedValueOnce(card('applied', { result: { ...result, undo } }))
            .mockRejectedValue(failure(503))

        const { response } = await settle(post('undo', {}))

        expect(response.status).toBe(200)
        const body = await response.json()
        expect(body).toMatchObject({ status: 'reverted', recordPending: true, detail: 'Undone — the card will update shortly.' })
        expect(body.result.undo).toBeUndefined()
        expect(paths().filter((p) => p === 'POST /agent/change-sets/cs_1/revert')).toHaveLength(4)
    })
})
