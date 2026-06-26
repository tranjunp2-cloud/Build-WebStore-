'use client'


import React, { memo, useEffect, useRef, useState } from 'react'
import DOMPurify from 'isomorphic-dompurify'
import { RotateCcw, Send, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AIAction, BlockData, ThemeData } from '@/types/editor'
import { useI18n } from '@/i18n'

/** Strip all HTML tags from content — defense-in-depth against XSS in AI responses */
function sanitizeContent(content: string): string {
    return DOMPurify.sanitize(content, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
}

type ChatMessage = {
    id: string
    role: 'user' | 'assistant'
    content: string
    createdAt?: string
    undoable?: boolean
    isStreaming?: boolean
}

interface AIChatPanelProps {
    siteId?: string
    blocks: BlockData[]
    selectedBlock: number | null
    onAIAction: (action: AIAction) => Promise<void> | void
    onUndoLastAction: () => void
    siteName: string
    theme: ThemeData | undefined
    currentPageSlug?: string
    currentPageTitle?: string
    externalActivity?: {
        id: string
        content: string
    } | null
    blockContext?: { blockIndex: number; blockType: string } | null
    onBlockContextDismiss?: () => void
    compact?: boolean
}

// Auto-grow textarea cap: ~6 lines of 13px/leading-5 (20px) text + py-1.5 before scrolling.
const MAX_TEXTAREA_HEIGHT = 132

function formatChatTime(date = new Date()) {
    return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    })
}

function AIChatPanelInner({
    siteId,
    blocks,
    selectedBlock,
    onAIAction,
    onUndoLastAction,
    siteName,
    theme,
    currentPageSlug,
    currentPageTitle,
    externalActivity,
    blockContext,
    onBlockContextDismiss,
    compact = false,
}: AIChatPanelProps) {

    const { t } = useI18n()
    const ac = t.editor.aiChat

    // BUG-F05-13: Persist chat history per site in localStorage
    const chatStorageKey = siteId ? `editor-chat-${siteId}` : null

    const [input, setInput] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    // MIN-5: SSR-safe initial state — deterministic welcome without createdAt.
    // Cache + timestamp hydrate in the useEffect below after mount.
    const [messages, setMessages] = useState<ChatMessage[]>([{
        id: 'welcome',
        role: 'assistant',
        content: ac.welcomeMessage,
    }])
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    // Skip the save effect's first run per chatStorageKey.
    // Root cause: effects run in declaration order within the same render cycle.
    // Hydration effect (1st) calls setMessages — state hasn't updated yet when
    // save effect (2nd) runs, so save would write stale [welcome] to localStorage.
    const skipNextSaveRef = useRef(true)

    // MIN-5: hydrate from localStorage after mount to avoid SSR/CSR divergence.
    useEffect(() => {
        skipNextSaveRef.current = true // block save for this render cycle
        if (chatStorageKey) {
            const saved = localStorage.getItem(chatStorageKey)
            if (saved) {
                try {
                    const parsed = JSON.parse(saved) as ChatMessage[]
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setMessages(parsed)
                        return
                    }
                } catch (err) {
                    if (process.env.NODE_ENV === 'development') console.error('[AIChatPanel] invalid cache', err)
                    localStorage.removeItem(chatStorageKey)
                }
            }
        }
        setMessages(prev =>
            prev.length === 1 && prev[0].id === 'welcome' && !prev[0].createdAt
                ? [{ ...prev[0], createdAt: formatChatTime() }]
                : prev,
        )
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatStorageKey])

    // BUG-F05-13: Save messages to localStorage on change
    useEffect(() => {
        if (typeof window === 'undefined' || !chatStorageKey) return
        if (skipNextSaveRef.current) {
            skipNextSaveRef.current = false
            return
        }
        // Strip incomplete streaming messages — they render broken on next load
        const toSave = messages.filter(m => !m.isStreaming)
        localStorage.setItem(chatStorageKey, JSON.stringify(toSave))
    }, [messages, chatStorageKey])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Auto-resize textarea to fit content: grows from 1 line up to MAX_TEXTAREA_HEIGHT,
    // then scrolls internally. Runs on typing and on programmatic clears (after send).
    useEffect(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = 'auto'
        const next = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)
        el.style.height = `${next}px`
        el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden'
    }, [input])

    useEffect(() => {
        if (!externalActivity) return

        setMessages(prev => {
            if (prev.some(message => message.id === externalActivity.id)) {
                return prev
            }

            return [
                ...prev,
                {
                    id: externalActivity.id,
                    role: 'assistant',
                    content: externalActivity.content,
                    createdAt: formatChatTime(),
                    undoable: true,
                },
            ]
        })
    }, [externalActivity])

    const updateAssistantMessage = (messageId: string, next: Partial<ChatMessage>) => {
        setMessages(prev =>
            prev.map(message => (message.id === messageId
                ? { ...message, ...next, content: next.content ? sanitizeContent(next.content) : message.content }
                : message)),
        )
    }

    const handleAIError = (messageId: string, message: string) => {
        updateAssistantMessage(messageId, {
            content: `❌ ${sanitizeContent(message)}`,
            isStreaming: false,
            undoable: false,
        })
    }

    const readSSEStream = async (response: Response, messageId: string) => {
        if (!response.body) {
            throw new Error('Empty stream body')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        const flushChunk = async (chunk: string) => {
            const rawEvent = chunk.trim()
            if (!rawEvent) return

            let eventName = 'message'
            const dataLines: string[] = []

            for (const line of rawEvent.split('\n')) {
                if (line.startsWith('event:')) {
                    eventName = line.slice(6).trim()
                    continue
                }

                if (line.startsWith('data:')) {
                    dataLines.push(line.slice(5).trim())
                }
            }

            if (dataLines.length === 0) return

            const payload = JSON.parse(dataLines.join('\n'))

            if (eventName === 'status') {
                updateAssistantMessage(messageId, { content: payload.message || ac.drafting })
                return
            }

            if (eventName === 'action') {
                const actionType = payload?.result?.action ?? payload?.action
                if (actionType === 'none') {
                    updateAssistantMessage(messageId, {
                        content: payload.result?.message || payload.message || ac.outOfScope,
                        isStreaming: false,
                        undoable: false,
                    })
                    return
                }
                await onAIAction(payload as AIAction)
                return
            }

            if (eventName === 'done') {
                updateAssistantMessage(messageId, {
                    content: payload.message || ac.appliedChanges,
                    isStreaming: false,
                    undoable: true,
                })
                return
            }

            if (eventName === 'error') {
                handleAIError(messageId, payload.error || ac.editFailed)
            }
        }

        while (true) {
            const { done, value } = await reader.read()
            buffer += decoder.decode(value || new Uint8Array(), { stream: !done })

            const chunks = buffer.split('\n\n')
            buffer = chunks.pop() || ''

            for (const chunk of chunks) {
                await flushChunk(chunk)
            }

            if (done) {
                if (buffer.trim()) {
                    await flushChunk(buffer)
                }
                break
            }
        }
    }

    const handleSendChat = async () => {
        if (!input.trim() || isProcessing) return

        const blockLabel = blockContext ? blockContext.blockType.replace(/-/g, ' ') : null
        const userMsg = blockLabel
            ? `[${blockLabel}] ${input.trim()}`
            : input.trim()
        const assistantMessageId = `${Date.now()}-assistant`

        setInput('')
        onBlockContextDismiss?.()
        setMessages(prev => [
            ...prev,
            { id: Date.now().toString(), role: 'user', content: userMsg, createdAt: formatChatTime() },
            {
                id: assistantMessageId,
                role: 'assistant',
                content: ac.drafting,
                createdAt: formatChatTime(),
                isStreaming: true,
            },
        ])
        setIsProcessing(true)

        try {
            const currentBlock = selectedBlock !== null ? (blocks[selectedBlock] || null) : null

            // Spec §1.3: send last 10 chat messages as context
            const recentMessages = messages
                .filter(m => !m.isStreaming)
                .slice(-10)
                .map(m => ({ role: m.role, content: m.content }))

            const res = await fetch('/api/ai/edit-block?stream=true', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    instruction: userMsg,
                    block: currentBlock,
                    blockIndex: selectedBlock ?? undefined,
                    allBlocks: blocks,
                    theme,
                    siteName,
                    currentPageSlug: currentPageSlug || 'home',
                    currentPageTitle: currentPageTitle || '',
                    chatHistory: recentMessages,
                }),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                handleAIError(assistantMessageId, data.error || ac.failedToEdit)
                return
            }

            const isStream = res.headers.get('content-type')?.includes('text/event-stream')

            if (isStream) {
                await readSSEStream(res, assistantMessageId)
                return
            }

            const data = await res.json()
            const resultAction = data?.result?.action ?? data?.action
            if (resultAction === 'none') {
                // Out-of-scope request — show message only, no changes applied
                updateAssistantMessage(assistantMessageId, {
                    content: data.result?.message || data.description || ac.outOfScope,
                    isStreaming: false,
                    undoable: false,
                })
            } else {
                await onAIAction(data as AIAction)
                updateAssistantMessage(assistantMessageId, {
                    content: data.message || data.description || ac.appliedChanges,
                    isStreaming: false,
                    undoable: true,
                })
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error'
            handleAIError(assistantMessageId, message)
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <div className="flex h-full flex-col bg-[var(--editor-bg)]">
            <div role="tabpanel" className="flex min-h-0 flex-1 flex-col">
                <div
                    className={cn(
                        'flex-1 overflow-y-auto',
                        compact ? 'px-4 pb-5 pt-6' : 'px-4 pb-4 pt-6',
                    )}
                    role="log"
                    aria-label="AI chat messages"
                >
                    <div className="space-y-3">
                        {messages.map(msg => {
                            if (msg.role === 'user') {
                                return (
                                    <div key={msg.id} className="flex justify-end">
                                        <div className="w-fit max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-[hsl(var(--info))] to-[hsl(var(--primary))] px-4 py-3 text-white shadow-lg shadow-blue-500/10">
                                            <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{msg.content}</p>
                                            {msg.createdAt ? (
                                                <p className="mt-1.5 text-right text-[10px] text-white/50">{msg.createdAt}</p>
                                            ) : null}
                                        </div>
                                    </div>
                                )
                            }

                            if (msg.isStreaming) {
                                return (
                                    <div key={msg.id} className="flex">
                                        <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-white/[0.06] bg-[var(--editor-surface-elevated)] px-4 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="flex gap-1">
                                                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[hsl(var(--primary))] [animation-delay:0ms]" />
                                                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[hsl(var(--primary))] [animation-delay:150ms]" />
                                                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[hsl(var(--primary))] [animation-delay:300ms]" />
                                                </div>
                                                <span className="text-[13px] leading-relaxed text-slate-300">{msg.content || ac.thinking}</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            }

                            if (msg.undoable) {
                                return (
                                    <div key={msg.id} className="flex">
                                        <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-white/[0.06] bg-[var(--editor-surface-elevated)] px-4 py-3 text-[var(--editor-text)]">
                                            <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{msg.content}</p>
                                            <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5">
                                                <button
                                                    type="button"
                                                    onClick={onUndoLastAction}
                                                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[hsl(var(--primary))] transition-all hover:bg-[hsl(var(--primary)/0.1)] hover:text-[hsl(var(--primary))]"
                                                >
                                                    <RotateCcw className="h-3 w-3" />
                                                    {ac.undo}
                                                </button>
                                                {msg.createdAt ? (
                                                    <span className="text-[10px] text-white/40">{msg.createdAt}</span>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                )
                            }

                            return (
                                <div key={msg.id} className="flex">
                                    <div className={cn(
                                        'rounded-2xl rounded-bl-md border border-white/[0.06] bg-[var(--editor-surface-elevated)] text-[var(--editor-text)]',
                                        compact ? 'max-w-[85%] px-4 py-3' : 'max-w-[85%] px-4 py-3',
                                    )}>
                                        <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{msg.content}</p>
                                        {msg.createdAt ? (
                                            <p className="mt-1.5 text-[10px] text-white/40">{msg.createdAt}</p>
                                        ) : null}
                                    </div>
                                </div>
                            )
                        })}

                        <div ref={messagesEndRef} />
                    </div>
                </div>

                <div className={cn('border-t border-white/[0.06] bg-[rgb(var(--editor-bg-rgb)/0.8)] backdrop-blur-sm', compact ? 'px-4 pb-4 pt-3' : 'px-4 pb-4 pt-3')}>
                    <div className="group rounded-xl border border-white/[0.08] bg-[rgb(var(--editor-surface-elevated-rgb)/0.8)] px-3 py-2.5 transition-all focus-within:border-cyan-400/40 focus-within:bg-[var(--editor-surface-elevated)] focus-within:shadow-[0_0_0_1px_hsl(var(--info)/0.1)]">
                        {blockContext && (
                            <div className="mb-2 flex items-center gap-1.5">
                                <span className="flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300 border border-amber-500/20">
                                    <Sparkles className="h-3 w-3" />
                                    {blockContext.blockType.replace(/-/g, ' ')}
                                </span>
                                <button
                                    type="button"
                                    onClick={onBlockContextDismiss}
                                    className="rounded p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
                                    title="Remove context"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        )}
                        <div className="flex items-end gap-2">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        void handleSendChat()
                                    }
                                }}
                                placeholder={ac.inputPlaceholder}
                                aria-label="Chat message"
                                rows={1}
                                className="min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-[13px] leading-5 text-white placeholder:text-slate-500 shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                                disabled={isProcessing}
                            />
                            <button
                                type="button"
                                onClick={() => void handleSendChat()}
                                disabled={!input.trim() || isProcessing}
                                aria-label={ac.send}
                                className={cn(
                                    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all',
                                    input.trim() && !isProcessing
                                        ? 'bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--primary))] text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30'
                                        : 'bg-white/[0.06] text-slate-500',
                                    isProcessing && 'cursor-not-allowed',
                                )}
                            >
                                <Send className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between px-0.5">
                        <p className="flex items-center gap-1 text-[11px] text-slate-500">
                            <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 py-0.5 font-mono text-[10px]">Enter</kbd>
                            <span>{ac.send}</span>
                            <kbd className="ml-1 rounded border border-white/10 bg-white/[0.04] px-1 py-0.5 font-mono text-[10px]">Shift+Enter</kbd>
                            <span>{ac.newLine}</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export const AIChatPanel = memo(AIChatPanelInner)
