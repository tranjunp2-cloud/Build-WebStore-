/** Feedback card callback (F44): Lark authentication, 3 s answer then write, rollback. TC-IDs from docs/qa/F44-feedback-mvp.md. */
import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/lark/lark-base-client', () => {
    class LarkApiError extends Error {
        constructor(message: string, public code: number | null = null, public httpStatus: number | null = null) {
            super(message)
        }
    }
    return { LarkApiError, getBaseRecord: vi.fn(), updateBaseRecord: vi.fn(), updateCardAfterCallback: vi.fn() }
})

import { handleFeedbackCardCallback } from '@/lib/feedback/feedback-card-callback'
import { PRODUCTION_TABLE_ID, STAGING_TABLE_ID } from '@/lib/feedback/feedback-card-config'
import { getBaseRecord, updateBaseRecord, updateCardAfterCallback } from '@/lib/lark/lark-base-client'

const TOKEN = 'vtok-123'
const ME = 'ou_me'
const ENV_KEYS = ['LARK_APP_ID', 'LARK_BASE_APP_TOKEN', 'LARK_NOTIFY_CHAT_ID', 'LARK_CALLBACK_VERIFICATION_TOKEN', 'LARK_CALLBACK_ENCRYPT_KEY'] as const
const saved: Record<string, string | undefined> = {}
const pending: Array<() => Promise<unknown>> = []
const schedule = (work: () => Promise<unknown>) => { pending.push(work) }

const record = (over: Record<string, unknown> = {}) => ({
    'Feedback ID': 'FB-26-000123', Type: 'Suggestion', Feature: ['Orders'], Details: 'Please add export', Status: 'New', 'Submitted At': Date.now() - 5 * 3_600_000, ...over,
})
const callback = (action: string, over: Record<string, unknown> = {}, value: Record<string, unknown> = {}) => ({
    schema: '2.0',
    header: { token: TOKEN, app_id: 'cli_test', event_type: 'card.action.trigger' },
    event: {
        operator: { open_id: ME },
        action: { tag: 'button', value: { action, record_id: 'recABC123', table_id: STAGING_TABLE_ID, ...value } },
        context: { open_chat_id: 'oc_team', open_message_id: 'om_1' },
        token: 'c-callback-token',
        ...over,
    },
})
const post = (body: unknown, headers: Record<string, string> = {}) =>
    handleFeedbackCardCallback(new Headers(headers), typeof body === 'string' ? body : JSON.stringify(body), schedule)
// Scheduled work runs only when the test lets the response "finish", like after().
const settle = () => Promise.all(pending.splice(0).map((work) => work()))
type Answer = { toast: { type: string }; card?: { data: { config: { update_multi: boolean }; header?: { template: string } } } }
const answerOf = (r: { body: unknown }) => r.body as Answer
const card = (r: { body: unknown }) => JSON.stringify(answerOf(r).card?.data)

beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k]
    Object.assign(process.env, { LARK_APP_ID: 'cli_test', LARK_BASE_APP_TOKEN: 'bascn1', LARK_NOTIFY_CHAT_ID: 'oc_team', LARK_CALLBACK_VERIFICATION_TOKEN: TOKEN })
    delete process.env.LARK_CALLBACK_ENCRYPT_KEY
    vi.mocked(getBaseRecord).mockReset().mockResolvedValue(record())
    vi.mocked(updateBaseRecord).mockReset().mockResolvedValue(undefined)
    vi.mocked(updateCardAfterCallback).mockReset().mockResolvedValue(undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] }
    vi.restoreAllMocks()
})

describe('TC-F44-27: callback authentication', () => {
    it('answers the url_verification handshake only with the right token', async () => {
        expect(await post({ type: 'url_verification', challenge: 'ch-1', token: TOKEN })).toEqual({ status: 200, body: { challenge: 'ch-1' } })
        expect((await post({ type: 'url_verification', challenge: 'ch-1', token: 'wrong' })).status).toBe(401)
    })
    it('refuses everything while the verification token is not configured', async () => {
        delete process.env.LARK_CALLBACK_VERIFICATION_TOKEN
        expect((await post({ type: 'url_verification', challenge: 'c', token: undefined })).status).toBe(401)
    })
    it('refuses a callback with no token, a foreign app or invalid JSON, without touching the Base', async () => {
        expect((await post({ ...callback('claim'), header: { app_id: 'cli_test' } })).status).toBe(401)
        expect((await post({ ...callback('claim'), header: { token: TOKEN, app_id: 'cli_evil' } })).status).toBe(401)
        expect((await post('not json')).status).toBe(401)
        expect(getBaseRecord).not.toHaveBeenCalled()
    })
    it('with an Encrypt Key: decrypts a signed payload, refuses a bad signature and a plain payload', async () => {
        const KEY = 'enc-key-xyz'
        process.env.LARK_CALLBACK_ENCRYPT_KEY = KEY
        const iv = randomBytes(16)
        const c = createCipheriv('aes-256-cbc', createHash('sha256').update(KEY).digest(), iv)
        const encrypt = Buffer.concat([iv, c.update(JSON.stringify({ type: 'url_verification', challenge: 'ch-enc', token: TOKEN })), c.final()]).toString('base64')
        const raw = JSON.stringify({ encrypt })
        const sig = createHash('sha256').update(`1700000000n1${KEY}${raw}`).digest('hex')
        const headers = { 'x-lark-request-timestamp': '1700000000', 'x-lark-request-nonce': 'n1', 'x-lark-signature': sig }
        expect(await post(raw, headers)).toEqual({ status: 200, body: { challenge: 'ch-enc' } })
        // Flip the first hex digit: a fixed '0' prefix leaves the signature valid when it already starts with 0.
        const badSig = `${sig[0] === '0' ? '1' : '0'}${sig.slice(1)}`
        expect((await post(raw, { ...headers, 'x-lark-signature': badSig })).status).toBe(401)
        expect((await post(callback('claim'))).status).toBe(401)
    })
})

describe('TC-F44-28: card press flow', () => {
    it('Take it: answers with the redrawn card, then writes the Base row', async () => {
        const res = await post(callback('claim'))
        expect(res.status).toBe(200)
        expect(answerOf(res).toast.type).toBe('success')
        expect(card(res)).toContain(`<at id=${ME}></at>`)
        expect(card(res)).toContain('Status:** Triaging')
        // Nothing is written before the response is out: the write is only scheduled.
        expect(updateBaseRecord).not.toHaveBeenCalled()
        expect(getBaseRecord).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 2000 }))
        expect(answerOf(res).card.data.config.update_multi).toBe(true)
        await settle()
        expect(updateBaseRecord).toHaveBeenCalledWith({
            appToken: 'bascn1', tableId: STAGING_TABLE_ID, recordId: 'recABC123', fields: { Owner: [{ id: ME }], Status: 'Triaging' },
        })
    })
    it('a second press on a stale card writes nothing, warns and redraws the real state', async () => {
        vi.mocked(getBaseRecord).mockResolvedValue(record({ Status: 'Resolved' }))
        const res = await post(callback('resolve'))
        expect(answerOf(res).toast.type).toBe('warning')
        expect(answerOf(res).card.data.header.template).toBe('green')
        await settle()
        expect(updateBaseRecord).not.toHaveBeenCalled()
    })
    it('a second Take it on a row someone else took writes nothing and warns', async () => {
        vi.mocked(getBaseRecord).mockResolvedValue(record({ Status: 'Triaging', Owner: [{ id: 'ou_first' }] }))
        const res = await post(callback('claim'))
        expect(answerOf(res).toast.type).toBe('warning')
        expect(card(res)).toContain('<at id=ou_first></at>')
        await settle()
        expect(updateBaseRecord).not.toHaveBeenCalled()
    })
    it('works for the production table too, and the v1 payload gets the bare card', async () => {
        const prod = await post(callback('claim', {}, { table_id: PRODUCTION_TABLE_ID }))
        expect(card(prod)).toContain('[Production]')
        const v1 = await post({ token: TOKEN, open_id: ME, open_chat_id: 'oc_team', action: { value: { action: 'claim', record_id: 'recABC123', table_id: STAGING_TABLE_ID } } })
        expect((v1.body as { header?: unknown }).header).toBeDefined()
    })
    it('rejects a foreign table, a forged record id, an unknown action and another chat without touching the Base', async () => {
        const toast = async (r: Promise<{ body: unknown }>) => answerOf(await r).toast
        expect((await toast(post(callback('claim', {}, { table_id: 'tblOther' })))).type).toBe('error')
        expect((await toast(post(callback('claim', {}, { record_id: '../../apps/x' })))).type).toBe('error')
        expect((await toast(post(callback('delete_everything')))).type).toBe('error')
        expect((await toast(post(callback('claim', { context: { open_chat_id: 'oc_elsewhere' } })))).type).toBe('error')
        expect(getBaseRecord).not.toHaveBeenCalled()
    })
    it('reports a Base read failure to the presser without writing', async () => {
        vi.mocked(getBaseRecord).mockRejectedValue(new Error('down'))
        const res = await post(callback('claim'))
        expect(answerOf(res).toast.type).toBe('error')
        expect(updateBaseRecord).not.toHaveBeenCalled()
    })
    it('a failed write puts the card back to the row real state via delayed update', async () => {
        vi.mocked(updateBaseRecord).mockRejectedValue(new Error('field not found'))
        const res = await post(callback('claim'))
        expect(answerOf(res).toast.type).toBe('success')
        await settle()
        const [token, rolledBack] = vi.mocked(updateCardAfterCallback).mock.calls[0]
        expect(token).toBe('c-callback-token')
        expect(JSON.stringify(rolledBack)).toContain('Status:** New')
        expect(JSON.stringify(rolledBack)).toContain('Owner:** unassigned')
    })
})
