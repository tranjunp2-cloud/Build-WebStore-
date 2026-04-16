'use client'

import { GripVertical, ChevronUp, ChevronDown, Copy, Sparkles, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BlockActionBarProps {
    blockIndex: number
    blockType: string
    blockName: string
    totalBlocks: number
    onMoveUp: () => void
    onMoveDown: () => void
    onDuplicate: () => void
    onAIEdit: () => void
    onDelete: () => void
    position: { top: number; left: number; width: number }
}

const ACTION_BTN = 'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed'

export function BlockActionBar({
    blockIndex,
    blockType,
    blockName,
    totalBlocks,
    onMoveUp,
    onMoveDown,
    onDuplicate,
    onAIEdit,
    onDelete,
    position,
}: BlockActionBarProps) {
    // Hide for global blocks (navigation/footer)
    if (blockType === 'navigation' || blockType === 'footer') return null

    return (
        <div
            className="absolute z-[55] flex items-center gap-0.5 rounded-xl border border-white/10 bg-[#1E293B]/95 px-1.5 py-1 shadow-2xl backdrop-blur-sm animate-in fade-in duration-150"
            style={{
                top: position.top - 44,
                left: position.left + position.width / 2,
                transform: 'translateX(-50%)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <button type="button" className={cn(ACTION_BTN, 'cursor-grab')} title="Drag to reorder">
                <GripVertical className="h-4 w-4 text-slate-400" />
            </button>

            <div className="h-5 w-px bg-white/10" />

            <button
                type="button"
                className={ACTION_BTN}
                onClick={onMoveUp}
                disabled={blockIndex === 0}
                title="Move up"
            >
                <ChevronUp className="h-4 w-4 text-slate-300" />
            </button>
            <button
                type="button"
                className={ACTION_BTN}
                onClick={onMoveDown}
                disabled={blockIndex >= totalBlocks - 1}
                title="Move down"
            >
                <ChevronDown className="h-4 w-4 text-slate-300" />
            </button>

            <div className="h-5 w-px bg-white/10" />

            <button type="button" className={ACTION_BTN} onClick={onDuplicate} title="Duplicate block">
                <Copy className="h-3.5 w-3.5 text-slate-300" />
            </button>
            <button type="button" className={ACTION_BTN} onClick={onAIEdit} title="Edit with AI">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            </button>

            <div className="h-5 w-px bg-white/10" />

            <button
                type="button"
                className={cn(ACTION_BTN, 'hover:bg-red-500/15')}
                onClick={onDelete}
                title={`Delete ${blockName}`}
            >
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
            </button>
        </div>
    )
}
