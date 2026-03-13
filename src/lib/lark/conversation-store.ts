/**
 * Lark Bot — Conversation Context Store
 * In-memory conversation history with TTL and size limits
 * Key: `chatId:openId` for per-user context in each chat
 */
import { CONVERSATION_TTL, CONVERSATION_MAX_MESSAGES } from './constants'

// ─── Types ───────────────────────────────────────────────────────────────

export interface ConversationMessage {
    role: 'user' | 'assistant'
    content: string
    timestamp: number
}

interface ConversationContext {
    messages: ConversationMessage[]
    lastActivity: number
}

// ─── Store ───────────────────────────────────────────────────────────────

const store = new Map<string, ConversationContext>()

/**
 * Build context key from chat ID and user open ID
 */
function buildKey(chatId: string, openId: string): string {
    return `${chatId}:${openId}`
}

/**
 * Add a user message to conversation context
 */
export function addUserMessage(chatId: string, openId: string, content: string): void {
    const key = buildKey(chatId, openId)
    const ctx = getOrCreate(key)

    ctx.messages.push({
        role: 'user',
        content,
        timestamp: Date.now(),
    })

    // Trim to max messages
    if (ctx.messages.length > CONVERSATION_MAX_MESSAGES) {
        ctx.messages = ctx.messages.slice(-CONVERSATION_MAX_MESSAGES)
    }

    ctx.lastActivity = Date.now()
}

/**
 * Add a bot response to conversation context
 */
export function addAssistantMessage(chatId: string, openId: string, content: string): void {
    const key = buildKey(chatId, openId)
    const ctx = getOrCreate(key)

    ctx.messages.push({
        role: 'assistant',
        content,
        timestamp: Date.now(),
    })

    // Trim to max messages
    if (ctx.messages.length > CONVERSATION_MAX_MESSAGES) {
        ctx.messages = ctx.messages.slice(-CONVERSATION_MAX_MESSAGES)
    }

    ctx.lastActivity = Date.now()
}

/**
 * Get conversation messages for AI context
 * Returns messages in OpenAI format: { role, content }[]
 */
export function getConversationMessages(
    chatId: string,
    openId: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
    const key = buildKey(chatId, openId)
    const ctx = store.get(key)

    if (!ctx) return []

    // Check TTL
    if (Date.now() - ctx.lastActivity > CONVERSATION_TTL) {
        store.delete(key)
        return []
    }

    return ctx.messages.map(({ role, content }) => ({ role, content }))
}

/**
 * Clear conversation context for a user in a chat
 */
export function clearConversation(chatId: string, openId: string): void {
    const key = buildKey(chatId, openId)
    store.delete(key)
}

/**
 * Get total number of active conversations (for monitoring)
 */
export function getActiveConversationCount(): number {
    return store.size
}

// ─── Internal ────────────────────────────────────────────────────────────

function getOrCreate(key: string): ConversationContext {
    let ctx = store.get(key)

    if (!ctx || Date.now() - ctx.lastActivity > CONVERSATION_TTL) {
        ctx = { messages: [], lastActivity: Date.now() }
        store.set(key, ctx)
    }

    return ctx
}

/**
 * Cleanup expired conversations — called periodically
 */
export function cleanupExpired(): number {
    const now = Date.now()
    let cleaned = 0

    for (const [key, ctx] of store) {
        if (now - ctx.lastActivity > CONVERSATION_TTL) {
            store.delete(key)
            cleaned++
        }
    }

    return cleaned
}

// Auto-cleanup every 10 minutes
if (typeof setInterval !== 'undefined') {
    setInterval(cleanupExpired, 10 * 60 * 1000)
}
