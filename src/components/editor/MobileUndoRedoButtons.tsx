'use client'

import React from 'react'
import { Undo2, Redo2 } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

export function MobileUndoRedoButtons({ className }: { className?: string }) {
    const { t } = useI18n()
    const ur = t.editor.undoRedo
    const undo = useEditorStore((s) => s.undo)
    const redo = useEditorStore((s) => s.redo)
    const canUndo = useEditorStore((s) => s.canUndo)
    const canRedo = useEditorStore((s) => s.canRedo)
    const historyIndex = useEditorStore((s) => s.historyIndex)
    const historyLength = useEditorStore((s) => s.history.length)

    const undoCount = historyIndex
    const redoCount = historyLength - 1 - historyIndex

    const isUndoEnabled = canUndo()
    const isRedoEnabled = canRedo()

    // FR-09 Haptic Feedback
    const triggerHaptic = (duration = 50) => {
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(duration)
        }
    }

    const handleUndo = () => {
        triggerHaptic()
        undo()
    }

    const handleRedo = () => {
        triggerHaptic()
        redo()
    }

    return (
        <div
            className={cn(
                "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full p-1.5 shadow-2xl bg-slate-900 border border-white/10 backdrop-blur-md",
                className
            )}
            role="group"
            aria-label={ur.mobileGroupLabel}
        >
            {/* Touch-Accessible Undo (>44px) */}
            <button
                onClick={handleUndo}
                disabled={!isUndoEnabled}
                aria-label={`${ur.undo}${undoCount > 0 ? ` (${undoCount})` : ''}`}
                className={cn(
                    'relative flex h-12 w-16 items-center justify-center rounded-full transition-all duration-150 touch-manipulation',
                    'bg-white/5 text-[#F8FAFC]',
                    isUndoEnabled
                        ? 'opacity-100 active:scale-95 active:bg-white/10'
                        : 'opacity-40 cursor-not-allowed',
                )}
            >
                <Undo2 className="h-5 w-5" strokeWidth={2} />
                {undoCount > 0 && isUndoEnabled && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-slate-900">
                        {undoCount}
                    </span>
                )}
            </button>

            <div className="h-6 w-px bg-white/10" />

            {/* Touch-Accessible Redo (>44px) */}
            <button
                onClick={handleRedo}
                disabled={!isRedoEnabled}
                aria-label={`${ur.redo}${redoCount > 0 ? ` (${redoCount})` : ''}`}
                className={cn(
                    'relative flex h-12 w-16 items-center justify-center rounded-full transition-all duration-150 touch-manipulation',
                    'bg-white/5 text-[#F8FAFC]',
                    isRedoEnabled
                        ? 'opacity-100 active:scale-95 active:bg-white/10'
                        : 'opacity-40 cursor-not-allowed',
                )}
            >
                <Redo2 className="h-5 w-5" strokeWidth={2} />
                {redoCount > 0 && isRedoEnabled && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-slate-900">
                        {redoCount}
                    </span>
                )}
            </button>
        </div>
    )
}
