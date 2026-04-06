'use client'

import { useEffect } from 'react'

export function PreviewScripts() {
    useEffect(() => {
        let parentOrigin = '*'
        try {
            parentOrigin = new URL(document.referrer).origin
        } catch (e) {
            parentOrigin = window.location.origin // fallback
        }

        const validTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'A', 'BUTTON', 'LI', 'LABEL', 'DIV']
        const excludedBlockTypes = ['navigation', 'footer']
        
        let hoveredEl: HTMLElement | null = null
        let hoverTimer: number | null = null
        let hoveredBlock: Element | null = null

        const getEditableLayouts = () => {
            return Array.from(document.querySelectorAll('[data-block-index]'))
                .map((node) => {
                    const rect = node.getBoundingClientRect()
                    return {
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height,
                        blockIndex: parseInt(node.getAttribute('data-block-index') || '-1', 10),
                        blockType: node.getAttribute('data-block-type')
                    }
                })
                .filter((layout) => layout.blockType && !excludedBlockTypes.includes(layout.blockType))
        }

        const postLayouts = () => {
            window.parent.postMessage({
                type: 'BLOCK_LAYOUT',
                layouts: getEditableLayouts()
            }, parentOrigin)
        }

        const clearHoverState = () => {
            if (hoverTimer) {
                clearTimeout(hoverTimer)
                hoverTimer = null
            }
            hoveredEl = null
            hoveredBlock = null
            window.parent.postMessage({ type: 'BLOCK_MOUSEOUT' }, parentOrigin)
        }

        const onMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            const blockContainer = target.closest('[data-block-index]')
            
            if (!blockContainer) {
                clearHoverState()
                return
            }

            const blockType = blockContainer.getAttribute('data-block-type')
            if (blockType && !excludedBlockTypes.includes(blockType) && hoveredBlock !== blockContainer) {
                hoveredBlock = blockContainer
                const rect = blockContainer.getBoundingClientRect()
                window.parent.postMessage({
                    type: 'BLOCK_CONTAINER_HOVERED',
                    layout: {
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height,
                        blockIndex: parseInt(blockContainer.getAttribute('data-block-index') || '-1', 10),
                        blockType
                    }
                }, parentOrigin)
            }

            if (target.tagName === 'IMG') {
                if (hoverTimer) clearTimeout(hoverTimer)
                hoverTimer = window.setTimeout(() => {
                    const rect = target.getBoundingClientRect()
                    window.parent.postMessage({
                        type: 'IMAGE_HOVERED',
                        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
                        src: (target as HTMLImageElement).src,
                        blockIndex: parseInt(blockContainer.getAttribute('data-block-index') || '-1', 10),
                        blockType: blockContainer.getAttribute('data-block-type')
                    }, parentOrigin)
                }, 200)
                return
            }

            if (!validTags.includes(target.tagName) || target.children.length > 1) {
                return
            }

            const text = target.innerText?.trim()
            if (!text || text.length < 2) return

            if (hoveredEl === target) return

            if (hoverTimer) {
                clearTimeout(hoverTimer)
            }

            hoveredEl = target
            hoverTimer = window.setTimeout(() => {
                const rect = target.getBoundingClientRect()
                window.parent.postMessage({
                    type: 'BLOCK_HOVERED',
                    rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
                    text: text,
                    blockIndex: parseInt(blockContainer.getAttribute('data-block-index') || '-1', 10),
                    blockType: blockContainer.getAttribute('data-block-type')
                }, parentOrigin)
            }, 200)
        }

        const onMouseOut = (e: MouseEvent) => {
            if (!hoveredEl) return
            if (e.target === hoveredEl) {
                clearHoverState()
            }
            if (e.target && (e.target as HTMLElement).tagName === 'IMG') {
                if (hoverTimer) {
                    clearTimeout(hoverTimer)
                    hoverTimer = null
                }
            }
        }

        const onPointerDown = () => {
            window.parent.postMessage({ type: 'PREVIEW_POINTER_DOWN' }, parentOrigin)
        }

        let currentEditingEl: HTMLElement | null = null
        let originalText = ''

        const cleanUpEditing = () => {
            if (!currentEditingEl) return
            currentEditingEl.removeAttribute('contenteditable')
            const newText = currentEditingEl.innerText?.trim()
            const blockIndex = parseInt(currentEditingEl.closest('[data-block-index]')?.getAttribute('data-block-index') || '-1', 10)
            
            window.parent.postMessage({
                type: 'TEXT_EDITED',
                blockIndex,
                oldText: originalText,
                newText: newText
            }, parentOrigin)
            
            currentEditingEl = null
            window.parent.postMessage({ type: 'TEXT_EDITING_STOPPED' }, parentOrigin)
        }

        const onDblClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            const blockContainer = target.closest('[data-block-index]')
            
            if (!blockContainer) return
            const blockType = blockContainer.getAttribute('data-block-type')
            if (blockType && excludedBlockTypes.includes(blockType)) return

            if (validTags.includes(target.tagName) && target.children.length <= 1) {
                e.preventDefault()
                e.stopPropagation()
                
                if (currentEditingEl && currentEditingEl !== target) {
                    cleanUpEditing()
                }
                
                currentEditingEl = target
                currentEditingEl.setAttribute('contenteditable', 'true')
                currentEditingEl.focus()
                originalText = currentEditingEl.innerText?.trim() || ''

                const rect = target.getBoundingClientRect()
                window.parent.postMessage({
                    type: 'TEXT_EDITING_STARTED',
                    rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
                    blockIndex: parseInt(blockContainer.getAttribute('data-block-index') || '-1', 10)
                }, parentOrigin)
            }
        }

        const onBlur = (e: FocusEvent) => {
            if (currentEditingEl === e.target) {
                cleanUpEditing()
            }
        }

        const onKeyDown = (e: KeyboardEvent) => {
            if (currentEditingEl && (e.key === 'Enter' || e.key === 'Escape')) {
                e.preventDefault()
                cleanUpEditing()
                window.getSelection()?.removeAllRanges()
            }
        }

        const onClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            let anchor = target.closest('a')
            if (anchor) {
                e.preventDefault()
                e.stopPropagation()
            }
            if (target.tagName === 'IMG') {
                e.preventDefault()
                e.stopPropagation()
                const blockContainer = target.closest('[data-block-index]')
                if (!blockContainer) return
                
                const blockIndex = parseInt(blockContainer.getAttribute('data-block-index') || '-1', 10)
                const blockType = blockContainer.getAttribute('data-block-type')
                
                if (blockType && excludedBlockTypes.includes(blockType)) return

                const rect = target.getBoundingClientRect()
                window.parent.postMessage({
                    type: 'IMAGE_EDITING_STARTED',
                    rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
                    src: (target as HTMLImageElement).src,
                    blockIndex,
                    blockType
                }, parentOrigin)
            }
        }

        const onDragOver = (e: DragEvent) => {
            e.preventDefault() // Allow drop
            const target = e.target as HTMLElement
            const blockContainer = target.closest('[data-block-index]')
            document.querySelectorAll('.insert-marker, .drag-over, .drag-over-top, .drag-over-bottom').forEach(el => {
                el.classList.remove('insert-marker', 'drag-over', 'drag-over-top', 'drag-over-bottom')
            })
            if (!blockContainer) return
            
            const blockType = blockContainer.getAttribute('data-block-type')
            if (blockType && excludedBlockTypes.includes(blockType)) return

            const rect = blockContainer.getBoundingClientRect()
            const midY = rect.top + rect.height / 2
            
            blockContainer.classList.add('insert-marker')
            if (e.clientY < midY) {
                blockContainer.classList.add('drag-over-top')
            } else {
                blockContainer.classList.add('drag-over-bottom')
            }
        }

        const onDragLeave = () => {
            document.querySelectorAll('.insert-marker, .drag-over-top, .drag-over-bottom').forEach(el => {
                el.classList.remove('insert-marker', 'drag-over', 'drag-over-top', 'drag-over-bottom')
            })
        }

        const onDrop = (e: DragEvent) => {
            e.preventDefault()
            const target = e.target as HTMLElement
            const blockContainer = target.closest('[data-block-index]')
            
            document.querySelectorAll('.insert-marker, .drag-over-top, .drag-over-bottom').forEach(el => {
                el.classList.remove('insert-marker', 'drag-over', 'drag-over-top', 'drag-over-bottom')
            })

            if (!blockContainer) return
            const blockType = blockContainer.getAttribute('data-block-type')
            if (blockType && excludedBlockTypes.includes(blockType)) return

            try {
                const dataRaw = e.dataTransfer?.getData('application/json')
                if (!dataRaw) return
                const blockData = JSON.parse(dataRaw)
                
                const rect = blockContainer.getBoundingClientRect()
                const midY = rect.top + rect.height / 2
                const isAfter = e.clientY > midY
                
                let targetIndex = parseInt(blockContainer.getAttribute('data-block-index') || '-1', 10)
                if (isAfter) targetIndex += 1

                window.parent.postMessage({
                    type: 'EDITOR_BLOCK_DROP',
                    payload: { index: targetIndex, blockData }
                }, parentOrigin)
            } catch (err) {
                console.error('Drop error:', err)
            }
        }

        const onMessage = (e: MessageEvent) => {
            const allowedOrigin = window.location.origin
            if (e.origin !== allowedOrigin) return
            
            if (e.data?.type === 'EXEC_COMMAND') {
                document.execCommand(e.data.command, false, e.data.value)
                currentEditingEl?.focus()
            }
        }

        document.addEventListener('mouseover', onMouseOver)
        document.addEventListener('mouseout', onMouseOut)
        document.addEventListener('pointerdown', onPointerDown)
        document.addEventListener('dblclick', onDblClick)
        document.addEventListener('blur', onBlur, true) // capture phase
        document.addEventListener('keydown', onKeyDown)
        document.addEventListener('click', onClick)
        document.addEventListener('dragover', onDragOver)
        document.addEventListener('dragleave', onDragLeave)
        document.addEventListener('drop', onDrop)
        window.addEventListener('message', onMessage)
        
        window.addEventListener('load', postLayouts)
        window.addEventListener('resize', postLayouts)
        window.addEventListener('scroll', postLayouts, { passive: true })
        document.addEventListener('DOMContentLoaded', postLayouts)
        
        const initTimeout = setTimeout(postLayouts, 50)

        // Inject the drag-over styles into document head
        const styleId = 'editor-preview-styles'
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style')
            style.id = styleId
            style.innerHTML = `
                .insert-marker {
                  position: relative;
                }
                .insert-marker::before {
                  content: '';
                  position: absolute;
                  left: 0;
                  right: 0;
                  height: 4px;
                  background: #0ea5e9;
                  z-index: 9999;
                  border-radius: 4px;
                  box-shadow: 0 0 8px rgba(14, 165, 233, 0.5);
                  display: none;
                  pointer-events: none;
                }
                .insert-marker::after {
                  content: 'Drop to add block';
                  position: absolute;
                  left: 50%;
                  transform: translateX(-50%);
                  background: #0ea5e9;
                  color: white;
                  padding: 4px 12px;
                  border-radius: 12px;
                  font-size: 12px;
                  font-weight: 600;
                  z-index: 9999;
                  display: none;
                  pointer-events: none;
                }
                .drag-over-top::before {
                  display: block;
                  top: -2px;
                }
                .drag-over-top::after {
                  display: block;
                  top: -14px;
                }
                .drag-over-bottom::before {
                  display: block;
                  bottom: -2px;
                }
                .drag-over-bottom::after {
                  display: block;
                  bottom: -14px;
                }
            `
            document.head.appendChild(style)
        }

        // Cleanup
        return () => {
            clearTimeout(initTimeout)
            if (hoverTimer) clearTimeout(hoverTimer)
            document.removeEventListener('mouseover', onMouseOver)
            document.removeEventListener('mouseout', onMouseOut)
            document.removeEventListener('pointerdown', onPointerDown)
            document.removeEventListener('dblclick', onDblClick)
            document.removeEventListener('blur', onBlur, true)
            document.removeEventListener('keydown', onKeyDown)
            document.removeEventListener('click', onClick)
            document.removeEventListener('dragover', onDragOver)
            document.removeEventListener('dragleave', onDragLeave)
            document.removeEventListener('drop', onDrop)
            window.removeEventListener('message', onMessage)
            window.removeEventListener('load', postLayouts)
            window.removeEventListener('resize', postLayouts)
            window.removeEventListener('scroll', postLayouts)
            document.removeEventListener('DOMContentLoaded', postLayouts)
        }
    }, [])

    return null
}
