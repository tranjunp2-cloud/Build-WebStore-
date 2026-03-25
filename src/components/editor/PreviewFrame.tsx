'use client'

import React, { memo, useEffect, useState, useCallback, useRef } from 'react'
import { GripVertical, Loader2 } from 'lucide-react'
import { InlineEditPopover } from './InlineEditPopover'
import { useEditorStore } from '@/store/editorStore'
import { toast } from 'sonner'

interface PreviewFrameProps {
    siteId: string
    pageId: string | null
    iframeKey: number
    isLoading: boolean
    viewport: 'desktop' | 'mobile'
    onInlineEditApplied?: (content: string, blockIndex: number) => void
    onReorderBlocks?: (fromIndex: number, toIndex: number) => void
}

type HoverRect = {
    top: number
    left: number
    width: number
    height: number
}

type HoveredElementData = {
    rect: HoverRect | null
    text: string
    blockIndex: number
    blockType: string
    fieldPath: Array<string | number> | null
}

type BlockLayoutRect = HoverRect & {
    blockIndex: number
    blockType: string
}

type DragState = {
    sourceIndex: number
    sourceRect: HoverRect
    pointerOffsetY: number
    currentY: number
}

function getEditableBlockLayouts(layouts: BlockLayoutRect[]) {
    return layouts
        .filter(layout => !['navigation', 'footer'].includes(layout.blockType))
        .sort((a, b) => a.top - b.top)
}

function getFrameOverlayOffset(
    frameElement: HTMLIFrameElement | null,
    containerElement: HTMLDivElement | null,
) {
    if (!frameElement || !containerElement) {
        return null
    }

    const frameRect = frameElement.getBoundingClientRect()
    const containerRect = containerElement.getBoundingClientRect()

    return {
        top: frameRect.top - containerRect.top,
        left: frameRect.left - containerRect.left,
        width: frameRect.width,
    }
}

function findStringFieldPath(
    value: unknown,
    targetText: string,
    currentPath: Array<string | number> = [],
): Array<string | number> | null {
    if (typeof value === 'string') {
        if (value === targetText) return currentPath
        if (value.includes(targetText)) return currentPath
        return null
    }

    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
            const result = findStringFieldPath(value[index], targetText, [...currentPath, index])
            if (result) return result
        }
        return null
    }

    if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
            const result = findStringFieldPath(child, targetText, [...currentPath, key])
            if (result) return result
        }
    }

    return null
}

function updateValueAtPath(
    source: Record<string, unknown>,
    path: Array<string | number>,
    nextValue: string,
): Record<string, unknown> {
    const clone: any = JSON.parse(JSON.stringify(source))
    let cursor: any = clone

    for (let index = 0; index < path.length - 1; index += 1) {
        cursor = cursor[path[index]]
    }

    const finalKey = path[path.length - 1]
    cursor[finalKey] = nextValue

    return clone
}

function getValueAtPath(source: Record<string, unknown>, path: Array<string | number>): unknown {
    let cursor: any = source

    for (const segment of path) {
        cursor = cursor?.[segment]
    }

    return cursor
}

function PreviewFrameInner({
    siteId,
    pageId,
    iframeKey,
    isLoading,
    viewport,
    onInlineEditApplied,
    onReorderBlocks,
}: PreviewFrameProps) {
    const { blocks, updateBlock } = useEditorStore()
    const [hoverData, setHoverData] = useState<HoveredElementData | null>(null)
    const [blockHover, setBlockHover] = useState<BlockLayoutRect | null>(null)
    const [blockLayouts, setBlockLayouts] = useState<BlockLayoutRect[]>([])
    const [dragState, setDragState] = useState<DragState | null>(null)
    const [dropIndex, setDropIndex] = useState<number | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [frameElement, setFrameElement] = useState<HTMLIFrameElement | null>(null)
    const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null)
    const clearHoverTimerRef = useRef<number | null>(null)

    const cancelPendingHoverClear = useCallback(() => {
        if (clearHoverTimerRef.current !== null) {
            window.clearTimeout(clearHoverTimerRef.current)
            clearHoverTimerRef.current = null
        }
    }, [])

    useEffect(() => {
        const handleMessage = (e: MessageEvent) => {
            if (e.data?.type === 'BLOCK_HOVERED') {
                if (isEditing || dragState) return
                cancelPendingHoverClear()

                const nextData = e.data as Omit<HoveredElementData, 'fieldPath'> & { rect: HoverRect | null }
                const block = blocks[nextData.blockIndex]
                const fieldPath = block ? findStringFieldPath(block, nextData.text) : null

                setHoverData({
                    ...nextData,
                    fieldPath,
                })
            } else if (e.data?.type === 'BLOCK_CONTAINER_HOVERED') {
                if (isEditing || dragState) return
                setBlockHover(e.data.layout as BlockLayoutRect)
            } else if (e.data?.type === 'BLOCK_LAYOUT') {
                setBlockLayouts((e.data.layouts || []) as BlockLayoutRect[])
            } else if (e.data?.type === 'BLOCK_MOUSEOUT') {
                if (!isEditing && !dragState) {
                    cancelPendingHoverClear()
                    clearHoverTimerRef.current = window.setTimeout(() => {
                        setHoverData(null)
                        setBlockHover(null)
                        clearHoverTimerRef.current = null
                    }, 180)
                }
            } else if (e.data?.type === 'PREVIEW_POINTER_DOWN') {
                if (isEditing) {
                    setIsEditing(false)
                }
            }
        }
        window.addEventListener('message', handleMessage)
        return () => {
            cancelPendingHoverClear()
            window.removeEventListener('message', handleMessage)
        }
    }, [blocks, cancelPendingHoverClear, dragState, isEditing])

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsEditing(false)
            }
        }

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null
            if (!target) return
            if (target.closest('[data-inline-edit-popover]')) return
            if (target.closest('[data-inline-edit-trigger]')) return
            setIsEditing(false)
        }

        document.addEventListener('keydown', handleKeyDown)
        document.addEventListener('mousedown', handlePointerDown)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.removeEventListener('mousedown', handlePointerDown)
        }
    }, [])

    useEffect(() => {
        cancelPendingHoverClear()
        setHoverData(null)
        setBlockHover(null)
        setBlockLayouts([])
        setDragState(null)
        setDropIndex(null)
        setIsEditing(false)
        setIsSubmitting(false)
    }, [cancelPendingHoverClear, iframeKey, pageId, viewport])

    useEffect(() => {
        if (!dragState || !containerElement || !frameElement) return

        const frameRect = frameElement.getBoundingClientRect()
        const containerRect = containerElement.getBoundingClientRect()

        const handlePointerMove = (event: PointerEvent) => {
            const nextY = event.clientY - frameRect.top
            setDragState(prev => prev ? { ...prev, currentY: nextY } : prev)

            const editableLayouts = getEditableBlockLayouts(blockLayouts)
            const remainingLayouts = editableLayouts.filter(
                layout => layout.blockIndex !== dragState.sourceIndex,
            )

            if (remainingLayouts.length === 0) {
                setDropIndex(null)
                return
            }

            let nextIndex = remainingLayouts.length

            for (let index = 0; index < remainingLayouts.length; index += 1) {
                const layout = remainingLayouts[index]
                const midpoint = layout.top + layout.height / 2
                if (nextY < midpoint) {
                    nextIndex = index
                    break
                }
                nextIndex = index + 1
            }

            setDropIndex(nextIndex)
        }

        const handlePointerUp = () => {
            const editableLayouts = getEditableBlockLayouts(blockLayouts)
            const sourcePosition = editableLayouts.findIndex(
                layout => layout.blockIndex === dragState.sourceIndex,
            )

            if (dropIndex !== null && sourcePosition !== -1) {
                const remainingLayouts = editableLayouts.filter(
                    layout => layout.blockIndex !== dragState.sourceIndex,
                )

                if (remainingLayouts.length > 0) {
                    const boundedInsertionIndex = Math.max(
                        0,
                        Math.min(dropIndex, remainingLayouts.length),
                    )

                    const rawTargetIndex =
                        boundedInsertionIndex >= remainingLayouts.length
                            ? remainingLayouts[remainingLayouts.length - 1].blockIndex + 1
                            : remainingLayouts[boundedInsertionIndex].blockIndex

                    const targetIndex =
                        rawTargetIndex > dragState.sourceIndex ? rawTargetIndex - 1 : rawTargetIndex

                    if (targetIndex !== dragState.sourceIndex) {
                        onReorderBlocks?.(dragState.sourceIndex, targetIndex)
                    }
                }
            }

            setDragState(null)
            setDropIndex(null)
        }

        window.addEventListener('pointermove', handlePointerMove)
        window.addEventListener('pointerup', handlePointerUp, { once: true })

        return () => {
            window.removeEventListener('pointermove', handlePointerMove)
            window.removeEventListener('pointerup', handlePointerUp)
        }
    }, [blockLayouts, containerElement, dragState, dropIndex, frameElement, onReorderBlocks])

    const handleInlineRewrite = useCallback(async (instruction: string) => {
        if (!hoverData) return

        const { blockIndex, blockType, text, fieldPath } = hoverData
        const block = blocks[blockIndex]
        if (!block || !fieldPath) {
            return
        }

        setIsSubmitting(true)

        try {
            const response = await fetch('/api/ai/rewrite-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    text,
                    instruction,
                    context: `${blockType} section`,
                }),
            })

            if (!response.ok) {
                throw new Error('Failed to rewrite text')
            }

            const data = await response.json()
            const rewritten = typeof data.rewritten === 'string' ? data.rewritten.trim() : ''

            if (!rewritten) {
                throw new Error('AI returned empty content')
            }

            const currentValue = getValueAtPath(block as Record<string, unknown>, fieldPath)
            const nextValue =
                typeof currentValue === 'string' && currentValue.includes(text)
                    ? currentValue.replace(text, rewritten)
                    : rewritten

            const nextBlock = updateValueAtPath(block as Record<string, unknown>, fieldPath, nextValue)
            updateBlock(blockIndex, nextBlock)

            onInlineEditApplied?.(
                `Updated ${blockType} text: "${text}" → "${rewritten}"`,
                blockIndex,
            )

            setIsEditing(false)
            setHoverData(prev => prev ? { ...prev, text: rewritten } : prev)
        } catch (error) {
            console.error('Inline rewrite failed', error)
            toast.error('Inline edit failed', {
                description: error instanceof Error ? error.message : 'Please try again.',
            })
        } finally {
            setIsSubmitting(false)
        }
    }, [blocks, hoverData, onInlineEditApplied, updateBlock])

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#0F172A]">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-400 mx-auto" />
                    <p className="mt-3 text-sm text-gray-400">Loading site...</p>
                </div>
            </div>
        )
    }

    const previewUrl = new URL(`/api/preview/${siteId}`, 'http://localhost')
    previewUrl.searchParams.set('v', String(iframeKey))
    if (pageId) {
        previewUrl.searchParams.set('pageId', pageId)
    }

    const canInlineEdit = Boolean(hoverData?.fieldPath)
    const editableLayouts = getEditableBlockLayouts(blockLayouts)
    const remainingLayouts = dragState
        ? editableLayouts.filter(layout => layout.blockIndex !== dragState.sourceIndex)
        : editableLayouts
    const overlayOffset = getFrameOverlayOffset(frameElement, containerElement)

    let dropIndicatorTop: number | null = null
    if (dropIndex !== null && remainingLayouts.length > 0) {
        if (dropIndex >= remainingLayouts.length) {
            const lastLayout = remainingLayouts[remainingLayouts.length - 1]
            dropIndicatorTop = lastLayout.top + lastLayout.height
        } else {
            dropIndicatorTop = remainingLayouts[dropIndex].top
        }
    }

    return (
        <div
            ref={setContainerElement}
            className="relative flex-1 overflow-hidden bg-[#111827] p-6"
        >
            <div className="flex h-full items-start justify-center overflow-auto rounded-[28px] border border-white/10 bg-[#0F172A] p-4">
                <div
                    className="relative h-full overflow-hidden rounded-[24px] border border-white/10 bg-white shadow-2xl transition-all"
                    style={{
                        width: viewport === 'mobile' ? 390 : '100%',
                        maxWidth: viewport === 'mobile' ? 390 : 1280,
                    }}
                >
                    <iframe
                        ref={setFrameElement}
                        key={iframeKey}
                        src={previewUrl.pathname + previewUrl.search}
                        className="h-full w-full border-0"
                        title="Site Preview"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                    />
                </div>
            </div>

            {blockHover && overlayOffset && !dragState ? (
                <div
                    className="pointer-events-none absolute rounded-xl border border-cyan-400/40 bg-cyan-400/5 transition-all duration-150"
                    style={{
                        top: overlayOffset.top + blockHover.top - 6,
                        left: overlayOffset.left + blockHover.left - 6,
                        width: blockHover.width + 12,
                        height: blockHover.height + 12,
                        zIndex: 30,
                    }}
                >
                    {!['navigation', 'footer'].includes(blockHover.blockType) ? (
                        <button
                            type="button"
                            className="pointer-events-auto absolute -left-5 top-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-[#0F172A]/95 text-cyan-300 shadow-lg transition-colors hover:bg-[#162136] hover:text-cyan-200"
                            onMouseEnter={cancelPendingHoverClear}
                            onMouseDown={(event) => {
                                const frameRect = frameElement?.getBoundingClientRect()
                                if (!frameRect) return

                                event.preventDefault()
                                event.stopPropagation()
                                setHoverData(null)
                                setIsEditing(false)
                                setDropIndex(
                                    editableLayouts.findIndex(
                                        layout => layout.blockIndex === blockHover.blockIndex,
                                    ),
                                )
                                setDragState({
                                    sourceIndex: blockHover.blockIndex,
                                    sourceRect: blockHover,
                                    pointerOffsetY:
                                        event.clientY - frameRect.top - blockHover.top,
                                    currentY: blockHover.top,
                                })
                            }}
                        >
                            <GripVertical className="h-4 w-4" />
                        </button>
                    ) : null}
                </div>
            ) : null}

            {dragState && overlayOffset ? (
                <div
                    className="pointer-events-none absolute rounded-xl border border-cyan-400/40 bg-cyan-400/10 shadow-[0_24px_64px_rgba(45,212,191,0.15)]"
                    style={{
                        top: overlayOffset.top + dragState.currentY - dragState.pointerOffsetY,
                        left: overlayOffset.left + dragState.sourceRect.left,
                        width: dragState.sourceRect.width,
                        height: dragState.sourceRect.height,
                        zIndex: 60,
                    }}
                >
                    <div className="absolute inset-0 rounded-xl border border-dashed border-cyan-300/60" />
                </div>
            ) : null}

            {dropIndicatorTop !== null && overlayOffset ? (
                <div
                    className="pointer-events-none absolute z-50 h-1 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
                    style={{
                        top: overlayOffset.top + dropIndicatorTop - 2,
                        left: overlayOffset.left + 20,
                        width: Math.max(160, overlayOffset.width - 40),
                    }}
                />
            ) : null}

            {hoverData && hoverData.rect && overlayOffset && !dragState ? (
                <div 
                    className="absolute pointer-events-none border-2 border-blue-500 bg-blue-500/10 rounded transition-all duration-200"
                    onMouseEnter={cancelPendingHoverClear}
                    onMouseLeave={() => {
                        if (!isEditing) {
                            setHoverData(null)
                        }
                    }}
                    style={{
                        top: overlayOffset.top + hoverData.rect.top - 4,
                        left: overlayOffset.left + hoverData.rect.left - 4,
                        width: hoverData.rect.width + 8,
                        height: hoverData.rect.height + 8,
                        zIndex: 40,
                    }}
                >
                    {!isEditing && canInlineEdit && (
                        <div
                            data-inline-edit-trigger
                            className="absolute -top-8 right-0 flex cursor-pointer items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 text-[10px] font-bold uppercase text-white shadow-lg transition-colors hover:bg-blue-500 pointer-events-auto"
                            onMouseEnter={cancelPendingHoverClear}
                            onClick={() => setIsEditing(true)}
                        >
                            ✨ Edit with AI
                        </div>
                    )}
                    {isEditing && canInlineEdit && (
                        <div
                            data-inline-edit-popover
                            className="absolute left-0 top-0 z-50 pointer-events-auto -translate-y-[calc(100%+12px)]"
                            onMouseEnter={cancelPendingHoverClear}
                        >
                            <InlineEditPopover
                                blockType={hoverData.blockType}
                                currentText={hoverData.text}
                                isSubmitting={isSubmitting}
                                onClose={() => setIsEditing(false)}
                                onSubmit={handleInlineRewrite}
                            />
                        </div>
                    )}
                </div>
            ) : null}
        </div>
    )
}

export const PreviewFrame = memo(PreviewFrameInner)
