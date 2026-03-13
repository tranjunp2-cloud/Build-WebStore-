/**
 * Lark Bot — Intent Router
 * Classify incoming messages → intent for command dispatch
 *
 * Priority:
 * 1. Slash commands (/help, /ci, /pr)
 * 2. Keyword matching (simple patterns)
 * 3. AI fallback (project Q&A)
 */
import type { BotIntent, ParsedIntent, LarkMention } from './types'

// ─── Command Patterns ────────────────────────────────────────────────────

interface CommandPattern {
    pattern: RegExp
    intent: BotIntent
    extractArgs?: (match: RegExpMatchArray) => Record<string, string>
}

const COMMAND_PATTERNS: CommandPattern[] = [
    // /help or help
    {
        pattern: /^\/(help|h)\b/i,
        intent: 'help',
    },
    // /ci [branch]
    {
        pattern: /^\/(ci|build)\s*(.*)?$/i,
        intent: 'ci_status',
        extractArgs: (match) => ({
            branch: match[2]?.trim() || '',
        }),
    },
    // /deploy [env]
    {
        pattern: /^\/(deploy|staging|prod)\s*(.*)?$/i,
        intent: 'deploy_status',
        extractArgs: (match) => ({
            env: match[2]?.trim() || '',
        }),
    },
    // /pr reviewer <number>
    {
        pattern: /^\/(pr|pull)\s+reviewer\s+(\d+)/i,
        intent: 'pr_reviewer',
        extractArgs: (match) => ({
            prNumber: match[2],
        }),
    },
    // /pr list
    {
        pattern: /^\/(pr|pull)\s+list/i,
        intent: 'pr_list',
    },
    // /pr <number>
    {
        pattern: /^\/(pr|pull)\s+(\d+)/i,
        intent: 'pr_summary',
        extractArgs: (match) => ({
            prNumber: match[2],
        }),
    },
    // /note <content> — add team knowledge
    {
        pattern: /^\/(note|ghi)\s+(.+)/i,
        intent: 'add_note',
        extractArgs: (match) => ({
            content: match[2].trim(),
        }),
    },
    // /bot stats — show knowledge base stats
    {
        pattern: /^\/(bot|stats)\s*(stats|thongke)?$/i,
        intent: 'bot_stats',
    },
]

// ─── Text Extraction ─────────────────────────────────────────────────────

/**
 * Extract clean text from message content
 * Removes @mention tags and trims whitespace
 */
export function extractText(
    messageContent: string,
    mentions?: LarkMention[]
): string {
    let text: string

    try {
        const parsed = JSON.parse(messageContent)
        text = parsed.text || ''
    } catch {
        text = messageContent
    }

    // Remove @mention placeholders like @_user_1
    if (mentions?.length) {
        for (const mention of mentions) {
            text = text.replace(mention.key, '').trim()
        }
    }

    // Clean up extra whitespace
    text = text.replace(/\s+/g, ' ').trim()

    return text
}

// ─── Intent Classification ───────────────────────────────────────────────

/**
 * Check if the message is addressed to the bot
 * In P2P chat: always true
 * In group chat: only if @mentioned or starts with /
 */
export function isBotAddressed(
    chatType: 'p2p' | 'group',
    text: string,
    mentions?: LarkMention[],
    botOpenId?: string
): boolean {
    // P2P chat — always respond
    if (chatType === 'p2p') return true

    // Group chat — check @mention or slash command
    if (text.startsWith('/')) return true

    // Check if bot is @mentioned
    if (mentions?.length && botOpenId) {
        return mentions.some((m) => m.id.open_id === botOpenId)
    }

    return false
}

/**
 * Classify message into intent
 */
export function classifyIntent(text: string): ParsedIntent {
    // Try command patterns first
    for (const { pattern, intent, extractArgs } of COMMAND_PATTERNS) {
        const match = text.match(pattern)
        if (match) {
            return {
                intent,
                args: extractArgs?.(match),
                rawText: text,
            }
        }
    }

    // Fallback: AI project Q&A
    return {
        intent: 'project_qa',
        rawText: text,
    }
}

/**
 * Full pipeline: extract text → check addressed → classify
 */
export function routeMessage(
    messageContent: string,
    chatType: 'p2p' | 'group',
    mentions?: LarkMention[],
    botOpenId?: string
): ParsedIntent | null {
    const text = extractText(messageContent, mentions)

    if (!text) return null

    // Check if bot should respond
    if (!isBotAddressed(chatType, text, mentions, botOpenId)) {
        return null
    }

    return classifyIntent(text)
}
