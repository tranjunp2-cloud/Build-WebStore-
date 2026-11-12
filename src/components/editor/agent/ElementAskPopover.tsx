'use client'

import type { ContextElement, ContextElementKind } from '@ech/agent-core'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowUp, FileText, Image as ImageIcon, LayoutTemplate, Menu, MousePointerClick, PanelBottom, Search, Type, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/i18n'

// things on the page only: a record picked in the chat (product / post) is never asked about here
const KIND_ICON: Partial<Record<ContextElementKind, LucideIcon>> = {
    text: Type,
    button: MousePointerClick,
    image: ImageIcon,
    section: LayoutTemplate,
    seo: Search,
    menu: Menu,
    footer: PanelBottom,
    page: FileText,
}

export const MAX_ASK_LENGTH = 300

/** The element's chip — the same one that lands in the chat. */
export function ElementAskChip({ element }: { element: ContextElement }) {
    const { t } = useI18n()
    const Icon = KIND_ICON[element.kind] ?? Type
    return (
        <span className="inline-flex h-[26px] max-w-[160px] shrink-0 items-center gap-1.5 rounded-[7px] border border-solid border-[#3e4c60] bg-[#1c2537] pl-1.5 pr-2 text-xs text-slate-100">
            <Icon className="h-[13px] w-[13px] shrink-0 text-teal-300" aria-hidden />
            <b className="shrink-0 font-medium text-slate-400">{(t.editor.elementAsk.kinds as Record<string, string>)[element.kind] ?? element.kind}</b>
            <span className="truncate">{element.label}</span>
        </span>
    )
}

interface ElementAskPopoverProps {
    element: ContextElement
    /** "Now: …" line; omitted for pictures and sections */
    currentValue?: string
    onClose: () => void
    /** empty prompt = attach the element and continue in the chat */
    onSend: (prompt: string) => void
}

/**
 * Ask AI on one element: its chip, one line to say what should change, what it
 * says now and two or three one-tap asks for its kind. Enter sends it to the
 * chat (the element flies there); Enter with nothing typed just attaches it.
 * Esc closes. The chat does the work: approval, history and Undo live there.
 */
export function ElementAskPopover({ element, currentValue, onClose, onSend }: ElementAskPopoverProps) {
    const { t } = useI18n()
    const labels = t.editor.elementAsk
    const [text, setText] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)
    const reduce = useReducedMotion()
    const suggestions = (labels.suggestions as Record<string, string[]>)[element.kind] ?? []

    useEffect(() => {
        const id = requestAnimationFrame(() => inputRef.current?.focus())
        return () => cancelAnimationFrame(id)
    }, [])

    return (
        <motion.div
            role="dialog"
            aria-label={`${labels.title}: ${(labels.kinds as Record<string, string>)[element.kind] ?? element.kind} ${element.label}`}
            initial={reduce ? false : { opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
            className="rounded-xl border border-solid border-[#2a3645] bg-[#111827] p-2 text-left text-slate-200 shadow-[0_8px_28px_rgba(0,0,0,0.45)]"
            onKeyDown={(event) => {
                if (event.key === 'Escape') {
                    event.stopPropagation()
                    onClose()
                }
            }}
        >
            <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                    event.preventDefault()
                    onSend(text.trim())
                }}
            >
                <ElementAskChip element={element} />
                <input
                    ref={inputRef}
                    value={text}
                    maxLength={MAX_ASK_LENGTH}
                    onChange={(event) => setText(event.target.value)}
                    placeholder={labels.placeholder}
                    aria-label={labels.placeholder}
                    autoComplete="off"
                    className="h-[34px] min-w-0 flex-1 border-0 bg-transparent text-[13.5px] text-slate-50 outline-none placeholder:text-slate-400"
                />
                <button
                    type="submit"
                    aria-label={labels.send}
                    title={labels.send}
                    className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] border-0 bg-[#2dd4bf] text-[#0b1120] transition-colors hover:bg-[#22b8a6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/60"
                >
                    <ArrowUp className="h-4 w-4" aria-hidden />
                </button>
            </form>
            {(currentValue || suggestions.length > 0) && (
                <>
                    <div className="mx-0.5 mb-1.5 mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                        {currentValue ? (
                            <>
                                <span className="shrink-0">{labels.now}</span>
                                <span className="min-w-0 truncate text-slate-300">“{currentValue}”</span>
                            </>
                        ) : null}
                        <span className="ml-auto shrink-0">{labels.hint}</span>
                    </div>
                    {suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 border-0 border-t border-solid border-[#1e293b] px-0.5 pb-0.5 pt-2">
                            {suggestions.map((suggestion) => (
                                <button
                                    key={suggestion}
                                    type="button"
                                    onClick={() => onSend(suggestion)}
                                    className="inline-flex h-[26px] items-center whitespace-nowrap rounded-full border border-solid border-[#2a3645] bg-transparent px-2.5 text-xs text-slate-300 transition-colors hover:border-[#3e4c60] hover:bg-[#1f2937] hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/60"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}
        </motion.div>
    )
}
