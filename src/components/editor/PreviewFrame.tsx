'use client'

import React, { memo, useEffect, useState, useCallback, useRef } from 'react'
import { Loader2 } from 'lucide-react'
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
}: PreviewFrameProps) {
    const { blocks, updateBlock } = useEditorStore()
    const [hoverData, setHoverData] = useState<HoveredElementData | null>(null)
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
                if (isEditing) return
                cancelPendingHoverClear()

                const nextData = e.data as Omit<HoveredElementData, 'fieldPath'> & { rect: HoverRect | null }
                const block = blocks[nextData.blockIndex]
                const fieldPath = block ? findStringFieldPath(block, nextData.text) : null

                setHoverData({
                    ...nextData,
                    fieldPath,
                })
            } else if (e.data?.type === 'BLOCK_MOUSEOUT') {
                if (!isEditing) {
                    cancelPendingHoverClear()
                    clearHoverTimerRef.current = window.setTimeout(() => {
                        setHoverData(null)
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
    }, [blocks, cancelPendingHoverClear, isEditing])

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
        setIsEditing(false)
        setIsSubmitting(false)
    }, [cancelPendingHoverClear, iframeKey, pageId, viewport])

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

            {hoverData && hoverData.rect && frameElement && containerElement ? (
                <div 
                    className="absolute pointer-events-none border-2 border-blue-500 bg-blue-500/10 rounded transition-all duration-200"
                    onMouseEnter={cancelPendingHoverClear}
                    onMouseLeave={() => {
                        if (!isEditing) {
                            setHoverData(null)
                        }
                    }}
                    style={{
                        top:
                            frameElement.getBoundingClientRect().top -
                            containerElement.getBoundingClientRect().top +
                            hoverData.rect.top -
                            4,
                        left:
                            frameElement.getBoundingClientRect().left -
                            containerElement.getBoundingClientRect().left +
                            hoverData.rect.left -
                            4,
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
