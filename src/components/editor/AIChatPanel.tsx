'use client'

import React, { memo, useEffect, useRef, useState } from 'react'
import { Send, Sparkles, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AIAction, BlockData, ThemeData } from '@/types/editor'

type ChatMessage = {
    id: string
    role: 'user' | 'assistant'
    content: string
    createdAt?: string
    undoable?: boolean
    isStreaming?: boolean
}

interface AIChatPanelProps {
    blocks: BlockData[]
    selectedBlock: number | null
    onAIAction: (action: AIAction) => Promise<void> | void
    onUndoLastAction: () => void
    siteName: string
    theme: ThemeData | undefined
    externalActivity?: {
        id: string
        content: string
    } | null
    compact?: boolean
}

function formatChatTime(date = new Date()) {
    return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    })
}

function AIChatPanelInner({
    blocks,
    selectedBlock,
    onAIAction,
    onUndoLastAction,
    siteName,
    theme,
    externalActivity,
    compact = false,
}: AIChatPanelProps) {
    const [input, setInput] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: 'Hello! What would you like to edit?',
            createdAt: formatChatTime(),
        },
    ])
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

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
            prev.map(message => (message.id === messageId ? { ...message, ...next } : message)),
        )
    }

    const handleAIError = (messageId: string, message: string) => {
        updateAssistantMessage(messageId, {
            content: `❌ ${message}`,
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
                updateAssistantMessage(messageId, { content: payload.message || 'AI dang xu ly...' })
                return
            }

            if (eventName === 'action') {
                await onAIAction(payload as AIAction)
                return
            }

            if (eventName === 'done') {
                updateAssistantMessage(messageId, {
                    content: payload.message || 'Da ap dung thay doi cho website.',
                    isStreaming: false,
                    undoable: true,
                })
                return
            }

            if (eventName === 'error') {
                handleAIError(messageId, payload.error || 'AI editing failed')
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

        const userMsg = input.trim()
        const assistantMessageId = `${Date.now()}-assistant`

        setInput('')
        setMessages(prev => [
            ...prev,
            { id: Date.now().toString(), role: 'user', content: userMsg },
            {
                id: assistantMessageId,
                role: 'assistant',
                content: 'AI dang doc yeu cau cua ban...',
                createdAt: formatChatTime(),
                isStreaming: true,
            },
        ])
        setIsProcessing(true)

        try {
            const currentBlock = selectedBlock !== null ? (blocks[selectedBlock] || null) : null
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
                }),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                handleAIError(assistantMessageId, data.error || 'Failed to edit website')
                return
            }

            const isStream = res.headers.get('content-type')?.includes('text/event-stream')

            if (isStream) {
                await readSSEStream(res, assistantMessageId)
                return
            }

            const data = await res.json()
            await onAIAction(data as AIAction)
            updateAssistantMessage(assistantMessageId, {
                content: data.message || 'Da ap dung thay doi cho website.',
                isStreaming: false,
                undoable: true,
            })
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error'
            handleAIError(assistantMessageId, message)
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <div className={cn('flex h-full flex-col', compact && 'bg-[#0F172A]')}>
            {!compact ? (
                <div className="border-b border-white/10 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-white">AI Chat</p>
                            <p className="mt-1 text-xs text-gray-500">
                                Ask AI to update layout, content, and theme in realtime.
                            </p>
                        </div>
                        <Sparkles className="h-4 w-4 text-cyan-400" />
                    </div>
                </div>
            ) : null}

            <div role="tabpanel" className="flex min-h-0 flex-1 flex-col">
                <div
                    className={cn(
                        'flex-1 overflow-y-auto',
                        compact ? 'px-4 pb-5 pt-6' : 'p-4',
                    )}
                    role="log"
                    aria-label="AI chat messages"
                >
                    <div className="space-y-3">
                        {messages.map(msg => (
                            <div key={msg.id} className={cn('flex gap-2', msg.role === 'user' ? 'flex-row-reverse' : '')}>
                                {msg.role === 'assistant' && !compact ? (
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-500">
                                        <Sparkles className="h-3.5 w-3.5 text-white" />
                                    </div>
                                ) : null}

                                <div
                                    className={cn(
                                        'max-w-[88%] rounded-2xl px-3 py-3 text-sm leading-relaxed',
                                        msg.role === 'user'
                                            ? 'rounded-br-md bg-blue-600 text-white'
                                            : compact
                                                ? 'rounded-[18px] border border-white/[0.04] bg-[#1E293B] text-[#F8FAFC] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]'
                                                : 'rounded-bl-md border border-white/5 bg-[#1E293B] text-gray-300',
                                        compact && msg.role === 'assistant' && 'max-w-[260px] px-4 py-3.5',
                                    )}
                                >
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                    {compact && msg.role === 'assistant' && msg.createdAt ? (
                                        <p className="mt-2 text-xs text-slate-400">{msg.createdAt}</p>
                                    ) : null}
                                    {msg.undoable && msg.role === 'assistant' ? (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={onUndoLastAction}
                                            className="mt-3 h-7 rounded-full px-3 text-[11px]"
                                        >
                                            Undo change
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        ))}

                        {isProcessing ? (
                            <div className="flex gap-2" role="status" aria-label="AI is thinking">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-500">
                                    <Sparkles className="h-3.5 w-3.5 text-white" />
                                </div>
                                <div className="rounded-2xl rounded-bl-md border border-white/5 bg-[#1E293B] px-3 py-3">
                                    <div className="flex gap-1">
                                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500" style={{ animationDelay: '0ms' }} />
                                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500" style={{ animationDelay: '150ms' }} />
                                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        <div ref={messagesEndRef} />
                    </div>
                </div>

                <div className={cn('border-t border-white/10', compact ? 'bg-[rgba(11,17,32,0.5)] px-4 pb-4 pt-4' : 'p-4')}>
                    <div className={cn('mb-3 flex gap-2', compact ? 'overflow-x-auto pb-1' : 'flex-wrap')}>
                        <button
                            type="button"
                            onClick={() => setInput('Change web color to mint green')}
                            className={cn(
                                'rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-white/10',
                                compact && 'shrink-0 border-white/[0.04] bg-[#1E293B] text-slate-400',
                            )}
                        >
                            {compact ? '💡 Change website color' : 'Change web color'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setInput('Add a new section with testimonials')}
                            className={cn(
                                'rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-white/10',
                                compact && 'shrink-0 border-white/[0.04] bg-[#1E293B] text-slate-400',
                            )}
                        >
                            {compact ? '➕ Add section' : 'Add section'}
                        </button>
                    </div>

                    <div className={cn(
                        'rounded-2xl border border-white/10 bg-[#111827] p-3 transition-colors focus-within:border-cyan-500/40',
                        compact && 'border-white/[0.04] bg-[#1E293B] px-4 py-3.5',
                    )}>
                        <div className="flex items-end gap-2">
                            <textarea
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        void handleSendChat()
                                    }
                                }}
                                placeholder={compact ? "Enter command... (e.g., 'Change website color')" : "Enter command... (For example: 'Change the hero heading')"}
                                aria-label="Chat message"
                                className={cn(
                                    'min-h-[84px] flex-1 resize-none bg-transparent text-sm text-white placeholder:text-gray-600 outline-none',
                                    compact && 'min-h-[38px] text-[14px] leading-6 text-slate-200 placeholder:text-slate-500',
                                )}
                                disabled={isProcessing}
                            />
                            <Button
                                type="button"
                                size="icon"
                                onClick={() => void handleSendChat()}
                                disabled={!input.trim() || isProcessing}
                                className={cn(
                                    'shrink-0 rounded-xl',
                                    compact && 'h-9 w-9 rounded-[14px] border-0 bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] text-white shadow-none hover:opacity-95',
                                )}
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <p className={cn('mt-3 text-[11px] text-gray-500', compact && 'flex items-center gap-1.5 text-slate-400')}>
                        {compact ? <WandSparkles className="h-3 w-3" /> : null}
                        Press Enter to send, Shift+Enter for a new line
                    </p>
                </div>
            </div>
        </div>
    )
}

export const AIChatPanel = memo(AIChatPanelInner)
