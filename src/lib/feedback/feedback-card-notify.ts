import { sendChatCard } from '@/lib/lark/lark-base-client'
import { buildFeedbackCard } from './feedback-card'
import { environmentOf } from './feedback-card-config'
import { LARK_FEEDBACK_FIELDS } from './feedback-report'
import { cardDataFromFields } from './feedback-card-actions'

type NotifyInput = {
    recordId: string
    appToken: string
    tableId: string
    /** Fields exactly as written to the Base, so the first card matches what a button press redraws. */
    fields: Record<string, unknown>
}

/**
 * Posts the new-feedback card to the team group. Best effort: the feedback is already in the Base,
 * so any failure is logged and swallowed. No-op without LARK_NOTIFY_CHAT_ID. Returns whether a card was sent.
 */
export async function notifyNewFeedback(input: NotifyInput): Promise<boolean> {
    const chatId = process.env.LARK_NOTIFY_CHAT_ID
    if (!chatId || !input.recordId || !environmentOf(input.tableId)) return false
    try {
        const data = cardDataFromFields(input, { ...input.fields, [LARK_FEEDBACK_FIELDS.submittedAt]: Date.now() })
        if (!data) return false
        await sendChatCard(chatId, buildFeedbackCard(data))
        return true
    } catch (err) {
        console.error('[feedback] Lark card failed', { name: (err as Error).name, code: (err as { code?: unknown }).code ?? null })
        return false
    }
}
