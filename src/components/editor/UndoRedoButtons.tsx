'use client'

import React from 'react'
import { Undo2, Redo2 } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

/**
 * UndoRedoButtons — Toolbar component for F11 Undo/Redo
 * Design: Figma node 30678-7083
 *   - Height 32px, border-radius 10px, Inter Medium 12px #F8FAFC
 *   - Opacity 0.5 when disabled
 *   - Count badge beside label
 *   - Gap between buttons: 4px
 */
export function UndoRedoButtons({ className }: { className?: string }) {
    const { t } = useI18n()
    const ur = t.editor.undoRedo
    const undo = useEditorStore((s) => s.undo)
    const redo = useEditorStore((s) => s.redo)
    const canUndo = useEditorStore((s) => s.canUndo)
    const canRedo = useEditorStore((s) => s.canRedo)
    const undoLabel = useEditorStore((s) => s.undoLabel)
    const redoLabel = useEditorStore((s) => s.redoLabel)
    const historyIndex = useEditorStore((s) => s.historyIndex)
    const historyLength = useEditorStore((s) => s.history.length)

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

    const undoCount = historyIndex
    const redoCount = historyLength - 1 - historyIndex

    const isUndoEnabled = canUndo()
    const isRedoEnabled = canRedo()

    return (
        <div className={cn("flex items-center gap-1", className)} role="group" aria-label={ur.groupLabel}>
            {/* Undo */}
            <button
                onClick={handleUndo}
                disabled={!isUndoEnabled}
                title={isUndoEnabled ? ur.undoTooltip.replace('{label}', undoLabel() ?? ur.lastChange) : ur.nothingToUndo}
                aria-label={`${ur.undo}${undoCount > 0 ? ` (${undoCount})` : ''}`}
                className={cn(
                    'flex h-8 items-center gap-2 rounded-[10px] px-2.5 transition-all duration-150 touch-manipulation',
                    'bg-white/5 text-[var(--editor-text)] font-medium text-[12px]',
                    isUndoEnabled
                        ? 'opacity-100 hover:bg-white/15 cursor-pointer'
                        : 'opacity-50 cursor-not-allowed',
                )}
            >
                <Undo2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span>{ur.undo}</span>
                {undoCount > 0 && isUndoEnabled && (
                    <span className="rounded px-1 py-px text-[10px] leading-none font-semibold bg-white/10 text-[var(--editor-text)]/70 tabular-nums">
                        {undoCount}
                    </span>
                )}
            </button>

            {/* Redo */}
            <button
                onClick={handleRedo}
                disabled={!isRedoEnabled}
                title={isRedoEnabled ? ur.redoTooltip.replace('{label}', redoLabel() ?? ur.lastUndoneChange) : ur.nothingToRedo}
                aria-label={`${ur.redo}${redoCount > 0 ? ` (${redoCount})` : ''}`}
                className={cn(
                    'flex h-8 items-center gap-2 rounded-[10px] px-2.5 transition-all duration-150 touch-manipulation',
                    'bg-white/5 text-[var(--editor-text)] font-medium text-[12px]',
                    isRedoEnabled
                        ? 'opacity-100 hover:bg-white/15 cursor-pointer'
                        : 'opacity-50 cursor-not-allowed',
                )}
            >
                <Redo2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span>{ur.redo}</span>
                {redoCount > 0 && isRedoEnabled && (
                    <span className="rounded px-1 py-px text-[10px] leading-none font-semibold bg-white/10 text-[var(--editor-text)]/70 tabular-nums">
                        {redoCount}
                    </span>
                )}
            </button>
        </div>
    )
}
