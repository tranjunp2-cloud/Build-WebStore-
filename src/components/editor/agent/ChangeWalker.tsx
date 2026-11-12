'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useI18n } from '@/i18n'
import { useChangeWalker } from './change-walker-store'
import { revealInEditor } from './editor-agent-context'

const STEP_BTN =
    'inline-flex h-8 w-8 border-0 bg-transparent items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60'

/**
 * The bar under the canvas after "Show" on a change: "2/4 · Hero · Button 1:
 * Mua ngay → Khám phá bộ sưu tập", ‹ › to go to each place the change touched
 * (← → keys too), Done or Esc to close. Each step reveals its place: page,
 * Settings tab, section, the element outlined, its field pulsed.
 */
export function ChangeWalker() {
    const { t } = useI18n()
    const labels = t.editor.elementAsk.walker
    const { targets, index, seq, step, close } = useChangeWalker()
    const target = targets[index]
    const barRef = useRef<HTMLDivElement>(null)
    const reduce = useReducedMotion()

    useEffect(() => {
        if (target) revealInEditor(target)
        // seq: the same place again (‹ › on one change) still reveals
    }, [target, seq])

    useEffect(() => {
        if (!target) return
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') close()
            // arrows only while the bar has focus: the canvas and the fields keep theirs
            if (!barRef.current?.contains(document.activeElement)) return
            if (event.key === 'ArrowLeft') step(-1)
            if (event.key === 'ArrowRight') step(1)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [target, step, close])

    if (!target) return null
    const many = targets.length > 1
    return (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[220] flex justify-center px-4">
            <motion.div
                ref={barRef}
                role="toolbar"
                aria-label={labels.label}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                className="pointer-events-auto flex w-full max-w-[560px] items-center gap-2.5 rounded-xl border border-solid border-[#2a3645] bg-[#111827] py-2 pl-3 pr-2 text-slate-200 shadow-[0_8px_28px_rgba(0,0,0,0.45)]"
            >
                <Sparkles className="h-4 w-4 shrink-0 text-[#5eead4]" aria-hidden />
                <p className="min-w-0 flex-1 truncate text-[13px]" aria-live="polite" title={`${target.where}: ${target.before ?? ''} → ${target.after ?? ''}`}>
                    {many && <span className="mr-1.5 font-medium tabular-nums text-slate-400">{index + 1}/{targets.length}</span>}
                    <span>{target.where}</span>
                    {target.after !== undefined && (
                        <span className="text-slate-400">
                            {': '}
                            {target.before ? `${target.before} → ` : '+ '}
                            <span className="text-slate-100">{target.after}</span>
                        </span>
                    )}
                </p>
                {many && (
                    <>
                        <button type="button" className={STEP_BTN} onClick={() => step(-1)} aria-label={labels.prev} title={labels.prev}>
                            <ChevronLeft className="h-4 w-4" aria-hidden />
                        </button>
                        <button type="button" className={STEP_BTN} onClick={() => step(1)} aria-label={labels.next} title={labels.next}>
                            <ChevronRight className="h-4 w-4" aria-hidden />
                        </button>
                    </>
                )}
                <button
                    type="button"
                    onClick={close}
                    className="h-8 rounded-lg border border-solid border-[#2a3645] bg-transparent px-3 text-[13px] font-medium text-slate-100 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
                >
                    {labels.done}
                </button>
            </motion.div>
        </div>
    )
}
