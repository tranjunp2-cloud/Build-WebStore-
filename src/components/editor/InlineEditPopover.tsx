'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

function normalizeInstructionValue(nextValue: string, previousValue: string): string {
    const isWrappedInStraightQuotes =
        nextValue.length >= 2 &&
        nextValue.startsWith('"') &&
        nextValue.endsWith('"')

    const isWrappedInCurlyQuotes =
        nextValue.length >= 2 &&
        nextValue.startsWith('“') &&
        nextValue.endsWith('”')

    if (!isWrappedInStraightQuotes && !isWrappedInCurlyQuotes) {
        return nextValue
    }

    const unwrappedValue = nextValue.slice(1, -1)
    if (unwrappedValue === previousValue || unwrappedValue.startsWith(previousValue)) {
        return unwrappedValue
    }

    return nextValue
}

interface InlineEditPopoverProps {
    blockType: string
    currentText: string
    isSubmitting: boolean
    onClose: () => void
    onSubmit: (instruction: string) => Promise<void> | void
}

export function InlineEditPopover({
    blockType,
    currentText,
    isSubmitting,
    onClose,
    onSubmit,
}: InlineEditPopoverProps) {
    const [instruction, setInstruction] = useState('')
    const inputRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [onClose])

    const handleSubmit = async () => {
        if (!instruction.trim() || isSubmitting) return
        await onSubmit(instruction.trim())
    }

    return (
        <div className="w-[360px] rounded-2xl border border-cyan-500/30 bg-[#0F172A] p-4 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400">
                        Inline AI Edit
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                        {blockType}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg p-1 text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500">
                    Current Text
                </div>
                <p className="mt-2 text-sm leading-6 text-gray-200">{currentText}</p>
            </div>

            <div className="mt-4">
                <label className="text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500">
                    How would you like to change this?
                </label>
                <textarea
                    ref={inputRef}
                    value={instruction}
                    onChange={event =>
                        setInstruction(prev => normalizeInstructionValue(event.target.value, prev))
                    }
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    onKeyDown={event => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault()
                            void handleSubmit()
                        }
                    }}
                    placeholder="For example: Make this more concise and premium."
                    className="mt-2 min-h-[100px] w-full resize-none rounded-xl border border-white/10 bg-[#111827] px-3 py-3 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-cyan-500/40"
                />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                    Cancel
                </Button>
                <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleSubmit()}
                    disabled={!instruction.trim() || isSubmitting}
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Applying
                        </>
                    ) : (
                        <>
                            <Sparkles className="h-3.5 w-3.5" />
                            Apply
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
}
