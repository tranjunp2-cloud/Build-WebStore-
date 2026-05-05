'use client'

import { useEffect } from 'react'

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

/** Returns true if the URL uses a safe protocol (blocks javascript:, data:, etc.) */
export function isSafeUrl(url: string): boolean {
    try { return SAFE_URL_PROTOCOLS.has(new URL(url, window.location.href).protocol) }
    catch { return false }
}

/** Replace drop-hint CSS content text. Exported for testing. */
export function replaceDropHintCSS(css: string, text: string): string {
    return css.replace(
        /content:\s*'[^']*';\s*\/\*drop-hint\*\//,
        `content: '${text.replace(/'/g, "\\'")}'; /*drop-hint*/`
    )
}

export function PreviewScripts() {
    useEffect(() => {
        let parentOrigin = window.location.origin
        try {
            parentOrigin = new URL(document.referrer).origin
        } catch (e) {
            // keep window.location.origin fallback
        }

        const validTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'A', 'BUTTON', 'LI', 'LABEL', 'DIV']
        const excludedBlockTypes = ['navigation', 'footer', 'breadcrumb']
        // cartWidget has no user-editable text fields — block contenteditable entirely
        const noTextEditBlockTypes = new Set(['cartWidget'])
        // Only whatsapp-button and cartWidget suppress BLOCK_HOVERED — socialWidget hover is intentionally allowed
        const noHoverHintBlockTypes = new Set(['whatsapp-button', 'cartWidget'])
        // Blocks whose images come from external product catalog — image editing not supported
        const imageReadOnlyBlockTypes = new Set(['products-featured', 'products-grid'])
        
        let hoveredEl: HTMLElement | null = null
        let hoverTimer: number | null = null
        let hoveredBlock: Element | null = null

        const getEditableLayouts = () => {
            return Array.from(document.querySelectorAll('[data-block-index]'))
                .map((node) => {
                    const rect = node.getBoundingClientRect()
                    // Use first element child's top to skip block-spacing padding so the
                    // action bar appears just above the visible content, not the invisible gap.
                    const firstChild = node.firstElementChild as HTMLElement | null
                    const contentTop = firstChild ? firstChild.getBoundingClientRect().top : rect.top
                    return {
                        top: contentTop,
                        left: rect.left,
                        width: rect.width,
                        height: rect.bottom - contentTop,
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
                const firstChild = (blockContainer as HTMLElement).firstElementChild as HTMLElement | null
                const contentTop = firstChild ? firstChild.getBoundingClientRect().top : rect.top
                window.parent.postMessage({
                    type: 'BLOCK_CONTAINER_HOVERED',
                    layout: {
                        top: contentTop,
                        left: rect.left,
                        width: rect.width,
                        height: rect.bottom - contentTop,
                        blockIndex: parseInt(blockContainer.getAttribute('data-block-index') || '-1', 10),
                        blockType
                    }
                }, parentOrigin)
            }

            // Detect both real <img> and non-img placeholder elements (e.g. InitialsAvatar, LogoPlaceholder)
            // that carry data-image-index so they can also trigger image-replace in the editor.
            const imgEl = target.tagName === 'IMG' ? target
                : (target.getAttribute('data-image-index') !== null ? target : null)
            if (imgEl) {
                const imgBlockType = blockContainer.getAttribute('data-block-type') || ''
                if (!imageReadOnlyBlockTypes.has(imgBlockType)) {
                    if (hoverTimer) clearTimeout(hoverTimer)
                    hoverTimer = window.setTimeout(() => {
                        const rect = imgEl.getBoundingClientRect()
                        window.parent.postMessage({
                            type: 'IMAGE_HOVERED',
                            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
                            src: imgEl.tagName === 'IMG' ? (imgEl as HTMLImageElement).src : '',
                            blockIndex: parseInt(blockContainer.getAttribute('data-block-index') || '-1', 10),
                            blockType: imgBlockType
                        }, parentOrigin)
                    }, 200)
                }
                return
            }

            if (target.closest('[data-editor-control]')) return

            // whatsapp-button and cartWidget use InlineEdit — skip BLOCK_HOVERED text hint
            if (blockType && noHoverHintBlockTypes.has(blockType)) return

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
        const LIST_TAGS = ['UL', 'OL']

        /**
         * Build clean HTML from the current editing element.
         * Only checks explicit tags in innerHTML — heading and inline formatting
         * are completely independent.
         */
        const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const rgbToHex = (rgb: string) => {
            const m = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/)
            if (!m) return rgb
            return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
        }

        const buildCleanHtml = (el: HTMLElement): string => {
            const text = el.innerText?.trim() || ''
            if (!text) return ''

            // Detect text alignment
            const align = el.style.textAlign ||
                (el.classList.contains('text-center') ? 'center' :
                 el.classList.contains('text-right') ? 'right' :
                 el.classList.contains('text-justify') ? 'justify' : '')

            // Collect element-level inline styles (color, fontSize, fontFamily)
            // Skip CSS variable values like "var(--muted, #71717a)" injected by block templates
            const inlineStyles: string[] = []
            if (el.style.color && !el.style.color.startsWith('var(')) inlineStyles.push(`color:${el.style.color}`)
            if (el.style.fontSize && !el.style.fontSize.startsWith('var(')) inlineStyles.push(`font-size:${el.style.fontSize}`)
            if (el.style.fontFamily && !el.style.fontFamily.startsWith('var(')) inlineStyles.push(`font-family:${el.style.fontFamily}`)
            if (align && align !== 'left') inlineStyles.push(`text-align:${align}`)

            // Preserve innerHTML as-is (may contain partial <b>, <span style="color:">, etc.)
            // but clean up excessive <font> tags from execCommand fallback
            let innerHTML = el.innerHTML
                .replace(/<font[^>]*color="([^"]+)"[^>]*>([<\s\S]*?)<\/font>/gi,
                    (_m, color, inner) => `<span style="color:${color}">${inner}</span>`)
                // Normalize browser-injected <p>/<div> wrappers from contenteditable (e.g. on Enter key).
                // Replace opening block tags with <br> to preserve line breaks, then strip closing tags.
                .replace(/<(?:div|p)[^>]*>/gi, '<br>')
                .replace(/<\/(?:div|p)>/gi, '')
                .replace(/^<br>/, '')

            if (HEADING_TAGS.includes(el.tagName)) {
                const styleAttr = inlineStyles.length ? ` style="${inlineStyles.join(';')}"` : ''
                return `<${el.tagName.toLowerCase()}${styleAttr}>${innerHTML}</${el.tagName.toLowerCase()}>`
            } else if (LIST_TAGS.includes(el.tagName)) {
                // Preserve <ul>/<ol> wrapper so list structure is saved correctly
                return `<${el.tagName.toLowerCase()}>${innerHTML}</${el.tagName.toLowerCase()}>`
            } else if (inlineStyles.length) {
                const needsBlock = inlineStyles.some(s => s.startsWith('text-align:'))
                const displayPart = needsBlock ? ';display:block' : ''
                return `<span style="${inlineStyles.join(';')}${displayPart}">${innerHTML}</span>`
            }

            return innerHTML
        }

        // Debounce timer for live-typing sync — sends TEXT_EDITED while user is still typing
        // so changes reach the parent store without waiting for blur.
        let liveTypingTimer: ReturnType<typeof setTimeout> | null = null

        const postLiveHtml = () => {
            if (!currentEditingEl) return
            const blockIndex = parseInt(currentEditingEl.closest('[data-block-index]')?.getAttribute('data-block-index') || '-1', 10)
            if (blockIndex < 0) return
            window.parent.postMessage({
                type: 'TEXT_EDITED',
                blockIndex,
                searchKey: originalText,
                oldHtml: originalHtml,
                newHtml: buildCleanHtml(currentEditingEl),
                originalTag,
                newTag: currentEditingEl.tagName,
            }, parentOrigin)
        }

        const onInput = () => {
            if (!currentEditingEl) return
            if (liveTypingTimer) clearTimeout(liveTypingTimer)
            liveTypingTimer = setTimeout(() => {
                liveTypingTimer = null
                postLiveHtml()
            }, 1000)
        }

        const cleanUpEditing = () => {
            if (!currentEditingEl) return
            // Cancel any pending live-typing sync — we're about to send the final state
            if (liveTypingTimer) { clearTimeout(liveTypingTimer); liveTypingTimer = null }
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
                originalTag,
                newTag: currentEditingEl?.tagName || originalTag,
            }, parentOrigin)

            currentEditingEl = null
            window.parent.postMessage({ type: 'TEXT_EDITING_STOPPED' }, parentOrigin)
        }

        const onTextClick = (e: MouseEvent) => {
            let target = e.target as HTMLElement
            if ((target as HTMLElement).closest('[data-editor-control]')) return
            const blockContainer = target.closest('[data-block-index]')

            if (!blockContainer) return
            const blockType = blockContainer.getAttribute('data-block-type')
            if (blockType && excludedBlockTypes.includes(blockType)) return
            // whatsapp-button and cartWidget use InlineEdit — global contenteditable must not activate
            if (blockType && noTextEditBlockTypes.has(blockType)) return

            // Walk up from click target to find nearest valid editable element
            // (click may land on <b>, <i>, <u> inside a valid element)
            // Stop before reaching block container or its direct structural children
            while (target && target !== blockContainer && target.parentElement !== blockContainer) {
                if (validTags.includes(target.tagName)) break
                target = target.parentElement!
            }
            if (!target || target === blockContainer || !validTags.includes(target.tagName)) return
            // Skip elements explicitly marked as non-editable
            if (target.hasAttribute('data-no-text-edit')) return
            // Skip elements inside a no-edit zone unless they carry data-text-editable
            if (!target.hasAttribute('data-text-editable') && !!target.parentElement?.closest('[data-no-text-edit]')) return
            // Skip image-placeholder elements — clicking them triggers image-replace, not text-edit
            if (target.getAttribute('data-image-index') !== null) return
            // Don't edit elements with many block-level children (sections, not text)
            const blockChildren = Array.from(target.children).filter(c =>
                ['DIV', 'SECTION', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'UL', 'OL'].includes(c.tagName)
            )
            if (blockChildren.length > 1) return

            // Skip structural containers that wrap editor control overlays (e.g. HeroMediaOverlay)
            // — their innerText includes hidden button labels, which would fool the text check below
            if (target.querySelector('[data-editor-control]')) return

            // Skip elements with no meaningful text (e.g. pure CSS background/overlay divs)
            const elementText = target.innerText?.trim()
            if (!elementText || elementText.length < 2) return

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
                blockIndex: parseInt(blockContainer.getAttribute('data-block-index') || '-1', 10),
                blockType: blockContainer.getAttribute('data-block-type') || '',
                originalText: currentEditingEl.innerText?.trim() || '',
                scrollY: window.scrollY,
            }, parentOrigin)
            // Immediately push correct font/size/color state for the newly activated element
            postSelectionState()
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
            if (!currentEditingEl) return
            if (e.key === 'Escape') {
                e.preventDefault()
                cleanUpEditing()
                window.getSelection()?.removeAllRanges()
                return
            }
            if (e.key === 'Enter') {
                if (e.shiftKey) {
                    // Shift+Enter: insert <br> at cursor (soft line break)
                    e.preventDefault()
                    document.execCommand('insertLineBreak')
                    return
                }
                // Plain Enter: if cursor is inside a list item, let browser add new <li>
                // Otherwise exit editing mode
                const sel = window.getSelection()
                const inList = sel && sel.rangeCount > 0 &&
                    !!(sel.getRangeAt(0).commonAncestorContainer.parentElement?.closest('li'))
                if (!inList) {
                    e.preventDefault()
                    cleanUpEditing()
                    window.getSelection()?.removeAllRanges()
                }
            }
        }

        const onClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement

            // Notify parent which block was clicked → opens block settings tab
            const clickedBlock = target.closest('[data-block-index]')
            if (clickedBlock) {
                const blockIndex = parseInt(clickedBlock.getAttribute('data-block-index') || '-1', 10)
                const blockType = clickedBlock.getAttribute('data-block-type')
                const isGlobal = ['navigation', 'footer', 'breadcrumb'].includes(blockType || '')
                if (blockIndex >= 0 || isGlobal) {
                    const rect = clickedBlock.getBoundingClientRect()
                    const firstChild = (clickedBlock as HTMLElement).firstElementChild as HTMLElement | null
                    const contentTop = firstChild ? firstChild.getBoundingClientRect().top : rect.top
                    window.parent.postMessage({
                        type: 'BLOCK_CONTAINER_CLICKED',
                        blockIndex,
                        layout: {
                            top: contentTop, left: rect.left,
                            width: rect.width, height: rect.bottom - contentTop,
                            blockIndex, blockType,
                        },
                    }, parentOrigin)
                }
            } else {
                // Clicked outside any block → deselect
                window.parent.postMessage({ type: 'PREVIEW_CANVAS_CLICKED' }, parentOrigin)
            }

            let anchor = target.closest('a')
            if (anchor) {
                const anchorBlock = anchor.closest('[data-block-index]')
                const anchorBlockType = anchorBlock?.getAttribute('data-block-type')
                const href = anchor.getAttribute('href') || ''

                if (window !== window.parent) {
                    // Inside editor iframe — route everything through parent
                    e.preventDefault()
                    e.stopPropagation()
                    if (anchorBlockType === 'breadcrumb') {
                        // Breadcrumb: notify parent to switch page, don't open as external link
                        if (href && href !== '#') {
                            try {
                                const pageId = new URL(href, window.location.href).searchParams.get('pageId')
                                if (pageId) window.parent.postMessage({ type: 'PAGE_NAVIGATE', pageId }, parentOrigin)
                            } catch (_) { /* invalid href */ }
                        }
                    } else if (['socialWidget', 'whatsapp-button', 'cartWidget'].includes(anchorBlockType || '')) {
                        // Floating widgets — absorb click, don't redirect in editor
                    } else if (href && isSafeUrl(href)) {
                        window.parent.postMessage({ type: 'OPEN_LINK', href }, parentOrigin)
                    }
                } else if (isSafeUrl(href)) {
                    // Standalone preview — only open truly external http/https links in new tab.
                    // Internal preview links (/preview/{siteId}?pageId=X) navigate normally.
                    // mailto:/tel: have origin="null" so must be gated by protocol check too
                    // (mirrors BuilderLinkScripts line 1142 exactly).
                    try {
                        const url = new URL(href, window.location.href)
                        if (url.origin !== window.location.origin && SAFE_URL_PROTOCOLS.has(url.protocol)) {
                            e.preventDefault()
                            window.open(href, '_blank', 'noopener,noreferrer')
                        }
                    } catch { /* invalid URL — let browser handle */ }
                }
            }
            // Also detect non-img placeholder elements (InitialsAvatar, LogoPlaceholder) via data-image-index
            const imgEl = target.tagName === 'IMG' ? target
                : (target.getAttribute('data-image-index') !== null ? target : null)
            if (imgEl) {
                e.preventDefault()
                e.stopPropagation()
                const blockContainer = imgEl.closest('[data-block-index]')
                if (!blockContainer) return

                const blockIndex = parseInt(blockContainer.getAttribute('data-block-index') || '-1', 10)
                const blockType = blockContainer.getAttribute('data-block-type')

                if (blockType && excludedBlockTypes.includes(blockType)) return
                if (blockType && imageReadOnlyBlockTypes.has(blockType)) return

                const rect = imgEl.getBoundingClientRect()
                const imageIndexAttr = imgEl.getAttribute('data-image-index')
                const imageIndex = imageIndexAttr !== null ? parseInt(imageIndexAttr, 10) : undefined
                const src = imgEl.tagName === 'IMG' ? (imgEl as HTMLImageElement).src : ''
                const totalImagesInBlock = blockContainer.querySelectorAll('[data-image-index]').length || undefined
                window.parent.postMessage({
                    type: 'IMAGE_EDITING_STARTED',
                    rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
                    src,
                    blockIndex,
                    blockType,
                    imageIndex,
                    totalImagesInBlock
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
            // Read font size: inline style first, then computed
            let fontSize = 0
            if (currentEditingEl) {
                const inlineFs = parseFloat(currentEditingEl.style.fontSize)
                if (inlineFs > 0) {
                    fontSize = inlineFs
                } else {
                    fontSize = parseFloat(window.getComputedStyle(currentEditingEl).fontSize) || 16
                }
            }
            // Read font family: inline style first, then computed — always strip quotes
            const rawFF = currentEditingEl?.style.fontFamily ||
                window.getComputedStyle(currentEditingEl!).fontFamily.split(',')[0].trim()
            const fontFamily = rawFF.replace(/['"]/g, '').trim() || 'Inter'
            // Read color: inline style first, then computed — convert rgb() → hex
            const rawColor = currentEditingEl?.style.color ||
                (currentEditingEl ? window.getComputedStyle(currentEditingEl).color : '')
            const color = rawColor ? rgbToHex(rawColor) : '#000000'
            // Detect if cursor is inside an <a> tag to pre-populate link input
            let linkHref = ''
            if (currentEditingEl) {
                if (currentEditingEl.tagName === 'A') {
                    // The editable element itself is the anchor
                    linkHref = currentEditingEl.getAttribute('href') || ''
                } else {
                    const sel = window.getSelection()
                    if (sel && sel.rangeCount > 0) {
                        let node: Node | null = sel.getRangeAt(0).commonAncestorContainer
                        if (node.nodeType === Node.TEXT_NODE) node = node.parentNode
                        while (node && node !== currentEditingEl) {
                            if ((node as HTMLElement).tagName === 'A') {
                                linkHref = (node as HTMLAnchorElement).getAttribute('href') || ''
                                break
                            }
                            node = (node as HTMLElement).parentNode
                        }
                    }
                }
            }
            // Detect active list type for toolbar active indicator
            let activeList = ''
            if (currentEditingEl) {
                if (currentEditingEl.tagName === 'LI') {
                    const parentList = currentEditingEl.closest('ul, ol') as HTMLElement | null
                    if (parentList) activeList = parentList.tagName.toLowerCase()
                } else {
                    const firstListEl = currentEditingEl.firstElementChild
                    if (firstListEl && (firstListEl.tagName === 'UL' || firstListEl.tagName === 'OL')) {
                        activeList = firstListEl.tagName.toLowerCase()
                    }
                }
            }
            window.parent.postMessage({
                type: 'SELECTION_STATE',
                state: {
                    bold: /<b\b|<strong\b/i.test(html),
                    italic: /<i\b|<em\b/i.test(html),
                    underline: /<u\b/i.test(html),
                    strikeThrough: /<s\b|<del\b/i.test(html),
                    formatBlock: currentEditingEl?.tagName || 'P',
                    textAlign: align,
                    fontSize: Math.round(fontSize),
                    fontFamily,
                    color,
                    linkHref,
                    activeList,
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
                        if (oldStyle) {
                            // Strip font-size: heading-level classes (text-3xl etc.) define the natural
                            // size. User can re-apply custom font-size after selecting heading format.
                            const stripped = oldStyle.split(';').map(s => s.trim())
                                .filter(s => s && !s.toLowerCase().startsWith('font-size'))
                                .join(';')
                            if (stripped) newEl.setAttribute('style', stripped)
                        }
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

                // ── bold/italic/underline: apply to selection only (or whole element if nothing selected) ──
                } else if (['bold', 'italic', 'underline'].includes(cmd)) {
                    const sel = window.getSelection()
                    const hasSelection = sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed

                    if (hasSelection) {
                        // Apply only to selected text using execCommand
                        const execMap: Record<string, string> = { bold: 'bold', italic: 'italic', underline: 'underline' }
                        document.execCommand(execMap[cmd], false)
                    } else {
                        // No selection: toggle whole element
                        const rawHtml = currentEditingEl.innerHTML
                        const text = currentEditingEl.innerText?.trim() || ''
                        let hasBold = /<b\b|<strong\b/i.test(rawHtml)
                        let hasItalic = /<i\b|<em\b/i.test(rawHtml)
                        let hasUnderline = /<u\b/i.test(rawHtml)
                        if (cmd === 'bold') hasBold = !hasBold
                        if (cmd === 'italic') hasItalic = !hasItalic
                        if (cmd === 'underline') hasUnderline = !hasUnderline
                        let newHtml = text
                        if (hasUnderline) newHtml = `<u>${newHtml}</u>`
                        if (hasItalic) newHtml = `<i>${newHtml}</i>`
                        if (hasBold) newHtml = `<b>${newHtml}</b>`
                        currentEditingEl.innerHTML = newHtml
                        const range = document.createRange()
                        range.selectNodeContents(currentEditingEl)
                        sel?.removeAllRanges()
                        sel?.addRange(range)
                    }
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

                // ── fontSize/fontName: apply to selection or whole element ──
                } else if ((cmd === 'fontSize' || cmd === 'fontName') && val) {
                    const sel = window.getSelection()
                    const hasSelection = sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed
                    
                    if (hasSelection) {
                        document.execCommand('styleWithCSS', false, 'true')
                        // For fontName, standard execCommand works fine with any string
                        if (cmd === 'fontName') {
                            document.execCommand('fontName', false, val)
                        } else {
                            // execCommand('fontSize') strictly accepts 1-7. We use an unused size marker (7), then patch it natively.
                            document.execCommand('fontSize', false, '7')
                            currentEditingEl.querySelectorAll('font[size="7"], [style*="font-size: -webkit-xxx-large"]').forEach(el => {
                                el.removeAttribute('size')
                                ;(el as HTMLElement).style.fontSize = `${parseFloat(val)}px`
                            })
                        }
                        document.execCommand('styleWithCSS', false, 'false')
                    } else {
                        // Apply to entire element block if no specific selection
                        if (cmd === 'fontName') {
                            currentEditingEl.style.fontFamily = val
                        } else {
                            const px = parseFloat(val)
                            if (!isNaN(px) && px > 0) currentEditingEl.style.fontSize = `${px}px`
                        }
                    }

                // ── foreColor: apply to selection only; fallback to whole element ──
                } else if (cmd === 'foreColor' && val) {
                    const sel = window.getSelection()
                    const hasSelection = sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed
                    if (hasSelection) {
                        // Wrap the selected text in a <span style="color:...">
                        // Apply color via execCommand styleWithCSS
                        document.execCommand('styleWithCSS', false, 'true')
                        document.execCommand('foreColor', false, val)
                        document.execCommand('styleWithCSS', false, 'false')
                    } else {
                        currentEditingEl.style.color = val
                    }

                // ── createLink: wrap selected text (or whole element) in <a> tag ──
                } else if (cmd === 'createLink' && val) {
                    if (!isSafeUrl(val)) return
                    const sel = window.getSelection()
                    const hasSelection = sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed

                    if (hasSelection) {
                        const range = sel.getRangeAt(0)
                        const anchor = document.createElement('a')
                        anchor.href = val
                        anchor.target = '_blank'
                        anchor.rel = 'noopener noreferrer'
                        try {
                            range.surroundContents(anchor)
                        } catch {
                            // Selection spans multiple nodes — extract and rewrap
                            const fragment = range.extractContents()
                            anchor.appendChild(fragment)
                            range.insertNode(anchor)
                        }
                        sel.removeAllRanges()
                    } else {
                        // No selection: wrap entire element content in a link
                        const anchor = document.createElement('a')
                        anchor.href = val
                        anchor.target = '_blank'
                        anchor.rel = 'noopener noreferrer'
                        anchor.innerHTML = currentEditingEl.innerHTML
                        currentEditingEl.innerHTML = ''
                        currentEditingEl.appendChild(anchor)
                    }
                    saveSelection()

                // ── insertUnorderedList / insertOrderedList: manual implementation ──
                // execCommand('insertUnorderedList') doesn't work when contenteditable is set
                // directly on a block element (<p>, <h2>, etc.) because <ul> can't be a child
                // of <p>. Manual implementation: split content by <br> and wrap in list items.
                } else if (cmd === 'insertUnorderedList' || cmd === 'insertOrderedList') {
                    const listTag = cmd === 'insertUnorderedList' ? 'ul' : 'ol'
                    const otherTag = listTag === 'ul' ? 'ol' : 'ul'
                    const listStyle = listTag === 'ul'
                        ? 'list-style-type:disc;padding-left:1.5em'
                        : 'list-style-type:decimal;padding-left:1.5em'

                    if (currentEditingEl.tagName === 'LI') {
                        // User re-clicked a list item — operate on ancestor list + its container
                        const ancestorList = currentEditingEl.closest('ul, ol') as HTMLElement | null
                        const containerEl = ancestorList?.parentElement as HTMLElement | null
                        if (ancestorList && containerEl) {
                            currentEditingEl.removeAttribute('contenteditable')
                            if (ancestorList.tagName.toLowerCase() === listTag) {
                                // Same type → toggle off: unwrap items to br-separated text
                                const items = Array.from(ancestorList.children).filter(el => el.tagName === 'LI')
                                containerEl.innerHTML = items.map(li => (li as HTMLElement).innerHTML).join('<br>')
                            } else {
                                // Different type → convert ul ↔ ol
                                const newList = document.createElement(listTag)
                                newList.setAttribute('style', listStyle)
                                newList.innerHTML = ancestorList.innerHTML
                                ancestorList.replaceWith(newList)
                            }
                            currentEditingEl = containerEl
                            originalTag = containerEl.tagName
                            currentEditingEl.setAttribute('contenteditable', 'true')
                            currentEditingEl.focus()
                        }
                    } else {
                        const currentHtml = currentEditingEl.innerHTML
                        const existingSame = currentEditingEl.querySelector(listTag) as HTMLElement | null
                        const existingOther = currentEditingEl.querySelector(otherTag) as HTMLElement | null
                        if (existingSame && currentHtml.trim().toLowerCase().startsWith(`<${listTag}`)) {
                            // Same type → toggle off: unwrap items to br-separated text
                            const items = Array.from(existingSame.querySelectorAll('li'))
                            currentEditingEl.innerHTML = items.map(li => li.innerHTML).join('<br>')
                        } else if (existingOther && currentHtml.trim().toLowerCase().startsWith(`<${otherTag}`)) {
                            // Convert: change list type ul ↔ ol
                            const newList = document.createElement(listTag)
                            newList.setAttribute('style', listStyle)
                            newList.innerHTML = existingOther.innerHTML
                            existingOther.replaceWith(newList)
                        } else {
                            // Create new list: split by <br> → individual <li> items
                            const lines = currentHtml.split(/<br\s*\/?>/i).map(l => l.trim()).filter(Boolean)
                            const listItems = (lines.length > 0 ? lines : [currentHtml]).map(l => `<li>${l}</li>`).join('')
                            currentEditingEl.innerHTML = `<${listTag} style="${listStyle}">${listItems}</${listTag}>`
                        }
                    }

                // ── other commands: fallback to execCommand ──
                } else {
                    document.execCommand(cmd, false, val)
                }
                // Re-save selection + update toolbar state
                saveSelection()
                postSelectionState()
                // Immediately sync current HTML to parent so toolbar changes are
                // persisted via the auto-save debounce without requiring a blur first
                if (currentEditingEl) {
                    const bi = parseInt(currentEditingEl.closest('[data-block-index]')?.getAttribute('data-block-index') || '-1', 10)
                    if (bi >= 0) {
                        window.parent.postMessage({
                            type: 'TEXT_EDITED',
                            blockIndex: bi,
                            searchKey: originalText,
                            oldHtml: originalHtml,
                            newHtml: buildCleanHtml(currentEditingEl),
                            originalTag,
                            newTag: currentEditingEl.tagName,
                        }, parentOrigin)
                        // For createLink, trigger an immediate save so the link persists
                        // even if the user reloads before blurring the element
                        if (cmd === 'createLink') {
                            window.parent.postMessage({ type: 'SAVE_CHECKPOINT' }, parentOrigin)
                        }
                    }
                }
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
            if (e.data?.type === 'SET_DROP_HINT' && e.data.text) {
                const styleEl = document.getElementById('editor-preview-styles')
                if (styleEl) {
                    styleEl.innerHTML = replaceDropHintCSS(styleEl.innerHTML, e.data.text)
                }
            }
            if (e.data?.type === 'THEME_UPDATE' && e.data.css) {
                let themeStyle = document.getElementById('live-theme-override')
                if (!themeStyle) {
                    themeStyle = document.createElement('style')
                    themeStyle.id = 'live-theme-override'
                    document.body.appendChild(themeStyle)
                }
                themeStyle.textContent = e.data.css
            }
            // Toggle Tailwind dark class on <html> when colorMode changes in the editor.
            // Tailwind dark: utilities require the `dark` class on the root element.
            // UPDATE_SITE_THEME re-renders SiteRenderer but doesn't touch the html element.
            if (e.data?.type === 'THEME_COLOR_MODE_UPDATE') {
                const isDark = e.data.colorMode === 'dark'
                document.documentElement.classList.toggle('dark', isDark)
            }
            if (e.data?.type === 'SET_BLOCK_SELECTED') {
                document.querySelectorAll('[data-block-index]').forEach((el) => {
                    ;(el as HTMLElement).style.boxShadow = ''
                })
                const idx = e.data.blockIndex
                if (idx !== null && idx !== undefined) {
                    const el = document.querySelector(`[data-block-index="${idx}"]`) as HTMLElement | null
                    if (el) {
                        // inset box-shadow works inside overflow:hidden/border-radius, unlike outline
                        el.style.boxShadow = 'inset 0 0 0 2px #3b82f6'
                    }
                }
            }
            if (e.data?.type === 'SCROLL_TO_BLOCK') {
                const idx = e.data.index
                if (idx !== undefined && idx !== null) {
                    const el = document.querySelector(`[data-block-index="${idx}"]`) as HTMLElement
                    if (el) {
                        const top = el.getBoundingClientRect().top + window.scrollY
                        window.scrollTo({ top: top - 80, behavior: 'smooth' })
                    }
                }
            }
        }

        document.addEventListener('mouseover', onMouseOver)
        document.addEventListener('mouseout', onMouseOut)
        document.addEventListener('pointerdown', onPointerDown)
        document.addEventListener('click', onTextClick)
        document.addEventListener('blur', onBlur, true) // capture phase
        document.addEventListener('keydown', onKeyDown)
        document.addEventListener('input', onInput)
        document.addEventListener('click', onClick)
        document.addEventListener('dragover', onDragOver)
        document.addEventListener('dragleave', onDragLeave)
        document.addEventListener('drop', onDrop)
        window.addEventListener('message', onMessage)
        
        const onIframeScroll = () => {
            window.parent.postMessage({ type: 'IFRAME_SCROLL', scrollY: window.scrollY }, parentOrigin)
        }

        window.addEventListener('load', postLayouts)
        window.addEventListener('resize', postLayouts)
        window.addEventListener('scroll', postLayouts, { passive: true })
        window.addEventListener('scroll', onIframeScroll, { passive: true })
        
        const applyScrollRestoration = () => {
            postLayouts()
            const params = new URLSearchParams(window.location.search)
            const scrollToBlock = params.get('scrollToBlock')
            const scrollY = params.get('scroll')

            if (scrollToBlock !== null) {
                const blockIdx = parseInt(scrollToBlock, 10)
                if (!isNaN(blockIdx)) {
                    // Try immediately
                    let blockEl = document.querySelector(`[data-block-index="${blockIdx}"]`) as HTMLElement | null
                    if (blockEl) {
                        blockEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    } else {
                        // Fallback retry
                        setTimeout(() => {
                            blockEl = document.querySelector(`[data-block-index="${blockIdx}"]`) as HTMLElement | null
                            if (blockEl) blockEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }, 100)
                    }
                    return
                }
            }

            if (scrollY !== null) {
                const y = parseInt(scrollY, 10)
                if (!isNaN(y) && y > 0) {
                    window.scrollTo({ top: y, behavior: 'instant' })
                    // Fallback retry for next.js late hydration shifts
                    setTimeout(() => window.scrollTo({ top: y, behavior: 'instant' }), 50)
                }
            }
        }

        document.addEventListener('DOMContentLoaded', applyScrollRestoration)
        // Also run once just in case we missed DOMContentLoaded
        applyScrollRestoration()
        
        const initTimeout = setTimeout(postLayouts, 50)

        // Inject the drag-over styles into document head
        const styleId = 'editor-preview-styles'
        let editorStyle = document.getElementById(styleId) as HTMLStyleElement | null
        if (!editorStyle) {
            editorStyle = document.createElement('style')
            editorStyle.id = styleId
            document.head.appendChild(editorStyle)
        }
        editorStyle.innerHTML = `
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
                  content: 'Drop to add block'; /*drop-hint*/
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
                p a[href], h1 a[href], h2 a[href], h3 a[href],
                h4 a[href], h5 a[href], h6 a[href], span a[href] {
                  text-decoration: underline !important;
                  text-decoration-color: currentColor !important;
                  text-underline-offset: 2px;
                }
                [contenteditable="true"] a {
                  cursor: text;
                }
        `

        // Cleanup
        return () => {
            clearTimeout(initTimeout)
            if (hoverTimer) clearTimeout(hoverTimer)
            document.removeEventListener('mouseover', onMouseOver)
            document.removeEventListener('mouseout', onMouseOut)
            document.removeEventListener('pointerdown', onPointerDown)
            document.removeEventListener('click', onTextClick)
            document.removeEventListener('blur', onBlur, true)
            document.removeEventListener('keydown', onKeyDown)
            document.removeEventListener('input', onInput)
            if (liveTypingTimer) clearTimeout(liveTypingTimer)
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
            window.removeEventListener('scroll', onIframeScroll)
            document.removeEventListener('DOMContentLoaded', postLayouts)
        }
    }, [])

    return null
}

/**
 * Lightweight click handler for builder preview mode (builder=1).
 * Opens external links in a new tab; lets internal nav links navigate normally.
 */
export function BuilderLinkScripts() {
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            const anchor = (e.target as HTMLElement).closest('a')
            if (!anchor) return
            const href = anchor.getAttribute('href') || ''
            if (!href) return
            try {
                const url = new URL(href, window.location.href)
                if (url.origin !== window.location.origin && SAFE_URL_PROTOCOLS.has(url.protocol)) {
                    e.preventDefault()
                    window.open(href, '_blank', 'noopener,noreferrer')
                }
            } catch { /* invalid URL — let browser handle */ }
        }
        document.addEventListener('click', onClick)
        return () => document.removeEventListener('click', onClick)
    }, [])
    return null
}
