'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
    Sparkles, Send, ArrowLeft, Loader2, Check, ExternalLink,
    Eye, MessageSquare, Globe, GripVertical, Lock, Plus, Zap,
    MousePointerClick
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useBuilderStore, type Message, type BusinessInfo } from '@/store/builderStore'
import { blockRegistry } from '@/blocks/registry'
import { BlockErrorBoundary } from '@/blocks/ErrorBoundary'
import type { ThemeConfig } from '@/blocks/types'
import BusinessInfoForm from '@/components/builder/BusinessInfoForm'
import { CongratsModal } from '@/components/builder/CongratsModal'
import { Reorder } from 'framer-motion'

// Types
import type { BusinessInfoInput } from '@/lib/ai/system-prompt'

// ─── Chat Message Component ────────────────────────────────────────────
function ChatBubble({ message }: { message: Message }) {
    const isUser = message.role === 'user'
    return (
        <div className={cn('flex gap-3 items-end', isUser ? 'flex-row-reverse' : 'flex-row')}>
            {/* Avatar */}
            <div className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-bold shadow-md',
                isUser
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                    : 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white ring-2 ring-purple-500/20'
            )}>
                {isUser ? '👤' : '✨'}
            </div>

            {/* Bubble */}
            <div className={cn(
                'max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg',
                isUser
                    ? 'rounded-br-sm bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-blue-900/30'
                    : 'rounded-bl-sm border border-white/[0.06] bg-white/[0.04] text-white/80 backdrop-blur-sm shadow-black/20'
            )}>
                <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
        </div>
    )
}

// ─── Typing Dots ────────────────────────────────────────────────────────
function TypingDots() {
    return (
        <div className="flex gap-3 items-end">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-xs font-bold ring-2 ring-purple-500/20">✨</div>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-white/[0.06] bg-white/[0.04] px-4 py-3.5 backdrop-blur-sm">
                {[0, 150, 300].map(delay => (
                    <span
                        key={delay}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/30"
                        style={{ animationDelay: `${delay}ms` }}
                    />
                ))}
            </div>
        </div>
    )
}

// ─── Progress Steps ─────────────────────────────────────────────────────
function GeneratingProgress({ progress }: { progress: { step: string; label: string; progress: number } }) {
    return (
        <div className="rounded-2xl border border-purple-500/15 bg-purple-500/[0.06] p-4 space-y-3 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="relative flex h-7 w-7 shrink-0 items-center justify-center">
                        <div className="absolute inset-0 animate-ping rounded-full bg-purple-500/20" />
                        <Loader2 className="relative h-4 w-4 animate-spin text-purple-400" />
                    </div>
                    <span className="text-xs font-medium text-purple-300">{progress.label || 'Processing...'}</span>
                </div>
                <span className="text-[10px] font-semibold tabular-nums text-purple-400/70">{progress.progress}%</span>
            </div>
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-purple-500/10">
                <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-700 ease-out"
                    style={{ width: `${progress.progress}%` }}
                />
                {/* Shimmer */}
                <div
                    className="absolute inset-y-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-all duration-700 ease-out"
                    style={{ width: `${Math.min(progress.progress + 15, 100)}%`, left: 0 }}
                />
            </div>
        </div>
    )
}

// ─── Live Preview Component ─────────────────────────────────────────────
function LivePreview({ blocks, theme, onReorder }: { blocks: any[]; theme: ThemeConfig | null; onReorder?: (newOrder: any[]) => void }) {
    if (!theme || blocks.length === 0) return null

    return (
        <Reorder.Group
            axis="y"
            values={blocks}
            onReorder={(newOrder) => onReorder?.(newOrder)}
            className="w-full min-h-full"
            style={{
                fontFamily: `'${theme.fontBody}', sans-serif`,
                background: theme.colorMode === 'dark' ? '#09090b' : '#ffffff',
                color: theme.colorMode === 'dark' ? '#fafafa' : '#09090b',
            }}
        >
            {blocks.map((block) => {
                if (!block.blockType) return null
                const BlockComponent = blockRegistry.getComponent(block.blockType)
                if (!BlockComponent) return null
                const isFixed = block.blockType === 'navigation' || block.blockType === 'footer'

                return (
                    <Reorder.Item
                        key={block._id}
                        value={block}
                        dragListener={!isFixed}
                        className="relative group/block"
                    >
                        {/* Drag Handle or Lock */}
                        <div className="absolute left-3 top-3 z-40 opacity-0 group-hover/block:opacity-100 transition-opacity duration-200">
                            {isFixed ? (
                                <div className="flex items-center gap-1.5 rounded-lg bg-black/40 px-2 py-1.5 backdrop-blur-sm border border-white/10 text-white/40 cursor-not-allowed text-[10px]">
                                    <Lock className="h-3 w-3" />
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 rounded-lg bg-blue-600/90 px-2 py-1.5 backdrop-blur-sm shadow-lg cursor-grab active:cursor-grabbing text-white text-[10px] font-medium border border-blue-500">
                                    <GripVertical className="h-3 w-3" />
                                </div>
                            )}
                        </div>

                        {/* Drag border */}
                        <div className="absolute inset-0 pointer-events-none border-2 border-transparent group-active/block:border-blue-500/40 group-active/block:bg-blue-500/5 transition-all z-30 rounded-sm" />

                        <BlockErrorBoundary blockType={block.blockType}>
                            <BlockComponent block={block} theme={theme} />
                        </BlockErrorBoundary>
                    </Reorder.Item>
                )
            })}
        </Reorder.Group>
    )
}

// ─── Main Page ──────────────────────────────────────────────────────────
export default function AIBuilderPage() {
    const router = useRouter()
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const [isPublishing, setIsPublishing] = useState(false)
    const [publishedUrl, setPublishedUrl] = useState('')
    const [showCongrats, setShowCongrats] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Zustand store
    const {
        step, businessInfo,
        status, messages, blocks, theme, siteId, siteName, progress, error,
        addMessage, setStatus, addBlock, setTheme, setProgress, setSiteId, setSiteName, setError, setBusinessInfo, setBlocks,
    } = useBuilderStore()

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, progress])

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // FR-06: Auto-save draft to DB when blocks or theme change
    useEffect(() => {
        if (!siteId || status !== 'done' || blocks.length === 0 || !theme) return

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

        saveTimeoutRef.current = setTimeout(async () => {
            try {
                await fetch(`/api/sites/${siteId}/save`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ blocks, theme }),
                })
                console.log('[Auto-save] Draft saved successfully')
            } catch (err) {
                console.error('[Auto-save] Failed to save draft:', err)
            }
        }, 2000)

        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
        }
    }, [blocks, theme, siteId, status])

    // SSE Stream consumer
    const startSSEGeneration = useCallback(async (info: BusinessInfo, extraInstructions?: string) => {
        setStatus('streaming')
        addMessage({ role: 'assistant', content: '🚀 Starting website creation...' })

        try {
            const res = await fetch('/api/ai/generate-site?stream=true', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessInfo: info,
                    extraInstructions,
                    language: info.language || 'auto',
                }),
                credentials: 'include',
            })

            if (!res.ok) {
                const errorData = await res.json()
                let errorMsg = 'Generation failed'
                if (errorData.error) {
                    if (typeof errorData.error === 'string') {
                        errorMsg = errorData.error
                    } else if (errorData.error.details) {
                        errorMsg = typeof errorData.error.details === 'string'
                            ? errorData.error.details
                            : JSON.stringify(errorData.error.details)
                    } else {
                        errorMsg = JSON.stringify(errorData.error)
                    }
                }
                throw new Error(errorMsg)
            }

            const reader = res.body?.getReader()
            const decoder = new TextDecoder()

            if (!reader) throw new Error('No response stream')

            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })

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
    }, [setStatus, addMessage, setError])

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
        if (status === 'idle' || status === 'error') {
            if (businessInfo) startSSEGeneration(businessInfo, currentInput)
        }
    }

    const handlePublish = async () => {
        if (!siteId) return
        setIsPublishing(true)
        try {
            const saveRes = await fetch(`/api/sites/${siteId}/save`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ blocks, theme }),
            })
            if (!saveRes.ok) {
                const saveData = await saveRes.json()
                throw new Error(saveData.error || 'Failed to save website layout')
            }
            const res = await fetch(`/api/sites/${siteId}/publish`, { method: 'PATCH' })
            const data = await res.json()
            if (data.success) {
                const publishedSite = data.data
                setPublishedUrl(publishedSite.url || `https://${publishedSite.domain || siteId}.primeweb.app`)
                setShowCongrats(true)
            } else {
                toast.error(data.error?.message || 'Failed to publish site')
            }
        } catch (error: any) {
            toast.error(error.message || 'Network error during publish')
        } finally {
            setIsPublishing(false)
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

    const handleGenerateStart = (info: BusinessInfo) => {
        setBusinessInfo(info)
        startSSEGeneration(info)
    }

    // Step 1: Show Business Info Form
    if (step === 'info') {
        return <BusinessInfoForm onSubmit={handleGenerateStart} isGenerating={isGenerating} />
    }

    return (
        <div className="flex h-screen overflow-hidden bg-[#080E1E]">
            {/* Ambient gradient background */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-purple-600/5 blur-[100px]" />
                <div className="absolute right-0 top-1/2 h-80 w-80 rounded-full bg-blue-600/5 blur-[80px]" />
            </div>

            {/* ─── Left: Chat Panel ─────────────────────────────────────── */}
            <div className={cn(
                'relative z-10 flex flex-col border-r border-white/[0.06] transition-all duration-300',
                showPreview ? 'hidden md:flex md:w-[440px]' : 'w-full md:w-[440px]'
            )}>
                {/* Header */}
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2.5">
                        <Link href="/onboarding" className="rounded-xl p-1.5 text-white/30 hover:bg-white/[0.06] hover:text-white/70 transition-colors">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <div className="h-5 w-px bg-white/10" />
                        <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20">
                                <Sparkles className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span className="text-sm font-semibold text-white/90">AI Builder</span>
                        </div>

                        {/* New Site button */}
                        {siteId && (
                            <button
                                onClick={() => {
                                    if (confirm('Start a new website? The current draft will be removed from this session.')) {
                                        useBuilderStore.getState().reset()
                                        router.push('/builder/new')
                                    }
                                }}
                                className="ml-1 flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] font-medium text-white/30 hover:bg-white/[0.08] hover:text-white/70 transition-all"
                            >
                                <Plus className="h-3 w-3" /> New
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Mobile toggle */}
                        <button onClick={() => setShowPreview(true)} className="md:hidden rounded-xl p-1.5 text-white/30 hover:bg-white/[0.06] hover:text-white/70 transition-colors">
                            <Eye className="h-4 w-4" />
                        </button>
                        {/* Status chip */}
                        <div className={cn(
                            'flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-all',
                            isGenerating
                                ? 'border-purple-500/30 bg-purple-500/10 text-purple-400'
                                : isDone
                                    ? 'border-green-500/30 bg-green-500/10 text-green-400'
                                    : 'border-white/[0.06] bg-white/[0.03] text-white/30'
                        )}>
                            {isGenerating
                                ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating...</>
                                : isDone
                                    ? <><Check className="h-3 w-3" /> {blocks.length} blocks</>
                                    : <><Zap className="h-3 w-3" /> Ready</>
                            }
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
                    {messages.map(msg => (
                        <ChatBubble key={msg.id} message={msg} />
                    ))}

                    {isLoading && <TypingDots />}

                    {isGenerating && <GeneratingProgress progress={progress} />}

                    {/* Done state — action buttons */}
                    {isDone && siteId && (
                        <div className="space-y-2 pt-1">
                            {/* Primary — Publish */}
                            <button
                                onClick={handlePublish}
                                disabled={isPublishing}
                                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3.5 text-sm font-semibold text-white shadow-xl shadow-blue-600/20 transition-all duration-300 hover:shadow-blue-600/35 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                                <span className="relative flex items-center gap-2">
                                    {isPublishing ? (
                                        <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" /> Publishing...</>
                                    ) : (
                                        <><Globe className="h-4 w-4" /> Publish & Go Live</>
                                    )}
                                </span>
                            </button>
                            {/* Secondary — Editor */}
                            <button
                                onClick={() => router.push(`/editor/${siteId}`)}
                                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/50 transition-all hover:border-white/[0.15] hover:bg-white/[0.07] hover:text-white/80"
                            >
                                <ExternalLink className="h-4 w-4" /> Continue in Editor
                            </button>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="shrink-0 border-t border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm">
                    <div className={cn(
                        'flex items-center gap-2 rounded-2xl border bg-white/[0.04] pr-2 pl-4 transition-all duration-200',
                        isDone
                            ? 'border-white/[0.05] opacity-50'
                            : 'border-white/[0.08] focus-within:border-blue-500/30 focus-within:bg-white/[0.06]'
                    )}>
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                isGenerating ? 'AI is creating your website...'
                                    : isDone ? 'Website created! Publish or open Editor.'
                                        : 'Type extra instructions or hit Generate...'
                            }
                            className="flex-1 bg-transparent py-3.5 text-sm text-white/80 placeholder-white/20 outline-none"
                            disabled={isLoading || isGenerating || isDone}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading || isGenerating || isDone}
                            className="rounded-xl bg-blue-600 p-2 text-white transition-all duration-200 hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-600/30 disabled:opacity-20 disabled:cursor-not-allowed"
                        >
                            <Send className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── Right: Live Preview ──────────────────────────────────── */}
            <div className={cn(
                'relative z-10 flex flex-1 flex-col',
                showPreview ? 'flex' : 'hidden md:flex'
            )}>
                {/* Preview header */}
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-5 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        {/* Mobile: back to chat */}
                        <button onClick={() => setShowPreview(false)} className="md:hidden rounded-xl p-1.5 text-white/30 hover:bg-white/[0.06] hover:text-white/70 transition-colors">
                            <MessageSquare className="h-4 w-4" />
                        </button>
                        <span className="text-sm font-medium text-white/40">Live Preview</span>
                        {isDone && blocks.length > 0 && (
                            <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/25">
                                <MousePointerClick className="h-3 w-3" />
                                Drag to reorder
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {isGenerating && (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-purple-400">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Generating...</span>
                            </span>
                        )}
                        {isDone && siteName && (
                            <span className="flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
                                <Check className="h-3 w-3" />
                                {siteName}
                            </span>
                        )}
                    </div>
                </div>

                {/* Preview content */}
                <div className="flex-1 overflow-y-auto bg-[#06090F]">
                    {blocks.length > 0 && theme ? (
                        <LivePreview blocks={blocks} theme={theme} onReorder={setBlocks} />
                    ) : isDone && siteId ? (
                        <div className="flex h-full items-center justify-center">
                            <div className="text-center space-y-4">
                                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-green-500/10 border border-green-500/20">
                                    <Check className="h-10 w-10 text-green-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white/80">{siteName}</h2>
                                    <p className="mt-1 text-sm text-white/30">Website created successfully</p>
                                </div>
                            </div>
                        </div>
                    ) : isGenerating ? (
                        <div className="flex h-full items-center justify-center">
                            <div className="text-center space-y-5">
                                <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
                                    <div className="absolute inset-0 animate-ping rounded-3xl bg-purple-500/10" style={{ animationDuration: '1.5s' }} />
                                    <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-purple-500/[0.08] border border-purple-500/20">
                                        <Sparkles className="h-9 w-9 text-purple-400" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-white/60">AI is creating your website...</p>
                                    <p className="text-xs text-white/20">Preview sections appear as they're ready</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-full items-center justify-center">
                            <div className="text-center space-y-4">
                                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white/[0.03] border border-white/[0.06]">
                                    <Sparkles className="h-9 w-9 text-white/15" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm text-white/30">Website preview will appear here</p>
                                    <p className="text-xs text-white/15">Fill the form → AI generates → Preview</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <CongratsModal
                isOpen={showCongrats}
                onOpenChange={setShowCongrats}
                siteUrl={publishedUrl}
                siteName={siteName || 'Your Website'}
                siteId={siteId || ''}
            />
        </div>
    )
}
