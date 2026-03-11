'use client'

import { useRef, useEffect } from 'react'
import { useChat } from 'ai/react'
import { X, Send, Bot, Sparkles } from 'lucide-react'
import { useAssistantStore } from '@/store/assistantStore'
import { MessageBubble, TypingIndicator } from './MessageBubble'
import { QuickActions } from './QuickActions'
import { cn } from '@/lib/utils'

export function AssistantPanel() {
    const { isOpen, close } = useAssistantStore()
    const scrollRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    const {
        messages,
        input,
        handleInputChange,
        handleSubmit,
        isLoading,
        setInput,
        append,
    } = useChat({
        api: '/api/assistant',
        id: 'assistant-bot',
    })

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isLoading])

    // Focus input when panel opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 300)
        }
    }, [isOpen])

    const handleQuickAction = (question: string) => {
        append({ role: 'user', content: question })
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (input.trim() && !isLoading) {
                handleSubmit(e as unknown as React.FormEvent)
            }
        }
    }

    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300',
                    isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                )}
                onClick={close}
            />

            {/* Panel */}
            <div
                id="assistant-bot-panel"
                className={cn(
                    'fixed right-0 top-0 z-50 flex h-full w-full max-w-[420px] flex-col',
                    'border-l border-white/10 bg-[#0B1120]/95 backdrop-blur-xl',
                    'shadow-2xl shadow-black/50',
                    'transition-transform duration-300 ease-out',
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                )}
            >
                {/* ── Header ── */}
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-400 shadow-lg shadow-cyan-500/20">
                            <Bot className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-white">PrimeBot</h2>
                            <p className="text-[11px] text-cyan-400/80">Team Assistant</p>
                        </div>
                    </div>
                    <button
                        onClick={close}
                        className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
                        aria-label="Close assistant"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* ── Messages ── */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto overscroll-contain scroll-smooth"
                >
                    {messages.length === 0 ? (
                        /* Empty state */
                        <div className="flex h-full flex-col items-center justify-center px-8">
                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-400/20 border border-cyan-500/20">
                                <Sparkles className="h-8 w-8 text-cyan-400" />
                            </div>
                            <h3 className="mb-2 text-base font-semibold text-white">
                                Xin chào! 👋
                            </h3>
                            <p className="mb-6 text-center text-sm text-gray-400 leading-relaxed">
                                Em là PrimeBot, trợ lý AI của team.
                                <br />
                                Hỏi em bất kỳ điều gì về dự án PrimeWeb!
                            </p>
                            <QuickActions onSelect={handleQuickAction} disabled={isLoading} />
                        </div>
                    ) : (
                        <div className="py-4">
                            {messages.map((message) => (
                                <MessageBubble
                                    key={message.id}
                                    role={message.role as 'user' | 'assistant'}
                                    content={message.content}
                                />
                            ))}
                            {isLoading && <TypingIndicator />}
                        </div>
                    )}
                </div>

                {/* ── Quick actions (when has messages) ── */}
                {messages.length > 0 && (
                    <div className="border-t border-white/5">
                        <QuickActions onSelect={handleQuickAction} disabled={isLoading} />
                    </div>
                )}

                {/* ── Input area ── */}
                <div className="border-t border-white/10 p-4">
                    <form
                        onSubmit={handleSubmit}
                        className="flex items-end gap-2"
                    >
                        <div className="relative flex-1">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                placeholder="Hỏi PrimeBot..."
                                rows={1}
                                className={cn(
                                    'w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3',
                                    'text-sm text-white placeholder:text-gray-500',
                                    'focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30',
                                    'transition-colors duration-200',
                                    'max-h-32 scrollbar-thin scrollbar-thumb-white/10'
                                )}
                                style={{
                                    height: 'auto',
                                    minHeight: '44px',
                                }}
                                onInput={(e) => {
                                    const target = e.target as HTMLTextAreaElement
                                    target.style.height = 'auto'
                                    target.style.height = Math.min(target.scrollHeight, 128) + 'px'
                                }}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className={cn(
                                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                                'bg-gradient-to-br from-cyan-500 to-teal-400',
                                'text-white shadow-lg shadow-cyan-500/20',
                                'transition-all duration-200',
                                'hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-105',
                                'active:scale-95',
                                'disabled:opacity-40 disabled:shadow-none disabled:hover:scale-100 disabled:cursor-not-allowed'
                            )}
                            aria-label="Send message"
                        >
                            <Send className="h-4 w-4" />
                        </button>
                    </form>
                    <p className="mt-2 text-center text-[10px] text-gray-600">
                        PrimeBot có thể mắc sai sót. Kiểm tra thông tin quan trọng.
                    </p>
                </div>
            </div>
        </>
    )
}
