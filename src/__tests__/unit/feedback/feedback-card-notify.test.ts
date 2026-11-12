/** New-feedback group card (F44): non-blocking, optional. TC-IDs from docs/qa/F44-feedback-mvp.md. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/lark/lark-base-client', () => ({ sendChatCard: vi.fn() }))

import { notifyNewFeedback } from '@/lib/feedback/feedback-card-notify'
import { PRODUCTION_TABLE_ID, STAGING_TABLE_ID } from '@/lib/feedback/feedback-card-config'
import { sendChatCard } from '@/lib/lark/lark-base-client'

const fields = { 'Feedback ID': 'FB-26-000123', Type: 'Data mismatch', Feature: ['Orders'], Details: 'Totals differ', Status: 'New', Store: 'Demo' }
const input = (tableId = STAGING_TABLE_ID) => ({ recordId: 'recABC123', appToken: 'bascn1', tableId, fields })
let saved: string | undefined

beforeEach(() => {
    saved = process.env.LARK_NOTIFY_CHAT_ID
    process.env.LARK_NOTIFY_CHAT_ID = 'oc_team'
    vi.mocked(sendChatCard).mockReset().mockResolvedValue(undefined)
    vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
    if (saved === undefined) delete process.env.LARK_NOTIFY_CHAT_ID; else process.env.LARK_NOTIFY_CHAT_ID = saved
    vi.restoreAllMocks()
})

describe('TC-F44-29: new feedback card', () => {
    it('posts a card with action buttons to the configured chat, labelled with the environment', async () => {
        expect(await notifyNewFeedback(input(PRODUCTION_TABLE_ID))).toBe(true)
        const [chat, card] = vi.mocked(sendChatCard).mock.calls[0] as [string, { header: { title: { content: string } } }]
        expect(chat).toBe('oc_team')
        expect(card.header.title.content).toContain('[Production]')
        expect(JSON.stringify(card)).toContain('"action":"claim"')
    })
    it('sends nothing without LARK_NOTIFY_CHAT_ID', async () => {
        delete process.env.LARK_NOTIFY_CHAT_ID
        expect(await notifyNewFeedback(input())).toBe(false)
        expect(sendChatCard).not.toHaveBeenCalled()
    })
    it('swallows a Lark failure so the submission is never failed', async () => {
        vi.mocked(sendChatCard).mockRejectedValue(new Error('lark down'))
        await expect(notifyNewFeedback(input())).resolves.toBe(false)
    })
})
