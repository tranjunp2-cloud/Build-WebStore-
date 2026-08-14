'use client'

import React, { memo, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { GripVertical, Loader2 } from 'lucide-react'
import { InlineEditPopover } from './InlineEditPopover'
import { RichTextToolbar } from './RichTextToolbar'
import { ImageToolbar } from './ImageToolbar'
import { BlockActionBar } from './BlockActionBar'
import { DeleteBlockConfirm } from './DeleteBlockConfirm'
import { useEditorStore, BLOCK_TYPE_TO_KEY } from '@/store/editorStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { cn } from '@/lib/utils'
import { resolveTheme, generateThemeCSS } from '@/lib/theme/resolve'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { useUploadProgress } from '@/hooks/use-upload-progress'
import { useI18n } from '@/i18n'
import { COMMERCE_BLOCK_TYPES } from '@/lib/site-renderer/detect-commerce-presence'
import { updateValueAtPath } from '@/lib/editor/update-value-at-path'

const ALLOWED_FOOTER_FIELDS = new Set(['copyrightText', 'tagline'])

export interface PreviewFrameHandle {
    /** Send a postMessage to the preview iframe without triggering a full reload. */
    sendToIframe: (message: object) => void
    /** Tell the preview iframe to scroll to a specific block index without reloading. */
    setScrollToBlock?: (index: number) => void
}

interface PreviewFrameProps {
    siteId: string
    pageId: string | null
    iframeKey: number
    isLoading: boolean
    viewport: 'desktop' | 'mobile'
    selectedBlock: number | null
    onBlockSelect?: (blockIndex: number | null, blockType?: string) => void
    onInlineEditApplied?: (content: string, blockIndex: number, detail?: { instruction: string; originalText: string; rewrittenText: string; blockType: string }) => void
    onReorderBlocks?: (fromIndex: number, toIndex: number) => void
    onDeleteBlock?: (index: number) => void
    onDuplicateBlock?: (index: number) => void
    onBlockDrop?: (index: number, blockData: { blockType: string, variant: string }) => void
    onImageReplaced?: () => void
    onPageNavigate?: (pageId: string) => void
    onBlockAIEdit?: (blockIndex: number, blockType: string) => void
    disableDragDrop?: boolean
    /**
     * F05 compact canvas (mobile + iPad): hide the floating `BlockActionBar`
     * overlay (duplicate/AI-edit/delete icons above the selected block) — the
     * compact block-settings sheet already covers move/delete. Optional,
     * additive; desktop (incl. its own "preview as mobile" viewport toggle)
     * omits this and is unaffected.
     */
    hideBlockActionBar?: boolean
    /** Called after inline text editing stops — should save + reload preview. */
    onInlineEditSave?: () => Promise<boolean | void>
    /** Called by an explicit Cmd/Ctrl+S inside the preview iframe. */
    onManualSave?: (source: 'iframe' | 'footer') => Promise<boolean | void>
    /** Called after mount with an imperative handle; called with null on unmount. */
    onHandleReady?: (handle: PreviewFrameHandle | null) => void
    /** Called when a footer field is edited inline in the preview — dedicated footer channel. */
    onFooterUpdate?: (changes: Record<string, unknown>) => void
    /** Called during live typing in a footer field (no iframe re-send — cursor-safe). */
    onFooterInlineEdit?: (changes: Record<string, unknown>) => void
    /** Called when footer inline edit session ends (blur/Enter/Escape) — flush debounce + save once. */
    onFooterEditStop?: () => void
    /** F26-07: Called when the in-preview language switcher block sends SWITCH_LOCALE. */
    onLocaleSwitch?: (locale: string) => void
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
        .filter(layout => !['navigation', 'footer', 'breadcrumb'].includes(layout.blockType))
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
        // Strip HTML tags from stored value, then exact-compare with plain-text searchKey.
        // Handles case where field stores "<b>Hello</b>" but searchKey is "Hello" (innerText).
        const strippedValue = value.replace(/<[^>]+>/g, '').trim()
        if (strippedValue === searchKey) return currentPath
        if (strippedValue === oldHtml) return currentPath

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

function getValueAtPath(source: Record<string, unknown>, path: Array<string | number>): unknown {
    let cursor: unknown = source

    for (const segment of path) {
        cursor = (cursor as Record<string, unknown>)?.[segment as string]
    }

    return cursor
}

type InlineEditPayload = {
    blockIndex: number
    searchKey: string
    oldHtml?: string
    newHtml: string
    originalTag?: string
    newTag?: string
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
    onDeleteBlock,
    onDuplicateBlock,
    onBlockDrop,
    onImageReplaced,
    onPageNavigate,
    onBlockAIEdit,
    disableDragDrop = false,
    hideBlockActionBar = false,
    onInlineEditSave,
    onManualSave,
    onHandleReady,
    onFooterUpdate,
    onFooterInlineEdit,
    onFooterEditStop,
    onLocaleSwitch,
}: PreviewFrameProps) {
    const { t } = useI18n()
    const { upload: uploadImage } = useUploadProgress()
    const { blocks, updateBlock, performSave, setIsInlineEditing, theme: storeTheme } = useEditorStore()
    const isCartLocked = useMemo(
        () => blocks.some(b => COMMERCE_BLOCK_TYPES.has((b as Record<string, unknown>).blockType as string ?? '')),
        [blocks],
    )
    const leftSidebarVisible = useWorkspaceStore((s) => s.leftSidebarVisible)
    const rightSidebarVisible = useWorkspaceStore((s) => s.rightSidebarVisible)
    const blocksRef = useRef(blocks)
    useEffect(() => { blocksRef.current = blocks }, [blocks])
    const onInlineEditSaveRef = useRef(onInlineEditSave)
    useEffect(() => { onInlineEditSaveRef.current = onInlineEditSave }, [onInlineEditSave])
    const onManualSaveRef = useRef(onManualSave)
    useEffect(() => { onManualSaveRef.current = onManualSave }, [onManualSave])
    const onFooterUpdateRef = useRef(onFooterUpdate)
    useEffect(() => { onFooterUpdateRef.current = onFooterUpdate }, [onFooterUpdate])
    const onFooterInlineEditRef = useRef(onFooterInlineEdit)
    useEffect(() => { onFooterInlineEditRef.current = onFooterInlineEdit }, [onFooterInlineEdit])
    const onFooterEditStopRef = useRef(onFooterEditStop)
    useEffect(() => { onFooterEditStopRef.current = onFooterEditStop }, [onFooterEditStop])
    const [hoverData, setHoverData] = useState<HoveredElementData | null>(null)
    const [blockHover, setBlockHover] = useState<BlockLayoutRect | null>(null)
    const [selectedGlobalBlockLayout, setSelectedGlobalBlockLayout] = useState<BlockLayoutRect | null>(null)

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
    const [textEditingData, setTextEditingData] = useState<{ rect: HoverRect; blockIndex: number; blockType: string; originalText: string; scrollYAtStart: number } | null>(null)
    // GH-1367 Bug 3: keeps the iframe frozen while the inline-edit save flushes in the
    // background, even though the text toolbar (gated by textEditingData) is already hidden.
    const [isFlushingEdit, setIsFlushingEdit] = useState(false)
    const [iframeScrollY, setIframeScrollY] = useState(0)
    const [imageClickData, setImageClickData] = useState<{ rect: HoverRect; src: string; blockIndex: number; blockType: string; imageIndex?: number; totalImagesInBlock?: number } | null>(null)
    // Scroll position to restore after iframe reload
    const savedScrollYRef = useRef<number>(0)
    const scrollToBlockIndexRef = useRef<number | null>(null)
    const [isImageProcessing, setIsImageProcessing] = useState(false)
    const [wysiwygState, setWysiwygState] = useState<Record<string, unknown>>({})
    const [frameElement, setFrameElement] = useState<HTMLIFrameElement | null>(null)
    const frameElementRef = useRef<HTMLIFrameElement | null>(null)
    const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null)

    // Expose handle to parent
    useEffect(() => {
        if (!onHandleReady) return
        onHandleReady({
            sendToIframe: (msg) => frameElementRef.current?.contentWindow?.postMessage(msg, window.location.origin),
            setScrollToBlock: (index: number) => {
                // Instantly tell the iframe to scroll if it's already loaded
                frameElementRef.current?.contentWindow?.postMessage(
                    { type: 'SCROLL_TO_BLOCK', index },
                    window.location.origin
                )
                // Also save it for the next reload just in case
                scrollToBlockIndexRef.current = index
            }
        })
        return () => onHandleReady(null)
        // onHandleReady is a stable callback ref from parent — only run on mount/unmount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

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

    // Sync selected block highlight into iframe via outline CSS
    useEffect(() => {
        if (!frameElement) return
        frameElement.contentWindow?.postMessage(
            { type: 'SET_BLOCK_SELECTED', blockIndex: selectedBlock ?? null },
            window.location.origin,
        )
    }, [frameElement, selectedBlock])

    // Send translated drop hint text to iframe for CSS pseudo-element
    useEffect(() => {
        if (!frameElement) return
        const sendHint = () => {
            frameElement.contentWindow?.postMessage(
                { type: 'SET_DROP_HINT', text: t.editor.blockLibrary.dropToAdd },
                window.location.origin,
            )
        }
        frameElement.addEventListener('load', sendHint)
        // Also send immediately in case iframe is already loaded
        sendHint()
        return () => frameElement.removeEventListener('load', sendHint)
    }, [frameElement, t.editor.blockLibrary.dropToAdd])

    const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null)
    const [canvasElement, setCanvasElement] = useState<HTMLDivElement | null>(null)
    const [scrollContainerElement, setScrollContainerElement] = useState<HTMLDivElement | null>(null)
    const clearHoverTimerRef = useRef<number | null>(null)
    const dragPointerClientYRef = useRef<number | null>(null)
    const dragPointerStartYRef = useRef<number | null>(null)
    const dragPointerOffsetYRef = useRef<number | null>(null)
    const isHoveringControlsRef = useRef<boolean>(false)
    const textEditStopTimerRef = useRef<number | null>(null)
    const currentLiveTextRef = useRef<string | null>(null)
    const pendingInlineEditRef = useRef<InlineEditPayload | null>(null)
    // GH-1367 Bug 3 (M1): monotonic token per inline-edit session. A background save's
    // .finally() must only clear shared state if it still owns the current session —
    // otherwise a save that resolves after the user re-targets another text would clobber
    // the new session's pending payload / re-enable autosave mid-edit.
    const editSessionSeqRef = useRef(0)
    const latestBlockLayoutsRef = useRef<BlockLayoutRect[]>([])
    useEffect(() => {
        latestBlockLayoutsRef.current = blockLayouts
    }, [blockLayouts])

    const applyInlineEditPayload = useCallback((payload: InlineEditPayload | null) => {
        if (!payload) return false

        const { blockIndex, searchKey, oldHtml, newHtml, originalTag, newTag } = payload
        if (newHtml === undefined || Number.isNaN(blockIndex)) return false

        const currentBlocks = blocksRef.current
        const block = currentBlocks[blockIndex]
        const matchHtml = oldHtml ?? searchKey
        const fieldPath = block ? findStringFieldPathTwoPass(block, searchKey, matchHtml) : null
        if (!fieldPath || !block) return false

        const originalValue = String(getValueAtPath(block, fieldPath) ?? '')
        const originalHasHeadingWrapper = /^<h[1-6][\s>]/i.test(originalValue.trim())

        // Detect if the user intentionally changed the element tag (e.g. P → H2)
        const tagChanged = !!(originalTag && newTag && originalTag !== newTag)

        currentLiveTextRef.current = newHtml
        let valueToSave = newHtml

        // Only strip heading wrapper if the original field value had no heading wrapper
        // AND the user did NOT intentionally change the tag via formatBlock
        if (!originalHasHeadingWrapper && !tagChanged) {
            const headingMatch = newHtml.match(/^<(h[1-6])(\s[^>]*)?>([\s\S]+?)<\/\1>$/i)
            if (headingMatch) {
                const attrs = headingMatch[2] || ''
                const styleMatch = attrs.match(/style="([^"]*)"/)
                const innerContent = headingMatch[3]
                // If the stripped heading had inline styles (font-size, color, etc.),
                // wrap inner content in a <span> to preserve those user-applied styles
                if (styleMatch && styleMatch[1].trim()) {
                    valueToSave = `<span style="${styleMatch[1]}">${innerContent}</span>`
                } else {
                    valueToSave = innerContent
                }
            }
        }

        if (originalValue === valueToSave) return true

        const clone = JSON.parse(JSON.stringify(currentBlocks))
        const nextBlock = updateValueAtPath(clone[blockIndex] as Record<string, unknown>, fieldPath, valueToSave)
        updateBlock(blockIndex, nextBlock)
        return true
    }, [updateBlock])

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
                    scrollToBlockIndexRef.current = targetIndex
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
                const layouts = (e.data.layouts || []) as BlockLayoutRect[]
                setBlockLayouts(layouts)

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
                setImageClickData(null)
            } else if (e.data?.type === 'BLOCK_CONTAINER_CLICKED') {
                const blockIndex = Number(e.data.blockIndex)
                const blockType = e.data.layout?.blockType as string | undefined
                const isGlobalClick = blockType !== undefined && ['navigation', 'footer', 'breadcrumb'].includes(blockType)
                if (!Number.isNaN(blockIndex)) {
                    onBlockSelect?.(blockIndex, blockType)
                    setHoverData(null)
                    if (isGlobalClick) {
                        setSelectedGlobalBlockLayout(e.data.layout as BlockLayoutRect)
                        setBlockHover(null)
                    } else {
                        setSelectedGlobalBlockLayout(null)
                        setBlockHover(e.data.layout as BlockLayoutRect)
                        // Refresh the clicked block's layout so the action bar uses the
                        // current position (guards against stale BLOCK_LAYOUT after block deletion).
                        if (e.data.layout) {
                            const freshLayout = e.data.layout as BlockLayoutRect
                            setBlockLayouts(prev => {
                                const idx = prev.findIndex(l => l.blockIndex === freshLayout.blockIndex)
                                if (idx >= 0) {
                                    const updated = [...prev]
                                    updated[idx] = freshLayout
                                    return updated
                                }
                                return [...prev, freshLayout]
                            })
                        }
                    }
                    setIsEditing(false)
                }
            } else if (e.data?.type === 'PREVIEW_CANVAS_CLICKED') {
                onBlockSelect?.(null)
                setSelectedGlobalBlockLayout(null)
            } else if (e.data?.type === 'TEXT_EDITING_STARTED') {
                // Global blocks (nav, footer, breadcrumb) are not inline-editable — ignore
                const globalBlockTypes = ['navigation', 'footer', 'breadcrumb']
                if (globalBlockTypes.includes(e.data.blockType)) return
                // Cancel any pending STOPPED cleanup (race: stop fires before start on re-click)
                if (textEditStopTimerRef.current) {
                    clearTimeout(textEditStopTimerRef.current)
                    textEditStopTimerRef.current = null
                }
                // New session — invalidate any in-flight save's .finally() so it won't clobber
                // this session's pending payload / autosave suspension (GH-1367 Bug 3 M1).
                editSessionSeqRef.current += 1
                // Suspend all auto-saves while inline editing is active.
                // Also clear any pending timer that carries stale blocks from before this session.
                setIsInlineEditing(true)
                const { autoSaveTimer: pendingStoreTimer } = useEditorStore.getState()
                if (pendingStoreTimer) {
                    clearTimeout(pendingStoreTimer)
                    useEditorStore.setState({ autoSaveTimer: null })
                }
                const startScrollY = e.data.scrollY ?? 0
                setIframeScrollY(startScrollY)
                setTextEditingData({ rect: e.data.rect, blockIndex: e.data.blockIndex, blockType: e.data.blockType ?? '', originalText: e.data.originalText ?? '', scrollYAtStart: startScrollY })
                currentLiveTextRef.current = e.data.originalText ?? null
                setImageClickData(null)
            } else if (e.data?.type === 'TEXT_EDITING_STOPPED') {
                textEditStopTimerRef.current = window.setTimeout(() => {
                    textEditStopTimerRef.current = null
                    if (document.activeElement?.closest('[data-wysiwyg-toolbar]')) {
                        return
                    }
                    currentLiveTextRef.current = null
                    applyInlineEditPayload(pendingInlineEditRef.current)
                    // GH-1367 Bug 3: hide the text toolbar IMMEDIATELY (decoupled from save).
                    // Previously setTextEditingData(null) ran inside .finally(), so the toolbar
                    // lingered for the full save+reload round-trip (~3s). Now it clears at once
                    // and the block action toolbar can take over instantly.
                    setTextEditingData(null)
                    // Keep the iframe frozen via isFlushingEdit until the save resolves so it
                    // reloads with the just-saved data (no stale reload / black gap).
                    setIsFlushingEdit(true)
                    // Save in the background. Prefer onInlineEditSave (component's handleSave) —
                    // it bypasses the isSaving guard that can block performSave when a concurrent
                    // save is in flight.
                    const flushSession = editSessionSeqRef.current
                    void (onInlineEditSaveRef.current?.() ?? performSave(true)).finally(() => {
                        // A newer edit session started while this save was in flight — skip cleanup
                        // so we don't clobber the new session's pending payload / autosave state.
                        if (editSessionSeqRef.current !== flushSession) return
                        pendingInlineEditRef.current = null
                        setIsInlineEditing(false)
                        setIsFlushingEdit(false)
                    })
                }, 150)
            } else if (e.data?.type === 'TEXT_EDITED') {
                const { searchKey, oldHtml, newHtml, blockIndex } = e.data
                if (newHtml !== undefined) {
                    const payload: InlineEditPayload = {
                        blockIndex, searchKey, oldHtml, newHtml,
                        originalTag: e.data.originalTag,
                        newTag: e.data.newTag,
                    }
                    pendingInlineEditRef.current = payload
                    applyInlineEditPayload(payload)
                }
            } else if (e.data?.type === 'IFRAME_SCROLL') {
                const scrollY = e.data.scrollY ?? 0
                setIframeScrollY(scrollY)
                savedScrollYRef.current = scrollY
                setImageClickData(null)
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
                // logo-cloud uses LogoImageOverlay for image replacement — suppress generic ImageToolbar
                if (['navigation', 'footer', 'breadcrumb', 'logo-cloud'].includes(e.data.blockType)) return
                setImageClickData({ rect: e.data.rect, src: e.data.src, blockIndex: e.data.blockIndex, blockType: e.data.blockType, imageIndex: e.data.imageIndex, totalImagesInBlock: e.data.totalImagesInBlock })
                setTextEditingData(null)
            } else if (e.data?.type === 'SELECTION_STATE') {
                setWysiwygState(e.data.state)
            } else if (e.data?.type === 'IMAGE_HOVERED') {
            } else if (e.data?.type === 'EDITOR_BLOCK_DROP') {
                const { index, blockData } = e.data.payload
                scrollToBlockIndexRef.current = index
                onBlockDrop?.(index, blockData)
            } else if (e.data?.type === 'PAGE_NAVIGATE') {
                onPageNavigate?.(String(e.data.pageId))
            } else if (e.data?.type === 'OPEN_LINK') {
                const href = String(e.data.href || '')
                const safeProtocols = new Set(['http:', 'https:', 'mailto:', 'tel:'])
                try { if (href && safeProtocols.has(new URL(href).protocol)) window.open(href, '_blank', 'noopener,noreferrer') } catch { /* invalid URL */ }
            } else if (e.data?.type === 'SAVE_CHECKPOINT') {
                void (onInlineEditSaveRef.current?.() ?? performSave(false))
            } else if (e.data?.type === 'MANUAL_SAVE_REQUEST') {
                const source = e.data.source === 'footer' ? 'footer' : 'iframe'
                void (onManualSaveRef.current?.(source) ?? onInlineEditSaveRef.current?.() ?? performSave(true))
            } else if (e.data?.type === 'BLOCK_FIELD_CHANGED') {
                const { blockIndex, field, value } = e.data as { blockIndex: number; field: string; value: unknown }
                // GH-1381: ACK back to the iframe overlay so it toasts success only after the
                // change is applied AND the save settles — the overlay used to toast success
                // before this handler even ran, hiding apply/save failures (silent data loss).
                const replyResult = (ok: boolean, error?: string) => {
                    frameElementRef.current?.contentWindow?.postMessage(
                        { type: 'BLOCK_FIELD_CHANGE_RESULT', blockIndex, field, ok, ...(error ? { error } : {}) },
                        window.location.origin,
                    )
                }
                try {
                    const currentBlocks = blocksRef.current
                    const isAllowedValue = (v: unknown): v is string | number | Record<string, unknown> =>
                        typeof v === 'string' || typeof v === 'number' ||
                        (v !== null && typeof v === 'object' && !Array.isArray(v))
                    if (!currentBlocks[blockIndex] || !isAllowedValue(value)) {
                        replyResult(false, 'Invalid change payload')
                        return
                    }
                    // Reject (don't silently filter) blocked segments — dropping a segment would
                    // change WHERE the write lands. updateValueAtPath re-validates and throws on
                    // empty/blocked/out-of-range segments; the catch below turns that into a NACK.
                    const BLOCKED_PATH_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype'])
                    const rawSegments = (field as string).split('.')
                    if (rawSegments.some((seg) => BLOCKED_PATH_SEGMENTS.has(seg))) {
                        replyResult(false, 'Invalid field path')
                        return
                    }
                    const path = rawSegments.map((seg: string) =>
                        /^\d+$/.test(seg) ? Number(seg) : seg
                    ) as Array<string | number>
                    const nextBlock = updateValueAtPath(currentBlocks[blockIndex] as Record<string, unknown>, path, value as string | number | Record<string, unknown>)
                    updateBlock(blockIndex, nextBlock)
                    // Push updated block back to iframe so React re-renders with new field values
                    // without a full iframe reload (which would lose scroll position).
                    // Send the locale-MERGED display block: on a non-primary locale the panel stores
                    // edits like `variant` in localeOverrides, so the raw flat block would render
                    // the wrong variant (mirrors handleImageReplace + handleBlockFieldChange).
                    const store = useEditorStore.getState()
                    const updatedRaw = store.blocks[blockIndex]
                    const displayBlock = updatedRaw ? store.getDisplayBlock(updatedRaw) : nextBlock
                    frameElementRef.current?.contentWindow?.postMessage(
                        { type: 'UPDATE_BLOCK_DATA', blockIndex, blockData: displayBlock },
                        window.location.origin,
                    )
                    void performSave(true).then(saved => {
                        if (saved) replyResult(true)
                        else replyResult(false, 'Could not save the change — please try again')
                    }).catch(() => replyResult(false, 'Could not save the change — please try again'))
                } catch (err) {
                    console.error('[PreviewFrame] BLOCK_FIELD_CHANGED failed:', err)
                    replyResult(false, err instanceof Error ? err.message : 'Failed to apply change')
                }
            } else if (e.data?.type === 'SHOW_TOAST') {
                const { variant, message } = e.data as { variant: string; message: string }
                const ALLOWED_TOAST_VARIANTS = new Set(['success', 'error', 'info'] as const)
                if (ALLOWED_TOAST_VARIANTS.has(variant as 'success' | 'error' | 'info')) {
                    toast[variant as 'success' | 'error' | 'info'](message)
                }
            } else if (e.data?.type === 'FOOTER_FIELD_EDIT_START') {
                // no-op — could scroll sidebar to footer section in a future iteration
            } else if (e.data?.type === 'FOOTER_FIELD_EDITED') {
                const { fieldName, newValue } = e.data as { fieldName: string; newValue: string }
                if (!ALLOWED_FOOTER_FIELDS.has(fieldName)) return
                // Use inline-edit path (no iframe re-send) to avoid overwriting contentEditable cursor
                ;(onFooterInlineEditRef.current ?? onFooterUpdateRef.current)?.({ [fieldName]: newValue })
            } else if (e.data?.type === 'FOOTER_FIELD_EDIT_STOP') {
                const { fieldName: stopField, newValue: stopValue } = e.data as { fieldName?: string; newValue?: string }
                // Flush any in-flight content that the 300ms debounce hadn't fired yet (fast blur/Enter scenario)
                if (stopField && stopValue !== undefined && ALLOWED_FOOTER_FIELDS.has(stopField)) {
                    onFooterUpdateRef.current?.({ [stopField]: stopValue })
                }
                onFooterEditStopRef.current?.()
            } else if (e.data?.type === 'SWITCH_LOCALE') {
                // F26-07: Language switcher block in preview requests a locale change.
                // Accept any locale code (en, ms, or non-standard like 'vi', 'el').
                const locale = e.data.locale as string
                if (locale) onLocaleSwitch?.(locale)
            }
        }
        window.addEventListener('message', handleMessage)
        return () => {
            cancelPendingHoverClear()
            window.removeEventListener('message', handleMessage)
        }
        // Stable deps only — blocks/dragState/isEditing accessed via refs to prevent listener churn
    }, [applyInlineEditPayload, cancelPendingHoverClear, onBlockDrop, onBlockSelect, onPageNavigate, onLocaleSwitch, setIsEditing, updateBlock])

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
            if (target.closest('[data-image-toolbar]')) return // Don't close if clicking image toolbar!

            setIsEditing(false)
            setTextEditingData(null) // Clean up WYSIWYG if clicking outside
            setImageClickData(null) // Close image toolbar if clicking outside
            // Tell iframe to stop editing too
            frameElementRef.current?.contentWindow?.postMessage({ type: 'STOP_TEXT_EDITING' }, window.location.origin)
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
        // GH-1367 Bug 3: also release the inline-edit save freeze. A token-guarded save .finally()
        // may skip clearing it (stale session); reset it here so navigation/key changes can't leave
        // the preview iframe permanently frozen. Self-heals on the next save's iframeKey bump.
        setIsFlushingEdit(false)
        setImageClickData(null)
        setSelectedGlobalBlockLayout(null)
    }, [cancelPendingHoverClear, iframeKey, pageId, viewport])

    const handleExecCommand = useCallback(async (command: string, value?: string) => {
        if (!frameElement) return

        if (command === 'createLink' && !value) {
            return
        }

        // AI Edit from toolbar: open the inline AI popover instead of posting to iframe
        if (command === 'aiEdit') {
            setIsEditing(true)
            return
        }

        frameElement.contentWindow?.postMessage({
            type: 'EXEC_COMMAND',
            command,
            value
        }, window.location.origin)
    }, [frameElement, setIsEditing])

    const handleImageReplace = useCallback(async (file: File) => {
        if (!imageClickData) return
        setIsImageProcessing(true)

        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('alt', t.editor.preview.altUploadedImage)

            const uploadedMedia = await uploadImage(formData)
            const newUrl = uploadedMedia.url

            const { blockIndex, src } = imageClickData
            const block = blocks[blockIndex]
            const newMediaId = uploadedMedia.id

            // Skip URL-based strategies for blocks where imageIndex precisely identifies the array slot.
            // Strategies 1-5 can false-positive on OTHER array items (e.g. testimonials[0].avatar
            // matching when the user clicked testimonials[1]); Strategy 7 handles these correctly.
            const ARRAY_BLOCK_TYPES = new Set(['carousel', 'portfolio-grid', 'team', 'testimonials', 'social-proof', 'logo-cloud'])
            const hasArrayIndex = imageClickData.imageIndex !== undefined && ARRAY_BLOCK_TYPES.has(imageClickData.blockType)

            // Strategy 1: Find URL string match in block data (text fields with URL)
            const fieldPath = block ? findStringFieldPath(block, src, src) : null
            const UPLOAD_FIELD_SET = new Set(['image', 'backgroundImage', 'logo', 'avatar', 'ogImage'])

            if (block && fieldPath && !hasArrayIndex) {
                // When path descends into a Payload upload object (e.g. ['image','url']),
                // truncate to the upload field and store newMediaId — otherwise save would
                // re-extract the old id from { id: old, url: new } via normalizeUploadField.
                const uploadAncestorIdx = fieldPath.findIndex(
                    seg => typeof seg === 'string' && UPLOAD_FIELD_SET.has(seg as string)
                )
                if (uploadAncestorIdx >= 0) {
                    const truncatedPath = fieldPath.slice(0, uploadAncestorIdx + 1)
                    const nextBlock = updateValueAtPath(block as Record<string, unknown>, truncatedPath, newMediaId)
                    updateBlock(blockIndex, nextBlock)
                } else {
                    const nextBlock = updateValueAtPath(block as Record<string, unknown>, fieldPath, newUrl)
                    updateBlock(blockIndex, nextBlock)
                }
            } else if (block) {
                // Strategy 2: Find image/upload field by name convention
                // Payload upload fields: image, backgroundImage, posterImage, logo, avatar, etc.
                // Values can be: number (ID), populated object {id,url}, or null (cleared/stripped by save)
                const IMAGE_FIELD_NAMES = ['image', 'backgroundImage', 'background_image', 'posterImage', 'logo', 'avatar', 'thumbnail']
                // GH-1381: only these root upload fields are normalized back to an integer id on save
                // (normalizeBlocksForPersistence → UPLOAD_FIELDS). For them we can safely store the
                // populated object { id, url, alt } so the preview updates immediately. Fields NOT in
                // this set (posterImage / thumbnail / background_image) must stay a bare id — storing an
                // object there would persist the raw object (or null a string-url field) and lose data.
                const NORMALIZABLE_UPLOAD_FIELDS = new Set(['image', 'backgroundImage', 'logo', 'avatar'])
                const buildImageValue = (fieldName: string, existingAlt = ''): unknown =>
                    NORMALIZABLE_UPLOAD_FIELDS.has(fieldName)
                        ? { id: newMediaId, url: newUrl, alt: existingAlt }
                        : newMediaId
                const blockData = block as Record<string, unknown>
                let matched = false

                if (!hasArrayIndex) {

                    // Try matching: non-null fields first (ID or populated object with matching URL)
                    for (const fieldName of IMAGE_FIELD_NAMES) {
                        const val = blockData[fieldName]
                        if (val !== undefined && val !== null) {
                            const isMatch = typeof val === 'number' ||
                                (typeof val === 'object' && 'url' in (val as Record<string, unknown>) &&
                                    src.includes(String((val as Record<string, unknown>).url)))
                            if (isMatch) {
                                // Preserve existing alt if the field already held a populated image object
                                const existingAlt = typeof val === 'object' && val !== null
                                    ? String((val as Record<string, unknown>).alt ?? '')
                                    : ''
                                updateBlock(blockIndex, { [fieldName]: buildImageValue(fieldName, existingAlt) })
                                matched = true
                                break
                            }
                        }
                    }

                    // Strategy 3: field exists but is null (save may have stripped the ID)
                    // — set it to the new media ID
                    if (!matched) {
                        for (const fieldName of IMAGE_FIELD_NAMES) {
                            if (fieldName in blockData && (blockData[fieldName] === null || typeof blockData[fieldName] === 'number')) {
                                updateBlock(blockIndex, { [fieldName]: buildImageValue(fieldName) })
                                matched = true
                                break
                            }
                        }
                    }

                    // Strategy 4: Deep search nested arrays for image fields with URL match
                    // Only matches populated objects where URL matches clicked src (safe for arrays)
                    if (!matched) {
                        const NESTED_IMAGE_KEYS = new Set(['image', 'avatar', 'logo', 'backgroundImage', 'posterImage', 'thumbnail'])
                        const srcPathname = new URL(src, window.location.origin).pathname
                        const findNestedImageByUrl = (obj: unknown, path: Array<string | number> = []): Array<string | number> | null => {
                            if (Array.isArray(obj)) {
                                for (let i = 0; i < obj.length; i++) {
                                    const p = findNestedImageByUrl(obj[i], [...path, i])
                                    if (p) return p
                                }
                            } else if (obj && typeof obj === 'object') {
                                for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
                                    if (NESTED_IMAGE_KEYS.has(k) && v && typeof v === 'object' && 'url' in (v as Record<string, unknown>)) {
                                        const url = String((v as Record<string, unknown>).url)
                                        if (src.includes(url) || url.includes(srcPathname)) {
                                            return [...path, k]
                                        }
                                    }
                                    if (typeof v === 'object' && v !== null) {
                                        const p = findNestedImageByUrl(v, [...path, k])
                                        if (p) return p
                                    }
                                }
                            }
                            return null
                        }
                        const clone = JSON.parse(JSON.stringify(blocks))
                        const nestedPath = findNestedImageByUrl(clone[blockIndex])
                        if (nestedPath) {
                            const nextBlock = updateValueAtPath(clone[blockIndex], nestedPath, newMediaId)
                            updateBlock(blockIndex, nextBlock)
                            matched = true
                        }
                    }

                    // Strategy 5: Partial URL match in nested strings
                    // Skip for gallery with imageIndex — Strategy 6 handles that case exclusively
                    // to avoid empty-string caption fields matching any URL (target.includes('') === true).
                    if (!matched && !(imageClickData.blockType === 'gallery' && imageClickData.imageIndex !== undefined)) {
                        const findPartialPath = (obj: unknown, target: string, path: Array<string | number> = []): Array<string | number> | null => {
                            if (typeof obj === 'string' && obj.length > 0 && (target.includes(obj) || obj.includes(target))) return path
                            if (Array.isArray(obj)) {
                                for (let i = 0; i < obj.length; i++) {
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
                        const clone = JSON.parse(JSON.stringify(blocks))
                        const partialPath = findPartialPath(clone[blockIndex], new URL(src, window.location.origin).pathname)
                        if (partialPath) {
                            const nextBlock = updateValueAtPath(clone[blockIndex], partialPath, newUrl)
                            updateBlock(blockIndex, nextBlock)
                            matched = true
                        }
                    }
                } // end !hasArrayIndex (Strategies 2–5)

                // Strategy 6: Gallery fallback — use data-image-index to target array slot directly
                // Non-destructive: reads current images from Zustand store, only updates the clicked slot.
                // Pre-fills null slots up to totalImagesInBlock so existing stock placeholders are preserved
                // as null entries (gallery will show real images where set, otherwise falls back per-slot).
                // Store the populated object { id, url, alt } (mirrors Strategy 7): the gallery render gate
                // (gallery/index.tsx) only shows a real image when `typeof image === 'object' && image.url`,
                // so a bare integer would fall back to the stock image until reload. normalizeUploadField
                // extracts the numeric .id before persistence, so the DB write is unaffected.
                if (!matched && imageClickData.imageIndex !== undefined && imageClickData.blockType === 'gallery') {
                    const idx = imageClickData.imageIndex
                    const currentBlock = blocks[blockIndex] as Record<string, unknown>
                    const currentImages = Array.isArray(currentBlock.images)
                        ? [...currentBlock.images as Array<Record<string, unknown>>]
                        : []
                    const totalSlots = Math.max(
                        imageClickData.totalImagesInBlock ?? 0,
                        idx + 1,
                        currentImages.length
                    )
                    while (currentImages.length < totalSlots) {
                        currentImages.push({ image: null, caption: '' })
                    }
                    // Preserve existing alt text if the slot already held a populated image object
                    const existingImg = currentImages[idx]?.image
                    const existingAlt = existingImg && typeof existingImg === 'object'
                        ? String((existingImg as Record<string, unknown>).alt ?? '')
                        : ''
                    currentImages[idx] = { ...currentImages[idx], image: { id: newMediaId, url: newUrl, alt: existingAlt } }
                    updateBlock(blockIndex, { images: currentImages })
                    matched = true
                }

                // Strategy 7: Universal array-image handler for all other blocks with imageIndex.
                // Store populated object { id, url, alt } so in-memory rendering works immediately
                // (components read .url) while persistence works via .id (normalizeUploadField keeps
                // objects that have an .id, strips those that don't).
                if (!matched && imageClickData.imageIndex !== undefined) {
                    const ARRAY_IMAGE_CONFIG: Record<string, { arrayField: string; imageSubField: string }> = {
                        carousel: { arrayField: 'items', imageSubField: 'image' },
                        'portfolio-grid': { arrayField: 'projects', imageSubField: 'image' },
                        team: { arrayField: 'members', imageSubField: 'image' },
                        testimonials: { arrayField: 'testimonials', imageSubField: 'avatar' },
                        'social-proof': { arrayField: 'reviews', imageSubField: 'avatar' },
                        'logo-cloud': { arrayField: 'logos', imageSubField: 'logo' },
                    }
                    const arrayConfig = ARRAY_IMAGE_CONFIG[imageClickData.blockType]
                    if (arrayConfig) {
                        const idx = imageClickData.imageIndex
                        const currentBlock = blocks[blockIndex] as Record<string, unknown>
                        const currentArray = Array.isArray(currentBlock[arrayConfig.arrayField])
                            ? [...currentBlock[arrayConfig.arrayField] as Array<Record<string, unknown>>]
                            : []
                        // Pad array to idx if block has fewer items than rendered fallback slots
                        while (currentArray.length <= idx) {
                            currentArray.push({} as Record<string, unknown>)
                        }
                        // Store populated object so components reading .url render the new image immediately
                        // without a full reload. Preserves existing alt text. normalizeUploadField
                        // extracts the numeric id before persistence.
                        const existingItem = currentArray[idx] as Record<string, unknown>
                        const existingAlt = typeof existingItem[arrayConfig.imageSubField] === 'object' && existingItem[arrayConfig.imageSubField] !== null
                            ? String((existingItem[arrayConfig.imageSubField] as Record<string, unknown>).alt ?? '')
                            : ''
                        currentArray[idx] = { ...existingItem, [arrayConfig.imageSubField]: { id: newMediaId, url: newUrl, alt: existingAlt } }
                        updateBlock(blockIndex, { [arrayConfig.arrayField]: currentArray })
                        matched = true
                    }
                }

                if (!matched) {
                    toast.error(t.editor.preview.mapImageError)
                }
            }

            // Push updated block to iframe for in-place preview — mirrors BLOCK_FIELD_CHANGED path.
            // updateBlock calls above are synchronous so getState() reflects the latest value.
            // This lets onImageReplaced use refreshPreview:false (no full iframe reload needed).
            // Send the locale-MERGED display block (not the raw flat block): on a non-primary locale
            // the panel stores edits like `variant` in localeOverrides, so the flat block keeps the
            // stale DB value. Sending it raw would render the wrong variant (e.g. about image-overlay
            // flipping to split after upload). Mirrors handleBlockFieldChange in page.tsx.
            const store = useEditorStore.getState()
            const rawBlock = store.blocks[blockIndex]
            const latestBlock = rawBlock ? store.getDisplayBlock(rawBlock) : rawBlock
            if (latestBlock) {
                frameElementRef.current?.contentWindow?.postMessage(
                    { type: 'UPDATE_BLOCK_DATA', blockIndex, blockData: latestBlock },
                    window.location.origin,
                )
            }
            toast.success(t.editor.preview.imageReplaceSuccess)
            setImageClickData(null)
            onImageReplaced?.()
        } catch (error) {
            console.error('Image replace error:', error)
            // GH-1381 Case 2: surface the specific reason (e.g. "Invalid image file…", "Unauthorized")
            // instead of a bare generic toast, so the user knows whether it's format/auth/server.
            const reason = error instanceof Error && error.message ? error.message : ''
            toast.error(t.editor.preview.imageReplaceFailed, reason ? { description: reason } : undefined)
        } finally {
            setIsImageProcessing(false)
        }
    }, [blocks, imageClickData, onImageReplaced, updateBlock, uploadImage])

    const isDragging = dragState !== null
    const dragSourceIndex = dragState?.sourceIndex

    const latestDropIndexRef = useRef<number | null>(null)
    useEffect(() => {
        latestDropIndexRef.current = dropIndex
    }, [dropIndex])

    const lastDragTimeRef = useRef(0)

    useEffect(() => {
        if (!isDragging || dragSourceIndex === undefined || !containerElement || !frameElement) return

        const handlePointerMove = (event: PointerEvent) => {
            const now = Date.now()
            if (now - lastDragTimeRef.current < 16) return
            lastDragTimeRef.current = now
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
        // Use hoverData if available, otherwise fall back to textEditingData context
        const blockIndex = hoverData?.blockIndex ?? textEditingData?.blockIndex ?? -1
        const blockType = hoverData?.blockType ?? textEditingData?.blockType ?? ''
        const text = hoverData?.text ?? currentLiveTextRef.current ?? textEditingData?.originalText ?? ''
        // When falling back to textEditingData (no hoverData), use exact-match only —
        // the fuzzy pass risks matching a different field with the same short substring.
        const fieldPath = hoverData?.fieldPath ??
            (textEditingData && blocks[textEditingData.blockIndex]
                ? findStringFieldPath(blocks[textEditingData.blockIndex], text, text, [], true)
                : null)

        if (blockIndex < 0) return
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
                { instruction, originalText: text, rewrittenText: rewritten, blockType },
            )

            setIsEditing(false)
            setHoverData(prev => prev ? { ...prev, text: rewritten } : prev)
        } catch (error) {
            console.error('Inline rewrite failed', error)
            toast.error(t.editor.preview.inlineEditFailed, {
                description: 'Please try again.',
            })
        } finally {
            setIsSubmitting(false)
        }
    }, [blocks, hoverData, textEditingData, onInlineEditApplied, updateBlock])

    // BUG-FIX: Prevent iframe reloading in the middle of typing due to background auto-saves.
    // If the user is actively editing text, freeze the iframeKey so it doesn't navigate.
    // Once they blur/stop editing, it safely syncs up and reloads the preview.
    const previousIframeKey = useRef(iframeKey)
    // isFlushingEdit keeps the freeze alive while the inline-edit save flushes (GH-1367 Bug 3),
    // even though textEditingData was already cleared to hide the toolbar.
    const effectiveIframeKey = (textEditingData || isEditing || isFlushingEdit) ? previousIframeKey.current : iframeKey
    useEffect(() => {
        if (!textEditingData && !isEditing && !isFlushingEdit) {
            previousIframeKey.current = iframeKey
        }
    }, [iframeKey, textEditingData, isEditing, isFlushingEdit])

    const iframeSrc = useMemo(() => {
        const url = new URL(`/preview/${siteId}`, 'http://localhost')
        url.searchParams.set('v', String(effectiveIframeKey))
        if (pageId) {
            url.searchParams.set('pageId', pageId)
        }
        url.searchParams.set('editor', '1')
        // Mobile/tablet compact chrome (same signal CompactEditorLayout already passes as
        // disableDragDrop) — the injected click handler uses this to skip activating the
        // inline WYSIWYG text-edit toolbar, which is desktop-only in the F05-v2 spec (text
        // edits go through the block-settings sheet's fields on mobile/tablet instead).
        if (disableDragDrop) url.searchParams.set('compact', '1')

        // Add scroll parameters to avoid relying on native iframe onLoad which can be flaky.
        // NOTE: This runs only when iframeKey/pageId changes (when we INTEND to reload).
        url.searchParams.set('scroll', String(savedScrollYRef.current || 0))
        if (scrollToBlockIndexRef.current !== null) {
            url.searchParams.set('scrollToBlock', String(scrollToBlockIndexRef.current))
            scrollToBlockIndexRef.current = null // Clear it so it only runs once
        }

        return url.pathname + url.search
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [siteId, effectiveIframeKey, pageId, disableDragDrop]) // DO NOT depend on savedScrollYRef to prevent constant reloads


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

    // How much the iframe has scrolled since text editing started — used to keep
    // toolbar/popover anchored to the element as the user scrolls.
    const scrollOffset = textEditingData ? iframeScrollY - textEditingData.scrollYAtStart : 0

    // Expanded preview = any sidebar hidden (Focus / Structure / Content presets).
    // Strip padding, rounding, and the desktop max-width so the preview spans
    // edge-to-edge. Mobile viewport always centers its 390px canvas regardless.
    const isExpanded = !leftSidebarVisible || !rightSidebarVisible
    const isMobile = viewport === 'mobile'

    return (
        <>
            <div
                ref={setContainerElement}
                className="relative flex-1 overflow-hidden bg-[#111827]"
            >
                <div
                    ref={setScrollContainerElement}
                    className={cn(
                        'flex h-full items-stretch overflow-auto border border-white/10 bg-[#0F172A]',
                        isExpanded
                            ? cn('rounded-none', isMobile && 'justify-center')
                            : 'justify-center rounded-[28px] p-4',
                    )}
                >
                    <div
                        ref={setCanvasElement}
                        className="relative overflow-hidden border border-white/10 bg-transparent shadow-2xl transition-all"
                        style={{
                            width: isMobile ? 'min(390px, 100%)' : '100%',
                            maxWidth: isMobile ? 390 : isExpanded ? undefined : 1280,
                        }}
                    >
                        <iframe
                            ref={(el) => { setFrameElement(el); frameElementRef.current = el }}
                            key={effectiveIframeKey}
                            src={iframeSrc}
                            className="h-full w-full border-0"
                            title={t.editor.toolbar.sitePreview}
                            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                        />
                    </div>
                </div>

                {((blockHover && !dragState) || (selectedBlock !== null && overlayOffset)) ? (
                    <>
                        {/* Hover overlay — dashed border + block name label */}
                        {(() => {
                            if (!blockHover || dragState || !overlayOffset) return null
                            if (blockHover.blockIndex === selectedBlock) return null
                            if (blockHover.blockType === 'breadcrumb' || blockHover.blockType === 'navigation' || blockHover.blockType === 'footer') return null
                            const label = blockHover.blockType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                            return (
                                <div
                                    className="pointer-events-none absolute border-2 border-dashed border-blue-400 transition-all duration-100"
                                    style={{
                                        top: overlayOffset.top + blockHover.top,
                                        left: overlayOffset.left + blockHover.left,
                                        width: blockHover.width,
                                        height: blockHover.height,
                                        zIndex: 30,
                                    }}
                                >
                                    <span className="absolute left-0 top-0 -translate-y-full max-w-[160px] truncate rounded-t-sm bg-blue-400 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-white">
                                        {label}
                                    </span>
                                </div>
                            )
                        })()}
                        {/* Selected border injected via CSS into iframe; label rendered here */}
                        {(() => {
                            if (selectedBlock === null || !overlayOffset || dragState) return null
                            const layout = editableLayouts.find(l => l.blockIndex === selectedBlock) ?? null
                            if (!layout) return null
                            const label = layout.blockType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                            return (
                                <div
                                    className="pointer-events-none absolute transition-all duration-100"
                                    style={{
                                        top: overlayOffset.top + layout.top,
                                        left: overlayOffset.left + layout.left,
                                        width: layout.width,
                                        height: layout.height,
                                        zIndex: 31,
                                    }}
                                >
                                    <span className="absolute left-0 top-0 -translate-y-full rounded-t-sm bg-blue-500 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-white">
                                        {label}
                                    </span>
                                </div>
                            )
                        })()}
                        {/* Block Action Bar — shows on selected block */}
                        {(() => {
                            const selectedLayout = selectedBlock !== null
                                ? editableLayouts.find(layout => layout.blockIndex === selectedBlock) || null
                                : null
                            if (!selectedLayout || !overlayOffset || dragState || textEditingData || hideBlockActionBar) return null

                            return (
                                <>
                                    <BlockActionBar
                                        blockIndex={selectedLayout.blockIndex}
                                        blockType={selectedLayout.blockType}
                                        blockVariant={selectedLayout.blockIndex >= 0 ? (blocks[selectedLayout.blockIndex] as Record<string, unknown>)?.variant as string | undefined : undefined}
                                        blockName={selectedLayout.blockIndex >= 0 ? (blocks[selectedLayout.blockIndex]?.blockType || 'block') : selectedLayout.blockType}
                                        totalBlocks={editableLayouts.length}
                                        isMobile={viewport === 'mobile'}
                                        onMoveUp={() => onReorderBlocks?.(selectedLayout.blockIndex, selectedLayout.blockIndex - 1)}
                                        onMoveDown={() => onReorderBlocks?.(selectedLayout.blockIndex, selectedLayout.blockIndex + 1)}
                                        onDuplicate={() => {
                                            onDuplicateBlock?.(selectedLayout.blockIndex)
                                        }}
                                        onAIEdit={() => {
                                            onBlockSelect?.(selectedLayout.blockIndex)
                                            onBlockAIEdit?.(selectedLayout.blockIndex, selectedLayout.blockType)
                                        }}
                                        onDelete={() => setDeleteConfirmIndex(selectedLayout.blockIndex)}
                                        deleteDisabled={selectedLayout.blockType === 'cartWidget' && isCartLocked}
                                        deleteDisabledTitle={t.editor.settings.cartDeleteLocked}
                                        onDragStart={disableDragDrop ? undefined : (event) => {
                                            const frameRect = frameElement?.getBoundingClientRect()
                                            if (!frameRect) return

                                            event.preventDefault()
                                            event.stopPropagation()
                                            event.currentTarget.setPointerCapture(event.pointerId)
                                            cancelPendingHoverClear()
                                            dragPointerClientYRef.current = event.clientY
                                            dragPointerStartYRef.current = event.clientY
                                            dragPointerOffsetYRef.current = event.clientY - frameRect.top - selectedLayout.top
                                            setHoverData(null)
                                            setIsEditing(false)
                                            setDragState({
                                                sourceIndex: selectedLayout.blockIndex,
                                                sourceRect: { ...selectedLayout, blockType: selectedLayout.blockType },
                                                pointerOffsetY:
                                                    event.clientY - frameRect.top - selectedLayout.top,
                                                currentY: selectedLayout.top,
                                            })
                                            setDropIndex(
                                                editableLayouts.findIndex(
                                                    layout => layout.blockIndex === selectedLayout.blockIndex,
                                                ),
                                            )
                                            frameElement?.contentWindow?.postMessage(
                                                { type: 'DRAG_BLOCK_START', blockIndex: selectedLayout.blockIndex },
                                                window.location.origin,
                                            )
                                            syncDragPosition(event.clientY, selectedLayout.blockIndex)
                                        }}
                                        position={{
                                            top: overlayOffset.top + selectedLayout.top,
                                            left: overlayOffset.left + selectedLayout.left,
                                            width: selectedLayout.width,
                                        }}
                                    />
                                </>
                            )
                        })()}
                    </>
                ) : null}

                {/* Selection frame for global blocks (nav/footer/breadcrumb) — solid blue border */}
                {selectedGlobalBlockLayout && overlayOffset && !dragState ? (
                    <div
                        className="pointer-events-none absolute border-2 border-blue-500 bg-blue-500/10 transition-all duration-100"
                        style={{
                            top: overlayOffset.top + selectedGlobalBlockLayout.top,
                            left: overlayOffset.left + selectedGlobalBlockLayout.left,
                            width: selectedGlobalBlockLayout.width,
                            height: selectedGlobalBlockLayout.height,
                            zIndex: 31,
                        }}
                    >
                        <span className="absolute left-0 top-0 -translate-y-full rounded-t-sm bg-blue-500 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-white capitalize">
                            {selectedGlobalBlockLayout.blockType?.replace(/-/g, ' ')}
                        </span>
                    </div>
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
                            // Keep hoverData while text-editing so AI sparkles can still use it
                            if (!isEditing && !textEditingData) {
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
                    </div>
                ) : null}

                {/* AI popover unified — position:fixed to escape overflow-hidden */}
                {isEditing && overlayOffset && (hoverData || textEditingData) && (() => {
                    const targetData = textEditingData || hoverData!
                    if (!targetData.rect) return null
                    const currentScrollOffset = textEditingData ? scrollOffset : 0
                    const adjustedTop = targetData.rect.top - currentScrollOffset

                    const POPOVER_EST_HEIGHT = 200
                    const cRect = containerElement?.getBoundingClientRect() ?? { top: 0, left: 0, right: window.innerWidth }
                    const canvasWidth = (cRect.right ?? window.innerWidth) - cRect.left

                    const absTop = cRect.top + overlayOffset.top + adjustedTop
                    const absLeft = cRect.left + overlayOffset.left + targetData.rect.left

                    // Determine layout space
                    const toolbarHeight = textEditingData ? 48 : 0
                    const neededSpaceBelow = POPOVER_EST_HEIGHT + 8 + (textEditingData && ((absTop - 12) < 48) ? 48 : 0)
                    const availableSpaceBelow = window.innerHeight - (absTop + targetData.rect.height)

                    // Prefer showing BELOW unless there is no space below AND there is enough space above
                    let showBelow = true
                    if (availableSpaceBelow < neededSpaceBelow) {
                        const neededSpaceAbove = POPOVER_EST_HEIGHT + toolbarHeight
                        if (absTop - 12 >= neededSpaceAbove) {
                            showBelow = false
                        }
                    }

                    // Center horizontally within canvas, but don't spill off screen
                    const popoverWidth = Math.min(360, canvasWidth - 16)
                    let popoverLeft = absLeft + (targetData.rect.width / 2) - (popoverWidth / 2)
                    const minLeft = cRect.left + 8
                    const maxLeft = cRect.left + canvasWidth - popoverWidth - 8
                    popoverLeft = Math.max(minLeft, Math.min(popoverLeft, maxLeft))

                    return (
                        <div
                            data-inline-edit-popover
                            className="z-[210] pointer-events-auto"
                            style={showBelow ? {
                                position: 'fixed',
                                top: absTop + targetData.rect.height + 8 + (textEditingData && absTop - 12 < 48 ? 48 : 0), // Push down further if toolbar shifted below
                                left: popoverLeft,
                                width: popoverWidth,
                            } : {
                                position: 'fixed',
                                top: absTop - 12 - (textEditingData ? 48 : 0), // Push up above the toolbar if text editing
                                left: popoverLeft,
                                transform: 'translateY(-100%)',
                                width: popoverWidth,
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <InlineEditPopover
                                blockType={targetData.blockType}
                                currentText={textEditingData ? textEditingData.originalText : hoverData?.text || ''}
                                isSubmitting={isSubmitting}
                                isMobile={viewport === 'mobile'}
                                onClose={() => setIsEditing(false)}
                                onSubmit={handleInlineRewrite}
                            />
                        </div>
                    )
                })()}

                {/* US-F05-06 AC-1: Rich Text Toolbar — position:fixed to escape overflow-hidden parents */}
                {textEditingData && overlayOffset && (() => {
                    // On mobile the toolbar wraps to 2 rows (~96px); on desktop it fits in 1 row (48px)
                    const TOOLBAR_HEIGHT = viewport === 'mobile' ? 96 : 48;
                    const adjustedRectTop = textEditingData.rect.top - scrollOffset
                    // getBoundingClientRect gives viewport-relative coords → use with position:fixed
                    const cRect = containerElement?.getBoundingClientRect() ?? { top: 0, left: 0, right: window.innerWidth }
                    // Use canvas element bounds for accurate width (containerElement is the outer panel, not the 390px canvas)
                    const canvasRect = canvasElement?.getBoundingClientRect() ?? { ...cRect, width: (cRect.right ?? window.innerWidth) - cRect.left, left: cRect.left }
                    const canvasWidth = canvasRect.width
                    // Clamp toolbar width to canvas width so it never spills outside the canvas on mobile
                    const TOOLBAR_WIDTH = Math.min(560, canvasWidth - 16)
                    let topPos = cRect.top + overlayOffset.top + adjustedRectTop - TOOLBAR_HEIGHT;
                    let leftPos = cRect.left + overlayOffset.left + textEditingData.rect.left + (textEditingData.rect.width / 2) - (TOOLBAR_WIDTH / 2);

                    // Clamp within canvas bounds, not full window — prevents spilling outside canvas
                    const minLeft = canvasRect.left + 8
                    const maxLeft = canvasRect.left + canvasWidth - TOOLBAR_WIDTH - 8
                    leftPos = Math.max(minLeft, Math.min(leftPos, maxLeft));

                    // If no room above, flip below the element
                    if (topPos < 8) {
                        topPos = cRect.top + overlayOffset.top + adjustedRectTop + textEditingData.rect.height + 8;
                    }

                    return (
                        <div
                            className="z-[200]"
                            data-wysiwyg-toolbar
                            style={{
                                position: 'fixed',
                                top: topPos,
                                left: leftPos,
                                ...(viewport === 'mobile' ? { width: TOOLBAR_WIDTH } : {}),
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
                            data-image-toolbar
                            className="absolute z-[100]"
                            style={{
                                top: topPos,
                                left: leftPos,
                            }}
                        >
                            <ImageToolbar
                                onImageSelect={handleImageReplace}
                                isProcessing={isImageProcessing}
                            />
                        </div>
                    )
                })()}
            </div>

            {/* Delete block confirmation modal */}
            {(() => {
                // Floating global blocks use negative indices (-1=cartWidget, -2=whatsapp-button, -3=socialWidget)
                const isGlobalDelete = deleteConfirmIndex !== null && deleteConfirmIndex < 0
                const deleteBlockType = isGlobalDelete
                    ? (blockLayouts.find(l => l.blockIndex === deleteConfirmIndex)?.blockType ?? 'block')
                    : (deleteConfirmIndex !== null ? (blocks[deleteConfirmIndex]?.blockType ?? 'block') : 'block')
                return (
                    <DeleteBlockConfirm
                        open={deleteConfirmIndex !== null}
                        blockName={deleteBlockType}
                        scope={isGlobalDelete ? 'global' : 'page'}
                        onConfirm={() => {
                            if (deleteConfirmIndex === null) return
                            if (isGlobalDelete) {
                                const key = BLOCK_TYPE_TO_KEY[deleteBlockType]
                                if (key) useEditorStore.getState().deleteGlobalBlock(key)
                            } else {
                                onDeleteBlock?.(deleteConfirmIndex)
                            }
                            onBlockSelect?.(null)
                            setDeleteConfirmIndex(null)
                            toast.success(`Deleted ${deleteBlockType.replace(/-/g, ' ')}`, {
                                duration: 5000,
                                action: {
                                    label: 'Undo',
                                    onClick: () => {
                                        const { undo: storeUndo } = useEditorStore.getState()
                                        storeUndo()
                                    },
                                },
                            })
                        }}
                        onCancel={() => setDeleteConfirmIndex(null)}
                    />
                )
            })()}
        </>
    )
}

export const PreviewFrame = memo(PreviewFrameInner)
