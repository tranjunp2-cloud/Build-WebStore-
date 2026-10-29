/** POST /api/v1/feedback sends the group card after the response, once per key. TC-IDs from docs/qa/F44-feedback-mvp.md. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ after: [] as Array<() => unknown> }))

vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => { state.after.push(fn) } }))
vi.mock('@/lib/auth', () => ({
    withAuth: (handler: (user: unknown, req: Request) => Promise<Response>) =>
        (req: Request) => handler({ id: 1, firstName: 'Eve', tenants: [{ tenant: 7, role: 'owner' }] }, req),
    extractTenantId: () => '7',
    tenantIdForQuery: () => 7,
}))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/redis', () => ({ redis: null }))
vi.mock('@/lib/feedback/feedback-availability', () => ({
    isFeedbackWindowOpen: () => true,
    feedbackTypesFor: () => ['problem', 'mismatch', 'suggestion'],
    lookupTenantInfo: async () => ({ storeName: 'Demo', isMigratedStore: true }),
}))
vi.mock('@/lib/lark/lark-base-client', () => {
    class LarkApiError extends Error {
        constructor(message: string, public code: number | null = null, public httpStatus: number | null = null) {
            super(message)
        }
    }
    return { LarkApiError, createBaseRecord: vi.fn(), sendChatCard: vi.fn() }
})

import { POST } from '@/app/api/v1/feedback/route'
import { STAGING_TABLE_ID } from '@/lib/feedback/feedback-card-config'
import { clearFeedbackBlocks } from '@/lib/feedback/feedback-spam-guard'
import { createBaseRecord, sendChatCard } from '@/lib/lark/lark-base-client'

const KEY = '0a1b2c3d-5d4a-4b6f-9a7e-1c2d3e4f5a6b'
const keys = ['LARK_BASE_APP_TOKEN', 'LARK_BASE_REPORT_TABLE_ID', 'LARK_NOTIFY_CHAT_ID'] as const
const saved: Record<string, string | undefined> = {}
const submit = (key = KEY) => POST(new Request('http://x/api/v1/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify({ type: 'problem', areas: ['orders'], details: 'Checkout fails at payment' }),
}), undefined as never)
const runAfter = () => Promise.all(state.after.splice(0).map((fn) => fn()))

beforeEach(() => {
    for (const k of keys) saved[k] = process.env[k]
    Object.assign(process.env, { LARK_BASE_APP_TOKEN: 'bascn1', LARK_BASE_REPORT_TABLE_ID: STAGING_TABLE_ID, LARK_NOTIFY_CHAT_ID: 'oc_team' })
    clearFeedbackBlocks()
    state.after.length = 0
    vi.mocked(createBaseRecord).mockReset().mockResolvedValue({ recordId: 'recABC123' })
    vi.mocked(sendChatCard).mockReset().mockResolvedValue(undefined)
    vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] }
    vi.restoreAllMocks()
})

describe('TC-F44-29: card from the submit route', () => {
    it('returns the feedback id first; the card goes out only after the response (after())', async () => {
        const res = await submit()
        expect(res.status).toBe(200)
        expect((await res.json()).feedbackId).toMatch(/^FB-\d{2}-\d{6}$/)
        expect(sendChatCard).not.toHaveBeenCalled()
        await runAfter()
        expect(sendChatCard).toHaveBeenCalledTimes(1)
    })
    it('a Lark failure while sending the card still leaves the submission at 200', async () => {
        vi.mocked(sendChatCard).mockRejectedValue(new Error('lark down'))
        const res = await submit()
        expect(res.status).toBe(200)
        await expect(runAfter()).resolves.toBeDefined()
    })
    it('a retry with the same Idempotency-Key does not post a second card', async () => {
        await submit()
        await submit()
        await runAfter()
        expect(sendChatCard).toHaveBeenCalledTimes(1)
    })
    it('a Base write failure returns 502 and posts no card', async () => {
        vi.mocked(createBaseRecord).mockRejectedValue(new Error('lark'))
        expect((await submit()).status).toBe(502)
        await runAfter()
        expect(sendChatCard).not.toHaveBeenCalled()
    })
})
