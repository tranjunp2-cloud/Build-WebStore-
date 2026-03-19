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
// GeneratingProgress has been relocated to the Left Panel (Chat Bubble) and Right Panel (Generating Overlay)

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
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20">
                                <Sparkles className="h-5 w-5 text-white" />
                            </div>
                            <span className="text-base font-bold text-white tracking-tight">Create Website with AI</span>
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

                    {isGenerating && (
                        <div className="flex w-full items-start gap-3 px-2 py-1">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-400">
                                <span className="text-sm">🚀</span>
                            </div>
                            <div className="flex flex-col gap-1 rounded-2xl rounded-tl-sm bg-slate-800/60 px-4 py-3 border border-blue-500/15 shadow-sm shadow-black/20">
                                <p className="text-[14px] leading-relaxed text-slate-100">Starting website creation...</p>
                            </div>
                        </div>
                    )}

                    {/* Done state summary within chat flow */}
                    {isDone && siteId && (
                        <div className="flex w-full items-start gap-3 px-2 py-1">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-400 font-bold shadow-lg shadow-green-500/20">
                                <Check className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex flex-col gap-3 rounded-2xl rounded-tl-sm bg-slate-800/40 p-4 border border-white/[0.05] backdrop-blur-md shadow-xl w-fit">
                                <p className="text-[14px] font-medium text-slate-100">
                                    Website <span className="font-semibold text-blue-400">"{siteName || 'your-site'}"</span> has been created successfully!
                                </p>
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2.5">
                                        <div className="h-6 w-6 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                                        </div>
                                        <span className="text-[13px] font-medium text-slate-300">+{blocks?.length || 7} sections generated</span>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <div className="h-6 w-6 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </div>
                                        <span className="text-[13px] font-medium text-slate-300">+0s generation time</span>
                                    </div>
                                </div>
                                <p className="text-[13px] leading-relaxed text-slate-400 max-w-[280px]">
                                    Your website is ready. You can now tweak it in the editor or go to your dashboard.
                                </p>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Sticky Action Buttons (only on Success) */}
                {isDone && siteId && (
                    <div className="shrink-0 border-t border-white/[0.06] bg-[#0B1120]/80 p-5 backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="group flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-6 py-4 text-[14px] font-bold text-white shadow-xl shadow-blue-600/20 transition-all duration-300 hover:shadow-blue-600/40 hover:brightness-110 active:scale-[0.98]"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                                Dashboard
                            </button>
                            <button
                                onClick={() => router.push(`/editor/${siteId}`)}
                                className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-6 py-4 text-[14px] font-bold text-slate-200 transition-all hover:border-blue-500/40 hover:bg-white/[0.08] hover:text-white active:scale-[0.98]"
                            >
                                <ExternalLink className="h-5 h-5" /> Open Editor
                            </button>
                        </div>
                    </div>
                )}

                {/* Input Area (only on non-Done states) */}
                {!isDone && (
                    <div className="shrink-0 border-t border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm">
                        <div className={cn(
                            'flex items-center gap-2 rounded-2xl border bg-white/[0.04] pr-2 pl-4 transition-all duration-200',
                            'border-white/[0.08] focus-within:border-blue-500/30 focus-within:bg-white/[0.06]'
                        )}>
                            <input
                                ref={inputRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={
                                    isGenerating ? 'AI is creating your website...'
                                        : 'Type extra instructions or hit Generate...'
                                }
                                className="flex-1 bg-transparent py-3.5 text-sm text-white/80 placeholder-white/20 outline-none"
                                disabled={isLoading || isGenerating}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isLoading || isGenerating}
                                className="rounded-xl bg-blue-600 p-2 text-white transition-all duration-200 hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-600/30 disabled:opacity-20 disabled:cursor-not-allowed"
                            >
                                <Send className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                )}
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
                <div className="relative flex-1 bg-[#06090F] overflow-hidden">
                    {blocks.length > 0 && theme ? (
                        <div className="h-full relative overflow-y-auto">
                            {/* The Overlay for Website Preview */}
                            {isDone && (
                                <div className="sticky top-0 z-50 flex items-center justify-between border-b border-white/[0.06] bg-[#0B1120]/95 px-6 py-4 backdrop-blur-xl">
                                    <div className="flex-1">
                                        <h3 className="text-[18px] font-bold text-white tracking-tight">Website Preview</h3>
                                        <p className="text-[12px] text-slate-400 font-medium">Your AI-generated website</p>
                                    </div>

                                    {/* Integrated Device Toggle */}
                                    <div className="flex-1 flex justify-center">
                                        <div className="flex items-center p-1 bg-white/[0.03] border border-white/[0.08] rounded-2xl backdrop-blur-md">
                                            <button className="flex items-center gap-2 px-6 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 shadow-lg shadow-blue-500/20 text-white text-[12px] font-bold transition-all">
                                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="3" width="10" height="14" rx="2" strokeWidth="2.5"/><path d="M8 21h8m-4-4v4" strokeWidth="2.5" strokeLinecap="round"/></svg>
                                                Desktop
                                            </button>
                                            <button className="flex items-center gap-2 px-6 py-2 rounded-xl text-slate-400 text-[12px] font-bold hover:text-white transition-all">
                                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="5" y="2" width="14" height="20" rx="2" strokeWidth="2.5"/><path d="M12 18h.01" strokeWidth="2.5" strokeLinecap="round"/></svg>
                                                Mobile
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-1 flex justify-end">
                                        <button
                                            onClick={() => window.open(`/editor/${siteId}`, '_blank')}
                                            className="flex justify-center items-center gap-2.5 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-[13px] hover:brightness-110 transition-all shadow-xl shadow-blue-500/25 active:scale-[0.98]"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                            View Full Preview
                                        </button>
                                    </div>
                                </div>
                            )}
                            <LivePreview blocks={blocks} theme={theme} onReorder={setBlocks} />
                        </div>
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
                        <div className="flex h-full items-center justify-center bg-[#0B1120]">
                            <div className="w-[448px] rounded-[16px] border border-blue-500/15 bg-[#1E293B]/60 p-8 shadow-2xl backdrop-blur-md">
                                <div className="text-center space-y-3 mb-10">
                                    <h2 className="text-[24px] font-semibold text-slate-50">Creating Your Website...</h2>
                                    <p className="text-[14px] text-slate-400">AI is analyzing your business and generating the perfect design.</p>
                                </div>
                                <div className="space-y-4 mb-10">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00C950]/20 text-[#00C950]">
                                            <Check className="h-4 w-4" strokeWidth={3} />
                                        </div>
                                        <span className="text-[14px] text-slate-100">Analyzing business information</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 bg-opacity-[0.53] text-white animate-[spin_2s_linear_infinite]">
                                            <Loader2 className="h-4 w-4" />
                                        </div>
                                        <span className="text-[14px] text-slate-100">Generating content & design</span>
                                    </div>
                                    <div className="flex items-center gap-3 opacity-50">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#94A3B8]/20 text-slate-400">
                                            <span className="text-sm font-bold">3</span>
                                        </div>
                                        <span className="text-[14px] text-slate-400">Preparing preview</span>
                                    </div>
                                </div>
                                <div className="space-y-3 px-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[14px] text-slate-400 font-medium">Building your website</span>
                                        <span className="text-[14px] text-cyan-400 font-medium">Processing...</span>
                                    </div>
                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700/50">
                                        <div 
                                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-[300ms] ease-out rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                                            style={{ width: `${Math.max(10, progress.progress)}%` }} 
                                        />
                                    </div>
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
