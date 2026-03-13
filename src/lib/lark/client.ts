/**
 * Lark Bot — API Client
 * Tenant access token management, send/reply messages, send cards
 */
import { LARK_API_BASE, LARK_APP_ID, LARK_APP_SECRET } from './constants'
import type { LarkCard, LarkMsgType } from './types'

// ─── Token Cache ─────────────────────────────────────────────────────────

let cachedToken: string | null = null
let tokenExpiresAt = 0

/**
 * Get tenant_access_token (app-level token)
 * Cached with TTL — Lark tokens expire in 2 hours, we refresh at 1.5h
 */
export async function getTenantAccessToken(): Promise<string> {
    const now = Date.now()

    if (cachedToken && now < tokenExpiresAt) {
        return cachedToken
    }

    if (!LARK_APP_ID || !LARK_APP_SECRET) {
        throw new Error('LARK_APP_ID and LARK_APP_SECRET are required')
    }

    const res = await fetch(
        `${LARK_API_BASE}/auth/v3/tenant_access_token/internal`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                app_id: LARK_APP_ID,
                app_secret: LARK_APP_SECRET,
            }),
        }
    )

    const data = await res.json()

    if (data.code !== 0) {
        throw new Error(`[Lark] Failed to get token: ${data.msg} (code: ${data.code})`)
    }

    cachedToken = data.tenant_access_token
    // Refresh 30 minutes before expiry (token lasts 2 hours)
    tokenExpiresAt = now + (data.expire - 1800) * 1000

    console.log('[Lark] Token refreshed, expires in', data.expire, 'seconds')
    return cachedToken!
}

// ─── Send Message ────────────────────────────────────────────────────────

/**
 * Send a message to a chat or user
 * @param receiveIdType - 'open_id' | 'chat_id' | 'user_id' | 'email'
 */
export async function sendMessage(
    receiveId: string,
    content: string,
    msgType: LarkMsgType = 'text',
    receiveIdType: string = 'chat_id'
): Promise<void> {
    const token = await getTenantAccessToken()

    const res = await fetch(
        `${LARK_API_BASE}/im/v1/messages?receive_id_type=${receiveIdType}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                receive_id: receiveId,
                msg_type: msgType,
                content,
            }),
        }
    )

    const data = await res.json()

    if (data.code !== 0) {
        console.error('[Lark] sendMessage failed:', data.msg, data.code)
        throw new Error(`[Lark] sendMessage: ${data.msg}`)
    }
}

/**
 * Reply to a specific message
 */
export async function replyMessage(
    messageId: string,
    content: string,
    msgType: LarkMsgType = 'text'
): Promise<void> {
    const token = await getTenantAccessToken()

    const res = await fetch(
        `${LARK_API_BASE}/im/v1/messages/${messageId}/reply`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                msg_type: msgType,
                content,
            }),
        }
    )

    const data = await res.json()

    if (data.code !== 0) {
        console.error('[Lark] replyMessage failed:', data.msg, data.code)
        throw new Error(`[Lark] replyMessage: ${data.msg}`)
    }
}

// ─── Send Card ───────────────────────────────────────────────────────────

/**
 * Send an interactive card to a chat
 */
export async function sendCard(
    chatId: string,
    card: LarkCard
): Promise<void> {
    const content = JSON.stringify(card)
    await sendMessage(chatId, content, 'interactive')
}

/**
 * Reply with an interactive card
 */
export async function replyCard(
    messageId: string,
    card: LarkCard
): Promise<void> {
    const content = JSON.stringify(card)
    await replyMessage(messageId, content, 'interactive')
}

// ─── Send Text Helpers ───────────────────────────────────────────────────

/**
 * Send a plain text message to a chat
 */
export async function sendText(
    chatId: string,
    text: string
): Promise<void> {
    const content = JSON.stringify({ text })
    await sendMessage(chatId, content, 'text')
}

/**
 * Reply with plain text
 */
export async function replyText(
    messageId: string,
    text: string
): Promise<void> {
    const content = JSON.stringify({ text })
    await replyMessage(messageId, content, 'text')
}

// ─── Update Card (in-place) ─────────────────────────────────────────────

/**
 * Update a card message in-place (for card action callbacks)
 */
export async function updateCard(
    messageId: string,
    card: LarkCard
): Promise<void> {
    const token = await getTenantAccessToken()

    const res = await fetch(
        `${LARK_API_BASE}/im/v1/messages/${messageId}`,
        {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                msg_type: 'interactive',
                content: JSON.stringify(card),
            }),
        }
    )

    const data = await res.json()

    if (data.code !== 0) {
        console.error('[Lark] updateCard failed:', data.msg, data.code)
    }
}
