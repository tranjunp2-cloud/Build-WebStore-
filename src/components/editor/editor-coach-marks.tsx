'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '@/i18n'

const STORAGE_KEY = 'editor:coach-marks:v1:seen'
const CARD_WIDTH = 300
const VIEWPORT_MARGIN = 16

type Step = 0 | 1 | 2

interface Props {
    /** Called when step 1 is about to show — parent switches left sidebar to pages tab */
    onEnterStep1?: () => void
    /** Called when user enters step 2 — parent switches right panel to menu tab */
    onEnterStep2?: () => void
    /** Delay before showing step 1, to let editor layout settle */
    mountDelayMs?: number
}

function useAnchorRect(step: Step): DOMRect | null {
    const [rect, setRect] = useState<DOMRect | null>(null)

    useEffect(() => {
        if (step === 0) { setRect(null); return }

        const selector = step === 1 ? '[data-coach="page-library"]' : '[data-coach="menu-settings"]'
        // Step 2 anchor is inside a conditionally-rendered tab (renderMenuContent).
        // onEnterStep2 triggers requestedTab → SettingsPanel useEffect → setActiveTab → re-render.
        // That is 2 React flush cycles; 150ms covers the worst-case tab-switch commit latency.
        const delay = step === 2 ? 150 : 50
        const timer = window.setTimeout(() => {
            const el = document.querySelector<HTMLElement>(selector)
            setRect(el ? el.getBoundingClientRect() : null)
        }, delay)

        const handleResize = () => {
            const el = document.querySelector<HTMLElement>(selector)
            setRect(el ? el.getBoundingClientRect() : null)
        }
        window.addEventListener('resize', handleResize)
        return () => {
            window.clearTimeout(timer)
            window.removeEventListener('resize', handleResize)
        }
    }, [step])

    return rect
}

export function EditorCoachMarks({ onEnterStep1, onEnterStep2, mountDelayMs = 500 }: Props) {
    const { t } = useI18n()
    const cm = t.editor.coachMarks
    const [step, setStep] = useState<Step>(0)
    const rect = useAnchorRect(step)

    // On mount: skip if already seen; otherwise switch sidebar to pages tab then show step 1
    useEffect(() => {
        if (typeof window === 'undefined') return
        let alreadySeen = false
        try { alreadySeen = window.localStorage.getItem(STORAGE_KEY) === 'true' } catch { /* private/incognito */ }
        if (alreadySeen) return
        const timer = window.setTimeout(() => {
            onEnterStep1?.()
            setStep(1)
        }, mountDelayMs)
        return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mountDelayMs])

    const finish = useCallback(() => {
        try { window.localStorage.setItem(STORAGE_KEY, 'true') } catch { /* private/incognito — non-fatal */ }
        setStep(0)
    }, [])

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

    // Position popover: step 1 (left panel) → to the right; step 2 (right panel) → to the left
    const popoverLeft = step === 1
        ? rect.right + 16
        : rect.left - CARD_WIDTH - 16

    // Clamp vertical position so card (after translateY -50%) fits in viewport.
    // Falls back to anchor-center on first render before cardHeight is measured.
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 0
    const anchorCenter = rect.top + rect.height / 2
    const halfH = cardHeight / 2
    const popoverTop = cardHeight === 0 || viewportH === 0
        ? anchorCenter
        : Math.min(
            Math.max(anchorCenter, halfH + VIEWPORT_MARGIN),
            viewportH - halfH - VIEWPORT_MARGIN,
        )

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
                    boxShadow: 'inset 0 0 0 2px #22d3ee',
                }}
                aria-hidden="true"
            />

            {/* Popover card */}
            <div
                ref={cardRef}
                role="dialog"
                aria-modal="false"
                aria-label={step === 1 ? cm.step1Title : cm.step2Title}
                className="fixed z-[70] w-[300px] overflow-y-auto rounded-xl border border-white/10 bg-[#1e293b] p-4 shadow-2xl"
                style={{
                    top: popoverTop,
                    left: popoverLeft,
                    transform: 'translateY(-50%)',
                    maxHeight: `calc(100vh - ${VIEWPORT_MARGIN * 2}px)`,
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
                        className="rounded-lg bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                    >
                        {step === 1 ? cm.next : cm.finish}
                    </button>
                </div>
            </div>
        </>
    )
}
