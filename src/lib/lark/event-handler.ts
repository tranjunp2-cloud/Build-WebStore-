/**
 * Lark Bot — Event Handler
 * Main dispatch: parse event → route intent → execute → reply
 */
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { selectModel } from '@/lib/ai/config'
import { replyText, replyCard } from './client'
import { routeMessage } from './intent-router'
import {
    addUserMessage,
    addAssistantMessage,
    getConversationMessages,
} from './conversation-store'
import { buildEnrichedPrompt } from './knowledge-context'
import { ingestConversationInsight, ingestTeamNote } from './knowledge-ingest'
import { buildHelpCard, buildErrorCard, buildStatsCard, buildNoteAddedCard } from './cards'
import { handleCIStatus, handleDeployStatus } from './github-service'
import { handlePRList, handlePRSummary, handlePRReviewer } from './github-service'
import type {
    LarkEventEnvelope,
    LarkMessageReceiveEvent,
    ParsedIntent,
} from './types'

// ─── Main Dispatcher ─────────────────────────────────────────────────────

/**
 * Handle incoming Lark event
 * Called async from the webhook route (fire-and-forget)
 */
export async function handleLarkEvent(envelope: LarkEventEnvelope): Promise<void> {
    const header = envelope.header
    if (!header) return

    switch (header.event_type) {
        case 'im.message.receive_v1':
            await handleMessage(envelope.event as LarkMessageReceiveEvent)
            break

        case 'p2p_chat_create':
            // Bot added to P2P — send welcome
            console.log('[Lark] Bot added to P2P chat')
            break

        default:
            console.log('[Lark] Unhandled event type:', header.event_type)
    }
}

// ─── Message Handler ─────────────────────────────────────────────────────

async function handleMessage(event: LarkMessageReceiveEvent): Promise<void> {
    const { message, sender } = event

    // Skip bot messages (prevent infinite loop)
    if (sender.sender_type === 'bot') return

    // Only handle text messages for now
    if (message.message_type !== 'text') {
        await replyText(
            message.message_id,
            '🤖 Hiện tại mình chỉ hỗ trợ tin nhắn text. Hãy gửi text hoặc dùng /help để xem commands nhé!'
        )
        return
    }

    const openId = sender.sender_id.open_id
    const chatId = message.chat_id
    const messageId = message.message_id

    // Route the message
    const intent = routeMessage(
        message.content,
        message.chat_type,
        message.mentions,
        process.env.LARK_BOT_OPEN_ID
    )

    // Not addressed to bot (group chat without @mention)
    if (!intent) return

    console.log('[Lark] Intent:', intent.intent, intent.args || '', '| from:', openId)

    try {
        await dispatchIntent(intent, messageId, chatId, openId)
    } catch (error) {
        console.error('[Lark] Dispatch error:', error)
        await replyCard(messageId, buildErrorCard(
            'Có lỗi xảy ra',
            error instanceof Error ? error.message : 'Unknown error'
        ))
    }
}

// ─── Intent Dispatch ─────────────────────────────────────────────────────

async function dispatchIntent(
    intent: ParsedIntent,
    messageId: string,
    chatId: string,
    openId: string
): Promise<void> {
    switch (intent.intent) {
        case 'help':
            await replyCard(messageId, buildHelpCard())
            break

        case 'ci_status':
            await handleCIStatus(messageId, intent.args?.branch)
            break

        case 'deploy_status':
            await handleDeployStatus(messageId, intent.args?.env)
            break

        case 'pr_list':
            await handlePRList(messageId)
            break

        case 'pr_summary':
            await handlePRSummary(messageId, intent.args?.prNumber || '')
            break

        case 'pr_reviewer':
            await handlePRReviewer(messageId, intent.args?.prNumber || '')
            break

        case 'add_note':
            await handleAddNote(messageId, openId, intent.args?.content || intent.rawText)
            break

        case 'bot_stats':
            await handleBotStats(messageId)
            break

        case 'project_qa':
            await handleProjectQA(messageId, chatId, openId, intent.rawText)
            break
    }
}

// ─── Add Note ───────────────────────────────────────────────────────

async function handleAddNote(
    messageId: string,
    openId: string,
    content: string
): Promise<void> {
    if (!content || content.length < 5) {
        await replyText(messageId, '⚠️ Nội dung ghi chú quá ngắn. Ví dụ: `/note auth dùng JWT + refresh token`')
        return
    }

    try {
        await ingestTeamNote(content, openId)
        await replyCard(messageId, buildNoteAddedCard(content))
    } catch (error) {
        console.error('[Lark] Add note error:', error)
        await replyText(messageId, '❌ Không thể lưu ghi chú. Vui lòng thử lại.')
    }
}

// ─── Bot Stats ──────────────────────────────────────────────────────

async function handleBotStats(messageId: string): Promise<void> {
    try {
        const { getKnowledgeStats } = await import('./knowledge-search')
        const stats = await getKnowledgeStats()
        await replyCard(messageId, buildStatsCard(stats))
    } catch (error) {
        console.error('[Lark] Bot stats error:', error)
        await replyText(messageId, '❌ Không thể lấy thống kê. Vui lòng thử lại.')
    }
}

// ─── AI Project Q&A ──────────────────────────────────────────────────────

async function handleProjectQA(
    messageId: string,
    chatId: string,
    openId: string,
    userText: string
): Promise<void> {
    // Add user message to conversation context
    addUserMessage(chatId, openId, userText)

    // Get conversation history
    const history = getConversationMessages(chatId, openId)

    const model = selectModel('assistant-chat')

    try {
        // Build enriched prompt with project knowledge + GitHub code search
        const systemPrompt = await buildEnrichedPrompt(userText)

        const { text } = await generateText({
            model: openai(model),
            system: systemPrompt,
            messages: history,
            maxTokens: 1024,
            temperature: 0.7,
        })

        // Save assistant response to context
        addAssistantMessage(chatId, openId, text)

        // Reply
        await replyText(messageId, text)

        // Save meaningful Q&A as long-term knowledge (fire-and-forget)
        // Only save if the answer is substantial (not just a greeting)
        if (text.length > 100 && userText.length > 20) {
            Promise.resolve().then(() =>
                ingestConversationInsight(userText, text).catch(() => {})
            )
        }
    } catch (error) {
        console.error('[Lark] AI Q&A error:', error)
        await replyText(
            messageId,
            '❌ AI đang gặp sự cố. Vui lòng thử lại sau ít phút.'
        )
    }
}
