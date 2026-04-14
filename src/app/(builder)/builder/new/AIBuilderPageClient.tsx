'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GripVertical, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Reorder } from 'framer-motion'
import BusinessInfoForm from '@/components/builder/BusinessInfoForm'
import BuilderCompletionView from '@/components/builder/BuilderCompletionView'
import BuilderFullPreview from '@/components/builder/BuilderFullPreview'
import BuilderGenerationView from '@/components/builder/BuilderGenerationView'
import { CongratsModal } from '@/components/builder/CongratsModal'
import type { BuilderPreviewMode } from '@/components/builder/BuilderPreviewPrimitives'
import { blockRegistry } from '@/blocks/registry'
import { BlockErrorBoundary } from '@/blocks/ErrorBoundary'
import type { ThemeConfig } from '@/blocks/types'
import { GoogleFontsLoader } from '@/components/site-renderer/GoogleFontsLoader'
import { useBuilderStore, type BusinessInfo } from '@/store/builderStore'
import { getGenerationError, formatErrorMessage } from '@/lib/generation-errors'
import { resolveTheme, generateThemeCSS } from '@/lib/theme/resolve'

export interface AIBuilderPageClientProps {
    /** Server-resolved current user ID — used to detect cross-user localStorage contamination */
    userId: string | null
}

const BUILDER_SESSION_META_KEY = 'prime-builder-session-meta'
const BUILDER_SESSION_TTL_MS = 24 * 60 * 60 * 1000

/** Locale for generation error messages — defaults to 'en'. */
const GENERATION_ERROR_LOCALE: 'en' | 'ms' = 'en'

function formatSavedAt(timestamp: number | null) {
    if (!timestamp) return null
    return new Date(timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    })
}

async function trackBuilderEvent(siteId: string, event: string, metadata?: Record<string, unknown>) {
    try {
        await fetch('/api/analytics/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                siteId,
                event,
                pageUrl: '/builder/new',
                metadata,
            }),
        })
    } catch (error) {
        console.error('[Builder Analytics] Failed to track event:', error)
    }
}

function clearBuilderSessionStorage() {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem('prime-builder-session')
    window.localStorage.removeItem(BUILDER_SESSION_META_KEY)
}

function LivePreview({
    blocks,
    theme,
    onReorder,
    interactive = true,
    siteType,
}: {
    blocks: any[]
    theme: ThemeConfig | null
    onReorder?: (newOrder: any[]) => void
    interactive?: boolean
    siteType?: string
}) {
    if (!theme || blocks.length === 0) return null

    const resolved = resolveTheme(theme)
    const themeCSS = generateThemeCSS(resolved)

    return (
        <>
        <style dangerouslySetInnerHTML={{ __html: themeCSS }} />
        <GoogleFontsLoader fontBody={theme.fontBody} fontHeading={theme.fontHeading} />
        <Reorder.Group
            axis="y"
            className="min-h-full w-full"
            onReorder={(newOrder) => onReorder?.(newOrder)}
            style={{
                fontFamily: `'${theme.fontBody}', sans-serif`,
                background: resolved.backgroundColor,
                color: resolved.textColor,
            }}
            values={blocks}
        >
            {blocks.map((block) => {
                if (!block.blockType) return null

                const BlockComponent = blockRegistry.getComponent(block.blockType)
                if (!BlockComponent) return null

                const isFixed = block.blockType === 'navigation' || block.blockType === 'footer'

                return (
                    <Reorder.Item
                        className="group/block relative"
                        dragListener={interactive && !isFixed}
                        key={block._id}
                        value={block}
                    >
                        {interactive ? (
                            <>
                                <div className="absolute left-3 top-3 z-40 opacity-0 transition-opacity duration-200 group-hover/block:opacity-100">
                                    {isFixed ? (
                                        <div className="flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-white/40 backdrop-blur-sm">
                                            <Lock className="size-3" />
                                        </div>
                                    ) : (
                                        <div className="flex cursor-grab items-center gap-1.5 rounded-lg border border-blue-500 bg-blue-600/90 px-2 py-1.5 text-[10px] font-medium text-white shadow-lg active:cursor-grabbing">
                                            <GripVertical className="size-3" />
                                        </div>
                                    )}
                                </div>

                                <div className="pointer-events-none absolute inset-0 z-30 rounded-sm border-2 border-transparent transition-all group-active/block:border-blue-500/40 group-active/block:bg-blue-500/5" />
                            </>
                        ) : null}

                        <BlockErrorBoundary blockType={block.blockType}>
                            <BlockComponent block={block} theme={theme} site={siteType ? { siteType } : undefined} />
                        </BlockErrorBoundary>
                    </Reorder.Item>
                )
            })}
        </Reorder.Group>
        </>
    )
}

export default function AIBuilderPageClient({ userId }: AIBuilderPageClientProps) {
    const router = useRouter()
    const [isFullPreviewOpen, setIsFullPreviewOpen] = useState(false)
    const [isMobileViewport, setIsMobileViewport] = useState(false)
    const [previewMode, setPreviewMode] = useState<BuilderPreviewMode>('desktop')
    const [generationTimeMs, setGenerationTimeMs] = useState(0)
    const [isPublishing, setIsPublishing] = useState(false)
    const [isNavigating, setIsNavigating] = useState(false)
    const [publishedSiteUrl, setPublishedSiteUrl] = useState<string | null>(null)
    const [draftSaveState, setDraftSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle')
    const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const abortControllerRef = useRef<AbortController | null>(null)
    const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const hardTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const [elapsedSeconds, setElapsedSeconds] = useState(0)
    const [showTimeoutWarning, setShowTimeoutWarning] = useState(false)

    const {
        step,
        businessInfo,
        status,
        error,
        messages,
        blocks,
        theme,
        siteId,
        siteName,
        progress,
        addMessage,
        setStatus,
        addBlock,
        setTheme,
        setProgress,
        setSiteId,
        setSiteName,
        setError,
        setBusinessInfo,
        setBlocks,
        setStep,
        setUserId,
        contentBrief,
        reset,
    } = useBuilderStore()

    // Security: clear persisted session if it belongs to a different user.
    // Prevents cross-user localStorage contamination when sharing a browser.
    //
    // Two cases to clear:
    //   1. isDifferentUser  — stored.userId exists but doesn't match current user
    //   2. isUnownedSession — session was created before this fix (no userId stored)
    //                         but already has data (blocks/siteId). Must clear because
    //                         we can't verify who owns it.
    useEffect(() => {
        if (!userId) return
        const stored = useBuilderStore.getState()
        const hasStaleData = stored.blocks.length > 0 || stored.siteId !== null
        const isDifferentUser = stored.userId !== null && stored.userId !== userId
        const isUnownedSession = stored.userId === null && hasStaleData

        if (isDifferentUser || isUnownedSession) {
            reset()
            clearBuilderSessionStorage()
        }
        setUserId(userId)
    }, [userId, reset, setUserId])

    useEffect(() => {
        if (typeof window === 'undefined') return

        const rawMeta = window.localStorage.getItem(BUILDER_SESSION_META_KEY)
        if (!rawMeta) return

        try {
            const meta = JSON.parse(rawMeta) as { lastTouchedAt?: number }
            if (meta.lastTouchedAt && Date.now() - meta.lastTouchedAt > BUILDER_SESSION_TTL_MS) {
                reset()
                window.localStorage.removeItem(BUILDER_SESSION_META_KEY)
                toast.message('Your previous AI builder draft expired after 24 hours.')
            }
        } catch {
            window.localStorage.removeItem(BUILDER_SESSION_META_KEY)
        }
    }, [reset])

    useEffect(() => {
        if (typeof window === 'undefined') return
        if (!businessInfo && blocks.length === 0 && !siteId && messages.length === 0) {
            window.localStorage.removeItem(BUILDER_SESSION_META_KEY)
            return
        }

        window.localStorage.setItem(
            BUILDER_SESSION_META_KEY,
            JSON.stringify({ lastTouchedAt: Date.now() }),
        )
    }, [blocks.length, businessInfo, messages.length, siteId, status])

    useEffect(() => {
        if (!siteId || status !== 'done' || blocks.length === 0 || !theme) return

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

        saveTimeoutRef.current = setTimeout(async () => {
            try {
                setDraftSaveState('saving')
                const response = await fetch(`/api/sites/${siteId}/save`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ blocks, theme }),
                })
                if (!response.ok) {
                    throw new Error('Failed to save draft')
                }
                setDraftSaveState('saved')
                setLastSavedAt(Date.now())
                void trackBuilderEvent(siteId, 'builder_autosave_success', {
                    blockCount: blocks.length,
                })
            } catch (error) {
                setDraftSaveState('error')
                console.error('[Auto-save] Failed to save draft:', error)
            }
        }, 2000)

        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
        }
    }, [blocks, siteId, status, theme])

    useEffect(() => {
        if (status === 'done' && blocks.length > 0 && theme) {
            setDraftSaveState((current) => (current === 'saving' ? current : 'dirty'))
        }
    }, [blocks, status, theme])

    const saveDraftNow = useCallback(async () => {
        if (!siteId || blocks.length === 0 || !theme) return true

        try {
            setDraftSaveState('saving')
            const response = await fetch(`/api/sites/${siteId}/save`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ blocks, theme }),
            })

            if (!response.ok) {
                throw new Error('Failed to save latest changes')
            }

            setDraftSaveState('saved')
            setLastSavedAt(Date.now())
            void trackBuilderEvent(siteId, 'builder_manual_save_success', {
                blockCount: blocks.length,
            })
            return true
        } catch (error) {
            setDraftSaveState('error')
            console.error('[Save Draft] Failed to persist draft:', error)
            toast.error('Failed to save the latest preview changes.')
            return false
        }
    }, [blocks, siteId, theme])

    useEffect(() => {
        if (status === 'error' && step !== 'info') {
            setStep('info')
        }
    }, [setStep, status, step])

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (draftSaveState !== 'dirty' && draftSaveState !== 'saving') return
            event.preventDefault()
            event.returnValue = ''
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [draftSaveState])

    useEffect(() => {
        if (typeof window === 'undefined') return

        const mediaQuery = window.matchMedia('(max-width: 1023px)')
        const syncViewport = () => setIsMobileViewport(mediaQuery.matches)

        syncViewport()
        mediaQuery.addEventListener('change', syncViewport)

        return () => mediaQuery.removeEventListener('change', syncViewport)
    }, [])

    useEffect(() => {
        if (status === 'done' && isMobileViewport) {
            setPreviewMode('mobile')
            setIsFullPreviewOpen(true)
        }
    }, [isMobileViewport, status])

    const prepareGenerationSession = useCallback((info: BusinessInfo) => {
        reset()
        setGenerationTimeMs(0)
        setBusinessInfo(info)
        setStatus('streaming')
        setProgress({
            step: 'generate',
            label: 'Generating content & design',
            progress: 8,
        })
        addMessage({ role: 'assistant', content: '🚀 Starting website creation...' })
    }, [addMessage, reset, setBusinessInfo, setProgress, setStatus])

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
            case 'error':
                setError(data)
                break
            case 'done':
                setStatus('done')
                setGenerationTimeMs(data.timeMs || 0)
                setSiteId(data.siteId)
                setSiteName(data.siteName)
                setDraftSaveState('dirty')
                void trackBuilderEvent(data.siteId, 'builder_generation_completed', {
                    totalBlocks: data.totalBlocks,
                    totalPages: data.totalPages || 1,
                    timeMs: data.timeMs || 0,
                })
                addMessage({
                    role: 'assistant',
                    content:
                        `✅ Website **"${data.siteName}"** has been created successfully!\n\n` +
                        `📄 **${data.totalPages || 1} pages** generated\n` +
                        `📊 **${data.totalBlocks} sections** generated\n` +
                        `⏱️ **${Math.round(data.timeMs / 1000)}s** generation time\n\n` +
                        'You can view the Preview on the right, open the Editor to make changes, or Publish now!',
                })
                break
            default:
                break
        }
    }, [addBlock, addMessage, setError, setProgress, setSiteId, setSiteName, setStatus, setTheme])

    const clearGenerationTimers = useCallback(() => {
        if (elapsedIntervalRef.current) {
            clearInterval(elapsedIntervalRef.current)
            elapsedIntervalRef.current = null
        }
        if (warningTimeoutRef.current) {
            clearTimeout(warningTimeoutRef.current)
            warningTimeoutRef.current = null
        }
        if (hardTimeoutRef.current) {
            clearTimeout(hardTimeoutRef.current)
            hardTimeoutRef.current = null
        }
        setElapsedSeconds(0)
        setShowTimeoutWarning(false)
    }, [])

    const cancelGeneration = useCallback(() => {
        abortControllerRef.current?.abort()
        abortControllerRef.current = null
        clearGenerationTimers()
        setStatus('idle')
        setStep('info')
        // businessInfo is preserved — user can retry without re-entering
    }, [clearGenerationTimers, setStatus, setStep])

    // Cleanup all timers and abort on unmount
    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort()
            clearGenerationTimers()
        }
    }, [clearGenerationTimers])

    const startSSEGeneration = useCallback(async (
        info: BusinessInfo,
        extraInstructions?: string,
        briefSnapshot?: Record<string, unknown> | null,
    ) => {
        const controller = new AbortController()
        abortControllerRef.current = controller

        // Elapsed timer — tick every second
        const elapsedInterval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000)
        elapsedIntervalRef.current = elapsedInterval

        // 60s warning timeout — shows "still working..." hint (non-blocking)
        const warningTimeout = setTimeout(() => setShowTimeoutWarning(true), 60_000)
        warningTimeoutRef.current = warningTimeout

        // 300s (5 min) hard timeout — auto-abort.
        // v3 (2026-04-14): 120s → 300s. site-generation flipped to gpt-4.1-mini
        // (commit 56adabe0) with p95 ~99s, p99 can exceed 120s. Bumped to 5 min
        // to absorb long-tail OpenAI latency until phase-03b tuning ships.
        const hardTimeout = setTimeout(() => {
            controller.abort()
            clearGenerationTimers()
            const genError = getGenerationError(408)
            const message = formatErrorMessage(genError, GENERATION_ERROR_LOCALE)
            setError({ code: 'timeout', message, retryable: true })
            setStep('info')
            toast.error(message)
        }, 300_000)
        hardTimeoutRef.current = hardTimeout

        try {
            // Use briefSnapshot (captured before reset) if provided, fallback to store
            const brief = briefSnapshot ?? contentBrief
            const response = await fetch('/api/ai/generate-site?stream=true', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessInfo: info,
                    extraInstructions,
                    language: info.language || 'auto',
                    ...(brief ? { contentBrief: brief } : {}),
                }),
                credentials: 'include',
                signal: controller.signal,
            })

            if (!response.ok) {
                const errorBody = await response.json().catch(() => null)
                const genError = getGenerationError(response.status, errorBody)
                const message = formatErrorMessage(genError, GENERATION_ERROR_LOCALE)
                setError({ code: genError.code, message, retryable: genError.retryable })
                setStep('info')
                toast.error(message)
                return
            }

            const reader = response.body?.getReader()
            const decoder = new TextDecoder()

            if (!reader) {
                throw new Error('No response stream')
            }

            let buffer = ''
            let currentEvent = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })

                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7)
                        continue
                    }

                    if (!line.startsWith('data: ') || !currentEvent) {
                        continue
                    }

                    try {
                        const data = JSON.parse(line.slice(6))
                        handleSSEEvent(currentEvent, data)
                    } catch {
                        console.warn('[SSE] malformed payload, skipping event:', currentEvent)
                    }

                    currentEvent = ''
                }
            }
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') {
                // User cancelled or hard timeout — already handled
                return
            }
            // SSE disconnect or network error
            const genError = getGenerationError(0, 'SSE_DISCONNECT')
            const message = formatErrorMessage(genError, GENERATION_ERROR_LOCALE)
            setError({ code: genError.code, message, retryable: genError.retryable })
            setStep('info')
            toast.error(message)
        } finally {
            clearGenerationTimers()
            abortControllerRef.current = null
        }
    }, [clearGenerationTimers, handleSSEEvent, setError, setStep, contentBrief])

    const handleGenerateStart = useCallback((info: BusinessInfo) => {
        // Capture contentBrief BEFORE reset() clears it from the store
        const briefSnapshot = useBuilderStore.getState().contentBrief
        prepareGenerationSession(info)
        void startSSEGeneration(info, undefined, briefSnapshot)
    }, [prepareGenerationSession, startSSEGeneration])

    const handleRetryGeneration = useCallback((info: BusinessInfo) => {
        handleGenerateStart(info)
    }, [handleGenerateStart])

    const handleDashboard = useCallback(async () => {
        setIsNavigating(true)
        // Save draft in background — don't block navigation
        void saveDraftNow()
        // Navigate FIRST, then clear state (prevents flash of empty form)
        router.push('/dashboard')
        // Delay reset so navigation starts before component re-renders
        setTimeout(() => {
            reset()
            clearBuilderSessionStorage()
        }, 100)
    }, [reset, router, saveDraftNow])

    const handleOpenEditor = useCallback(async () => {
        if (!siteId) return
        const saved = await saveDraftNow()
        if (!saved) return
        reset()
        clearBuilderSessionStorage()
        router.push(`/editor/${siteId}`)
    }, [reset, router, saveDraftNow, siteId])

    const handlePublish = useCallback(async () => {
        if (!siteId || isPublishing) return

        const saved = await saveDraftNow()
        if (!saved) return

        try {
            setIsPublishing(true)
            const response = await fetch(`/api/sites/${siteId}/publish`, {
                method: 'PATCH',
                credentials: 'include',
            })

            const payload = await response.json()
            if (!response.ok) {
                throw new Error(payload?.error?.message || payload?.error || 'Failed to publish')
            }

            setPublishedSiteUrl(payload?.data?.url || null)
            if (payload?.data?.id) {
                void trackBuilderEvent(payload.data.id, 'builder_publish_success', {
                    url: payload?.data?.url,
                })
            }
            toast.success('Website published successfully!')
        } catch (error: any) {
            toast.error(error?.message || 'Failed to publish website')
        } finally {
            setIsPublishing(false)
        }
    }, [isPublishing, saveDraftNow, siteId])

    const handleMoveBlock = useCallback((blockId: string, direction: 'up' | 'down') => {
        const movableIndices = blocks.reduce<number[]>((acc, block, index) => {
            if (block._id && block.blockType !== 'navigation' && block.blockType !== 'footer') {
                acc.push(index)
            }
            return acc
        }, [])

        const currentMovablePosition = movableIndices.findIndex((index) => blocks[index]?._id === blockId)
        if (currentMovablePosition === -1) return

        const targetMovablePosition = currentMovablePosition + (direction === 'up' ? -1 : 1)
        if (targetMovablePosition < 0 || targetMovablePosition >= movableIndices.length) return

        const currentIndex = movableIndices[currentMovablePosition]
        const targetIndex = movableIndices[targetMovablePosition]
        const reorderedBlocks = [...blocks]
        const [movedBlock] = reorderedBlocks.splice(currentIndex, 1)
        const insertionIndex = targetIndex
        reorderedBlocks.splice(insertionIndex, 0, movedBlock)
        setBlocks(reorderedBlocks)
    }, [blocks, setBlocks])

    const generationMessage =
        messages.find((message) => message.role === 'assistant')?.content.replace(/^🚀\s*/, '') ||
        'Starting website creation...'

    const previewContent = blocks.length > 0 && theme ? (
        <div className="h-full overflow-y-auto bg-[#06090F]">
            <LivePreview blocks={blocks} onReorder={setBlocks} theme={theme} siteType={businessInfo?.industry} />
        </div>
    ) : (
        <div className="flex h-full items-center justify-center bg-[#06090F]">
            <div className="text-center">
                <p className="text-base font-medium text-white/80">{siteName || businessInfo?.businessName || 'Your website'}</p>
                <p className="mt-2 text-sm text-white/40">Preview is being prepared.</p>
            </div>
        </div>
    )

    const readonlyPreviewContent = blocks.length > 0 && theme ? (
        <div className="h-full overflow-y-auto bg-[#06090F]">
            <LivePreview blocks={blocks} interactive={false} theme={theme} siteType={businessInfo?.industry} />
        </div>
    ) : (
        <div className="flex h-full items-center justify-center bg-[#06090F]">
            <div className="text-center">
                <p className="text-base font-medium text-white/80">{siteName || businessInfo?.businessName || 'Your website'}</p>
                <p className="mt-2 text-sm text-white/40">Preview is being prepared.</p>
            </div>
        </div>
    )

    const shouldShowGenerationScreen =
        step === 'chat' &&
        status === 'streaming' &&
        blocks.length === 0

    const shouldShowPreviewScreen =
        status === 'done' ||
        (step === 'chat' && status === 'streaming' && blocks.length > 0 && !!theme)

    const saveStatusLabel =
        draftSaveState === 'saving'
            ? 'Saving draft...'
            : draftSaveState === 'saved'
                ? `Saved ${formatSavedAt(lastSavedAt) ?? ''}`.trim()
                : draftSaveState === 'error'
                    ? 'Save failed'
                    : draftSaveState === 'dirty'
                        ? 'Unsaved changes'
                        : null

    const saveStatusBadge = saveStatusLabel ? (
        <div className="fixed bottom-6 right-6 z-[70] rounded-2xl border border-white/10 bg-[#0b1120]/90 px-4 py-2 text-xs font-medium text-[#94a3b8] shadow-[0px_8px_32px_0px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            {saveStatusLabel}
        </div>
    ) : null

    if (step === 'info') {
        return (
            <BusinessInfoForm
                errorMessage={status === 'error' ? error?.message || null : null}
                initialValues={businessInfo}
                isGenerating={status === 'streaming'}
                onRetry={status === 'error' && error?.retryable ? handleRetryGeneration : undefined}
                onSubmit={handleGenerateStart}
            />
        )
    }

    if (shouldShowGenerationScreen) {
        return (
            <>
                {saveStatusBadge}
                <BuilderGenerationView
                    elapsedSeconds={elapsedSeconds}
                    message={generationMessage}
                    onCancel={cancelGeneration}
                    progress={progress.progress || 52}
                    showTimeoutWarning={showTimeoutWarning}
                />
            </>
        )
    }

    if (shouldShowPreviewScreen) {
        if (isFullPreviewOpen) {
            return (
                <BuilderFullPreview
                    mode={previewMode}
                    onBack={() => setIsFullPreviewOpen(false)}
                    onModeChange={setPreviewMode}
                    previewContent={readonlyPreviewContent}
                />
            )
        }

        return (
            <>
                {saveStatusBadge}
                <BuilderCompletionView
                    blocks={blocks}
                    generationTimeLabel={generationTimeMs > 0 ? `${Math.round(generationTimeMs / 1000)}s` : '0s'}
                    isNavigating={isNavigating}
                    isPublishing={isPublishing}
                    onDashboard={handleDashboard}
                    onMoveBlock={handleMoveBlock}
                    onOpenEditor={handleOpenEditor}
                    onOpenPreview={() => setIsFullPreviewOpen(true)}
                    onPublish={handlePublish}
                    onPreviewModeChange={setPreviewMode}
                    previewContent={previewContent}
                    previewMode={previewMode}
                    siteName={siteName || businessInfo?.businessName || 'your-site'}
                    totalBlocks={blocks.length || 7}
                />
                <CongratsModal
                    dashboardHref="/dashboard"
                    dashboardLabel="Go to Dashboard"
                    isOpen={!!publishedSiteUrl}
                    onOpenChange={(open) => {
                        if (!open) {
                            // Dismissing success modal → land users on their dashboard
                            // (X, backdrop click, Esc all route here). Reset builder state first
                            // so navigating back to /builder/new starts clean.
                            setPublishedSiteUrl(null)
                            reset()
                            clearBuilderSessionStorage()
                            router.push('/dashboard')
                        }
                    }}
                    onNavigate={() => {
                        reset()
                        clearBuilderSessionStorage()
                    }}
                    siteId={siteId || ''}
                    siteName={siteName || businessInfo?.businessName || 'your-site'}
                    siteUrl={publishedSiteUrl || ''}
                />
            </>
        )
    }

    return (
        <BusinessInfoForm
            errorMessage={status === 'error' ? error?.message || null : null}
            initialValues={businessInfo}
            isGenerating={false}
            onRetry={status === 'error' && error?.retryable ? handleRetryGeneration : undefined}
            onSubmit={handleGenerateStart}
        />
    )
}
