'use client'

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/i18n'

const STORAGE_KEY = 'editor:coach-marks:v1:seen'
const CARD_WIDTH = 300

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
        // Small defer so React can finish rendering the anchored element
        const timer = window.setTimeout(() => {
            const el = document.querySelector<HTMLElement>(selector)
            setRect(el ? el.getBoundingClientRect() : null)
        }, 50)

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
        if (window.localStorage.getItem(STORAGE_KEY) === 'true') return
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

    const next = useCallback(() => {
        if (step === 1) {
            onEnterStep2?.()
            setStep(2)
        } else {
            finish()
        }
    }, [step, finish, onEnterStep2])

    // ESC key closes coach marks
    useEffect(() => {
        if (step === 0) return
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') finish() }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [step, finish])

    if (step === 0 || !rect) return null

    // Position popover: step 1 (left panel) → to the right; step 2 (right panel) → to the left
    const popoverLeft = step === 1
        ? rect.right + 16
        : rect.left - CARD_WIDTH - 16

    const popoverTop = rect.top + rect.height / 2

    return (
        <>
            {/* Dimmed backdrop — click to dismiss */}
            <div
                className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px]"
                aria-hidden="true"
                onClick={finish}
            />

            {/* Spotlight ring around anchor element */}
            <div
                className="pointer-events-none fixed z-[65] rounded-xl ring-2 ring-cyan-400 ring-offset-2 ring-offset-black/5"
                style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }}
                aria-hidden="true"
            />

            {/* Popover card */}
            <div
                role="dialog"
                aria-modal="false"
                aria-label={step === 1 ? cm.step1Title : cm.step2Title}
                className="fixed z-[70] w-[300px] rounded-xl border border-white/10 bg-[#1e293b] p-4 shadow-2xl"
                style={{ top: popoverTop, left: popoverLeft, transform: 'translateY(-50%)' }}
            >
                <p className="text-[11px] font-medium uppercase tracking-wide text-cyan-400">{step}/2</p>
                <p className="mt-1 text-sm font-semibold text-white">
                    {step === 1 ? cm.step1Title : cm.step2Title}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-gray-300">
                    {step === 1 ? cm.step1Body : cm.step2Body}
                </p>
                <div className="mt-4 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={finish}
                        className="text-xs text-gray-400 transition-colors hover:text-white"
                    >
                        {cm.skip}
                    </button>
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
