'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '@/i18n'

const STORAGE_KEY = 'editor:coach-marks:v1:seen'
const CARD_WIDTH = 300
const VIEWPORT_MARGIN = 16
const GAP = 16 // matches VIEWPORT_MARGIN spacing convention
// Floor for compact's max-height cap — enough for badge+title+body+buttons; below this the
// card would become unusable, so pathologically short viewports (rect.top < ~172px) accept
// a small overlap instead of collapsing the card.
const MIN_CARD_MAX_HEIGHT = 140
// Floor for compact's card width on very narrow viewports (e.g. ~320px devices, foldables in
// cover-screen mode) — below CARD_WIDTH the card would overflow position:fixed's viewport edge.
const MIN_CARD_WIDTH = 220

type Step = 0 | 1 | 2

interface Props {
    /** Called when step 1 is about to show — parent switches left sidebar to pages tab */
    onEnterStep1?: () => void
    /** Called when user enters step 2 — parent switches right panel to menu tab */
    onEnterStep2?: () => void
    /** Called when the tour ends (Done clicked) — parent closes the compact Tools sheet */
    onFinish?: () => void
    /** Delay before showing step 1, to let editor layout settle */
    mountDelayMs?: number
    /** Compact (mobile/tablet) layout — anchor sits inside the bottom Tools sheet, popover goes above it */
    isCompact?: boolean
}

const ANCHOR_POLL_INTERVAL_MS = 100
const ANCHOR_POLL_TIMEOUT_MS = 1000

function useAnchorRect(step: Step, isCompact: boolean): DOMRect | null {
    const [rect, setRect] = useState<DOMRect | null>(null)
    const hasScrolledRef = useRef(false)

    useEffect(() => {
        hasScrolledRef.current = false
        if (step === 0) { setRect(null); return }

        const selector = step === 1 ? '[data-coach="page-library"]' : '[data-coach="menu-settings"]'
        const resolve = () => {
            const el = document.querySelector<HTMLElement>(selector)
            // Compact only (never touch desktop): the anchor can sit below the fold inside
            // SettingsPanel's own scroll container (e.g. the nav-link form under Menu tab is
            // past whatever's above it) — scroll it into view once per step, minimal movement,
            // so the popup positions against its final (visible) rect, not an off-screen one.
            if (el && isCompact && !hasScrolledRef.current) {
                hasScrolledRef.current = true
                el.scrollIntoView({ behavior: 'instant', block: 'nearest' })
            }
            setRect(el ? el.getBoundingClientRect() : null)
            return el !== null
        }

        // Step 2 anchor is inside a conditionally-rendered tab. On desktop SettingsPanel is
        // already mounted (onEnterStep2 → requestedTab → useEffect → setActiveTab → re-render,
        // 2 flush cycles). On compact, EditorToolsSheet only mounts SettingsPanel once its tab
        // is active — the FIRST openTools('settings') call mounts it fresh, adding a mount
        // cycle on top of that same tab-switch effect. A single fixed delay is a guess that can
        // fall short on a slow device/CPU-throttled session, so after the initial delay poll
        // briefly instead of giving up on one attempt (bounded — never polls forever).
        const initialDelay = step === 2 ? 150 : 50
        let pollId: number | null = null
        let pollTimeoutId: number | null = null
        const stopPolling = () => {
            if (pollId !== null) { window.clearInterval(pollId); pollId = null }
            if (pollTimeoutId !== null) { window.clearTimeout(pollTimeoutId); pollTimeoutId = null }
        }

        const timer = window.setTimeout(() => {
            if (resolve()) return
            pollId = window.setInterval(() => { if (resolve()) stopPolling() }, ANCHOR_POLL_INTERVAL_MS)
            pollTimeoutId = window.setTimeout(stopPolling, ANCHOR_POLL_TIMEOUT_MS)
        }, initialDelay)

        window.addEventListener('resize', resolve)
        return () => {
            window.clearTimeout(timer)
            stopPolling()
            window.removeEventListener('resize', resolve)
        }
    }, [step, isCompact])

    return rect
}

export function EditorCoachMarks({ onEnterStep1, onEnterStep2, onFinish, mountDelayMs = 500, isCompact = false }: Props) {
    const { t } = useI18n()
    const cm = t.editor.coachMarks
    const [step, setStep] = useState<Step>(0)
    const rect = useAnchorRect(step, isCompact)

    // Mount-timer fires once (deps below intentionally omit onEnterStep1) but must still call
    // the LATEST callback — isCompactLayout (parent) is false on first render and flips true
    // shortly after mount via matchMedia, so a closure frozen at mount would call openTools()
    // with a stale `false` and the compact anchor would never mount (GH-1607 regression).
    const onEnterStep1Ref = useRef(onEnterStep1)
    useEffect(() => { onEnterStep1Ref.current = onEnterStep1 })

    // On mount: skip if already seen; otherwise switch sidebar to pages tab then show step 1
    useEffect(() => {
        if (typeof window === 'undefined') return
        let alreadySeen = false
        try { alreadySeen = window.localStorage.getItem(STORAGE_KEY) === 'true' } catch { /* private/incognito */ }
        if (alreadySeen) return
        const timer = window.setTimeout(() => {
            onEnterStep1Ref.current?.()
            setStep(1)
        }, mountDelayMs)
        return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mountDelayMs])

    const finish = useCallback(() => {
        try { window.localStorage.setItem(STORAGE_KEY, 'true') } catch { /* private/incognito — non-fatal */ }
        setStep(0)
        onFinish?.()
    }, [onFinish])

    // Guard against rapid double-click advancing step twice before React re-renders
    const isSteppingRef = useRef(false)
    const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    // Cleanup step-debounce timer on unmount
    useEffect(() => () => { if (stepTimerRef.current) clearTimeout(stepTimerRef.current) }, [])
    const next = useCallback(() => {
        if (isSteppingRef.current) return
        isSteppingRef.current = true
        if (stepTimerRef.current) clearTimeout(stepTimerRef.current)
        stepTimerRef.current = setTimeout(() => { isSteppingRef.current = false }, 200)
        if (step === 1) {
            onEnterStep2?.()
            setStep(2)
        } else {
            finish()
        }
    }, [step, finish, onEnterStep2])

    const back = useCallback(() => {
        onEnterStep1?.()
        setStep(1)
    }, [onEnterStep1])

    // Measure rendered card height so we can clamp position into viewport — long
    // content (translations, future edits) would otherwise overflow off-screen.
    const cardRef = useRef<HTMLDivElement | null>(null)
    const [cardHeight, setCardHeight] = useState(0)
    useLayoutEffect(() => {
        if (!cardRef.current) return
        setCardHeight(cardRef.current.offsetHeight)
    }, [step, rect])

    // rect.width === 0 means element is hidden (display:none) — avoid rendering at 0,0
    if (step === 0 || !rect || rect.width === 0) return null

    let popoverLeft: number
    let popoverTop: number
    let cardTransform: string | undefined
    let cardMaxHeight: string
    let cardWidth: number | undefined

    if (isCompact) {
        // Anchor lives inside the bottom Tools sheet — center card horizontally,
        // place it fully above rect.top (never overlaps the spotlight ring).
        const viewportW = typeof window !== 'undefined' ? window.innerWidth : 0
        // Shrink below CARD_WIDTH on narrow viewports so the card never overflows the
        // viewport edge (position:fixed has no horizontal scroll to recover it).
        const effectiveWidth = Math.max(MIN_CARD_WIDTH, Math.min(CARD_WIDTH, viewportW - VIEWPORT_MARGIN * 2))
        cardWidth = effectiveWidth < CARD_WIDTH ? effectiveWidth : undefined
        popoverLeft = Math.min(
            Math.max(VIEWPORT_MARGIN, viewportW / 2 - effectiveWidth / 2),
            Math.max(VIEWPORT_MARGIN, viewportW - effectiveWidth - VIEWPORT_MARGIN),
        )
        // Cap the card's own max-height to the space actually available above the anchor,
        // so long content scrolls internally instead of growing the box past rect.top —
        // otherwise the vertical clamp below only repositions a too-tall card to
        // VIEWPORT_MARGIN, which still overlaps the anchor rather than avoiding it.
        const availableAboveAnchor = Math.max(MIN_CARD_MAX_HEIGHT, rect.top - GAP - VIEWPORT_MARGIN)
        cardMaxHeight = `${availableAboveAnchor}px`
        // cardHeight is 0 on first render (not yet measured) — fall back to
        // anchor top so nothing renders off-screen before the real height is known.
        popoverTop = cardHeight === 0
            ? Math.max(VIEWPORT_MARGIN, rect.top - GAP)
            : Math.max(VIEWPORT_MARGIN, rect.top - GAP - cardHeight)
        cardTransform = undefined
    } else {
        // Position popover: step 1 (left panel) → to the right; step 2 (right panel) → to the left
        popoverLeft = step === 1
            ? rect.right + 16
            : rect.left - CARD_WIDTH - 16

        // Clamp vertical position so card (after translateY -50%) fits in viewport.
        // Falls back to anchor-center on first render before cardHeight is measured.
        const viewportH = typeof window !== 'undefined' ? window.innerHeight : 0
        const anchorCenter = rect.top + rect.height / 2
        const halfH = cardHeight / 2
        popoverTop = cardHeight === 0 || viewportH === 0
            ? anchorCenter
            : Math.min(
                Math.max(anchorCenter, halfH + VIEWPORT_MARGIN),
                viewportH - halfH - VIEWPORT_MARGIN,
            )
        cardTransform = 'translateY(-50%)'
        cardMaxHeight = `calc(100vh - ${VIEWPORT_MARGIN * 2}px)`
        cardWidth = undefined
    }

    return (
        <>
            {/* 4-panel backdrop: blurs/dims outside spotlight, leaves spotlight area clear */}
            <div className="fixed z-[60] bg-black/60 backdrop-blur-[2px]" style={{ top: 0, left: 0, right: 0, height: rect.top }} aria-hidden="true" />
            <div className="fixed z-[60] bg-black/60 backdrop-blur-[2px]" style={{ top: rect.bottom, left: 0, right: 0, bottom: 0 }} aria-hidden="true" />
            <div className="fixed z-[60] bg-black/60 backdrop-blur-[2px]" style={{ top: rect.top, left: 0, width: rect.left, height: rect.height }} aria-hidden="true" />
            <div className="fixed z-[60] bg-black/60 backdrop-blur-[2px]" style={{ top: rect.top, left: rect.right, right: 0, height: rect.height }} aria-hidden="true" />

            {/* Transparent click-blocker over spotlight — prevents interaction with underlying UI */}
            <div
                className="fixed z-[62]"
                style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
                aria-hidden="true"
            />

            {/* Spotlight ring — inset shadow avoids clipping at viewport edges */}
            <div
                className="pointer-events-none fixed z-[65] rounded-xl"
                style={{
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                    boxShadow: 'inset 0 0 0 2px hsl(var(--info))',
                }}
                aria-hidden="true"
            />

            {/* Popover card */}
            <div
                ref={cardRef}
                role="dialog"
                aria-modal="false"
                aria-label={step === 1 ? cm.step1Title : cm.step2Title}
                className="fixed z-[70] w-[300px] overflow-y-auto rounded-xl border border-white/10 bg-[var(--editor-surface-elevated)] p-4 shadow-2xl"
                style={{
                    top: popoverTop,
                    left: popoverLeft,
                    width: cardWidth,
                    transform: cardTransform,
                    maxHeight: cardMaxHeight,
                }}
            >
                <p className="text-[11px] font-medium uppercase tracking-wide text-cyan-400">{step}/2</p>
                <p className="mt-1 text-sm font-semibold text-white">
                    {step === 1 ? cm.step1Title : cm.step2Title}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-gray-300">
                    {step === 1 ? cm.step1Body : cm.step2Body}
                </p>
                <div className="mt-4 flex items-center justify-between">
                    {step === 2 ? (
                        <button
                            type="button"
                            onClick={back}
                            className="text-xs text-gray-400 transition-colors hover:text-white"
                        >
                            {cm.back}
                        </button>
                    ) : <span />}
                    <button
                        type="button"
                        onClick={next}
                        className="rounded-lg bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                    >
                        {step === 1 ? cm.next : cm.finish}
                    </button>
                </div>
            </div>
        </>
    )
}
