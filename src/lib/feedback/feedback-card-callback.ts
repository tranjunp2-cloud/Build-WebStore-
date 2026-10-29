/**
 * Handles a Lark `card.action.trigger` callback for the feedback card.
 *
 * Lark gives up after 3 s, and a Base write alone can take longer, so: read the row, answer with the
 * card redrawn for the new state, then write (scheduled after the response). If the write fails the
 * card is put back to the row's real state through Lark's delayed update.
 */
import { getBaseRecord, LarkApiError, updateBaseRecord, updateCardAfterCallback } from '@/lib/lark/lark-base-client'
import { openPayload, secretsMatch, type LarkPayload } from '@/lib/lark/lark-callback-security'
import { buildFeedbackCard, CARD_ACTIONS } from './feedback-card'
import { cardDataFromFields, planAction } from './feedback-card-actions'
import { ALLOWED_TABLE_IDS } from './feedback-card-config'

export type CallbackResult = { status: number; body: unknown }
export type Schedule = (work: Promise<unknown>) => void

const RECORD_ID = /^rec[A-Za-z0-9]{6,30}$/

/** Normalises the two callback formats Lark ships: v2 (`schema: "2.0"`) and the older flat v1. */
function readAction(payload: LarkPayload) {
    const v2 = payload.schema === '2.0'
    const event = v2 ? payload.event ?? {} : payload
    return {
        v2,
        appId: v2 ? (payload.header?.app_id as string | undefined) : undefined,
        operatorOpenId: (v2 ? event.operator?.open_id : event.open_id) as string | undefined,
        chatId: (v2 ? event.context?.open_chat_id : event.open_chat_id) as string | undefined,
        callbackToken: v2 ? (event.token as string | undefined) : undefined,
        value: (event.action?.value ?? {}) as Record<string, unknown>,
    }
}

/** v2 wants `{ toast, card }`; v1 takes the bare card. */
function answer(v2: boolean, a: { toast: string; type?: string; card?: unknown }): CallbackResult {
    if (!v2) return { status: 200, body: a.card ?? {} }
    return {
        status: 200,
        body: { toast: { type: a.type ?? 'info', content: a.toast }, ...(a.card ? { card: { type: 'raw', data: a.card } } : {}) },
    }
}

const unauthorized = (): CallbackResult => ({ status: 401, body: { error: { message: 'Unauthorized.' } } })

function logFailure(step: string, error: unknown): void {
    const code = error instanceof LarkApiError ? error.code : null
    console.error(`[feedback-card] ${step} failed`, { name: (error as Error).name, code })
}

/** The write that follows an answered press; on failure redraws the card from the row's real state. */
export async function writeOrRollBack(
    ref: { appToken: string; tableId: string; recordId: string },
    patch: Record<string, unknown>,
    before: Record<string, unknown>,
    callbackToken: string | undefined,
): Promise<void> {
    try {
        await updateBaseRecord({ ...ref, fields: patch })
    } catch (error) {
        logFailure('write', error)
        const data = cardDataFromFields(ref, before)
        if (!callbackToken || !data) return
        try {
            await updateCardAfterCallback(callbackToken, buildFeedbackCard(data))
        } catch (rollbackError) {
            logFailure('card rollback', rollbackError)
        }
    }
}

export async function handleFeedbackCardCallback(headers: Headers, rawBody: string, schedule: Schedule): Promise<CallbackResult> {
    const opened = openPayload(headers, rawBody)
    if (!opened.ok) {
        console.warn('[feedback-card] refused', { reason: opened.reason })
        return unauthorized()
    }
    const { payload } = opened

    // The console's one-time handshake when the callback URL is saved.
    if (payload.type === 'url_verification') return { status: 200, body: { challenge: payload.challenge } }

    const { v2, appId, operatorOpenId, chatId, callbackToken, value } = readAction(payload)

    // Defence in depth on top of the token: right app, right chat.
    if (appId && process.env.LARK_APP_ID && !secretsMatch(appId, process.env.LARK_APP_ID)) return unauthorized()
    const teamChat = process.env.LARK_NOTIFY_CHAT_ID
    if (teamChat && chatId && chatId !== teamChat) {
        return answer(v2, { toast: 'This card is not from the feedback group.', type: 'error' })
    }

    const { action, record_id: recordId, table_id: tableId } = value
    const appToken = process.env.LARK_BASE_APP_TOKEN
    if (
        typeof action !== 'string' || !(CARD_ACTIONS as readonly string[]).includes(action)
        || typeof recordId !== 'string' || !RECORD_ID.test(recordId)
        || typeof tableId !== 'string' || !ALLOWED_TABLE_IDS.includes(tableId)
        || !operatorOpenId || !appToken
    ) {
        return answer(v2, { toast: 'Unknown action.', type: 'error' })
    }
    const ref = { appToken, tableId, recordId }

    let current: Record<string, unknown>
    try {
        current = await getBaseRecord(ref)
    } catch (error) {
        logFailure('read', error)
        return answer(v2, { toast: 'Could not read the Base. Try again, or open the record.', type: 'error' })
    }

    const plan = planAction(action, current, operatorOpenId)
    // A stale card (someone else already moved it on): redraw it, change nothing.
    if (!plan) {
        const data = cardDataFromFields(ref, current)
        return answer(v2, {
            toast: 'Already updated by someone else. Card refreshed.',
            type: 'warning',
            card: data ? buildFeedbackCard(data) : undefined,
        })
    }

    console.info('[feedback-card]', action, recordId) // ids only: no feedback content in logs
    schedule(writeOrRollBack(ref, plan.patch, current, callbackToken))
    const next = cardDataFromFields(ref, { ...current, ...plan.patch })
    return answer(v2, { toast: plan.toast, type: 'success', card: next ? buildFeedbackCard(next) : undefined })
}
