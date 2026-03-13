/**
 * Lark Bot — TypeScript types
 * Event schemas, message types, interactive card structures
 */

// ─── Event Envelope ──────────────────────────────────────────────────────

/** Top-level event payload from Lark webhook */
export interface LarkEventEnvelope {
    /** Schema version — "2.0" for v2 events */
    schema?: string
    /** Event header with metadata */
    header?: LarkEventHeader
    /** Event body — varies by event type */
    event?: LarkEvent

    // ── URL Verification (special case) ──
    challenge?: string
    token?: string
    type?: 'url_verification'
}

export interface LarkEventHeader {
    event_id: string
    event_type: string
    create_time: string
    token: string
    app_id: string
    tenant_key: string
}

// ─── Event Types ─────────────────────────────────────────────────────────

export type LarkEvent =
    | LarkMessageReceiveEvent
    | LarkBotAddedEvent

/** im.message.receive_v1 — someone sends a message in chat */
export interface LarkMessageReceiveEvent {
    sender: {
        sender_id: {
            open_id: string
            user_id?: string
            union_id?: string
        }
        sender_type: 'user' | 'bot' | 'app'
        tenant_key?: string
    }
    message: {
        message_id: string
        root_id?: string
        parent_id?: string
        create_time: string
        update_time?: string
        chat_id: string
        chat_type: 'p2p' | 'group'
        message_type: 'text' | 'post' | 'image' | 'file' | 'interactive'
        content: string // JSON string
        mentions?: LarkMention[]
    }
}

export interface LarkMention {
    key: string
    id: {
        open_id: string
        user_id?: string
        union_id?: string
    }
    name: string
    tenant_key?: string
}

/** p2p_chat_create — bot added to P2P chat */
export interface LarkBotAddedEvent {
    chat_id: string
    operator: {
        open_id: string
    }
}

// ─── Message Content ─────────────────────────────────────────────────────

/** Text message content (parsed from message.content JSON) */
export interface LarkTextContent {
    text: string
}

/** Post (rich text) message content */
export interface LarkPostContent {
    title?: string
    content: Array<Array<LarkPostElement>>
}

export type LarkPostElement =
    | { tag: 'text'; text: string }
    | { tag: 'a'; text: string; href: string }
    | { tag: 'at'; user_id: string; user_name?: string }
    | { tag: 'img'; image_key: string }

// ─── Send Message ────────────────────────────────────────────────────────

export type LarkMsgType = 'text' | 'post' | 'interactive'

export interface LarkSendMessagePayload {
    receive_id: string
    msg_type: LarkMsgType
    content: string // JSON string
}

// ─── Interactive Cards ───────────────────────────────────────────────────

export interface LarkCard {
    header?: LarkCardHeader
    elements: LarkCardElement[]
}

export interface LarkCardHeader {
    title: {
        tag: 'plain_text'
        content: string
    }
    template?: LarkCardHeaderColor
}

export type LarkCardHeaderColor =
    | 'blue'
    | 'green'
    | 'red'
    | 'orange'
    | 'purple'
    | 'indigo'
    | 'turquoise'
    | 'yellow'
    | 'grey'
    | 'wathet'

export type LarkCardElement =
    | LarkCardDiv
    | LarkCardHr
    | LarkCardAction
    | LarkCardColumnSet
    | LarkCardNote
    | LarkCardMarkdown

export interface LarkCardDiv {
    tag: 'div'
    text: {
        tag: 'lark_md' | 'plain_text'
        content: string
    }
}

export interface LarkCardMarkdown {
    tag: 'markdown'
    content: string
}

export interface LarkCardHr {
    tag: 'hr'
}

export interface LarkCardAction {
    tag: 'action'
    actions: LarkCardButton[]
}

export interface LarkCardButton {
    tag: 'button'
    text: {
        tag: 'plain_text'
        content: string
    }
    url?: string
    type?: 'default' | 'primary' | 'danger'
    value?: Record<string, string>
}

export interface LarkCardColumnSet {
    tag: 'column_set'
    flex_mode: 'none' | 'stretch' | 'flow' | 'bisect'
    background_style?: 'default' | 'grey'
    columns: LarkCardColumn[]
}

export interface LarkCardColumn {
    tag: 'column'
    width: 'weighted' | 'auto'
    weight?: number
    vertical_align?: 'top' | 'center' | 'bottom'
    elements: LarkCardElement[]
}

export interface LarkCardNote {
    tag: 'note'
    elements: Array<{
        tag: 'plain_text' | 'lark_md'
        content: string
    }>
}

// ─── Card Action Callback ────────────────────────────────────────────────

export interface LarkCardActionPayload {
    open_id: string
    user_id?: string
    open_message_id: string
    open_chat_id: string
    tenant_key: string
    token: string
    action: {
        value: Record<string, string>
        tag: string
    }
}

// ─── Intent Router ───────────────────────────────────────────────────────

export type BotIntent =
    | 'help'
    | 'ci_status'
    | 'deploy_status'
    | 'pr_list'
    | 'pr_summary'
    | 'pr_reviewer'
    | 'project_qa'
    | 'add_note'
    | 'bot_stats'

export interface ParsedIntent {
    intent: BotIntent
    args?: Record<string, string>
    rawText: string
}
