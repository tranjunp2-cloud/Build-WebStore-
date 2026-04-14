'use client'

import React, { memo, useEffect, useState, useCallback, useRef } from 'react'
import { GripVertical, Loader2 } from 'lucide-react'
import { InlineEditPopover } from './InlineEditPopover'
import { RichTextToolbar } from './RichTextToolbar'
import { ImageToolbar } from './ImageToolbar'
import { useEditorStore } from '@/store/editorStore'
import { resolveTheme, generateThemeCSS } from '@/lib/theme/resolve'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

interface PreviewFrameProps {
    siteId: string
    pageId: string | null
    iframeKey: number
    isLoading: boolean
    viewport: 'desktop' | 'mobile'
    selectedBlock: number | null
    onBlockSelect?: (blockIndex: number | null, blockType?: string) => void
    onInlineEditApplied?: (content: string, blockIndex: number) => void
    onReorderBlocks?: (fromIndex: number, toIndex: number) => void
    onBlockDrop?: (index: number, blockData: { blockType: string, variant: string }) => void
    onPageNavigate?: (pageId: string) => void
    disableDragDrop?: boolean
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
    sourceRect: HoverRect & { blockType?: string }
    pointerOffsetY: number
    currentY: number
}

type DragFinishPayload = {
    sourceIndex: number
    nextDropIndex: number | null
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
    searchKey: string,
    oldHtml: string,
    currentPath: Array<string | number> = [],
    exactOnly: boolean = true
): Array<string | number> | null {
    if (typeof value === 'string') {
        const temp = document.createElement('textarea');
        temp.innerHTML = oldHtml;
        const decodedOldHtml = temp.value;

        // Exact matches
        if (value === oldHtml) return currentPath
        if (value === decodedOldHtml) return currentPath
        if (value === searchKey) return currentPath
        
        // Partial matches
        if (!exactOnly) {
            if (value.includes(oldHtml)) return currentPath
            if (value.includes(decodedOldHtml)) return currentPath
            if (value.includes(searchKey)) return currentPath

            // Case-insensitive fallbacks
            const valLower = value.toLowerCase()
            if (valLower.includes(oldHtml.toLowerCase())) return currentPath
            if (valLower.includes(decodedOldHtml.toLowerCase())) return currentPath
            if (valLower.includes(searchKey.toLowerCase())) return currentPath

            // Flexible whitespace handling
            const flexWs = (str: string) => str.replace(/\s+/g, ' ').trim().toLowerCase()
            const valFlex = flexWs(value)
            if (valFlex.includes(flexWs(oldHtml))) return currentPath
            if (valFlex.includes(flexWs(decodedOldHtml))) return currentPath
            if (valFlex.includes(flexWs(searchKey))) return currentPath
        }
        return null
    }

    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
            const result = findStringFieldPath(value[index], searchKey, oldHtml, [...currentPath, index], exactOnly)
            if (result) return result
        }
        return null
    }

    if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
            const result = findStringFieldPath(child, searchKey, oldHtml, [...currentPath, key], exactOnly)
            if (result) return result
        }
    }

    return null
}

function findStringFieldPathTwoPass(
    value: unknown,
    searchKey: string,
    oldHtml: string
): Array<string | number> | null {
    const exactMatch = findStringFieldPath(value, searchKey, oldHtml, [], true)
    if (exactMatch) return exactMatch
    return findStringFieldPath(value, searchKey, oldHtml, [], false)
}

function updateValueAtPath(
    source: Record<string, unknown>,
    path: Array<string | number>,
    nextValue: string,
): Record<string, unknown> {
    const clone = JSON.parse(JSON.stringify(source)) as Record<string, unknown>
    let cursor: Record<string, unknown> | Array<unknown> = clone

    for (let index = 0; index < path.length - 1; index += 1) {
        cursor = (cursor as Record<string, unknown>)[path[index] as string] as Record<string, unknown> | Array<unknown>
    }

    const finalKey = path[path.length - 1]
    ;(cursor as Record<string, unknown>)[finalKey as string] = nextValue

    return clone
}

function getValueAtPath(source: Record<string, unknown>, path: Array<string | number>): unknown {
    let cursor: unknown = source

    for (const segment of path) {
        cursor = (cursor as Record<string, unknown>)?.[segment as string]
    }

    return cursor
}

function PreviewFrameInner({
    siteId,
    pageId,
    iframeKey,
    isLoading,
    viewport,
    selectedBlock,
    onBlockSelect,
    onInlineEditApplied,
    onReorderBlocks,
    onBlockDrop,
    onPageNavigate,
    disableDragDrop = false,
}: PreviewFrameProps) {
    const { blocks, updateBlock, performSave, theme: storeTheme } = useEditorStore()
    const blocksRef = useRef(blocks)
    useEffect(() => { blocksRef.current = blocks }, [blocks])
    const [hoverData, setHoverData] = useState<HoveredElementData | null>(null)
    const [blockHover, setBlockHover] = useState<BlockLayoutRect | null>(null)
    const [blockLayouts, setBlockLayouts] = useState<BlockLayoutRect[]>([])
    const [dragState, setDragStateRaw] = useState<DragState | null>(null)
    const [dropIndex, setDropIndex] = useState<number | null>(null)
    const [isEditing, setIsEditingState] = useState(false)
    const isEditingRef = useRef(false)
    const dragStateRef = useRef<DragState | null>(null)
    const setIsEditing = useCallback((val: boolean) => { isEditingRef.current = val; setIsEditingState(val) }, [])
    const setDragState = useCallback((val: DragState | null | ((prev: DragState | null) => DragState | null)) => {
        setDragStateRaw(prev => {
            const next = typeof val === 'function' ? val(prev) : val
            dragStateRef.current = next
            return next
        })
    }, [])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [textEditingData, setTextEditingData] = useState<{ rect: HoverRect; blockIndex: number } | null>(null)
    const [imageClickData, setImageClickData] = useState<{ rect: HoverRect; src: string; blockIndex: number; blockType: string } | null>(null)
    const [isImageProcessing, setIsImageProcessing] = useState(false)
    const [wysiwygState, setWysiwygState] = useState<Record<string, unknown>>({})
    const [frameElement, setFrameElement] = useState<HTMLIFrameElement | null>(null)

    // Live theme update — send CSS variables to iframe without reload
    useEffect(() => {
        if (!frameElement || !storeTheme?.primaryColor) return
        const resolved = resolveTheme(storeTheme)
        const css = generateThemeCSS(resolved)
        frameElement.contentWindow?.postMessage(
            { type: 'THEME_UPDATE', css },
            window.location.origin,
        )
    }, [frameElement, storeTheme])

    const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null)
    const [scrollContainerElement, setScrollContainerElement] = useState<HTMLDivElement | null>(null)
    const clearHoverTimerRef = useRef<number | null>(null)
    const dragPointerClientYRef = useRef<number | null>(null)
    const dragPointerStartYRef = useRef<number | null>(null)
    const dragPointerOffsetYRef = useRef<number | null>(null)
    const isHoveringControlsRef = useRef<boolean>(false)
    const textEditStopTimerRef = useRef<number | null>(null)
    const latestBlockLayoutsRef = useRef<BlockLayoutRect[]>([])
    useEffect(() => {
        latestBlockLayoutsRef.current = blockLayouts
    }, [blockLayouts])

    const syncDragPosition = useCallback((clientY: number, sourceIndex?: number) => {
        if (!frameElement) return
        
        const safeSourceIndex = sourceIndex
        if (safeSourceIndex === undefined) return

        const startY = dragPointerStartYRef.current ?? clientY

        const frameRect = frameElement.getBoundingClientRect()
        const nextY = clientY - frameRect.top
        dragPointerClientYRef.current = clientY
        
        setDragState(prev => prev ? { ...prev, currentY: nextY } : prev)

        const editableLayouts = getEditableBlockLayouts(latestBlockLayoutsRef.current)
        const draggedLayout = editableLayouts.find(l => l.blockIndex === safeSourceIndex)
        const remainingLayouts = editableLayouts.filter(
            layout => layout.blockIndex !== safeSourceIndex,
        )

        if (remainingLayouts.length === 0 || !draggedLayout) {
            setDropIndex(null)
            return
        }

        const pointerOffsetY = dragPointerOffsetYRef.current ?? 0
        const currentTop = nextY - pointerOffsetY
        const currentBottom = currentTop + draggedLayout.height

        const isMovedUp = currentTop < draggedLayout.top
        const activeHitPoint = isMovedUp ? currentTop : currentBottom

        let nextIndex = remainingLayouts.length

        for (let index = 0; index < remainingLayouts.length; index += 1) {
            const layout = remainingLayouts[index]
            const targetMidpoint = layout.top + layout.height / 2
            if (activeHitPoint < targetMidpoint) {
                nextIndex = index
                break
            }
        }

        setDropIndex(nextIndex)
    }, [frameElement, setDropIndex])

    const cancelPendingHoverClear = useCallback(() => {
        if (clearHoverTimerRef.current !== null) {
            window.clearTimeout(clearHoverTimerRef.current)
            clearHoverTimerRef.current = null
        }
    }, [])

    const finishDrag = useCallback(({ sourceIndex, nextDropIndex }: DragFinishPayload) => {
        const editableLayouts = getEditableBlockLayouts(latestBlockLayoutsRef.current)
        const sourcePosition = editableLayouts.findIndex(
            layout => layout.blockIndex === sourceIndex,
        )

        if (nextDropIndex !== null && sourcePosition !== -1) {
            const remainingLayouts = editableLayouts.filter(
                layout => layout.blockIndex !== sourceIndex,
            )

            if (remainingLayouts.length > 0) {
                const boundedInsertionIndex = Math.max(
                    0,
                    Math.min(nextDropIndex, remainingLayouts.length),
                )

                const rawTargetIndex =
                    boundedInsertionIndex >= remainingLayouts.length
                        ? remainingLayouts[remainingLayouts.length - 1].blockIndex + 1
                        : remainingLayouts[boundedInsertionIndex].blockIndex

                const targetIndex =
                    rawTargetIndex > sourceIndex ? rawTargetIndex - 1 : rawTargetIndex

                if (targetIndex !== sourceIndex) {
                    onReorderBlocks?.(sourceIndex, targetIndex)
                }
            }
        }

        frameElement?.contentWindow?.postMessage(
            { type: 'DRAG_BLOCK_END' },
            window.location.origin,
        )
        setDragState(null)
        setDropIndex(null)
        dragPointerClientYRef.current = null
    }, [onReorderBlocks, frameElement])

    useEffect(() => {
        const handleMessage = (e: MessageEvent) => {
            // Security: only accept messages from own origin or sandboxed iframe ('null')
            if (e.origin !== window.location.origin && e.origin !== 'null') return

            if (e.data?.type === 'BLOCK_HOVERED') {
                if (isEditingRef.current || dragStateRef.current) return
                cancelPendingHoverClear()

                const nextData = e.data as Omit<HoveredElementData, 'fieldPath'> & { rect: HoverRect | null }
                const block = blocksRef.current[nextData.blockIndex]
                const fieldPath = block ? findStringFieldPath(block, nextData.text, nextData.text) : null

                setHoverData({
                    ...nextData,
                    fieldPath,
                })
            } else if (e.data?.type === 'BLOCK_CONTAINER_HOVERED') {
                if (isEditingRef.current || dragStateRef.current) return
                setBlockHover(e.data.layout as BlockLayoutRect)
            } else if (e.data?.type === 'BLOCK_LAYOUT') {
                setBlockLayouts((e.data.layouts || []) as BlockLayoutRect[])
            } else if (e.data?.type === 'BLOCK_MOUSEOUT') {
                if (!isEditingRef.current && !dragStateRef.current && !isHoveringControlsRef.current) {
                    cancelPendingHoverClear()
                    clearHoverTimerRef.current = window.setTimeout(() => {
                        setHoverData(null)
                        setBlockHover(null)
                        clearHoverTimerRef.current = null
                    }, 250)
                }
            } else if (e.data?.type === 'PREVIEW_POINTER_DOWN') {
                if (isEditingRef.current) {
                    setIsEditing(false)
                }
            } else if (e.data?.type === 'BLOCK_CONTAINER_CLICKED') {
                const blockIndex = Number(e.data.blockIndex)
                const blockType = e.data.layout?.blockType as string | undefined
                if (!Number.isNaN(blockIndex)) {
                    onBlockSelect?.(blockIndex, blockType)
                    setHoverData(null)
                    setBlockHover(e.data.layout as BlockLayoutRect)
                    setIsEditing(false)
                }
            } else if (e.data?.type === 'PREVIEW_CANVAS_CLICKED') {
                onBlockSelect?.(null)
            } else if (e.data?.type === 'TEXT_EDITING_STARTED') {
                // Cancel any pending STOPPED cleanup (race: stop fires before start on re-click)
                if (textEditStopTimerRef.current) {
                    clearTimeout(textEditStopTimerRef.current)
                    textEditStopTimerRef.current = null
                }
                setTextEditingData({ rect: e.data.rect, blockIndex: e.data.blockIndex })
                setImageClickData(null)
            } else if (e.data?.type === 'TEXT_EDITING_STOPPED') {
                textEditStopTimerRef.current = window.setTimeout(() => {
                    textEditStopTimerRef.current = null
                    if (document.activeElement?.closest('[data-wysiwyg-toolbar]')) {
                        return
                    }
                    setTextEditingData(null)
                    performSave(true)
                }, 150)
            } else if (e.data?.type === 'TEXT_EDITED') {
                const { searchKey, newHtml, blockIndex } = e.data
                if (newHtml !== undefined) {
                    const currentBlocks = blocksRef.current
                    const block = currentBlocks[blockIndex]
                    // Find the field using plain text searchKey
                    const fieldPath = block ? findStringFieldPathTwoPass(block, searchKey, searchKey) : null
                    if (fieldPath && block) {
                        // Direct set — always replace entire field value with clean HTML
                        // This prevents nesting accumulation from partial find-and-replace
                        const clone = JSON.parse(JSON.stringify(currentBlocks))
                        const nextBlock = updateValueAtPath(clone[blockIndex] as Record<string, unknown>, fieldPath, newHtml)
                        updateBlock(blockIndex, nextBlock)
                    }
                }
            } else if (e.data?.type === 'REQUEST_STOP_EDITING') {
                setTimeout(() => {
                    const activeEl = document.activeElement
                    const isToolbarClicked = activeEl?.hasAttribute('data-wysiwyg-toolbar') || 
                                           activeEl?.closest('[data-wysiwyg-toolbar]')
                    if (!isToolbarClicked) {
                        const iframe = document.querySelector('iframe') as HTMLIFrameElement
                        iframe?.contentWindow?.postMessage({ type: 'STOP_TEXT_EDITING' }, window.location.origin)
                        setTextEditingData(null)
                        setWysiwygState({})
                    }
                }, 100)
            } else if (e.data?.type === 'IMAGE_EDITING_STARTED') {
                setImageClickData({ rect: e.data.rect, src: e.data.src, blockIndex: e.data.blockIndex, blockType: e.data.blockType })
                setTextEditingData(null)
            } else if (e.data?.type === 'SELECTION_STATE') {
                setWysiwygState(e.data.state)
            } else if (e.data?.type === 'IMAGE_HOVERED') {
            } else if (e.data?.type === 'EDITOR_BLOCK_DROP') {
                const { index, blockData } = e.data.payload
                onBlockDrop?.(index, blockData)
            } else if (e.data?.type === 'PAGE_NAVIGATE') {
                onPageNavigate?.(String(e.data.pageId))
            }
        }
        window.addEventListener('message', handleMessage)
        return () => {
            cancelPendingHoverClear()
            window.removeEventListener('message', handleMessage)
        }
    // Stable deps only — blocks/dragState/isEditing accessed via refs to prevent listener churn
    }, [cancelPendingHoverClear, onBlockDrop, onBlockSelect, onPageNavigate, setIsEditing, updateBlock])

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
            if (target.closest('[data-wysiwyg-toolbar]')) return // Don't close if clicking toolbar!
            
            setIsEditing(false)
            setTextEditingData(null) // Clean up WYSIWYG if clicking outside
            // Tell iframe to stop editing too
            frameElement?.contentWindow?.postMessage({ type: 'STOP_TEXT_EDITING' }, window.location.origin)
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
        setTextEditingData(null)
        setImageClickData(null)
    }, [cancelPendingHoverClear, iframeKey, pageId, viewport])

    const handleExecCommand = useCallback(async (command: string, value?: string) => {
        if (!frameElement) return

        if (command === 'createLink' && !value) {
            return
        }

        frameElement.contentWindow?.postMessage({
            type: 'EXEC_COMMAND',
            command,
            value
        }, window.location.origin)
    }, [frameElement])

    const handleImageReplace = useCallback(async (file: File) => {
        if (!imageClickData) return
        setIsImageProcessing(true)
        
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('alt', 'Uploaded image')

            const uploadRes = await fetch('/api/media', {
                method: 'POST',
                body: formData
            })

            if (!uploadRes.ok) throw new Error('Upload failed')
            
            const uploadedMedia = await uploadRes.json()
            const newUrl = uploadedMedia.doc.url

            const { blockIndex, src } = imageClickData
            const block = blocks[blockIndex]
            const fieldPath = block ? findStringFieldPath(block, src, src) : null

            if (block && fieldPath) {
                const clone = JSON.parse(JSON.stringify(blocks))
                const nextBlock = updateValueAtPath(clone[blockIndex] as Record<string, unknown>, fieldPath, newUrl)
                updateBlock(blockIndex, nextBlock)
            } else {
                // Fallback image swapping logic if exact src fieldPath didn't match absolute vs relative URL
                const clone = JSON.parse(JSON.stringify(blocks))
                // Try finding with partial match
                let foundPath = null
                const findPartialPath = (obj: unknown, target: string, path: Array<string | number> = []): Array<string | number> | null => {
                    if (typeof obj === 'string' && (target.includes(obj) || obj.includes(target))) return path
                    if (Array.isArray(obj)) {
                        for (let i=0; i<obj.length; i++) {
                            const p = findPartialPath(obj[i], target, [...path, i])
                            if (p) return p
                        }
                    } else if (obj && typeof obj === 'object') {
                        for (const k in obj) {
                            const p = findPartialPath((obj as Record<string, unknown>)[k], target, [...path, k])
                            if (p) return p
                        }
                    }
                    return null
                }
                const partialPath = findPartialPath(clone[blockIndex], new URL(src, window.location.origin).pathname)
                if (partialPath) {
                    const nextBlock = updateValueAtPath(clone[blockIndex], partialPath, newUrl)
                    updateBlock(blockIndex, nextBlock)
                } else {
                    toast.error('Could not map image to block field')
                }
            }

            toast.success('Image replaced successfully')
            setImageClickData(null)
        } catch (error) {
            console.error('Image replace error:', error)
            toast.error('Failed to replace image')
        } finally {
            setIsImageProcessing(false)
        }
    }, [blocks, imageClickData, updateBlock])

    const isDragging = dragState !== null
    const dragSourceIndex = dragState?.sourceIndex

    const latestDropIndexRef = useRef<number | null>(null)
    useEffect(() => {
        latestDropIndexRef.current = dropIndex
    }, [dropIndex])

    useEffect(() => {
        if (!isDragging || dragSourceIndex === undefined || !containerElement || !frameElement) return

        const handlePointerMove = (event: PointerEvent) => {
            syncDragPosition(event.clientY, dragSourceIndex)
        }

        const handlePointerUp = () => {
            finishDrag({
                sourceIndex: dragSourceIndex,
                nextDropIndex: latestDropIndexRef.current,
            })
        }

        window.addEventListener('pointermove', handlePointerMove)
        window.addEventListener('pointerup', handlePointerUp, { once: true })
        window.addEventListener('pointercancel', handlePointerUp, { once: true })
        window.addEventListener('blur', handlePointerUp, { once: true })

        return () => {
            window.removeEventListener('pointermove', handlePointerMove)
            window.removeEventListener('pointerup', handlePointerUp)
            window.removeEventListener('pointercancel', handlePointerUp)
            window.removeEventListener('blur', handlePointerUp)
        }
    }, [isDragging, dragSourceIndex, containerElement, frameElement, syncDragPosition, finishDrag])

    useEffect(() => {
        if (!frameElement) return

        frameElement.style.pointerEvents = dragState ? 'none' : 'auto'

        return () => {
            frameElement.style.pointerEvents = 'auto'
        }
    }, [dragState, frameElement])

    useEffect(() => {
        if (!isDragging || dragSourceIndex === undefined || !frameElement) return

        const handleWheel = (event: WheelEvent) => {
            event.preventDefault()
            frameElement.contentWindow?.scrollBy(0, event.deltaY)

            if (dragPointerClientYRef.current !== null) {
                syncDragPosition(dragPointerClientYRef.current, dragSourceIndex)
            }
        }

        window.addEventListener('wheel', handleWheel, { passive: false })

        return () => {
            window.removeEventListener('wheel', handleWheel)
        }
    }, [isDragging, dragSourceIndex, frameElement, syncDragPosition])

    useEffect(() => {
        if (!isDragging || dragSourceIndex === undefined || !frameElement) return

        let animationFrameId = 0
        const edgeThreshold = 72
        const maxStep = 24

        const tick = () => {
            const pointerY = dragPointerClientYRef.current
            if (pointerY !== null) {
                const frameRect = frameElement.getBoundingClientRect()
                const distanceToTop = pointerY - frameRect.top
                const distanceToBottom = frameRect.bottom - pointerY
                let scrollDelta = 0

                if (distanceToTop < edgeThreshold) {
                    scrollDelta = -Math.max(
                        4,
                        Math.min(maxStep, ((edgeThreshold - distanceToTop) / edgeThreshold) * maxStep),
                    )
                } else if (distanceToBottom < edgeThreshold) {
                    scrollDelta = Math.max(
                        4,
                        Math.min(maxStep, ((edgeThreshold - distanceToBottom) / edgeThreshold) * maxStep),
                    )
                }

                if (scrollDelta !== 0) {
                    frameElement.contentWindow?.scrollBy(0, scrollDelta)
                    syncDragPosition(pointerY, dragSourceIndex)
                }
            }

            animationFrameId = window.requestAnimationFrame(tick)
        }

        animationFrameId = window.requestAnimationFrame(tick)

        return () => {
            window.cancelAnimationFrame(animationFrameId)
        }
    }, [isDragging, dragSourceIndex, frameElement, syncDragPosition])

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
                description: 'Please try again.',
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

    const previewUrl = new URL(`/preview/${siteId}`, 'http://localhost')
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
            <div
                ref={setScrollContainerElement}
                className="flex h-full items-start justify-center overflow-auto rounded-[28px] border border-white/10 bg-[#0F172A] p-4"
            >
                <div
                    className="relative h-full overflow-hidden rounded-[24px] border border-white/10 bg-transparent shadow-2xl transition-all"
                    style={{
                        width: viewport === 'mobile' ? 'min(390px, 100%)' : '100%',
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

            {((blockHover && !dragState) || (selectedBlock !== null && overlayOffset)) ? (
                <>
                    {(() => {
                        const selectedLayout = selectedBlock !== null
                            ? editableLayouts.find(layout => layout.blockIndex === selectedBlock) || null
                            : null
                        const activeLayout = blockHover || selectedLayout
                        if (!activeLayout || !overlayOffset || dragState) return null

                        return (
                            <div
                                className="pointer-events-none absolute rounded-xl border border-cyan-400/40 bg-cyan-400/5 transition-opacity duration-150"
                                style={{
                                    top: overlayOffset.top + activeLayout.top - 6,
                                    left: overlayOffset.left + activeLayout.left - 6,
                                    width: activeLayout.width + 12,
                                    height: activeLayout.height + 12,
                                    zIndex: 30,
                                }}
                            />
                        )
                    })()}
                    {(() => {
                        const activeLayout = blockHover || (selectedBlock !== null
                            ? editableLayouts.find(layout => layout.blockIndex === selectedBlock) || null
                            : null)
                        if (!activeLayout || !overlayOffset || dragState || disableDragDrop || ['navigation', 'footer'].includes(activeLayout.blockType)) {
                            return null
                        }

                        return (
                        <button
                            type="button"
                            title="Drag to reorder section"
                            className="group/drag absolute inline-flex items-center gap-2 rounded-full border border-white/20 bg-white px-3 py-2 text-slate-700 shadow-[0_2px_12px_rgba(0,0,0,0.15)] transition-all duration-150 hover:shadow-[0_4px_20px_rgba(0,0,0,0.2)] active:scale-95 cursor-grab active:cursor-grabbing animate-in fade-in"
                            style={{
                                top: overlayOffset.top + activeLayout.top + 10,
                                left: overlayOffset.left + activeLayout.left - 24,
                                zIndex: 45,
                            }}
                            onMouseEnter={() => {
                                isHoveringControlsRef.current = true
                                cancelPendingHoverClear()
                            }}
                            onMouseLeave={() => {
                                isHoveringControlsRef.current = false
                            }}
                            onPointerDown={(event) => {
                                const frameRect = frameElement?.getBoundingClientRect()
                                if (!frameRect) return

                                event.preventDefault()
                                event.stopPropagation()
                                event.currentTarget.setPointerCapture(event.pointerId)
                                cancelPendingHoverClear()
                                dragPointerClientYRef.current = event.clientY
                                dragPointerStartYRef.current = event.clientY
                                dragPointerOffsetYRef.current = event.clientY - frameRect.top - activeLayout.top
                                setHoverData(null)
                                setIsEditing(false)
                                setDragState({
                                    sourceIndex: activeLayout.blockIndex,
                                    sourceRect: { ...activeLayout, blockType: activeLayout.blockType },
                                    pointerOffsetY:
                                        event.clientY - frameRect.top - activeLayout.top,
                                    currentY: activeLayout.top,
                                })
                                setDropIndex(
                                    editableLayouts.findIndex(
                                        layout => layout.blockIndex === activeLayout.blockIndex,
                                    ),
                                )
                                frameElement?.contentWindow?.postMessage(
                                    { type: 'DRAG_BLOCK_START', blockIndex: activeLayout.blockIndex },
                                    window.location.origin,
                                )
                                syncDragPosition(event.clientY, activeLayout.blockIndex)
                            }}
                        >
                            <GripVertical className="h-4 w-4 text-slate-400 group-hover/drag:text-slate-600" />
                            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 group-hover/drag:text-slate-700">Drag</span>
                        </button>
                        )
                    })()}
                </>
            ) : null}

            <AnimatePresence>
            {dragState && overlayOffset ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="pointer-events-none absolute rounded-xl border-2 border-blue-500/60 bg-blue-500/10 shadow-[0_24px_64px_rgba(59,130,246,0.25)]"
                    style={{
                        top: overlayOffset.top + dragState.currentY - dragState.pointerOffsetY,
                        left: overlayOffset.left + dragState.sourceRect.left,
                        width: dragState.sourceRect.width,
                        height: Math.min(dragState.sourceRect.height, 120),
                        zIndex: 60,
                    }}
                >
                    <div className="absolute inset-0 rounded-xl border border-dashed border-blue-400/40" />
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 rounded-lg bg-blue-600/90 px-3 py-1.5 shadow-lg">
                        <GripVertical className="h-3.5 w-3.5 text-white/80" />
                        <span className="text-xs font-semibold text-white capitalize">
                            {dragState.sourceRect.blockType?.replace(/-/g, ' ') || 'Block'}
                        </span>
                    </div>
                </motion.div>
            ) : null}
            </AnimatePresence>

            <AnimatePresence>
            {dropIndicatorTop !== null && overlayOffset ? (
                <motion.div
                    initial={{ opacity: 0, scaleX: 0.5 }}
                    animate={{ 
                        opacity: 1, 
                        scaleX: 1,
                        top: overlayOffset.top + dropIndicatorTop - 2,
                    }}
                    exit={{ opacity: 0, scaleX: 0.5 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="pointer-events-none absolute z-50 h-1 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
                    style={{
                        left: overlayOffset.left + 20,
                        width: Math.max(160, overlayOffset.width - 40),
                        transformOrigin: 'left center'
                    }}
                />
            ) : null}
            </AnimatePresence>

            {hoverData && hoverData.rect && overlayOffset && !dragState ? (
                <div 
                    className="absolute pointer-events-none border-2 border-blue-500 bg-blue-500/10 rounded transition-opacity duration-200"
                    onMouseEnter={() => {
                        isHoveringControlsRef.current = true
                        cancelPendingHoverClear()
                    }}
                    onMouseLeave={() => {
                        isHoveringControlsRef.current = false
                        if (!isEditing) {
                            setHoverData(null)
                        }
                    }}
                    style={{
                        top: overlayOffset.top + hoverData.rect.top - 4,
                        left: overlayOffset.left + hoverData.rect.left - 4,
                        width: hoverData.rect.width + 8,
                        height: hoverData.rect.height + 8,
                        zIndex: 100,
                    }}
                >
                    {!isEditing && canInlineEdit && (
                        <div
                            data-inline-edit-trigger
                            className="absolute -top-8 right-0 flex cursor-pointer items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 text-[10px] font-bold uppercase text-white shadow-lg transition-colors hover:bg-blue-500 pointer-events-auto"
                            onMouseEnter={() => {
                                isHoveringControlsRef.current = true
                                cancelPendingHoverClear()
                            }}
                            onMouseLeave={() => {
                                isHoveringControlsRef.current = false
                            }}
                            onClick={() => setIsEditing(true)}
                        >
                            ✨ Edit with AI
                        </div>
                    )}
                    {isEditing && canInlineEdit && (
                        <div
                            data-inline-edit-popover
                            className="absolute left-0 top-0 z-50 pointer-events-auto -translate-y-[calc(100%+12px)]"
                            onMouseEnter={() => {
                                isHoveringControlsRef.current = true
                                cancelPendingHoverClear()
                            }}
                            onMouseLeave={() => {
                                isHoveringControlsRef.current = false
                            }}
                        >
                            <InlineEditPopover
                                blockType={hoverData.blockType}
                                currentText={hoverData.text}
                                isSubmitting={isSubmitting}
                                isMobile={viewport === 'mobile'}
                                onClose={() => setIsEditing(false)}
                                onSubmit={handleInlineRewrite}
                            />
                        </div>
                    )}
                </div>
            ) : null}

            {/* US-F05-06 AC-1: Rich Text Toolbar */}
            {textEditingData && overlayOffset && (() => {
                const TOOLBAR_WIDTH = 340;
                let topPos = overlayOffset.top + textEditingData.rect.top - 48;
                let leftPos = overlayOffset.left + textEditingData.rect.left + (textEditingData.rect.width / 2) - (TOOLBAR_WIDTH / 2);
                
                const maxLeft = (containerElement?.clientWidth || typeof window !== 'undefined' ? window.innerWidth : 1000) - TOOLBAR_WIDTH - 16;
                leftPos = Math.max(16, Math.min(leftPos, maxLeft));

                if (topPos < 16) {
                    topPos = overlayOffset.top + textEditingData.rect.top + textEditingData.rect.height + 8;
                }

                return (
                    <div
                        className="absolute z-[100]"
                        data-wysiwyg-toolbar
                        style={{
                            top: topPos,
                            left: leftPos,
                        }}
                    >
                        <RichTextToolbar onCommand={handleExecCommand} activeState={wysiwygState} />
                    </div>
                )
            })()}

            {/* US-F05-06 AC-2: Image Toolbar */}
            {imageClickData && overlayOffset && (() => {
                const TOOLBAR_WIDTH = 250;
                let topPos = overlayOffset.top + imageClickData.rect.top + 8;
                let leftPos = overlayOffset.left + imageClickData.rect.left + 8;

                const maxLeft = (containerElement?.clientWidth || typeof window !== 'undefined' ? window.innerWidth : 1000) - TOOLBAR_WIDTH - 16;
                leftPos = Math.max(16, Math.min(leftPos, maxLeft));

                return (
                    <div
                        className="absolute z-[100]"
                        style={{
                            top: topPos,
                            left: leftPos,
                        }}
                    >
                        <ImageToolbar 
                            onImageSelect={handleImageReplace} 
                            isProcessing={isImageProcessing}
                            onAiGenerate={() => { toast.info('AI Generation context locked to: ' + imageClickData.blockType) }} 
                        />
                    </div>
                )
            })()}
        </div>
    )
}

export const PreviewFrame = memo(PreviewFrameInner)
