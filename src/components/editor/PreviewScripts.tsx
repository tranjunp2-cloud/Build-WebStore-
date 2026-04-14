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

        const onPointerDown = (e: PointerEvent) => {
            window.parent.postMessage({ type: 'PREVIEW_POINTER_DOWN' }, parentOrigin)
            // If clicking outside the current editing element, finish editing
            if (currentEditingEl && e.target !== currentEditingEl && !currentEditingEl.contains(e.target as Node)) {
                cleanUpEditing()
            }
        }

        let currentEditingEl: HTMLElement | null = null
        let originalText = ''
        let originalHtml = ''
        let originalTag = ''

        const HEADING_TAGS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6']

        /**
         * Build clean HTML from the current editing element.
         * Only checks explicit tags in innerHTML — heading and inline formatting
         * are completely independent.
         */
        const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

        const buildCleanHtml = (el: HTMLElement): string => {
            const text = el.innerText?.trim() || ''
            if (!text) return ''

            const rawHtml = el.innerHTML
            const isBold = /<b\b|<strong\b/i.test(rawHtml)
            const isItalic = /<i\b|<em\b/i.test(rawHtml)
            const isUnderline = /<u\b/i.test(rawHtml)

            // Detect text alignment
            const align = el.style.textAlign ||
                (el.classList.contains('text-center') ? 'center' :
                 el.classList.contains('text-right') ? 'right' :
                 el.classList.contains('text-justify') ? 'justify' : '')

            let html = escapeHtml(text)
            if (isUnderline) html = `<u>${html}</u>`
            if (isItalic) html = `<i>${html}</i>`
            if (isBold) html = `<b>${html}</b>`

            if (HEADING_TAGS.includes(el.tagName)) {
                const alignAttr = align && align !== 'left' ? ` style="text-align:${align}"` : ''
                html = `<${el.tagName.toLowerCase()}${alignAttr}>${html}</${el.tagName.toLowerCase()}>`
            } else if (align && align !== 'left') {
                // Wrap in span with alignment for non-heading elements
                html = `<span style="text-align:${align};display:block">${html}</span>`
            }

            return html
        }

        const cleanUpEditing = () => {
            if (!currentEditingEl) return
            // Build clean HTML BEFORE removing contenteditable (queryCommandState needs it)
            const cleanHtml = buildCleanHtml(currentEditingEl)
            currentEditingEl.removeAttribute('contenteditable')
            const searchKey = originalText
            const blockIndex = parseInt(currentEditingEl.closest('[data-block-index]')?.getAttribute('data-block-index') || '-1', 10)

            // Reconstruct oldHtml to match field value (including heading wrapper if original was heading)
            const oldHtmlFull = HEADING_TAGS.includes(originalTag)
                ? `<${originalTag.toLowerCase()}>${originalHtml}</${originalTag.toLowerCase()}>`
                : originalHtml

            window.parent.postMessage({
                type: 'TEXT_EDITED',
                blockIndex,
                searchKey,
                oldHtml: oldHtmlFull,
                newHtml: cleanHtml,
            }, parentOrigin)

            currentEditingEl = null
            window.parent.postMessage({ type: 'TEXT_EDITING_STOPPED' }, parentOrigin)
        }

        const onTextClick = (e: MouseEvent) => {
            let target = e.target as HTMLElement
            const blockContainer = target.closest('[data-block-index]')

            if (!blockContainer) return
            const blockType = blockContainer.getAttribute('data-block-type')
            if (blockType && excludedBlockTypes.includes(blockType)) return

            // Walk up from click target to find nearest valid editable element
            // (click may land on <b>, <i>, <u> inside a valid element)
            // Stop before reaching block container or its direct structural children
            while (target && target !== blockContainer && target.parentElement !== blockContainer) {
                if (validTags.includes(target.tagName)) break
                target = target.parentElement!
            }
            if (!target || target === blockContainer || !validTags.includes(target.tagName)) return
            // Don't edit elements with many block-level children (sections, not text)
            const blockChildren = Array.from(target.children).filter(c =>
                ['DIV', 'SECTION', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'UL', 'OL'].includes(c.tagName)
            )
            if (blockChildren.length > 1) return

            // Skip if already editing this element
            if (currentEditingEl === target) return

            if (currentEditingEl && currentEditingEl !== target) {
                cleanUpEditing()
            }

            currentEditingEl = target
            currentEditingEl.setAttribute('contenteditable', 'true')
            currentEditingEl.focus()
            originalText = currentEditingEl.innerText?.trim() || ''
            originalHtml = currentEditingEl.innerHTML?.trim() || ''
            originalTag = currentEditingEl.tagName

            const rect = target.getBoundingClientRect()
            window.parent.postMessage({
                type: 'TEXT_EDITING_STARTED',
                rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
                blockIndex: parseInt(blockContainer.getAttribute('data-block-index') || '-1', 10)
            }, parentOrigin)
        }

        // Track whether parent toolbar is being used — skip blur cleanup if so
        let toolbarActive = false
        let blurCleanupTimer: number | null = null

        const cancelBlurCleanup = () => {
            if (blurCleanupTimer !== null) {
                clearTimeout(blurCleanupTimer)
                blurCleanupTimer = null
            }
        }

        const onBlur = (e: FocusEvent) => {
            if (currentEditingEl !== e.target) return
            // relatedTarget is null when focus moves to parent frame (toolbar)
            // relatedTarget is set when focus moves within the iframe
            if (e.relatedTarget === null) {
                // Focus moved to parent frame (toolbar, dropdown, or elsewhere).
                // Do NOT cleanup here — parent will send STOP_TEXT_EDITING if user
                // clicked outside toolbar. This avoids racing with select dropdown.
                toolbarActive = true
                return
            }
            // Focus moved within iframe — cleanup immediately
            cleanUpEditing()
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

            // Notify parent which block was clicked → opens block settings tab
            const clickedBlock = target.closest('[data-block-index]')
            if (clickedBlock) {
                const blockIndex = parseInt(clickedBlock.getAttribute('data-block-index') || '-1', 10)
                const blockType = clickedBlock.getAttribute('data-block-type')
                if (blockIndex >= 0) {
                    const rect = clickedBlock.getBoundingClientRect()
                    window.parent.postMessage({
                        type: 'BLOCK_CONTAINER_CLICKED',
                        blockIndex,
                        layout: {
                            top: rect.top, left: rect.left,
                            width: rect.width, height: rect.height,
                            blockIndex, blockType,
                        },
                    }, parentOrigin)
                }
            } else {
                // Clicked outside any block → deselect
                window.parent.postMessage({ type: 'PREVIEW_CANVAS_CLICKED' }, parentOrigin)
            }

            let anchor = target.closest('a')
            if (anchor && window !== window.parent) {
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

        // Save/restore selection across cross-frame focus changes
        let savedRange: Range | null = null

        const saveSelection = () => {
            const sel = window.getSelection()
            if (sel && sel.rangeCount > 0) {
                savedRange = sel.getRangeAt(0).cloneRange()
            }
        }

        const restoreSelection = () => {
            if (!savedRange) return
            const sel = window.getSelection()
            if (sel) {
                sel.removeAllRanges()
                sel.addRange(savedRange)
            }
        }

        const postSelectionState = () => {
            const html = currentEditingEl?.innerHTML || ''
            const align = currentEditingEl?.style.textAlign ||
                (currentEditingEl?.classList.contains('text-center') ? 'center' :
                 currentEditingEl?.classList.contains('text-right') ? 'right' :
                 currentEditingEl?.classList.contains('text-justify') ? 'justify' : 'left')
            window.parent.postMessage({
                type: 'SELECTION_STATE',
                state: {
                    bold: /<b\b|<strong\b/i.test(html),
                    italic: /<i\b|<em\b/i.test(html),
                    underline: /<u\b/i.test(html),
                    formatBlock: currentEditingEl?.tagName || 'P',
                    textAlign: align,
                }
            }, parentOrigin)
        }

        // Save selection when iframe loses focus (user clicked toolbar in parent)
        const onWindowBlur = () => { saveSelection() }
        window.addEventListener('blur', onWindowBlur)

        // Track selection changes for toolbar active state
        const onSelectionChange = () => {
            if (currentEditingEl) postSelectionState()
        }
        document.addEventListener('selectionchange', onSelectionChange)

        const onMessage = (e: MessageEvent) => {
            const allowedOrigin = window.location.origin
            if (e.origin !== allowedOrigin) return

            if (e.data?.type === 'EXEC_COMMAND') {
                toolbarActive = false
                cancelBlurCleanup()
                if (!currentEditingEl) return

                currentEditingEl.focus()
                restoreSelection()

                const cmd = e.data.command as string
                const val = e.data.value as string | undefined

                // ── formatBlock: change element tag only, preserve inline formatting ──
                const ALLOWED_FORMAT_TAGS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P']
                const FORMAT_TAG_SIZES: Record<string, string> = {
                    H1: 'text-4xl md:text-6xl',
                    H2: 'text-3xl md:text-4xl',
                    H3: 'text-2xl md:text-3xl',
                    H4: 'text-xl md:text-2xl',
                    H5: 'text-lg md:text-xl',
                    H6: 'text-base md:text-lg',
                    P: 'text-base',
                }
                const SIZE_RE = /\b(md:)?text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/g
                if (cmd === 'formatBlock' && val && ALLOWED_FORMAT_TAGS.includes(val.toUpperCase())) {
                    const newTag = val.toUpperCase()
                    if (currentEditingEl.tagName !== newTag) {
                        const newEl = document.createElement(newTag)
                        newEl.innerHTML = currentEditingEl.innerHTML
                        // Copy safe attributes + update font-size classes for new heading level
                        const oldClass = currentEditingEl.getAttribute('class') || ''
                        const sizeClasses = FORMAT_TAG_SIZES[newTag] || ''
                        const cleanedClass = oldClass.replace(SIZE_RE, '').replace(/\s+/g, ' ').trim()
                        newEl.setAttribute('class', `${cleanedClass} ${sizeClasses}`.trim())
                        const oldStyle = currentEditingEl.getAttribute('style')
                        if (oldStyle) newEl.setAttribute('style', oldStyle)
                        newEl.setAttribute('contenteditable', 'true')
                        currentEditingEl.replaceWith(newEl)
                        currentEditingEl = newEl
                        newEl.focus()
                        const range = document.createRange()
                        range.selectNodeContents(newEl)
                        const sel = window.getSelection()
                        sel?.removeAllRanges()
                        sel?.addRange(range)
                        saveSelection()
                    }

                // ── bold/italic/underline: toggle by rebuilding innerHTML from scratch ──
                } else if (['bold', 'italic', 'underline'].includes(cmd)) {
                    const rawHtml = currentEditingEl.innerHTML
                    const text = currentEditingEl.innerText?.trim() || ''

                    // Read current state from DOM
                    let hasBold = /<b\b|<strong\b/i.test(rawHtml)
                    let hasItalic = /<i\b|<em\b/i.test(rawHtml)
                    let hasUnderline = /<u\b/i.test(rawHtml)

                    // Toggle the requested format
                    if (cmd === 'bold') hasBold = !hasBold
                    if (cmd === 'italic') hasItalic = !hasItalic
                    if (cmd === 'underline') hasUnderline = !hasUnderline

                    // Rebuild clean HTML
                    let newHtml = text
                    if (hasUnderline) newHtml = `<u>${newHtml}</u>`
                    if (hasItalic) newHtml = `<i>${newHtml}</i>`
                    if (hasBold) newHtml = `<b>${newHtml}</b>`

                    currentEditingEl.innerHTML = newHtml

                    const range = document.createRange()
                    range.selectNodeContents(currentEditingEl)
                    const sel = window.getSelection()
                    sel?.removeAllRanges()
                    sel?.addRange(range)
                    saveSelection()

                // ── alignment: set style.textAlign directly ──
                } else if (['justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'].includes(cmd)) {
                    const alignMap: Record<string, string> = {
                        justifyLeft: 'left', justifyCenter: 'center',
                        justifyRight: 'right', justifyFull: 'justify',
                    }
                    currentEditingEl.style.textAlign = alignMap[cmd] || ''
                    // Also remove Tailwind text-align classes that might conflict
                    currentEditingEl.classList.remove('text-left', 'text-center', 'text-right', 'text-justify')

                // ── other commands: fallback to execCommand ──
                } else {
                    document.execCommand(cmd, false, val)
                }
                // Re-save selection + update toolbar state
                saveSelection()
                postSelectionState()
            }
            if (e.data?.type === 'STOP_TEXT_EDITING') {
                toolbarActive = false
                cleanUpEditing()
            }
            if (e.data?.type === 'DRAG_BLOCK_START') {
                const el = document.querySelector(`[data-block-index="${e.data.blockIndex}"]`) as HTMLElement
                if (el) el.style.opacity = '0.3'
            }
            if (e.data?.type === 'DRAG_BLOCK_END') {
                document.querySelectorAll('[data-block-index]').forEach((el) => {
                    ;(el as HTMLElement).style.opacity = ''
                })
            }
            // Live theme update — inject CSS variables without page reload
            if (e.data?.type === 'THEME_UPDATE' && e.data.css) {
                let themeStyle = document.getElementById('live-theme-override')
                if (!themeStyle) {
                    themeStyle = document.createElement('style')
                    themeStyle.id = 'live-theme-override'
                    document.head.appendChild(themeStyle)
                }
                themeStyle.textContent = e.data.css
            }
        }

        document.addEventListener('mouseover', onMouseOver)
        document.addEventListener('mouseout', onMouseOut)
        document.addEventListener('pointerdown', onPointerDown)
        document.addEventListener('dblclick', onTextClick)
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
            document.removeEventListener('dblclick', onTextClick)
            document.removeEventListener('blur', onBlur, true)
            document.removeEventListener('keydown', onKeyDown)
            document.removeEventListener('click', onClick)
            document.removeEventListener('dragover', onDragOver)
            document.removeEventListener('dragleave', onDragLeave)
            document.removeEventListener('drop', onDrop)
            window.removeEventListener('message', onMessage)
            window.removeEventListener('blur', onWindowBlur)
            document.removeEventListener('selectionchange', onSelectionChange)
            window.removeEventListener('load', postLayouts)
            window.removeEventListener('resize', postLayouts)
            window.removeEventListener('scroll', postLayouts)
            document.removeEventListener('DOMContentLoaded', postLayouts)
        }
    }, [])

    return null
}
