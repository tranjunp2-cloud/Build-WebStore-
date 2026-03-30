'use client'


import React, { memo, useEffect, useRef, useState } from 'react'
import { RotateCcw, Send, WandSparkles } from 'lucide-react'
import { AddSectionPromptChips } from './AddSectionPromptChips'
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
            { id: Date.now().toString(), role: 'user', content: userMsg, createdAt: formatChatTime() },
            {
                id: assistantMessageId,
                role: 'assistant',
                content: 'AI is drafting...',
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
        <div className="flex h-full flex-col bg-[#0F172A]">
            <div role="tabpanel" className="flex min-h-0 flex-1 flex-col">
                <div
                    className={cn(
                        'flex-1 overflow-y-auto',
                        compact ? 'px-4 pb-5 pt-6' : 'px-4 pb-4 pt-6',
                    )}
                    role="log"
                    aria-label="AI chat messages"
                >
                    <div className="space-y-4">
                        {messages.map(msg => {
                            if (msg.role === 'user') {
                                return (
                                    <div key={msg.id} className="flex justify-end">
                                        <div className="w-fit max-w-[160px] rounded-2xl bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] px-4 pt-3 pb-3 text-white">
                                            <p className="whitespace-pre-wrap text-sm leading-[22.75px]">{msg.content}</p>
                                            {msg.createdAt ? (
                                                <p className="mt-2 text-xs text-white/60">{msg.createdAt}</p>
                                            ) : null}
                                        </div>
                                    </div>
                                )
                            }

                            if (msg.isStreaming) {
                                return (
                                    <div key={msg.id} className="flex">
                                        <div className="rounded-2xl border border-[rgba(59,130,246,0.04)] bg-[#1E293B] px-4 py-[13px] text-slate-400">
                                            <div className="flex items-center gap-2">
                                                <div className="flex gap-1">
                                                    <span className="h-2 w-2 rounded-full bg-[#2DD4BF]" />
                                                    <span className="h-2 w-2 rounded-full bg-[#2DD4BF]" />
                                                    <span className="h-2 w-2 rounded-full bg-[#2DD4BF]" />
                                                </div>
                                                <span className="text-xs leading-4">{msg.content || 'AI is drafting...'}</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            }

                            if (msg.undoable) {
                                return (
                                    <div key={msg.id} className="flex">
                                        <div className="w-[295px] rounded-2xl border border-[rgba(59,130,246,0.04)] bg-[#1E293B] px-4 py-3 text-[#F8FAFC]">
                                            <p className="whitespace-pre-wrap text-sm leading-[22.75px]">{msg.content}</p>
                                            <div className="mt-4 border-t border-white/10 pt-3">
                                                <button
                                                    type="button"
                                                    onClick={onUndoLastAction}
                                                    className="inline-flex items-center gap-2 text-xs font-medium text-[#2DD4BF] transition-colors hover:text-[#5EEAD4]"
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                    Undo this step
                                                </button>
                                            </div>
                                            {msg.createdAt ? (
                                                <p className="mt-2 text-xs text-white/60">{msg.createdAt}</p>
                                            ) : null}
                                        </div>
                                    </div>
                                )
                            }

                            return (
                                <div key={msg.id} className="flex">
                                    <div className={cn(
                                        'rounded-2xl border border-[rgba(59,130,246,0.04)] bg-[#1E293B] text-[#F8FAFC]',
                                        compact ? 'max-w-[260px] px-4 py-3.5' : 'w-[255px] px-[17px] py-[13px]',
                                    )}>
                                        <p className="whitespace-pre-wrap text-sm leading-[22.75px]">{msg.content}</p>
                                        {msg.createdAt ? (
                                            <p className="mt-2 text-xs text-white/60">{msg.createdAt}</p>
                                        ) : null}
                                    </div>
                                </div>
                            )
                        })}

                        <div ref={messagesEndRef} />
                    </div>
                </div>

                <div className={cn('border-t border-[rgba(59,130,246,0.07)] bg-[rgba(11,17,32,0.5)]', compact ? 'px-4 pb-4 pt-4' : 'px-4 pb-4 pt-4')}>
                    <div className={cn('mb-3 flex gap-2', compact ? 'overflow-x-auto pb-1' : 'items-center justify-between')}>
                        <button
                            type="button"
                            onClick={() => setInput('Change web color to mint green')}
                            className={cn(
                                'rounded-full border border-[rgba(59,130,246,0.04)] bg-[#1E293B] px-[13px] py-[7px] text-xs font-medium text-slate-400 transition-colors hover:bg-white/10',
                                compact && 'shrink-0 border-white/[0.04] bg-[#1E293B] text-slate-400',
                            )}
                        >
                            {compact ? '💡 Change website color' : 'Change web color'}
                        </button>
                        <AddSectionPromptChips
                            compact={compact}
                            desktopMinimal={!compact}
                            desktopLabelOverride="➕ Add section"
                            onPromptSelect={prompt => setInput(prompt)}
                        />
                    </div>

                    <div className={cn(
                        'relative mt-3 h-[66px] rounded-2xl border border-[rgba(59,130,246,0.04)] bg-[#1E293B] pl-4 pr-12 py-3 transition-colors focus-within:border-cyan-500/40',
                        compact && 'h-auto border-white/[0.04] bg-[#1E293B] px-4 py-3.5',
                    )}>
                        <textarea
                                value={input}
                                onChange={e => setInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    void handleSendChat()
                                }
                            }}
                            placeholder={compact ? "Enter command... (e.g., 'Change website color')" : "Enter command... (For example: 'Change..."}
                            aria-label="Chat message"
                            className={cn(
                                'mt-[1px] h-[40px] w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-sm leading-5 text-white placeholder:text-slate-500 shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0',
                                compact && 'min-h-[38px] max-h-none text-[14px] leading-6 text-slate-200 placeholder:text-slate-500',
                            )}
                            disabled={isProcessing}
                        />
                        <button
                            type="button"
                            onClick={() => void handleSendChat()}
                            disabled={!input.trim() || isProcessing}
                            className={cn(
                                'absolute right-3.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[12px] bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] text-white opacity-50 transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50',
                                input.trim() && !isProcessing && 'opacity-100',
                                compact && 'h-9 w-9 rounded-[14px]',
                            )}
                        >
                            <Send className="h-4 w-4" />
                        </button>
                    </div>

                    <p className="mt-3 flex items-center gap-1.5 text-[12px] text-slate-400">
                        <WandSparkles className="h-3 w-3" />
                        Press Enter to send, Shift+Enter to go to the next line
                    </p>
                </div>
            </div>
        </div>
    )
}

export const AIChatPanel = memo(AIChatPanelInner)
