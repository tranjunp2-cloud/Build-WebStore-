/**
 * The apply receipts in the approve / undo flow of the agent proxy (lib/ai-platform/agent-proxy + apply-receipts):
 * TC-AISEC-100 — after the claim the receipt is taken; a change that already ran here (receipt `applied`) is not
 *   applied again: its stored result is re-sent (no second email / refund / post); a fresh `applying` receipt (another
 *   request mid-apply) or an undone one answers 409 and gives the claim back; a receipt that can't be taken fails closed.
 * TC-AISEC-101 — the result is kept (`applied`) right after the apply and BEFORE ai-platform is told; a refused apply
 *   drops the receipt so Approve can be tried again; a recorded approval marks the receipt done; a final failure that
 *   kept an undo (shipped orders) is recorded as applied with its note.
 * TC-AISEC-102 — undo: the receipt goes `reverted` with the undo's result before the revert is recorded; an undo that
 *   already ran (receipt `reverted`) re-sends its result without putting anything back again; the editor's Redo
 *   (reconcile → reinstate) turns the receipt back to applied.
 * TC-AISEC-138 — Reject of a change that has a receipt here is refused (409), never forwarded: applied with a result →
 *   the approve is recorded on the way (the card gets its Undo); applying → "being applied" while fresh, "Approve again"
 *   once stale. No receipt (or an undone one) → the reject goes through.
 * TC-AISEC-139 — a version guard refusal on a try that took over a dead attempt keeps the card pending (409, not final):
 *   receipt dropped, claim given back, reported, no reject sent.
 * TC-AISEC-140 — a receipt `applied` whose result can't be read: never applied again, 409, claim given back, reported fatal.
 * Real: handleAgentProxy. Faked: the AI platform, the appliers, the receipt store (its SQL runs on PostgreSQL in
 * integration/ai-apply-receipts-postgres.test.ts), next/cache.
 */
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
vi.mock('@/lib/ai-platform/appliers/site-undo-verdict', () => ({ undoVerdict: vi.fn() }))
vi.mock('@/lib/ai-platform/apply-receipts', () => ({
    beginApply: vi.fn(),
    abandonApply: vi.fn(),
    markApplied: vi.fn(),
    markReverted: vi.fn(),
    markRecorded: vi.fn(),
    markReinstated: vi.fn(),
    readReceipt: vi.fn(),
    STALE_APPLYING_MS: 6 * 60 * 1000,
}))

import { handleAgentProxy } from '@/lib/ai-platform/agent-proxy'
import { applyChangeSet } from '@/lib/ai-platform/appliers'
import { ChangeSetApplyError } from '@/lib/ai-platform/appliers/errors'
import { applyUndo } from '@/lib/ai-platform/appliers/record-edits'
import { undoVerdict } from '@/lib/ai-platform/appliers/site-undo-verdict'
import { abandonApply, beginApply, markApplied, markRecorded, markReinstated, markReverted, readReceipt } from '@/lib/ai-platform/apply-receipts'
import { AiPlatformError, aiPlatformJson } from '@/lib/ai-platform/upstream'

const result = { entities: [{ kind: 'lead_reply', id: '2' }], links: [] }
const undo = { kind: 'store.customers_restore', payload: { ops: [] }, until: '2999-01-01T00:00:00Z' }
const card = (status: string, extra: Record<string, unknown> = {}) => ({
    id: 'cs_1',
    runId: 'run_1',
    domain: 'crm',
    title: 'Reply to Ahmad',
    summary: '',
    risk: 'medium',
    blastRadius: { kind: 'lead', count: 1, label: '1 lead' },
    diffs: [{ entity: { kind: 'lead', id: '2' }, field: 'reply', before: null, after: 'Terima kasih', provenance: 'generated' }],
    guardrails: [],
    status,
    stagedBy: 'agent',
    stagedAt: '2026-10-22T00:00:00Z',
    expiresAt: '2999-01-01T00:00:00Z',
    action: { kind: 'store.customers_patch', payload: {} },
    ...extra,
})
const receipt = (state: string, extra: Record<string, unknown> = {}) => ({
    changeSetId: 'cs_1', tenantId: '7', userId: '3', state, result, note: null, requestId: 'r', recordedAt: null, createdAt: '', updatedAt: '', ...extra,
})
const post = (action: 'decision' | 'undo' | 'reconcile', body: unknown) =>
    handleAgentProxy(
        new NextRequest(`http://localhost:3000/api/agent/change-sets/cs_1/${action}`, {
            method: 'POST',
            headers: { host: 'localhost:3000', 'content-type': 'application/json', 'x-request-id': 'req-approve-0001' },
            body: JSON.stringify(body),
        }),
        ['change-sets', 'cs_1', action],
    )
const calls = () => vi.mocked(aiPlatformJson).mock.calls.map(([arg]) => `${arg.method} ${arg.path}`)
/** the order in which the proxy touched the receipt store and the platform */
const order: string[] = []

beforeEach(() => {
    order.length = 0
    vi.mocked(aiPlatformJson).mockReset().mockImplementation(async ({ method, path }) => {
        order.push(`${method} ${path}`)
        if (path.endsWith('/decision')) return card('applied', { result })
        if (path.endsWith('/revert')) return card('reverted')
        return card('pending')
    })
    vi.mocked(applyChangeSet).mockReset().mockImplementation(async () => {
        order.push('apply')
        return result
    })
    vi.mocked(applyUndo).mockReset().mockImplementation(async () => {
        order.push('undo')
        return { entities: [], links: [] }
    })
    vi.mocked(beginApply).mockReset().mockResolvedValue({ kind: 'started', takeover: false })
    vi.mocked(abandonApply).mockReset().mockResolvedValue(undefined)
    vi.mocked(markApplied).mockReset().mockImplementation(async () => {
        order.push('receipt applied')
    })
    vi.mocked(markReverted).mockReset().mockImplementation(async () => {
        order.push('receipt reverted')
    })
    vi.mocked(markRecorded).mockReset().mockResolvedValue(undefined)
    vi.mocked(markReinstated).mockReset().mockResolvedValue(undefined)
    vi.mocked(readReceipt).mockReset().mockResolvedValue(null)
})
afterEach(() => {
    vi.restoreAllMocks()
})

describe('approve takes a receipt [TC-AISEC-100]', () => {
    it('takes it after the claim, for the workspace and approver, with the request id', async () => {
        const res = await post('decision', { decision: 'approve' })

        expect(res.status).toBe(200)
        expect(beginApply).toHaveBeenCalledWith({ changeSetId: 'cs_1', tenantId: '7', userId: '3', requestId: 'req-approve-0001' })
        expect(order.indexOf('POST /agent/change-sets/cs_1/claim')).toBeLessThan(order.indexOf('apply'))
    })

    it('a change that already ran here is not applied again: the stored result is re-sent', async () => {
        vi.mocked(beginApply).mockResolvedValue({ kind: 'applied', receipt: receipt('applied') } as never)

        const res = await post('decision', { decision: 'approve' })

        expect(res.status).toBe(200)
        expect(applyChangeSet).not.toHaveBeenCalled()
        const decision = vi.mocked(aiPlatformJson).mock.calls.find(([arg]) => arg.path.endsWith('/decision'))![0]
        expect(JSON.parse(String(decision.body))).toMatchObject({ decision: 'approve', result })
        expect(markRecorded).toHaveBeenCalledWith('cs_1', 'applied')
    })

    it('another request applying it right now, or an undone change: 409 and the claim is given back', async () => {
        vi.mocked(beginApply).mockResolvedValueOnce({ kind: 'busy', state: 'applying' })
        const busy = await post('decision', { decision: 'approve' })
        vi.mocked(beginApply).mockResolvedValueOnce({ kind: 'busy', state: 'reverted' })
        const undone = await post('decision', { decision: 'approve' })

        expect(busy.status).toBe(409)
        expect((await busy.json()).detail).toBe('This change is being applied right now.')
        expect((await undone.json()).detail).toBe('This change was already undone.')
        expect(applyChangeSet).not.toHaveBeenCalled()
        expect(calls().filter((c) => c === 'POST /agent/change-sets/cs_1/release')).toHaveLength(2)
    })

    it('fails closed when the receipt can\'t be taken (database down): nothing applied, claim given back', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        vi.mocked(beginApply).mockRejectedValue(new Error('connection refused'))

        const res = await post('decision', { decision: 'approve' })

        expect(res.status).toBe(500)
        expect(applyChangeSet).not.toHaveBeenCalled()
        expect(calls()).toContain('POST /agent/change-sets/cs_1/release')
        log.mockRestore()
    })
})

describe('the result is kept before ai-platform is told [TC-AISEC-101]', () => {
    it('apply → receipt applied (with the note) → decision recorded → receipt done', async () => {
        await post('decision', { decision: 'approve', note: 'ok' })

        expect(order.slice(-2)).toEqual(['receipt applied', 'POST /agent/change-sets/cs_1/decision'])
        expect(order.indexOf('apply')).toBeLessThan(order.indexOf('receipt applied'))
        expect(markApplied).toHaveBeenCalledWith('cs_1', 'req-approve-0001', result, 'ok')
        expect(markRecorded).toHaveBeenCalledWith('cs_1', 'applied')
    })

    it('a refused apply drops the receipt, so Approve can be tried again', async () => {
        vi.mocked(applyChangeSet).mockRejectedValue(new ChangeSetApplyError('Try again later.', 409))

        const res = await post('decision', { decision: 'approve' })

        expect(res.status).toBe(409)
        expect(abandonApply).toHaveBeenCalledWith('cs_1', 'req-approve-0001')
        expect(markApplied).not.toHaveBeenCalled()
    })

    it('the record never landed: receipt stays applied and not done (the cron sends it), 200 for the merchant', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        vi.useFakeTimers()
        vi.mocked(aiPlatformJson).mockImplementation(async ({ path }) => {
            if (path.endsWith('/decision')) throw new AiPlatformError('AI platform 503', 503)
            return card('pending')
        })

        const pending = post('decision', { decision: 'approve' })
        await vi.runAllTimersAsync()
        const res = await pending
        vi.useRealTimers()

        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({ recordPending: true })
        expect(markApplied).toHaveBeenCalled()
        expect(markRecorded).not.toHaveBeenCalled()
    })

    it('a final failure that kept an undo (shipped before a refund failed) is recorded as applied with the reason', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        const partial = { entities: [{ kind: 'store_order', id: '3' }], links: [], undo: { kind: 'store.orders_restore', payload: { ops: [] }, until: '2999-01-01T00:00:00Z' } }
        vi.mocked(applyChangeSet).mockRejectedValue(new ChangeSetApplyError('Refund failed. Done before it: ORD-1 shipped.', 422, true, { partial }))

        const res = await post('decision', { decision: 'approve' })

        expect(res.status).toBe(422)
        expect(markApplied).toHaveBeenCalledWith('cs_1', 'req-approve-0001', partial, 'Refund failed. Done before it: ORD-1 shipped.')
        const decision = vi.mocked(aiPlatformJson).mock.calls.find(([arg]) => arg.path.endsWith('/decision'))![0]
        expect(JSON.parse(String(decision.body))).toMatchObject({ decision: 'approve', result: partial, note: 'Refund failed. Done before it: ORD-1 shipped.' })
        expect(abandonApply).not.toHaveBeenCalled()
    })

    it('a stale refusal closes the card as rejected and is not reported as a failure', async () => {
        vi.mocked(applyChangeSet).mockRejectedValue(new ChangeSetApplyError('These orders changed after the assistant drafted this. Ask again.', 409, true, { stale: true }))

        const res = await post('decision', { decision: 'approve' })

        expect(res.status).toBe(409)
        const decision = vi.mocked(aiPlatformJson).mock.calls.find(([arg]) => arg.path.endsWith('/decision'))![0]
        expect(JSON.parse(String(decision.body))).toMatchObject({ decision: 'reject', note: expect.stringContaining('changed after') })
        expect(abandonApply).toHaveBeenCalled()
    })
})

describe('undo keeps a receipt too [TC-AISEC-102]', () => {
    beforeEach(() => {
        vi.mocked(aiPlatformJson).mockImplementation(async ({ method, path }) => {
            order.push(`${method} ${path}`)
            if (path.endsWith('/revert')) return card('reverted')
            if (path.endsWith('/reinstate')) return card('applied', { result: { ...result, undo } })
            return card('applied', { result: { ...result, undo } })
        })
    })

    it('undo → receipt reverted (with the undo result) → revert recorded → receipt done', async () => {
        const res = await post('undo', {})

        expect(res.status).toBe(200)
        expect(order.filter((o) => !o.startsWith('GET'))).toEqual(['undo', 'receipt reverted', 'POST /agent/change-sets/cs_1/revert'])
        expect(markReverted).toHaveBeenCalledWith(expect.objectContaining({ changeSetId: 'cs_1', tenantId: '7', userId: '3', result: { entities: [], links: [] } }))
        expect(markRecorded).toHaveBeenCalledWith('cs_1', 'reverted')
    })

    it('an undo that already ran here re-sends its result and puts nothing back again', async () => {
        const undoResult = { entities: [], links: [{ label: 'Open contact leads', href: '/contact-leads' }] }
        vi.mocked(readReceipt).mockResolvedValue(receipt('reverted', { result: undoResult }) as never)

        const res = await post('undo', {})

        expect(res.status).toBe(200)
        expect(applyUndo).not.toHaveBeenCalled()
        expect(readReceipt).toHaveBeenCalledWith('cs_1', '7')
        const revert = vi.mocked(aiPlatformJson).mock.calls.find(([arg]) => arg.path.endsWith('/revert'))![0]
        expect(JSON.parse(String(revert.body))).toEqual({ result: undoResult })
    })

    it('the editor\'s Redo put an undone change back: the receipt follows (applied)', async () => {
        vi.mocked(aiPlatformJson).mockImplementation(async ({ path }) => {
            if (path.endsWith('/reinstate')) return card('applied', { action: { kind: 'site.page_patch', payload: {} }, result: { ...result, undo } })
            return card('reverted', { action: { kind: 'site.page_patch', payload: {} }, result: { ...result, undo } })
        })
        vi.mocked(undoVerdict).mockResolvedValue('applied')

        const res = await post('reconcile', {})

        expect(res.status).toBe(200)
        expect(markReinstated).toHaveBeenCalledWith('cs_1')
    })
})

describe('reject of a change that already ran here [TC-AISEC-138]', () => {
    const decisions = () => vi.mocked(aiPlatformJson).mock.calls.filter(([arg]) => arg.path.endsWith('/decision')).map(([arg]) => JSON.parse(String(arg.body)))

    it('applied with a result: 409 "use Undo", the approve is recorded with the stored result and note, no reject sent', async () => {
        vi.mocked(readReceipt).mockResolvedValue(receipt('applied', { note: 'first approve' }) as never)

        const res = await post('decision', { decision: 'reject', note: 'nope' })

        expect(res.status).toBe(409)
        expect((await res.json()).detail).toBe('This change was already applied — use Undo to take it back.')
        expect(readReceipt).toHaveBeenCalledWith('cs_1', '7')
        expect(decisions()).toEqual([{ decision: 'approve', note: 'first approve', result }])
        expect(markRecorded).toHaveBeenCalledWith('cs_1', 'applied')
    })

    it('applied without a readable result: 409 and nothing sent to the platform', async () => {
        vi.mocked(readReceipt).mockResolvedValue(receipt('applied', { result: null }) as never)

        const res = await post('decision', { decision: 'reject' })

        expect(res.status).toBe(409)
        expect(calls()).toEqual([])
    })

    it('applying: "being applied" while fresh, "Approve again" once the attempt is stale; nothing forwarded', async () => {
        vi.mocked(readReceipt).mockResolvedValueOnce(receipt('applying', { result: null, updatedAt: new Date(Date.now() - 60_000).toISOString() }) as never)
        const fresh = await post('decision', { decision: 'reject' })
        vi.mocked(readReceipt).mockResolvedValueOnce(receipt('applying', { result: null, updatedAt: new Date(Date.now() - 7 * 60_000).toISOString() }) as never)
        const stale = await post('decision', { decision: 'reject' })

        expect([fresh.status, stale.status]).toEqual([409, 409])
        expect((await fresh.json()).detail).toBe('This change is being applied right now.')
        expect((await stale.json()).detail).toBe('An earlier approve stopped part way — Approve again to finish it.')
        expect(calls()).toEqual([])
    })

    it('no receipt, or an undone change: the reject is forwarded as before', async () => {
        vi.mocked(readReceipt).mockResolvedValueOnce(null).mockResolvedValueOnce(receipt('reverted') as never)

        const none = await post('decision', { decision: 'reject', note: 'no' })
        const undone = await post('decision', { decision: 'reject' })

        expect([none.status, undone.status]).toEqual([200, 200])
        expect(decisions()).toEqual([{ decision: 'reject', note: 'no' }, { decision: 'reject' }])
    })
})

describe('a stale refusal on a takeover keeps the card pending [TC-AISEC-139]', () => {
    it('409 "may already have made this change", receipt dropped, claim given back, no reject sent', async () => {
        vi.mocked(beginApply).mockResolvedValue({ kind: 'started', takeover: true })
        vi.mocked(applyChangeSet).mockRejectedValue(new ChangeSetApplyError('This lead changed after the assistant drafted this.', 409, true, { stale: true }))

        const res = await post('decision', { decision: 'approve' })

        expect(res.status).toBe(409)
        expect((await res.json()).detail).toBe("An earlier try of this approval stopped part way and may already have made this change. Open the record to check; if it's there, Reject this card.")
        expect(abandonApply).toHaveBeenCalledWith('cs_1', 'req-approve-0001')
        expect(calls()).toContain('POST /agent/change-sets/cs_1/release')
        expect(calls().some((c) => c.endsWith('/decision'))).toBe(false)
    })

    it('a stale refusal on a first try still closes the card (unchanged)', async () => {
        vi.mocked(beginApply).mockResolvedValue({ kind: 'started', takeover: false })
        vi.mocked(applyChangeSet).mockRejectedValue(new ChangeSetApplyError('This lead changed after the assistant drafted this.', 409, true, { stale: true }))

        await post('decision', { decision: 'approve' })

        expect(calls()).toContain('POST /agent/change-sets/cs_1/decision')
    })
})

describe('an applied receipt without a readable result [TC-AISEC-140]', () => {
    it('is never applied again: 409, claim given back, no decision sent', async () => {
        vi.mocked(beginApply).mockResolvedValue({ kind: 'applied', receipt: receipt('applied', { result: null }) } as never)

        const res = await post('decision', { decision: 'approve' })

        expect(res.status).toBe(409)
        expect((await res.json()).detail).toBe('This change was already applied. Its card will update shortly.')
        expect(applyChangeSet).not.toHaveBeenCalled()
        expect(calls()).toContain('POST /agent/change-sets/cs_1/release')
        expect(calls().some((c) => c.endsWith('/decision'))).toBe(false)
    })
})
