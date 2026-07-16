'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GripVertical, Loader2, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Reorder } from 'framer-motion'
import BusinessInfoForm from '@/components/builder/BusinessInfoForm'
import BuilderCompletionView from '@/components/builder/BuilderCompletionView'
import BuilderFullPreview from '@/components/builder/BuilderFullPreview'
import BuilderGenerationView from '@/components/builder/BuilderGenerationView'
import { CongratsModal } from '@/components/builder/CongratsModal'
import { LanguageConfirmBanner, type LanguageConfirmAction } from '@/components/editor/LanguageConfirmBanner'
import { detectLocaleFromText } from '@/lib/detect-locale'
import { DraftRecoveryDialog } from '@/components/builder/DraftRecoveryDialog'
import { PaywallCard } from '@/components/builder/PaywallCard'
import type { BuilderPreviewMode } from '@/components/builder/BuilderPreviewPrimitives'
import { blockRegistry } from '@/blocks/registry'
import { BlockErrorBoundary } from '@/blocks/ErrorBoundary'
import type { ThemeConfig } from '@/blocks/types'
import { GoogleFontsLoader } from '@/components/site-renderer/GoogleFontsLoader'
import { useBuilderStore, getDraftStatus, getDraftMeta, type BusinessInfo } from '@/store/builderStore'
import { getGenerationError, formatErrorMessage } from '@/lib/generation-errors'
import { resolveTheme, generateThemeCSS } from '@/lib/theme/resolve'
import { useI18n } from '@/i18n'
import { coerceVideoVariants } from '@/lib/ai/coerce-video-variants'

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

// GH-1461: default readonly — the interactive (drag-reorder) path has no remaining caller
// since the preview screens went review-only. Kept behind the flag rather than deleted so
// the drag machinery is still reachable if a future editing surface needs it; a caller who
// wants drags must opt in AND pass onReorder, or drags visually snap back without saving.
function LivePreview({
    blocks,
    theme,
    onReorder,
    interactive = false,
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
            // Guard for streaming phase only (siteId not yet set). Once generation
            // completes, BuilderPreviewSurface switches to an iframe so SiteRenderer
            // rewrites links correctly. During streaming, blocks render directly in
            // DOM without URL rewriting, so internal hrefs would hit the app router
            // → CMS 404 (GH #770). External, mailto, tel, and #hash pass through.
            onClick={(e: React.MouseEvent) => {
                const anchor = (e.target as Element).closest('a')
                if (!anchor) return
                const href = anchor.getAttribute('href') ?? ''
                if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return
                e.preventDefault()
            }}
            style={{
                fontFamily: `'${theme.fontBody}', sans-serif`,
                background: resolved.backgroundColor,
                color: resolved.textColor,
                // GH-1461 rework: default I-beam cursor over text reads as "editable" —
                // this is review-only, so force the arrow cursor instead.
                cursor: interactive ? undefined : 'default',
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
    const { t } = useI18n()
    const router = useRouter()
    // Prevents SSR/hydration flash: server renders initial state (form), but Zustand
    // persist rehydrates synchronously only after client-side mount. Without this guard
    // the form flashes for ~500ms before React re-renders with the rehydrated done state.
    const [isMounted, setIsMounted] = useState(false)
    const [isFullPreviewOpen, setIsFullPreviewOpen] = useState(false)
    const [isMobileViewport, setIsMobileViewport] = useState(false)
    const [previewMode, setPreviewMode] = useState<BuilderPreviewMode>('desktop')
    const [generationTimeMs, setGenerationTimeMs] = useState(0)
    const [isPublishing, setIsPublishing] = useState(false)
    const [isNavigating, setIsNavigating] = useState(false)
    const [publishedSiteUrl, setPublishedSiteUrl] = useState<string | null>(null)
    const [draftSaveState, setDraftSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle')
    const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
    // BUG-F01-26: Track whether user has made manual edits (reorder, etc.)
    // after generation. Pages are already saved correctly by the gen route;
    // auto-save should only fire when user actually changes something,
    // otherwise it overwrites the properly-split page layouts with raw blocks.
    const hasUserEditsRef = useRef(false)
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const abortControllerRef = useRef<AbortController | null>(null)
    const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const hardTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const [elapsedSeconds, setElapsedSeconds] = useState(0)
    const [showTimeoutWarning, setShowTimeoutWarning] = useState(false)
    const sseRetryCountRef = useRef(0)
    const sseRetryTimerRef = useRef<NodeJS.Timeout | null>(null)
    const [showDraftDialog, setShowDraftDialog] = useState(false)
    const [showPaywall, setShowPaywall] = useState(false)
    // F26: pre-generation locale confirm modal state
    const [preGenModal, setPreGenModal] = useState<{ detectedLocale: string } | null>(null)
    const pendingGenRef = useRef<{ info: BusinessInfo; briefSnapshot: unknown } | null>(null)

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

    useEffect(() => { setIsMounted(true) }, [])

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
                toast.message(t.onboarding.generating.draftExpired)
            }
        } catch {
            window.localStorage.removeItem(BUILDER_SESSION_META_KEY)
        }
    }, [reset])

    // Recover from a stale/deleted siteId: the preview iframe reports via postMessage
    // when the requested site row no longer exists (localStorage pointing at a
    // reseeded/removed id). Clear the dead session and return to start instead of
    // trapping the user on a broken preview. Guarded by siteId match so it can't loop
    // after reset() nulls the id.
    useEffect(() => {
        if (typeof window === 'undefined') return
        const onMessage = (e: MessageEvent) => {
            if (e.origin !== window.location.origin) return
            if (e.data?.type !== 'PREVIEW_SITE_NOT_FOUND') return
            if (!siteId || String(e.data.siteId) !== String(siteId)) return
            reset()
            clearBuilderSessionStorage()
            setStep('info')
            toast.error(t.onboarding.generating.draftExpired)
        }
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
    }, [siteId, reset, setStep, t])

    // Draft recovery dialog — show on mount if a valid draft exists
    useEffect(() => {
        const stored = useBuilderStore.getState()
        if (stored.businessInfo && stored.step === 'info' && stored.status !== 'streaming') {
            const status = getDraftStatus()
            if (status === 'valid') {
                setShowDraftDialog(true)
            } else if (status === 'expired' || status === 'corrupted' || status === 'wrong-user') {
                stored.clearDraft()
            }
        }
    }, [])

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

    // BUG-F01-26: Only auto-save when user has made manual edits.
    // The gen route already creates pages with correct layouts, nav blocks,
    // Unsplash images, and per-page structure. Auto-saving the raw SSE blocks
    // (flat array, no images, no nav) would overwrite the homepage layout and
    // cause the preview to show different content than what was generated.
    useEffect(() => {
        if (!siteId || status !== 'done' || blocks.length === 0 || !theme) return
        if (!hasUserEditsRef.current) {
            // Pages already persisted by gen route — mark as saved without hitting API
            setDraftSaveState('saved')
            setLastSavedAt(Date.now())
            return
        }

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
        if (status === 'done' && blocks.length > 0 && theme && hasUserEditsRef.current) {
            setDraftSaveState((current) => (current === 'saving' ? current : 'dirty'))
        }
    }, [blocks, status, theme])

    const saveDraftNow = useCallback(async () => {
        if (!hasUserEditsRef.current) return true
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
            toast.error(t.onboarding.generating.saveFailed)
            return false
        }
    }, [blocks, siteId, theme])

    useEffect(() => {
        if (status === 'error' && step !== 'info') {
            setStep('info')
        }
    }, [setStep, status, step])

    // Watchdog: if status is streaming on mount but no SSE connection is active
    // (e.g. user reloaded mid-generation), reset immediately so user isn't stuck.
    useEffect(() => {
        if (status !== 'streaming') return
        if (abortControllerRef.current) return
        setStatus('idle')
        setStep('info')
        toast.message(t.onboarding.generating.interrupted)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (draftSaveState !== 'dirty' && draftSaveState !== 'saving' && status !== 'streaming') return
            event.preventDefault()
            event.returnValue = ''
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [draftSaveState, status])

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
        // Re-apply userId immediately after reset: reset() clears INITIAL_STATE
        // (userId: null), but the userId effect won't re-run since its deps haven't
        // changed. Without this, partialize stores userId: null with stale gen data,
        // and the next reload triggers isUnownedSession → blank form (GH-1371).
        if (userId) setUserId(userId)
        hasUserEditsRef.current = false
        setGenerationTimeMs(0)
        setBusinessInfo(info)
        setStatus('streaming')
        setProgress({
            step: 'generate',
            label: t.onboarding.generating.stepGenerating,
            progress: 8,
        })
        addMessage({ role: 'assistant', content: `🚀 ${t.onboarding.generating.startingMessage}` })
    }, [addMessage, reset, setBusinessInfo, setProgress, setStatus, setUserId, userId, t])

    const handleSSEEvent = useCallback((event: string, data: any) => {
        switch (event) {
            case 'step':
                setProgress(data)
                break
            case 'theme_set':
                setTheme(data.theme)
                break
            case 'block_complete': {
                // GH-1266: coerce video variants with no URL before adding to preview store
                // Server coercion runs after SSE events are emitted, so the stream can
                // carry split-video/video with no videoUrl. Apply the same rule here so
                // LivePreview matches the DB state that the gen route saves.
                const block = { ...data.block }
                coerceVideoVariants([block])
                addBlock(block)
                break
            }
            case 'error':
                setError(data)
                break
            case 'done':
                setStatus('done')
                setGenerationTimeMs(data.timeMs || 0)
                setSiteId(String(data.siteId))
                setSiteName(data.siteName)
                // BUG-F01-26: Don't mark dirty — gen route already saved pages correctly.
                // Setting 'dirty' here triggers auto-save which overwrites processed
                // homepage layout (with nav, images, page split) with raw SSE blocks.
                hasUserEditsRef.current = false
                void trackBuilderEvent(String(data.siteId), 'builder_generation_completed', {
                    totalBlocks: data.totalBlocks,
                    totalPages: data.totalPages || 1,
                    timeMs: data.timeMs || 0,
                })
                addMessage({
                    role: 'assistant',
                    content:
                        `✅ ${t.onboarding.completion.createdSuccessfully.replace('{name}', data.siteName)}\n\n` +
                        `📄 **${t.onboarding.completion.pagesGenerated.replace('{count}', String(data.totalPages || 1))}** ${t.onboarding.completion.generated}\n` +
                        `📊 **${t.onboarding.completion.sectionsGenerated.replace('{count}', String(data.totalBlocks))}** ${t.onboarding.completion.sectionsGeneratedLabel}\n` +
                        `⏱️ **${t.onboarding.completion.generationTime.replace('{seconds}', String(Math.round(data.timeMs / 1000)))}** ${t.onboarding.completion.generationTimeLabel}\n\n` +
                        t.onboarding.completion.viewPreviewHint,
                })
                break
            default:
                break
        }
    }, [addBlock, addMessage, setError, setProgress, setSiteId, setSiteName, setStatus, setTheme, t])

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
            if (sseRetryTimerRef.current) clearTimeout(sseRetryTimerRef.current)
        }
    }, [clearGenerationTimers])

    const startSSEGeneration = useCallback(async (
        info: BusinessInfo,
        extraInstructions?: string,
        briefSnapshot?: Record<string, unknown> | null,
        // F26: verbatim source locale (e.g. 'ja','zh') confirmed in the pre-gen modal.
        // `info.language` collapses non en/ms/vi to 'auto' for the prompt, losing the real
        // code — this is persisted to Sites.generationLocale so the editor shows it as primary.
        generationLocale?: string,
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
                    ...(generationLocale ? { generationLocale } : {}),
                    ...(brief ? { contentBrief: brief } : {}),
                }),
                credentials: 'include',
                signal: controller.signal,
            })

            if (!response.ok) {
                const errorBody = await response.json().catch(() => null)
                const genError = getGenerationError(response.status, errorBody)
                const message = formatErrorMessage(genError, GENERATION_ERROR_LOCALE)

                // 402/403 → show PaywallCard (free limit exceeded or feature/subscription gated)
                if (response.status === 402 || response.status === 403) {
                    setShowPaywall(true)
                    setStep('info')
                    return
                }

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
            // SSE disconnect or network error — show banner, auto-retry up to 3x
            const genError = getGenerationError(0, 'SSE_DISCONNECT')
            const retryIntervals = genError.retryIntervals || [2000, 5000, 10000]
            const maxRetries = genError.maxRetries || 3
            const currentRetry = sseRetryCountRef.current

            if (currentRetry < maxRetries) {
                const delay = retryIntervals[currentRetry] || retryIntervals[retryIntervals.length - 1]
                sseRetryCountRef.current += 1
                toast.warning('Lost connection. Retrying...', { duration: delay })
                // Store timer ref to prevent duplicate streams on new generation start
                if (sseRetryTimerRef.current) clearTimeout(sseRetryTimerRef.current)
                sseRetryTimerRef.current = setTimeout(() => {
                    sseRetryTimerRef.current = null
                    void startSSEGeneration(info, extraInstructions, briefSnapshot, generationLocale)
                }, delay)
                return
            }

            // All retries exhausted — show fatal error, redirect to dashboard
            sseRetryCountRef.current = 0
            const message = formatErrorMessage(genError, GENERATION_ERROR_LOCALE)
            setError({ code: genError.code, message, retryable: genError.retryable })
            setStep('info')
            toast.error('Cannot create website', {
                description: 'Connection failed after multiple retries.',
                duration: 10000,
                action: {
                    label: 'Go to Dashboard',
                    onClick: () => router.push('/dashboard?ai_status=failed'),
                },
            })
        } finally {
            clearGenerationTimers()
            abortControllerRef.current = null
        }
    }, [clearGenerationTimers, handleSSEEvent, setError, setStep, contentBrief])

    const handleGenerateStart = useCallback((info: BusinessInfo) => {
        const briefSnapshot = useBuilderStore.getState().contentBrief
        sseRetryCountRef.current = 0
        if (sseRetryTimerRef.current) { clearTimeout(sseRetryTimerRef.current); sseRetryTimerRef.current = null }

        // F26: detect input language — only intercept when it's not EN or BM
        const text = [info.businessName, info.shortDescription, info.products].filter(Boolean).join(' ')
        const detectedLocale = (info.language && info.language !== 'auto')
            ? info.language
            : detectLocaleFromText(text)

        if (detectedLocale === 'en' || detectedLocale === 'ms') {
            // Primary locale — generate immediately, no modal needed
            prepareGenerationSession(info)
            void startSSEGeneration(info, undefined, briefSnapshot)
            return
        }

        // Non-primary locale — show recommendation modal before generating
        pendingGenRef.current = { info, briefSnapshot }
        setPreGenModal({ detectedLocale })
    }, [prepareGenerationSession, startSSEGeneration])

    const handlePreGenConfirm = useCallback((action: LanguageConfirmAction, locale: string) => {
        if (action === 'dismiss') {
            setPreGenModal(null)
            pendingGenRef.current = null
            return
        }
        setPreGenModal(null)
        if (!pendingGenRef.current) return
        const { info, briefSnapshot } = pendingGenRef.current
        pendingGenRef.current = null
        // API only accepts 'en'|'ms'|'vi'|'auto' — unsupported locales (ar, zh, etc.) fall back
        // to 'auto' so the AI infers language from business content. The verbatim locale is sent
        // separately as generationLocale so it persists as the editor's primary language.
        const apiLang = (['en', 'ms', 'vi'] as const).includes(locale as 'en' | 'ms' | 'vi') ? locale : 'auto'
        const updatedInfo: BusinessInfo = { ...info, language: apiLang }
        prepareGenerationSession(updatedInfo)
        void startSSEGeneration(updatedInfo, undefined, briefSnapshot as any, locale)
    }, [prepareGenerationSession, startSSEGeneration])

    const handleRetryGeneration = useCallback((info: BusinessInfo) => {
        handleGenerateStart(info)
    }, [handleGenerateStart])

    const handleDashboard = useCallback(async () => {
        setIsNavigating(true)
        // BUG-F01-26: Only save if user made manual edits
        if (hasUserEditsRef.current) {
            void saveDraftNow()
        }
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
        // BUG-F01-26: Only save if user made manual edits. Gen route already
        // saved pages correctly — saving raw SSE blocks would overwrite them.
        if (hasUserEditsRef.current) {
            const saved = await saveDraftNow()
            if (!saved) return
        }
        setIsNavigating(true)
        // Navigate FIRST, then clear state (prevents flash of builder form — mirrors handleDashboard)
        router.push(`/editor/${siteId}`)
        setTimeout(() => {
            reset()
            clearBuilderSessionStorage()
        }, 100)
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
            toast.success(t.onboarding.completion.publishSuccess)
        } catch (error: any) {
            toast.error(error?.message || 'Failed to publish website')
        } finally {
            setIsPublishing(false)
        }
    }, [isPublishing, saveDraftNow, siteId])

    const handleMoveBlock = useCallback((blockId: string, direction: 'up' | 'down') => {
        hasUserEditsRef.current = true
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
        t.onboarding.generating.startingMessage

    // GH-1461 rework: the preview CANVAS (this panel + Full Preview modal) is review-only —
    // no drag-reorder/edit affordances inside the rendered site itself. Block reorder is
    // still available via the completion screen's own arrow buttons (handleMoveBlock),
    // which are builder chrome, not part of the preview render. Both consumers share this
    // single readonly instance.
    const readonlyPreviewContent = blocks.length > 0 && theme ? (
        <div className="h-full overflow-y-auto bg-[#06090F]">
            <LivePreview blocks={blocks} interactive={false} theme={theme} siteType={businessInfo?.industry} />
        </div>
    ) : (
        <div className="flex h-full items-center justify-center bg-[#06090F]">
            <div className="text-center">
                <p className="text-base font-medium text-white/80">{siteName || businessInfo?.businessName || t.onboarding.completion.yourWebsite}</p>
                <p className="mt-2 text-sm text-white/40">{t.onboarding.completion.previewPreparing}</p>
            </div>
        </div>
    )

    // GH-1269: keep generation screen visible for the entire streaming phase
    // (including when blocks arrive). Preview only shows after done + iframe ready.
    const shouldShowGenerationScreen =
        step === 'chat' &&
        status === 'streaming'

    const shouldShowPreviewScreen = status === 'done'

    const saveStatusLabel =
        draftSaveState === 'saving'
            ? t.onboarding.completion.savingDraft
            : draftSaveState === 'saved'
                ? t.onboarding.completion.savedAt.replace('{time}', formatSavedAt(lastSavedAt) ?? '').trim()
                : draftSaveState === 'error'
                    ? t.onboarding.completion.saveFailed
                    : draftSaveState === 'dirty'
                        ? t.onboarding.completion.unsavedChanges
                        : null

    const saveStatusBadge = saveStatusLabel ? (
        <div className="fixed bottom-6 right-6 z-[70] rounded-2xl border border-white/10 bg-[#0b1120]/90 px-4 py-2 text-xs font-medium text-[#94a3b8] shadow-[0px_8px_32px_0px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            {saveStatusLabel}
        </div>
    ) : null

    // Guard: while navigating away, show a loading screen so any store reset
    // (step→'info') that fires before the component unmounts doesn't flash the form.
    if (isNavigating) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[#06090F]">
                <Loader2 className="size-8 animate-spin text-white/40" />
                <p className="text-sm text-white/40">{t.onboarding.completion.redirecting}</p>
            </div>
        )
    }

    // Block render until client-side mount: Zustand persist rehydrates from
    // localStorage only after React hydration, so the first render uses initial
    // state (form). This dark screen prevents the ~500ms form flash on reload.
    if (!isMounted) {
        return <div className="fixed inset-0 bg-[#06090F]" />
    }

    if (step === 'info' && status !== 'done') {
        if (showPaywall) {
            return <PaywallCard onBack={() => setShowPaywall(false)} />
        }
        return (
            <>
                {preGenModal && (
                    <LanguageConfirmBanner
                        isOpen={true}
                        detectedLocale={preGenModal.detectedLocale}
                        onAction={handlePreGenConfirm}
                    />
                )}
                {showDraftDialog && (
                    <DraftRecoveryDialog
                        draft={getDraftMeta()}
                        onContinue={() => setShowDraftDialog(false)}
                        onDiscard={() => {
                            useBuilderStore.getState().clearDraft()
                            setShowDraftDialog(false)
                        }}
                    />
                )}
                <BusinessInfoForm
                    errorMessage={status === 'error' ? error?.message || null : null}
                    initialValues={businessInfo}
                    isGenerating={status === 'streaming'}
                    onRetry={status === 'error' && error?.retryable ? handleRetryGeneration : undefined}
                    onSubmit={handleGenerateStart}
                />
            </>
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
                    siteId={siteId}
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
                    previewContent={readonlyPreviewContent}
                    previewMode={previewMode}
                    siteId={siteId}
                    siteName={siteName || businessInfo?.businessName || 'your-site'}
                    totalBlocks={blocks.length || 7}
                />
                <CongratsModal
                    dashboardHref="/dashboard"
                    dashboardLabel={t.onboarding.completion.goToDashboard}
                    isOpen={!!publishedSiteUrl}
                    onOpenChange={(open) => {
                        if (!open) {
                            setPublishedSiteUrl(null)
                            setIsNavigating(true)
                            router.push('/dashboard')
                            setTimeout(() => {
                                reset()
                                clearBuilderSessionStorage()
                            }, 100)
                        }
                    }}
                    onNavigate={() => {
                        setIsNavigating(true)
                        setTimeout(() => {
                            reset()
                            clearBuilderSessionStorage()
                        }, 100)
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
