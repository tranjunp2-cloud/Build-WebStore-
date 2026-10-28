/**
 * TC-AISEC-036 — the BFF reports to Sentry (tags area "ai-agent", changeSetId, tenant, requestId) what on-call must
 * see: an approve whose apply failed on our side (5xx), every `final` apply error (it ran, was put back and closed),
 * an undo that failed on our side, and a change that is live but not recorded on ai-platform (level fatal). Refusals
 * the merchant can act on (a 409 / 422 that is not final) are not reported. Console logging is unchanged.
 * Real: handleAgentProxy (decision + undo), recordWithRetry, request-id.ts. Faked: Sentry, the AI platform, the
 * appliers, next/cache, timers.
 */
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ai-platform/apply-receipts', () => import('./apply-receipts-off'))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
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

import * as Sentry from '@sentry/nextjs'
import { handleAgentProxy } from '@/lib/ai-platform/agent-proxy'
import { applyChangeSet } from '@/lib/ai-platform/appliers'
import { ChangeSetApplyError } from '@/lib/ai-platform/appliers/errors'
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
const post = (action: 'decision' | 'undo', body: unknown) =>
    handleAgentProxy(
        new NextRequest(`http://localhost:3000/api/agent/change-sets/cs_1/${action}`, {
            method: 'POST',
            headers: { host: 'localhost:3000', 'content-type': 'application/json', 'x-request-id': 'req-approve-1' },
            body: JSON.stringify(body),
        }),
        ['change-sets', 'cs_1', action],
    )
async function settle(pending: Promise<Response>): Promise<Response> {
    await vi.runAllTimersAsync()
    return pending
}
const tags = { area: 'ai-agent', changeSetId: 'cs_1', tenant: '7', requestId: 'req-approve-1' }

beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-10-22T05:00:00Z') })
    vi.mocked(Sentry.captureException).mockReset()
    vi.mocked(aiPlatformJson).mockReset().mockImplementation(async ({ method, path }) => {
        if (method === 'GET' && path === '/agent/change-sets/cs_1') return card('pending')
        if (path.endsWith('/claim')) return card('pending')
        return card('rejected')
    })
    vi.mocked(applyChangeSet).mockReset().mockResolvedValue(result)
    vi.mocked(applyUndo).mockReset().mockResolvedValue({ entities: [], links: [] })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
})

describe('apply failures reported to Sentry [TC-AISEC-036]', () => {
    it('reports an apply that failed on our side (500) with the change set, tenant and request id', async () => {
        // Arrange
        const boom = new Error('relation "orders" does not exist')
        vi.mocked(applyChangeSet).mockRejectedValue(boom)

        // Act
        const res = await settle(post('decision', { decision: 'approve' }))

        // Assert
        expect(res.status).toBe(500)
        expect(Sentry.captureException).toHaveBeenCalledWith(boom, { level: 'error', tags })
    })

    it('reports every final apply error (it ran, was put back and the card is closed)', async () => {
        // Arrange
        const finalError = new ChangeSetApplyError('The refund went through but the order could not be updated; it was put back.', 422, true)
        vi.mocked(applyChangeSet).mockRejectedValue(finalError)

        // Act
        const res = await settle(post('decision', { decision: 'approve' }))

        // Assert
        expect(res.status).toBe(422)
        expect(Sentry.captureException).toHaveBeenCalledWith(finalError, { level: 'error', tags })
    })

    it('does not report a refusal the merchant can act on (409 / 422, not final)', async () => {
        // Arrange
        vi.mocked(applyChangeSet).mockRejectedValueOnce(new ChangeSetApplyError('Changed since the card was drafted.', 409))

        // Act
        const res = await settle(post('decision', { decision: 'approve' }))

        // Assert
        expect(res.status).toBe(409)
        expect(Sentry.captureException).not.toHaveBeenCalled()
    })

    it('reports a change that is live but could not be recorded as fatal, and still answers 200', async () => {
        // Arrange
        const down = new AiPlatformError('AI platform 503', 503)
        vi.mocked(aiPlatformJson).mockImplementation(async ({ method, path }) => {
            if (method === 'GET' || path.endsWith('/claim')) return card('pending')
            throw down
        })

        // Act
        const res = await settle(post('decision', { decision: 'approve' }))

        // Assert
        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({ status: 'applied', recordPending: true })
        expect(Sentry.captureException).toHaveBeenCalledTimes(1)
        expect(Sentry.captureException).toHaveBeenCalledWith(down, { level: 'fatal', tags })
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('change set cs_1 is applied in prime-web but the AI platform did not record it (tenant 7)'), 'AI platform 503')
    })

    it('reports an undo that failed on our side', async () => {
        // Arrange
        vi.mocked(aiPlatformJson).mockResolvedValue(card('applied', { result: { ...result, undo } }))
        const boom = new Error('connection terminated')
        vi.mocked(applyUndo).mockRejectedValue(boom)

        // Act
        const res = await settle(post('undo', {}))

        // Assert
        expect(res.status).toBe(500)
        expect(Sentry.captureException).toHaveBeenCalledWith(boom, { level: 'error', tags })
    })
})
