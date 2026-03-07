'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────
type Message = {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
}

type BuilderStep = 'chat' | 'confirming' | 'generating' | 'done'

// ─── Chat Message Component ────────────────────────────────────────────
function ChatBubble({ message }: { message: Message }) {
    const isUser = message.role === 'user'

    return (
        <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
            {/* Avatar */}
            <div
                className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    isUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
                )}
            >
                {isUser ? 'N' : '✨'}
            </div>

            {/* Bubble */}
            <div
                className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                    isUser
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-[#1E293B] text-gray-200 rounded-bl-md border border-white/5'
                )}
            >
                <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
        </div>
    )
}

// ─── Progress Indicator ─────────────────────────────────────────────────
function GeneratingProgress({ step }: { step: string }) {
    return (
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
            <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                <div>
                    <p className="text-sm font-medium text-purple-300">{step}</p>
                    <div className="mt-2 h-1.5 w-48 rounded-full bg-gray-800">
                        <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-1000" />
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Main Page ──────────────────────────────────────────────────────────
export default function AIBuilderPage() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content:
                'Xin chào! 👋 Tôi sẽ giúp bạn tạo website chuyên nghiệp trong vài phút.\n\nHãy mô tả business của bạn — ví dụ:\n• Tên shop / công ty\n• Ngành nghề (F&B, thời trang, beauty...)\n• Sản phẩm / dịch vụ chính\n• Phong cách mong muốn',
            timestamp: new Date(),
        },
    ])
    const [input, setInput] = useState('')
    const [step, setStep] = useState<BuilderStep>('chat')
    const [isLoading, setIsLoading] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Auto-scroll to latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    const handleSend = async () => {
        if (!input.trim() || isLoading) return

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        }

        setMessages((prev) => [...prev, userMessage])
        setInput('')
        setIsLoading(true)

        // TODO: Replace with real AI API call (Vercel AI SDK useChat)
        // For now, simulate AI response
        setTimeout(() => {
            const aiResponse: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content:
                    'Tuyệt vời! Tôi sẽ tạo website cho bạn với:\n\n' +
                    '🎨 **Phong cách:** Modern & Clean\n' +
                    '📄 **Trang:** Home, About, Contact\n' +
                    '🧩 **Sections:** Hero banner, About, Gallery, Contact form, Footer\n\n' +
                    'Bạn có muốn tôi bắt đầu tạo ngay không? (Gõ "Tạo ngay" để bắt đầu)',
                timestamp: new Date(),
            }
            setMessages((prev) => [...prev, aiResponse])
            setStep('confirming')
            setIsLoading(false)
        }, 1500)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div className="flex h-screen bg-[#0B1120]">
            {/* ─── Left: Chat Panel ─────────────────────────────────────── */}
            <div className="flex w-full max-w-[480px] flex-col border-r border-white/10">
                {/* Header */}
                <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/onboarding"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-purple-400" />
                            <span className="text-sm font-semibold text-white">AI Builder</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs text-gray-400">
                        Step {step === 'chat' ? '1' : step === 'confirming' ? '2' : '3'}/3
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg) => (
                        <ChatBubble key={msg.id} message={msg} />
                    ))}

                    {isLoading && (
                        <div className="flex gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-xs">
                                ✨
                            </div>
                            <div className="rounded-2xl rounded-bl-md border border-white/5 bg-[#1E293B] px-4 py-3">
                                <div className="flex gap-1">
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500" style={{ animationDelay: '0ms' }} />
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500" style={{ animationDelay: '150ms' }} />
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'generating' && (
                        <GeneratingProgress step="Đang tạo Hero section..." />
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t border-white/10 p-4">
                    <div className="flex items-center gap-2 rounded-xl bg-[#1E293B] pr-2 border border-white/10 focus-within:border-blue-500/50 transition-colors">
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Mô tả business của bạn..."
                            className="flex-1 bg-transparent px-4 py-3 text-sm text-white placeholder-gray-500 outline-none"
                            disabled={isLoading || step === 'generating'}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className="rounded-lg bg-blue-600 p-2 text-white transition-colors hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <Send className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── Right: Live Preview ──────────────────────────────────── */}
            <div className="flex-1 flex flex-col">
                {/* Preview header */}
                <div className="flex h-14 items-center justify-between border-b border-white/10 px-6">
                    <span className="text-sm text-gray-400">Live Preview</span>
                    {step === 'generating' && (
                        <span className="flex items-center gap-2 text-xs text-purple-400">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Generating...
                        </span>
                    )}
                </div>

                {/* Preview content */}
                <div className="flex-1 flex items-center justify-center bg-[#0F172A]">
                    {step === 'chat' || step === 'confirming' ? (
                        <div className="text-center">
                            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-white/5">
                                <Sparkles className="h-10 w-10 text-gray-700" />
                            </div>
                            <p className="mt-4 text-sm text-gray-600">
                                Website preview sẽ xuất hiện ở đây
                            </p>
                            <p className="mt-1 text-xs text-gray-700">
                                Mô tả business → AI generate → Preview realtime
                            </p>
                        </div>
                    ) : (
                        // TODO: iframe preview sẽ render website thật ở đây
                        <div className="h-full w-full bg-white">
                            <div className="p-8 text-center text-gray-400">
                                Website preview loading...
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
