'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, Send, ArrowLeft, Loader2, Check, ExternalLink, Eye, MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useBuilderStore, type Message } from '@/store/builderStore'
import { blockRegistry } from '@/blocks/registry'
import { BlockErrorBoundary } from '@/blocks/ErrorBoundary'
import type { ThemeConfig } from '@/blocks/types'
import BusinessInfoForm from '@/components/builder/BusinessInfoForm'

// ─── Chat Message Component ────────────────────────────────────────────
function ChatBubble({ message }: { message: Message }) {
    const isUser = message.role === 'user'
    return (
        <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
            <div className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                isUser ? 'bg-blue-600 text-white' : 'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
            )}>
                {isUser ? '👤' : '✨'}
            </div>
            <div className={cn(
                'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                isUser ? 'bg-blue-600 text-white rounded-br-md' : 'bg-[#1E293B] text-gray-200 rounded-bl-md border border-white/5'
            )}>
                <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
        </div>
    )
}

// ─── Progress Steps ─────────────────────────────────────────────────────
function GeneratingProgress({ progress }: { progress: { step: string; label: string; progress: number } }) {
    return (
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-3">
            <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                <span className="text-xs text-purple-300 font-medium">{progress.label || 'Processing...'}</span>
            </div>
            <div className="w-full bg-purple-500/10 rounded-full h-1.5">
                <div
                    className="bg-gradient-to-r from-purple-500 to-blue-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${progress.progress}%` }}
                />
            </div>
        </div>
    )
}

// ─── Live Preview Component ─────────────────────────────────────────────
function LivePreview({ blocks, theme }: { blocks: any[]; theme: ThemeConfig | null }) {
    if (!theme || blocks.length === 0) return null

    return (
        <div
            className="w-full min-h-full"
            style={{
                fontFamily: `'${theme.fontBody}', sans-serif`,
                background: theme.colorMode === 'dark' ? '#09090b' : '#ffffff',
                color: theme.colorMode === 'dark' ? '#fafafa' : '#09090b',
            }}
        >
            {blocks.map((block, index) => {
                if (!block.blockType) return null
                const BlockComponent = blockRegistry.getComponent(block.blockType)
                if (!BlockComponent) return null
                return (
                    <BlockErrorBoundary key={`${block.blockType}-${index}`} blockType={block.blockType}>
                        <BlockComponent block={block} theme={theme} />
                    </BlockErrorBoundary>
                )
            })}
        </div>
    )
}

// ─── Main Page ──────────────────────────────────────────────────────────
export default function AIBuilderPage() {
    const router = useRouter()
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Zustand store
    const {
        step, businessInfo,
        status, messages, blocks, theme, siteId, siteName, progress, error,
        addMessage, setStatus, addBlock, setTheme, setProgress, setSiteId, setSiteName, setError,
    } = useBuilderStore()

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, progress])

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    // SSE Stream consumer
    const startSSEGeneration = useCallback(async (extraInstructions?: string) => {
        setStatus('streaming')
        addMessage({ role: 'assistant', content: '🚀 Starting website creation...' })

        try {
            const res = await fetch('/api/ai/generate-site?stream=true', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessInfo,
                    extraInstructions,
                    language: 'vi',
                }),
                credentials: 'include',
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.error || 'Generation failed')
            }

            const reader = res.body?.getReader()
            const decoder = new TextDecoder()

            if (!reader) throw new Error('No response stream')

            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })

                // Parse SSE events from buffer
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                let currentEvent = ''
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.substring(7)
                    } else if (line.startsWith('data: ') && currentEvent) {
                        try {
                            const data = JSON.parse(line.substring(6))
                            handleSSEEvent(currentEvent, data)
                        } catch {
                            // Skip invalid JSON
                        }
                        currentEvent = ''
                    }
                }
            }
        } catch (err: any) {
            setError({ code: 'generation_failed', message: err.message, retryable: true })
            addMessage({ role: 'assistant', content: `❌ An error occurred: ${err.message}\n\nPlease try again!` })
        }
    }, [businessInfo, setStatus, addMessage, setError])

    const handleSSEEvent = useCallback((event: string, data: any) => {
        switch (event) {
            case 'step':
                setProgress(data)
                break
            case 'theme_set':
                setTheme(data.theme)
                break
            case 'block_complete':
                addBlock(data.block)
                break
            case 'seo_generated':
                // Store SEO meta (future use)
                break
            case 'error':
                setError(data)
                break
            case 'done':
                setStatus('done')
                setSiteId(data.siteId)
                setSiteName(data.siteName)
                addMessage({
                    role: 'assistant',
                    content:
                        `✅ Website **"${data.siteName}"** has been created successfully!\n\n` +
                        `📊 **${data.totalBlocks} sections** generated\n` +
                        `⏱️ **${Math.round(data.timeMs / 1000)}s** generation time\n\n` +
                        `You can view the Preview on the right, open the Editor to make changes, or Publish now!`,
                })
                break
        }
    }, [setProgress, setTheme, addBlock, setError, setStatus, setSiteId, setSiteName, addMessage])

    const handleSend = async () => {
        if (!input.trim() || isLoading || status === 'streaming') return

        const currentInput = input.trim()
        addMessage({ role: 'user', content: currentInput })
        setInput('')
        setIsLoading(false)

        // Start generation with optional extra instructions from user
        if (status === 'idle' || status === 'error') {
            startSSEGeneration(currentInput)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const isGenerating = status === 'streaming'
    const isDone = status === 'done'

    // Step 1: Show Business Info Form (after all hooks)
    if (step === 'info') {
        return <BusinessInfoForm />
    }

    return (
        <div className="flex h-screen bg-[#0B1120]">
            {/* ─── Left: Chat Panel ─────────────────────────────────────── */}
            <div className={cn(
                'flex flex-col border-r border-white/10 transition-all duration-300',
                showPreview ? 'hidden md:flex md:w-[480px]' : 'w-full md:max-w-[480px]'
            )}>
                {/* Header */}
                <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
                    <div className="flex items-center gap-3">
                        <Link href="/onboarding" className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-purple-400" />
                            <span className="text-sm font-semibold text-white">AI Builder</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Mobile: toggle preview */}
                        <button onClick={() => setShowPreview(true)} className="md:hidden rounded-lg p-1.5 text-gray-400 hover:bg-white/5">
                            <Eye className="h-4 w-4" />
                        </button>
                        <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs text-gray-400">
                            {blocks.length > 0 ? `${blocks.length} blocks` : 'Step 2/3'}
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map(msg => (
                        <ChatBubble key={msg.id} message={msg} />
                    ))}

                    {isLoading && (
                        <div className="flex gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-xs">✨</div>
                            <div className="rounded-2xl rounded-bl-md border border-white/5 bg-[#1E293B] px-4 py-3">
                                <div className="flex gap-1">
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500" style={{ animationDelay: '0ms' }} />
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500" style={{ animationDelay: '150ms' }} />
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {isGenerating && <GeneratingProgress progress={progress} />}

                    {/* Done state — action buttons */}
                    {isDone && siteId && (
                        <div className="flex flex-col gap-2 pt-2">
                            <Button onClick={() => router.push('/dashboard')} className="w-full">
                                🏠 Dashboard
                            </Button>
                            <Button variant="outline" onClick={() => router.push(`/editor/${siteId}`)} className="w-full">
                                <ExternalLink className="h-4 w-4" /> Open Editor
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
                                isGenerating ? 'Creating website...'
                                    : isDone ? 'Website created successfully!'
                                        : 'Type "Create now" or describe special requirements...'
                            }
                            className="flex-1 bg-transparent px-4 py-3 text-sm text-white placeholder-gray-500 outline-none"
                            disabled={isLoading || isGenerating || isDone}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading || isGenerating || isDone}
                            className="rounded-lg bg-blue-600 p-2 text-white transition-colors hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <Send className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── Right: Live Preview ──────────────────────────────────── */}
            <div className={cn(
                'flex-1 flex flex-col',
                showPreview ? 'flex' : 'hidden md:flex'
            )}>
                {/* Preview header */}
                <div className="flex h-14 items-center justify-between border-b border-white/10 px-6">
                    <div className="flex items-center gap-3">
                        {/* Mobile: back to chat */}
                        <button onClick={() => setShowPreview(false)} className="md:hidden rounded-lg p-1.5 text-gray-400 hover:bg-white/5">
                            <MessageSquare className="h-4 w-4" />
                        </button>
                        <span className="text-sm text-gray-400">Live Preview</span>
                    </div>
                    {isGenerating && (
                        <span className="flex items-center gap-2 text-xs text-purple-400">
                            <Loader2 className="h-3 w-3 animate-spin" /> Generating...
                        </span>
                    )}
                    {isDone && siteName && (
                        <span className="flex items-center gap-2 text-xs text-green-400">
                            <Check className="h-3 w-3" /> {siteName}
                        </span>
                    )}
                </div>

                {/* Preview content */}
                <div className="flex-1 overflow-y-auto bg-[#0F172A]">
                    {blocks.length > 0 && theme ? (
                        <LivePreview blocks={blocks} theme={theme} />
                    ) : isDone && siteId ? (
                        <div className="flex h-full items-center justify-center">
                            <div className="text-center space-y-6">
                                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-green-500/10 border-2 border-green-500/30">
                                    <Check className="h-12 w-12 text-green-400" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white">{siteName}</h2>
                                    <p className="mt-2 text-sm text-gray-400">Website created successfully</p>
                                </div>
                            </div>
                        </div>
                    ) : isGenerating ? (
                        <div className="flex h-full items-center justify-center">
                            <div className="text-center space-y-4">
                                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-purple-500/10 animate-pulse">
                                    <Sparkles className="h-10 w-10 text-purple-400" />
                                </div>
                                <p className="text-sm text-purple-300">Creating website...</p>
                                <p className="text-xs text-gray-600">Preview will appear when blocks are generated</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-full items-center justify-center">
                            <div className="text-center">
                                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-white/5">
                                    <Sparkles className="h-10 w-10 text-gray-700" />
                                </div>
                                <p className="mt-4 text-sm text-gray-600">Website preview will appear here</p>
                                <p className="mt-1 text-xs text-gray-700">Describe business → AI generates → Preview</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
