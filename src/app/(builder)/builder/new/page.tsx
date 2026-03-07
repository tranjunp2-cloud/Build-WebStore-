'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, ArrowLeft, Loader2, Check, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

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
            <div
                className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    isUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
                )}
            >
                {isUser ? '👤' : '✨'}
            </div>
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

// ─── Progress Steps ─────────────────────────────────────────────────────
const GENERATION_STEPS = [
    'Phân tích yêu cầu...',
    'Tạo Navigation & Hero...',
    'Tạo About & Features...',
    'Tạo Testimonials & Contact...',
    'Tạo Footer & SEO...',
    'Lưu vào database...',
]

function GeneratingProgress({ currentStep }: { currentStep: number }) {
    return (
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-3">
            {GENERATION_STEPS.map((stepText, i) => (
                <div key={i} className="flex items-center gap-3">
                    {i < currentStep ? (
                        <Check className="h-4 w-4 text-green-400" />
                    ) : i === currentStep ? (
                        <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                    ) : (
                        <div className="h-4 w-4 rounded-full border border-gray-600" />
                    )}
                    <span className={cn(
                        'text-xs',
                        i < currentStep ? 'text-green-400' :
                            i === currentStep ? 'text-purple-300 font-medium' :
                                'text-gray-600'
                    )}>
                        {stepText}
                    </span>
                </div>
            ))}
        </div>
    )
}

// ─── Main Page ──────────────────────────────────────────────────────────
export default function AIBuilderPage() {
    const router = useRouter()
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
    const [genStep, setGenStep] = useState(0)
    const [generatedSiteId, setGeneratedSiteId] = useState<string | null>(null)
    const [generatedSiteName, setGeneratedSiteName] = useState('')
    const [userPrompt, setUserPrompt] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, genStep])

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    // Simulate progress animation during generation
    useEffect(() => {
        if (step !== 'generating') return
        const interval = setInterval(() => {
            setGenStep(prev => {
                if (prev >= GENERATION_STEPS.length - 1) {
                    clearInterval(interval)
                    return prev
                }
                return prev + 1
            })
        }, 600)
        return () => clearInterval(interval)
    }, [step])

    const handleSend = async () => {
        if (!input.trim() || isLoading) return

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        }

        setMessages(prev => [...prev, userMessage])
        const currentInput = input.trim()
        setInput('')
        setIsLoading(true)

        if (step === 'chat') {
            // First message → AI confirms the plan
            setUserPrompt(currentInput)

            setTimeout(() => {
                const confirmMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content:
                        'Tuyệt vời! Tôi sẽ tạo website cho bạn với:\n\n' +
                        '📄 **Trang chính:** Homepage đầy đủ\n' +
                        '🧩 **7 Sections:** Navigation, Hero, About, Features, Testimonials, Contact, Footer\n' +
                        '🎨 **Theme:** Tự động theo ngành nghề\n' +
                        '📱 **Responsive:** Tối ưu mọi thiết bị\n\n' +
                        'Gõ **"Tạo ngay"** hoặc bất kỳ message nào để tôi bắt đầu! 🚀',
                    timestamp: new Date(),
                }
                setMessages(prev => [...prev, confirmMessage])
                setStep('confirming')
                setIsLoading(false)
            }, 800)
        } else if (step === 'confirming') {
            // Second message → Start generation
            setStep('generating')
            setGenStep(0)
            setIsLoading(false)

            try {
                const res = await fetch('/api/ai/generate-site', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: userPrompt }),
                    credentials: 'include',
                })

                const data = await res.json()

                if (!res.ok) {
                    throw new Error(data.error || 'Generation failed')
                }

                // Wait for progress animation to finish
                await new Promise(resolve => setTimeout(resolve, GENERATION_STEPS.length * 600 + 500))

                setGeneratedSiteId(data.siteId)
                setGeneratedSiteName(data.siteName)
                setStep('done')

                const doneMessage: Message = {
                    id: (Date.now() + 2).toString(),
                    role: 'assistant',
                    content:
                        `✅ Website **"${data.siteName}"** đã được tạo thành công!\n\n` +
                        `📊 **${data.blockCount} sections** đã được generate\n` +
                        `🎨 **Theme:** ${data.theme?.colorMode === 'dark' ? 'Dark' : 'Light'} mode\n\n` +
                        `Bạn có thể vào Dashboard để quản lý website hoặc mở Editor để chỉnh sửa.`,
                    timestamp: new Date(),
                }
                setMessages(prev => [...prev, doneMessage])

            } catch (error: any) {
                setStep('confirming')
                const errorMessage: Message = {
                    id: (Date.now() + 3).toString(),
                    role: 'assistant',
                    content: `❌ Đã xảy ra lỗi: ${error.message}\n\nVui lòng thử lại!`,
                    timestamp: new Date(),
                }
                setMessages(prev => [...prev, errorMessage])
            }
        }
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
                    {messages.map(msg => (
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
                        <GeneratingProgress currentStep={genStep} />
                    )}

                    {/* Done state — action buttons */}
                    {step === 'done' && generatedSiteId && (
                        <div className="flex flex-col gap-2 pt-2">
                            <Button
                                onClick={() => router.push('/dashboard')}
                                className="w-full"
                            >
                                🏠 Về Dashboard
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => router.push(`/editor/${generatedSiteId}`)}
                                className="w-full"
                            >
                                <ExternalLink className="h-4 w-4" />
                                Mở Editor
                            </Button>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t border-white/10 p-4">
                    <div className="flex items-center gap-2 rounded-xl bg-[#1E293B] pr-2 border border-white/10 focus-within:border-blue-500/50 transition-colors">
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                step === 'chat'
                                    ? 'Mô tả business của bạn...'
                                    : step === 'confirming'
                                        ? 'Gõ "Tạo ngay" để bắt đầu...'
                                        : 'Website đang được tạo...'
                            }
                            className="flex-1 bg-transparent px-4 py-3 text-sm text-white placeholder-gray-500 outline-none"
                            disabled={isLoading || step === 'generating' || step === 'done'}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading || step === 'generating' || step === 'done'}
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
                    {step === 'done' && generatedSiteName && (
                        <span className="flex items-center gap-2 text-xs text-green-400">
                            <Check className="h-3 w-3" />
                            {generatedSiteName}
                        </span>
                    )}
                </div>

                {/* Preview content */}
                <div className="flex-1 flex items-center justify-center bg-[#0F172A]">
                    {step === 'done' && generatedSiteId ? (
                        // Show success state with site summary
                        <div className="text-center space-y-6">
                            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-green-500/10 border-2 border-green-500/30">
                                <Check className="h-12 w-12 text-green-400" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">{generatedSiteName}</h2>
                                <p className="mt-2 text-sm text-gray-400">
                                    Website đã được tạo thành công với 7 sections
                                </p>
                            </div>
                            <div className="flex flex-col gap-3 mx-auto max-w-xs">
                                <Button
                                    size="lg"
                                    onClick={() => router.push('/dashboard')}
                                >
                                    Về Dashboard xem kết quả
                                </Button>
                            </div>
                        </div>
                    ) : step === 'generating' ? (
                        <div className="text-center space-y-4">
                            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-purple-500/10 animate-pulse">
                                <Sparkles className="h-10 w-10 text-purple-400" />
                            </div>
                            <p className="text-sm text-purple-300">
                                Đang tạo website...
                            </p>
                            <p className="text-xs text-gray-600">
                                AI đang generate {GENERATION_STEPS.length} sections cho bạn
                            </p>
                        </div>
                    ) : (
                        <div className="text-center">
                            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-white/5">
                                <Sparkles className="h-10 w-10 text-gray-700" />
                            </div>
                            <p className="mt-4 text-sm text-gray-600">
                                Website preview sẽ xuất hiện ở đây
                            </p>
                            <p className="mt-1 text-xs text-gray-700">
                                Mô tả business → AI generate → Preview
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
