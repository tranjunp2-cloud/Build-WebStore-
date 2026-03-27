'use client'

import React from 'react'
import { Undo2, Redo2 } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { cn } from '@/lib/utils'

/**
 * UndoRedoButtons — Toolbar component for F11 Undo/Redo
 * Design: Figma node 30678-7083
 *   - Height 32px, border-radius 10px, Inter Medium 12px #F8FAFC
 *   - Opacity 0.5 when disabled
 *   - Count badge beside label
 *   - Gap between buttons: 4px
 */
export function UndoRedoButtons() {
    const undo = useEditorStore((s) => s.undo)
    const redo = useEditorStore((s) => s.redo)
    const canUndo = useEditorStore((s) => s.canUndo)
    const canRedo = useEditorStore((s) => s.canRedo)
    const undoLabel = useEditorStore((s) => s.undoLabel)
    const redoLabel = useEditorStore((s) => s.redoLabel)
    const historyIndex = useEditorStore((s) => s.historyIndex)
    const historyLength = useEditorStore((s) => s.history.length)

    const undoCount = historyIndex
    const redoCount = historyLength - 1 - historyIndex

    const isUndoEnabled = canUndo()
    const isRedoEnabled = canRedo()

    return (
        <div className="flex items-center gap-1" role="group" aria-label="Undo and redo">
            {/* Undo */}
            <button
                onClick={undo}
                disabled={!isUndoEnabled}
                title={isUndoEnabled ? `Undo: ${undoLabel() ?? 'last change'} (Ctrl+Z)` : 'Nothing to undo'}
                aria-label={`Undo${undoCount > 0 ? ` (${undoCount})` : ''}`}
                className={cn(
                    'flex h-8 items-center gap-2 rounded-[10px] px-2.5 transition-all duration-150',
                    'bg-white/5 text-[#F8FAFC] font-medium text-[12px]',
                    isUndoEnabled
                        ? 'opacity-100 hover:bg-white/15 cursor-pointer'
                        : 'opacity-50 cursor-not-allowed',
                )}
            >
                <Undo2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span>Undo</span>
                {undoCount > 0 && isUndoEnabled && (
                    <span className="rounded px-1 py-px text-[10px] leading-none font-semibold bg-white/10 text-[#F8FAFC]/70 tabular-nums">
                        {undoCount}
                    </span>
                )}
            </button>

            {/* Redo */}
            <button
                onClick={redo}
                disabled={!isRedoEnabled}
                title={isRedoEnabled ? `Redo: ${redoLabel() ?? 'last undone change'} (Ctrl+Y)` : 'Nothing to redo'}
                aria-label={`Redo${redoCount > 0 ? ` (${redoCount})` : ''}`}
                className={cn(
                    'flex h-8 items-center gap-2 rounded-[10px] px-2.5 transition-all duration-150',
                    'bg-white/5 text-[#F8FAFC] font-medium text-[12px]',
                    isRedoEnabled
                        ? 'opacity-100 hover:bg-white/15 cursor-pointer'
                        : 'opacity-50 cursor-not-allowed',
                )}
            >
                <Redo2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span>Redo</span>
                {redoCount > 0 && isRedoEnabled && (
                    <span className="rounded px-1 py-px text-[10px] leading-none font-semibold bg-white/10 text-[#F8FAFC]/70 tabular-nums">
                        {redoCount}
                    </span>
                )}
            </button>
        </div>
    )
}
