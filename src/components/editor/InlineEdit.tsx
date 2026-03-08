/**
 * Inline AI Edit Component
 * F-03: Enables AI-powered inline text editing in the editor.
 *
 * Features:
 * - Click text → edit inline
 * - AI rewrite suggestions (Sparkles icon)
 * - Enter to save, Esc to cancel
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Loader2, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type InlineEditProps = {
    value: string
    onSave: (newValue: string) => void
    placeholder?: string
    multiline?: boolean
    maxLength?: number
    blockType?: string         // Context for AI (e.g., "hero")
    fieldName?: string         // Context for AI (e.g., "headline")
    className?: string
    previewClassName?: string
}

export function InlineEdit({
    value,
    onSave,
    placeholder = 'Click to edit...',
    multiline = false,
    maxLength,
    blockType,
    fieldName,
    className,
    previewClassName,
}: InlineEditProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState(value)
    const [isRewriting, setIsRewriting] = useState(false)
    const [showAIInput, setShowAIInput] = useState(false)
    const [aiInstruction, setAIInstruction] = useState('')
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
    const aiInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        setEditValue(value)
    }, [value])

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])

    useEffect(() => {
        if (showAIInput && aiInputRef.current) {
            aiInputRef.current.focus()
        }
    }, [showAIInput])

    const handleSave = () => {
        if (editValue !== value) {
            onSave(editValue)
        }
        setIsEditing(false)
        setShowAIInput(false)
    }

    const handleCancel = () => {
        setEditValue(value)
        setIsEditing(false)
        setShowAIInput(false)
        setAIInstruction('')
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSave()
        }
        if (e.key === 'Escape') {
            handleCancel()
        }
    }

    const handleAIRewrite = async () => {
        if (!aiInstruction.trim()) return
        setIsRewriting(true)

        try {
            const res = await fetch('/api/ai/rewrite-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: editValue,
                    instruction: aiInstruction,
                    context: blockType ? `${blockType} ${fieldName || ''}` : undefined,
                }),
            })

            const data = await res.json()
            if (data.rewritten) {
                setEditValue(data.rewritten)
            }
        } catch (err) {
            console.error('AI rewrite failed', err)
        } finally {
            setIsRewriting(false)
            setAIInstruction('')
            setShowAIInput(false)
        }
    }

    if (!isEditing) {
        return (
            <span
                onClick={() => setIsEditing(true)}
                className={cn(
                    'cursor-pointer rounded px-1 -mx-1 transition-colors hover:bg-blue-500/10 hover:ring-1 hover:ring-blue-500/30',
                    !value && 'text-gray-500 italic',
                    previewClassName
                )}
                title="Click to edit"
            >
                {value || placeholder}
            </span>
        )
    }

    return (
        <div className={cn('relative', className)}>
            <div className="flex items-start gap-1">
                {multiline ? (
                    <textarea
                        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                        value={editValue}
                        onChange={e => setEditValue(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={3}
                        className="flex-1 rounded-md border border-blue-500/50 bg-[#1E293B] px-2 py-1.5 text-sm text-white outline-none resize-none"
                    />
                ) : (
                    <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        value={editValue}
                        onChange={e => setEditValue(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1 rounded-md border border-blue-500/50 bg-[#1E293B] px-2 py-1.5 text-sm text-white outline-none"
                    />
                )}
                <div className="flex flex-col gap-0.5">
                    <button onClick={handleSave} className="rounded p-1 text-green-400 hover:bg-green-500/10" title="Save">
                        <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={handleCancel} className="rounded p-1 text-red-400 hover:bg-red-500/10" title="Cancel">
                        <X className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={() => setShowAIInput(!showAIInput)}
                        className={cn('rounded p-1 transition-colors', showAIInput ? 'text-purple-400 bg-purple-500/10' : 'text-gray-500 hover:bg-purple-500/10 hover:text-purple-400')}
                        title="AI Rewrite"
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* AI Rewrite input */}
            {showAIInput && (
                <div className="mt-1.5 flex items-center gap-1.5 rounded-md border border-purple-500/30 bg-purple-500/5 px-2 py-1.5">
                    <Sparkles className="h-3 w-3 text-purple-400 shrink-0" />
                    <input
                        ref={aiInputRef}
                        value={aiInstruction}
                        onChange={e => setAIInstruction(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAIRewrite(); if (e.key === 'Escape') setShowAIInput(false) }}
                        placeholder="e.g. Viết ngắn hơn, thêm emoji..."
                        className="flex-1 bg-transparent text-xs text-white placeholder-gray-500 outline-none"
                        disabled={isRewriting}
                    />
                    {isRewriting ? (
                        <Loader2 className="h-3 w-3 animate-spin text-purple-400" />
                    ) : (
                        <button onClick={handleAIRewrite} disabled={!aiInstruction.trim()}
                            className="rounded px-2 py-0.5 text-[10px] font-medium bg-purple-600 text-white disabled:opacity-30 hover:bg-purple-500">
                            Rewrite
                        </button>
                    )}
                </div>
            )}

            {maxLength && (
                <div className="mt-0.5 text-right text-[10px] text-gray-600">
                    {editValue.length}/{maxLength}
                </div>
            )}
        </div>
    )
}
