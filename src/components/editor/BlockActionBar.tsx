'use client'

import type { PointerEvent as ReactPointerEvent } from 'react'
import { GripVertical, ChevronUp, ChevronDown, Copy, Sparkles, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface BlockActionBarProps {
    blockIndex: number
    blockType: string
    blockVariant?: string
    blockName: string
    totalBlocks: number
    isMobile?: boolean
    onMoveUp: () => void
    onMoveDown: () => void
    onDuplicate: () => void
    onAIEdit: () => void
    onDelete: () => void
    deleteDisabled?: boolean
    deleteDisabledTitle?: string
    onDragStart?: (event: ReactPointerEvent<HTMLButtonElement>) => void
    position: { top: number; left: number; width: number }
}

const ACTION_BTN = 'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed'

// Floating widgets (non-inline variant) are position:fixed — drag-to-order and duplicate are not applicable.
const FLOATING_WIDGET_BLOCK_TYPES = new Set(['socialWidget', 'whatsapp-button', 'cartWidget'])

export function BlockActionBar({
    blockIndex,
    blockType,
    blockVariant,
    blockName,
    totalBlocks,
    isMobile = false,
    onMoveUp,
    onMoveDown,
    onDuplicate,
    onAIEdit,
    onDelete,
    deleteDisabled,
    deleteDisabledTitle,
    onDragStart,
    position,
}: BlockActionBarProps) {
    // Hide for global blocks (navigation/footer)
    if (blockType === 'navigation' || blockType === 'footer') return null

    // Only floating variant (not inline) disables drag/duplicate
    const isFloatingWidget = FLOATING_WIDGET_BLOCK_TYPES.has(blockType) && blockVariant !== 'inline'
    const showDrag = !isMobile && onDragStart && !isFloatingWidget
    const showMoveUpDown = isMobile && !isFloatingWidget

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
            {showDrag && (
                <>
                    <button
                        type="button"
                        className={cn(ACTION_BTN, 'cursor-grab active:cursor-grabbing')}
                        title="Drag to reorder"
                        onPointerDown={onDragStart}
                    >
                        <GripVertical className="h-4 w-4 text-slate-400" />
                    </button>
                    <div className="h-5 w-px bg-white/10" />
                </>
            )}

            {showMoveUpDown && (
                <>
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
                </>
            )}

            {!isFloatingWidget && (
                <button type="button" className={ACTION_BTN} onClick={onDuplicate} title="Duplicate block">
                    <Copy className="h-3.5 w-3.5 text-slate-300" />
                </button>
            )}
            <button type="button" className={ACTION_BTN} onClick={onAIEdit} title="Edit with AI">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            </button>

            <div className="h-5 w-px bg-white/10" />

            <TooltipProvider delayDuration={200}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className="inline-flex">
                            <button
                                type="button"
                                className={cn(ACTION_BTN, !deleteDisabled && 'hover:bg-red-500/15')}
                                onClick={deleteDisabled ? undefined : onDelete}
                                disabled={deleteDisabled}
                            >
                                <Trash2 className="h-3.5 w-3.5 text-red-400" />
                            </button>
                        </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                        {deleteDisabled
                            ? (deleteDisabledTitle ?? `Delete ${blockName}`)
                            : `Delete ${blockName}`}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    )
}
