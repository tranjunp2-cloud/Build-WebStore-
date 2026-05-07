'use client'

import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { FAQConfig, FAQItem } from '@/blocks/faq/config'
import { useI18n } from '@/i18n'

type FieldBlurEvent = React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>

interface FaqSettingsProps {
    block: FAQConfig
    blockIndex: number
    onBlockUpdate: (idx: number, changes: Record<string, unknown>) => void
}

// Mirror canvas resolution: Payload stores items as `faqs`, frontend config uses `items`
function resolveItems(block: FAQConfig): FAQItem[] {
    const rawFaqs = (block as Record<string, unknown>).faqs
    return (Array.isArray(rawFaqs) ? rawFaqs as FAQItem[] : null) ?? block.items ?? []
}

// Write to both fields so canvas (reads `faqs`) and config (reads `items`) stay in sync
function buildUpdate(newItems: FAQItem[]): Record<string, unknown> {
    return { items: newItems, faqs: newItems }
}

export default function FaqSettings({ block, blockIndex, onBlockUpdate }: FaqSettingsProps) {
    const { t } = useI18n()
    const s = t.editor.settings
    const [isOpen, setIsOpen] = useState(true)
    // Incremented on every mid-list remove so item keys change → React remounts inputs with fresh defaultValue
    const [removeVersion, setRemoveVersion] = useState(0)
    // Guard against infinite loop: only pad once per transition below 3
    const paddedRef = useRef(false)

    const items = resolveItems(block)
    const count = items.length

    // Pad to minimum 3 items on mount or when undo brings count below 3
    useEffect(() => {
        if (items.length >= 3) { paddedRef.current = false; return }
        if (paddedRef.current) return
        paddedRef.current = true
        const padding: FAQItem[] = Array.from({ length: 3 - items.length }, (_, i) => ({
            question: `Question ${items.length + i + 1}`,
            answer: `Answer ${items.length + i + 1}`,
        }))
        onBlockUpdate(blockIndex, buildUpdate([...items, ...padding]))
    }, [blockIndex, items.length]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleAdd = () => {
        const n = count + 1
        onBlockUpdate(blockIndex, buildUpdate([...items, { question: `Question ${n}`, answer: `Answer ${n}` }]))
    }

    const handleRemoveLast = () => {
        if (count <= 3) return
        onBlockUpdate(blockIndex, buildUpdate(items.slice(0, -1)))
    }

    const handleRemoveAt = (i: number) => {
        if (count <= 3) return
        onBlockUpdate(blockIndex, buildUpdate(items.filter((_, idx) => idx !== i)))
        setRemoveVersion(v => v + 1)
    }

    const handleQuestionBlur = (i: number, e: FieldBlurEvent) => {
        const original = items[i]?.question
        if (e.target.value === original) return
        const updated = items.map((it, idx) => idx === i ? { ...it, question: e.target.value } : it)
        onBlockUpdate(blockIndex, buildUpdate(updated))
    }

    const handleAnswerBlur = (i: number, e: FieldBlurEvent) => {
        const original = items[i]?.answer
        // Preserve JSONContent answers — do not overwrite with empty string on blur
        if (typeof original !== 'string') return
        if (e.target.value === original) return
        const updated = items.map((it, idx) => idx === i ? { ...it, answer: e.target.value } : it)
        onBlockUpdate(blockIndex, buildUpdate(updated))
    }

    return (
        <div className="mb-3">
            <div className="bg-[rgba(30,41,59,0.3)] border border-[rgba(59,130,246,0.04)] rounded-xl overflow-hidden">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between px-3 h-12"
                >
                    <span className="text-sm font-medium text-white">{s.faqConfiguration}</span>
                    <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', isOpen && 'rotate-180')} />
                </button>
                {isOpen && (
                    <div className="px-3 pb-3">
                        <div className="flex gap-4 items-center">
                            <div className="w-[100px] shrink-0">
                                <p className="text-[12px] font-medium text-[#94a3b8] leading-4">{s.numberOfFaqs}</p>
                                <p className="text-[10px] text-[#94a3b8] leading-4">{s.faqsMinMax}</p>
                            </div>
                            <div className="flex flex-1 items-center justify-center gap-2">
                                <button
                                    type="button"
                                    aria-label="Decrease FAQ count"
                                    disabled={count <= 3}
                                    onClick={handleRemoveLast}
                                    className="h-[38px] w-[44px] rounded-xl border border-[rgba(59,130,246,0.04)] text-white text-sm font-medium disabled:opacity-30 hover:bg-white/5 transition-colors"
                                >−</button>
                                <div className="h-[38px] w-[44px] rounded-xl border border-[rgba(59,130,246,0.04)] bg-[#1f2937] flex items-center justify-center text-white text-sm font-medium">
                                    {count}
                                </div>
                                <button
                                    type="button"
                                    aria-label="Increase FAQ count"
                                    disabled={count >= 10}
                                    onClick={handleAdd}
                                    className="h-[38px] w-[44px] rounded-xl border border-[rgba(59,130,246,0.04)] bg-[#0b1120] text-white text-sm font-medium disabled:opacity-30 hover:bg-white/10 transition-colors"
                                >+</button>
                            </div>
                        </div>
                        <div className="mt-3 space-y-3">
                            {items.map((item, i) => (
                                <div key={`${i}-${removeVersion}`} className="relative rounded-lg bg-white/5 p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-gray-500">FAQ {i + 1}</span>
                                        <button
                                            type="button"
                                            aria-label={`Remove FAQ item ${i + 1}`}
                                            disabled={count <= 3}
                                            onClick={() => handleRemoveAt(i)}
                                            className="text-[10px] text-red-400 hover:text-red-300 disabled:opacity-30"
                                        >✕</button>
                                    </div>
                                    <Input
                                        defaultValue={typeof item.question === 'string' ? item.question : ''}
                                        placeholder={s.questionPlaceholder}
                                        variant="editor"
                                        className="mt-1.5"
                                        onBlur={(e: FieldBlurEvent) => handleQuestionBlur(i, e)}
                                    />
                                    <Textarea
                                        readOnly={typeof item.answer !== 'string'}
                                        defaultValue={typeof item.answer === 'string' ? item.answer : ''}
                                        placeholder={typeof item.answer !== 'string' ? '(Rich text — chỉnh sửa trong Admin Panel)' : s.answerPlaceholder}
                                        variant="editor"
                                        className={cn('mt-1.5 min-h-[96px]', typeof item.answer !== 'string' && 'opacity-50 cursor-not-allowed')}
                                        onBlur={typeof item.answer !== 'string' ? undefined : (e: FieldBlurEvent) => handleAnswerBlur(i, e)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
