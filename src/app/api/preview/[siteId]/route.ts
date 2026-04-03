/**
 * Site Preview API — Renders a site's blocks into premium HTML.
 * Loads blocks from the pages collection (layout field), NOT from sites.
 * Uses industry-aware renderers for true visual diversity.
 */
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { renderNav, renderHero, renderSections, THEMES, baseCSS, getGoogleFontsLink, TemplateTheme } from '../renderers'
import { setHeroCategory, type RenderHeroBlock } from '../renderers/hero'
import { setSectionCategory, type RenderBlock } from '../renderers/sections'
import { detectCategory } from '@/lib/preview'
import { withAuth } from '@/lib/auth'
import { filterNavigationLinksByVisibility } from '@/lib/navigation'
import { mergeFooterSocialsWithSite, mergeNavigationBrandingWithSite } from '@/lib/site-settings'

// Force dynamic rendering — never cache this route
export const dynamic = 'force-dynamic'
export const revalidate = 0


function escapeHtml(unsafe: string) {
    if (!unsafe) return ''
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;")
}

type BlockData = {
    blockType: string;
    subheadline?: string;
    logoText?: string;
    [key: string]: unknown;
}

export function buildFullHTML(blocks: BlockData[], theme?: TemplateTheme, category?: string, meta?: { name?: string; description?: string; lang?: string; ogTitle?: string; ogDescription?: string }, site?: Record<string, unknown>): string {
  const cat = category || 'business'
  const t = theme || THEMES[cat] || THEMES.business

  // Extract site info from blocks for SEO
  const heroBlock = blocks.find(b => b.blockType === 'hero')
  const navBlock = blocks.find(b => b.blockType === 'navigation')
  const siteName = meta?.name || navBlock?.logoText || 'Website'
  const siteDesc = meta?.description || heroBlock?.subheadline || `${siteName} — Professional website`
  const ogTitle = meta?.ogTitle || String(siteName)
  const ogDescription = meta?.ogDescription || String(siteDesc).substring(0, 160)
  const lang = meta?.lang || 'en'

  const escLang = escapeHtml(lang)
  const escSiteName = escapeHtml(String(siteName))
  const escSiteDesc = escapeHtml(String(siteDesc).substring(0, 160))
  const escOgTitle = escapeHtml(String(ogTitle))
  const escOgDescription = escapeHtml(String(ogDescription))

  // Set category for image selection in renderers
  setHeroCategory(cat)
  setSectionCategory(cat)

  // Separate nav/hero from other sections for semantic HTML
  const addDataAttr = (html: string, index: number, type: string) => {
    return html.replace(/^<([a-z0-9]+)\s/i, `<$1 data-block-index="${index}" data-block-type="${type}" `)
  }

  const navHtml = blocks.map((b, i) => b.blockType === 'navigation' ? addDataAttr(renderNav(b, t), i, b.blockType) : '').filter(Boolean).join('\n')
  const heroHtml = blocks.map((b, i) => b.blockType === 'hero' ? addDataAttr(renderHero(b as RenderHeroBlock, t, cat), i, b.blockType) : '').filter(Boolean).join('\n')
  const footerHtml = blocks.map((b, i) => b.blockType === 'footer' ? addDataAttr(renderSections(b as RenderBlock, t, cat, site as Record<string, unknown>), i, b.blockType) : '').filter(Boolean).join('\n')
  const mainHtml = blocks
    .map((b, i) => !['navigation', 'hero', 'footer'].includes(b.blockType) ? addDataAttr(renderSections(b as RenderBlock, t, cat, site as Record<string, unknown>), i, b.blockType) : '')
    .filter(Boolean)
    .join('\n')

  return `<!DOCTYPE html>
<html lang="${escLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escSiteName}</title>
  <meta name="description" content="${escSiteDesc}">
  <meta property="og:title" content="${escOgTitle}">
  <meta property="og:description" content="${escOgDescription}">
  <meta property="og:type" content="website">
  <meta name="robots" content="index, follow">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="${getGoogleFontsLink(t)}" rel="stylesheet">
  <style>${baseCSS(t)}</style>
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": siteName,
    "description": siteDesc.substring(0, 160),
  }).replace(/</g, '\\u003c')}
  </script>
</head>
<body>
  <header role="banner">${navHtml}</header>
  <main role="main">
    ${heroHtml}
    ${mainHtml}
  </main>
  ${footerHtml}

  <script>
    let parentOrigin;
    try {
      parentOrigin = new URL(document.referrer).origin;
    } catch(e) {
      parentOrigin = window.location.origin; // fallback
    }
    (function() {
      // Standalone tab logic: disable editor tools, but route internal links properly
      if (window === window.parent) {
        document.addEventListener('click', (e) => {
          const anchor = e.target.closest('a');
          if (anchor && anchor.hasAttribute('href') && anchor.getAttribute('href') !== '#') {
            try {
              const url = new URL(anchor.href, window.location.origin);
              // Only intercept internal links that match the current origin e.g. /about-us
              if (url.origin === window.location.origin && !url.pathname.startsWith('/api/')) {
                e.preventDefault();
                window.location.href = window.location.pathname + '?path=' + encodeURIComponent(url.pathname);
              }
            } catch(err) {}
          }
        }, true);
        return;
      }

      const validTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'A', 'BUTTON', 'LI', 'LABEL', 'DIV']
      const excludedBlockTypes = ['navigation', 'footer']
      let hoveredEl = null;
      let hoverTimer = null;
      let hoveredBlock = null;

      const getEditableLayouts = () => {
        return Array.from(document.querySelectorAll('[data-block-index]'))
          .map((node) => {
            const rect = node.getBoundingClientRect()
            return {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              blockIndex: parseInt(node.getAttribute('data-block-index')),
              blockType: node.getAttribute('data-block-type')
            }
          })
          .filter((layout) => !excludedBlockTypes.includes(layout.blockType))
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

      document.addEventListener('mouseover', (e) => {
        let target = e.target
        let blockContainer = target.closest('[data-block-index]')
        if (!blockContainer) {
          clearHoverState()
          return
        }

        const blockType = blockContainer.getAttribute('data-block-type')
        if (!excludedBlockTypes.includes(blockType) && hoveredBlock !== blockContainer) {
          hoveredBlock = blockContainer
          const rect = blockContainer.getBoundingClientRect()
          window.parent.postMessage({
            type: 'BLOCK_CONTAINER_HOVERED',
            layout: {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              blockIndex: parseInt(blockContainer.getAttribute('data-block-index')),
              blockType
            }
          }, parentOrigin)
        }
        
        if (target.tagName === 'IMG') {
          // Send IMAGE_HOVERED
          if (hoverTimer) clearTimeout(hoverTimer)
          hoverTimer = window.setTimeout(() => {
            const rect = target.getBoundingClientRect()
            window.parent.postMessage({
              type: 'IMAGE_HOVERED',
              rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
              src: target.src,
              blockIndex: parseInt(blockContainer.getAttribute('data-block-index')),
              blockType: blockContainer.getAttribute('data-block-type')
            }, parentOrigin)
          }, 200)
          return
        }

        // Identify the closest meaningful text block for editing out of the valid tags
        const textBlockTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'LI', 'LABEL'];
        let possibleTextContainer = target.closest(textBlockTags.join(','));
        
        // Fix: To prevent infinite nesting of formatBlock tags, we must attach contenteditable
        // to the OUTERMOST text block container, not the inner nested ones.
        if (possibleTextContainer && blockContainer.contains(possibleTextContainer)) {
            let outermost = possibleTextContainer;
            let parent = outermost.parentElement;
            while (parent && blockContainer.contains(parent)) {
                if (textBlockTags.includes(parent.tagName)) {
                    outermost = parent;
                }
                parent = parent.parentElement;
            }
            target = outermost;
        }

        const isTextBlock = textBlockTags.includes(target.tagName);
        if (!isTextBlock) {
            if (!validTags.includes(target.tagName)) return;
            // For generic tags like DIV, SPAN, A, reject if they contain block elements or >1 children (likely structural)
            const hasBlockChildren = Array.from(target.children).some(c => textBlockTags.includes(c.tagName) || c.tagName === 'DIV');
            if (hasBlockChildren || target.children.length > 1) {
                return;
            }
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
            blockIndex: parseInt(blockContainer.getAttribute('data-block-index')),
            blockType: blockContainer.getAttribute('data-block-type')
          }, parentOrigin)
        }, 200)
      })

      document.addEventListener('mouseout', (e) => {
        if (!hoveredEl) return
        if (e.target === hoveredEl) {
          clearHoverState()
        }
        // Fix: Clear IMAGE_HOVERED timer when mouse leaves an img
        if (e.target && e.target.tagName === 'IMG') {
          if (hoverTimer) {
            clearTimeout(hoverTimer)
            hoverTimer = null
          }
        }
      })

      document.addEventListener('click', (e) => {
        // Do not block links if the preview is opened in a separate tab (standalone)
        if (window === window.parent) return;

        const anchor = e.target.closest('a')
        if (anchor && anchor.hasAttribute('href') && anchor.getAttribute('href') !== '#') {
          e.preventDefault()
          // Optionally notify parent that we prevented a redirect if we want
        }
      }, true)

      document.addEventListener('pointerdown', () => {
        window.parent.postMessage({ type: 'PREVIEW_POINTER_DOWN' }, parentOrigin)
      })

      // US-F05-06: WYSIWYG Text Editing
      let currentEditingEl = null
      let searchKey = ''
      let currentHtml = ''
      let isTrackingOuterHTML = false
      let isExecutingCommand = false


      const cleanUpEditing = () => {
        if (!currentEditingEl) return
        currentEditingEl.removeAttribute('contenteditable')
        let newHtml = isTrackingOuterHTML ? currentEditingEl.outerHTML : currentEditingEl.innerHTML?.trim()
        if (isTrackingOuterHTML && newHtml) newHtml = newHtml.replace(/\s*contenteditable="true"\s*/i, '');
        let oldHtmlFixed = currentHtml;
        if (isTrackingOuterHTML && oldHtmlFixed) oldHtmlFixed = oldHtmlFixed.replace(/\s*contenteditable="true"\s*/i, '');
        
        window.parent.postMessage({
          type: 'TEXT_EDITED',
          blockIndex: parseInt(currentEditingEl.closest('[data-block-index]')?.getAttribute('data-block-index')),
          searchKey: searchKey,
          oldHtml: oldHtmlFixed,
          newHtml: newHtml
        }, parentOrigin)
        currentEditingEl = null
        window.parent.postMessage({ type: 'TEXT_EDITING_STOPPED' }, parentOrigin)
      }

      // Send text back on keyup
      const reportTextChange = () => {
        if (!currentEditingEl) return
        
        let newHtml = isTrackingOuterHTML ? currentEditingEl.outerHTML : currentEditingEl.innerHTML?.trim()
        if (isTrackingOuterHTML && newHtml) newHtml = newHtml.replace(/\s*contenteditable="true"\s*/i, '');
        let oldHtmlFixed = currentHtml;
        if (isTrackingOuterHTML && oldHtmlFixed) oldHtmlFixed = oldHtmlFixed.replace(/\s*contenteditable="true"\s*/i, '');

        const blockIndex = parseInt(currentEditingEl.closest('[data-block-index]')?.getAttribute('data-block-index') || '0')
        
        console.log('[WYSIWYG] reportTextChange => oldHtml:', oldHtmlFixed, 'newHtml:', newHtml, 'blockIndex:', blockIndex)

        window.parent.postMessage({
          type: 'TEXT_EDITED',
          searchKey: searchKey,
          oldHtml: oldHtmlFixed,
          newHtml: newHtml,
          blockIndex: blockIndex
        }, parentOrigin)
        // If outer tracking, newHtml will become the new currentHtml
        currentHtml = isTrackingOuterHTML ? currentEditingEl.outerHTML : newHtml
      }

      document.addEventListener('keyup', (e) => {
        if (currentEditingEl) {
            // Give browser time to update DOM
            setTimeout(reportTextChange, 100)
        }
      })

      let blurTimeout = null;

      document.addEventListener('dblclick', (e) => {
        let target = e.target
        let blockContainer = target.closest('[data-block-index]')
        if (!blockContainer || excludedBlockTypes.includes(blockContainer.getAttribute('data-block-type'))) return

        // Identify the closest meaningful text block for editing out of the valid tags
        const textBlockTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'LI', 'LABEL'];
        let possibleTextContainer = target.closest(textBlockTags.join(','));
        
        // Stop if the parent is a template tag (has classes or styles)
        if (possibleTextContainer && blockContainer.contains(possibleTextContainer)) {
            let outermost = possibleTextContainer;
            let parent = outermost.parentElement;
            while (parent && blockContainer.contains(parent)) {
                if (textBlockTags.includes(parent.tagName)) {
                    if (parent.hasAttribute('class') || parent.hasAttribute('style')) break;
                    outermost = parent;
                } else {
                    break;
                }
                parent = parent.parentElement;
            }
            target = outermost;
        }

        const isTextBlock = textBlockTags.includes(target.tagName);
        if (!isTextBlock) {
            if (!validTags.includes(target.tagName)) return;
            const hasBlockChildren = Array.from(target.children).some(c => textBlockTags.includes(c.tagName) || c.tagName === 'DIV');
            if (hasBlockChildren || target.children.length > 1) {
                return;
            }
        }
        
        const isPurePayloadTag = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P'].includes(target.tagName) 
            && !target.hasAttribute('class') 
            && !target.hasAttribute('style');

        if (target) {
          e.preventDefault()
          e.stopPropagation()
          if (blurTimeout) clearTimeout(blurTimeout)
          if (currentEditingEl && currentEditingEl !== target) {
            cleanUpEditing()
          }
          currentEditingEl = target
          currentEditingEl.setAttribute('contenteditable', 'true')
          currentEditingEl.focus()
          searchKey = currentEditingEl.innerText?.trim()
          isTrackingOuterHTML = isPurePayloadTag
          currentHtml = isTrackingOuterHTML ? currentEditingEl.outerHTML : currentEditingEl.innerHTML?.trim()
          
          const rect = target.getBoundingClientRect()
          window.parent.postMessage({
            type: 'TEXT_EDITING_STARTED',
            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
            blockIndex: parseInt(blockContainer.getAttribute('data-block-index'))
          }, parentOrigin)
        }
      })

      document.addEventListener('blur', (e) => {
        if (isExecutingCommand) return // Ignore blur from execCommand DOM replacements
        if (currentEditingEl === e.target) {
            window.parent.postMessage({ type: 'REQUEST_STOP_EDITING' }, parentOrigin)
        }
      }, true)

      document.addEventListener('keydown', (e) => {
        if (currentEditingEl && (e.key === 'Enter' || e.key === 'Escape')) {
          e.preventDefault()
          cleanUpEditing()
          window.getSelection()?.removeAllRanges() // Remove selection
        }
      })

      let savedRange = null;

      const reportSelectionState = () => {
         if (!currentEditingEl) return;
         
         // If the user clicked into the top-level window (e.g. into the link input), 
         // the iframe loses focus and the selection might collapse. 
         // We do not want to record that collapsed selection.
         if (!document.hasFocus()) return;
         
         const sel = window.getSelection();
         if (sel && sel.rangeCount > 0) {
             savedRange = sel.getRangeAt(0).cloneRange();
         }

         window.parent.postMessage({
             type: 'SELECTION_STATE',
             state: {
                 bold: document.queryCommandState('bold'),
                 italic: document.queryCommandState('italic'),
                 underline: document.queryCommandState('underline'),
                 justifyCenter: document.queryCommandState('justifyCenter'),
                 justifyLeft: document.queryCommandState('justifyLeft'),
                 justifyRight: document.queryCommandState('justifyRight'),
                 justifyFull: document.queryCommandState('justifyFull'),
                 formatBlock: document.queryCommandValue('formatBlock')
             }
         }, parentOrigin)
      }

      document.addEventListener('selectionchange', () => {
          if (currentEditingEl) {
              reportSelectionState()
          }
      })

      // Image click handling
      document.addEventListener('click', (e) => {
        let target = e.target
        let blockContainer = target.closest('[data-block-index]')
        if (currentEditingEl) {
            reportSelectionState()
        }
        
        if (target.tagName === 'IMG') {
          if (!blockContainer || excludedBlockTypes.includes(blockContainer.getAttribute('data-block-type'))) return
          
          const rect = target.getBoundingClientRect()
          window.parent.postMessage({
            type: 'IMAGE_CLICKED',
            src: target.src,
            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
            blockIndex: parseInt(blockContainer.getAttribute('data-block-index')),
            blockType: blockContainer.getAttribute('data-block-type')
          }, parentOrigin)
        } else if (currentEditingEl && target !== currentEditingEl) {
           // Clicking outside while editing will blur
        } else if (blockContainer && !excludedBlockTypes.includes(blockContainer.getAttribute('data-block-type'))) {
          const rect = blockContainer.getBoundingClientRect()
          window.parent.postMessage({
            type: 'BLOCK_CONTAINER_CLICKED',
            blockIndex: parseInt(blockContainer.getAttribute('data-block-index')),
            layout: {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              blockIndex: parseInt(blockContainer.getAttribute('data-block-index')),
              blockType: blockContainer.getAttribute('data-block-type')
            }
          }, parentOrigin)
        } else {
           window.parent.postMessage({ type: 'PREVIEW_CANVAS_CLICKED' }, parentOrigin)
        }
      })

      // US-F05-08: Drag and drop component from outside
      const dropIndicator = document.createElement('div')
      dropIndicator.className = 'drop-indicator'
      dropIndicator.style.cssText = 'height: 4px; background-color: #3b82f6; width: 100%; position: absolute; z-index: 9999; display: none; pointer-events: none;'
      document.body.appendChild(dropIndicator)

      document.addEventListener('dragover', (e) => {
        e.preventDefault()
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'

        const blocks = Array.from(document.querySelectorAll('[data-block-index]'))
        if (blocks.length === 0) return

        let closestBlock = null
        let closestDist = Infinity
        let insertAfter = false

        for (const block of blocks) {
          const rect = block.getBoundingClientRect()
          const midY = rect.top + rect.height / 2
          const dist = Math.abs(e.clientY - midY)
          
          if (dist < closestDist) {
            closestDist = dist
            closestBlock = block
            insertAfter = e.clientY > midY
          }
        }

        if (closestBlock) {
          const rect = closestBlock.getBoundingClientRect()
          dropIndicator.style.display = 'block'
          if (insertAfter) {
             dropIndicator.style.top = (rect.bottom + window.scrollY - 2) + 'px'
          } else {
             dropIndicator.style.top = (rect.top + window.scrollY - 2) + 'px'
          }
          dropIndicator.dataset.index = closestBlock.getAttribute('data-block-index') || '0'
          dropIndicator.dataset.insertAfter = insertAfter.toString()
        }
      })

      document.addEventListener('dragleave', (e) => {
         if (!e.relatedTarget) {
            dropIndicator.style.display = 'none'
         }
      })

      document.addEventListener('drop', (e) => {
        e.preventDefault()
        dropIndicator.style.display = 'none'

        try {
          const dataStr = e.dataTransfer?.getData('application/json')
          if (!dataStr) return
          
          const blockData = JSON.parse(dataStr)
          const targetIndexAttr = dropIndicator.dataset.index
          const isAfter = dropIndicator.dataset.insertAfter === 'true'
          
          if (!targetIndexAttr) return
          let targetIndex = parseInt(targetIndexAttr)
          if (isAfter) targetIndex += 1

          window.parent.postMessage({
            type: 'EDITOR_BLOCK_DROP',
            payload: { index: targetIndex, blockData }
          }, parentOrigin)
        } catch (err) {
          console.error('Drop error:', err)
        }
      })

      // Parent command execution (for bold, italic etc from RichTextToolbar)
      window.addEventListener('message', (e) => {
        if (e.origin !== parentOrigin && e.origin !== window.location.origin) return
        
        if (e.data?.type === 'STOP_TEXT_EDITING') {
            cleanUpEditing()
        }

        if (e.data?.type === 'EXEC_COMMAND') {
          isExecutingCommand = true
          try {
            console.log('[WYSIWYG] Executing command:', e.data.command, e.data.value)
            
            const preSavedRange = savedRange ? savedRange.cloneRange() : null;
            if (currentEditingEl) {
                currentEditingEl.focus() // keep focus on the element
            }
            if (preSavedRange) {
                const sel = window.getSelection();
                if (sel) {
                    sel.removeAllRanges();
                    sel.addRange(preSavedRange);
                    savedRange = preSavedRange;
                }
            }

            let cmdVal = e.data.value;

            if (e.data.command === 'formatBlock' && currentEditingEl) {
                const newTag = cmdVal.replace(/[<>]/g, '').toUpperCase();
                const blockTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'DIV'];
                
                // Keep inline tags, unwrap nested block tags
                const elements = currentEditingEl.querySelectorAll(blockTags.join(','));
                Array.from(elements).reverse().forEach(el => {
                    const parent = el.parentNode;
                    while (el.firstChild) {
                        parent.insertBefore(el.firstChild, el);
                    }
                    parent.removeChild(el);
                });
                
                const isPurePayloadTag = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P'].includes(currentEditingEl.tagName) 
                    && !currentEditingEl.hasAttribute('class') 
                    && !currentEditingEl.hasAttribute('style');

                if (isPurePayloadTag) {
                    const wrapper = document.createElement(newTag);
                    while (currentEditingEl.firstChild) {
                        wrapper.appendChild(currentEditingEl.firstChild);
                    }
                    currentEditingEl.parentNode.replaceChild(wrapper, currentEditingEl);
                    currentEditingEl = wrapper;
                    currentEditingEl.setAttribute('contenteditable', 'true');
                    currentEditingEl.focus();
                } else {
                    const wrapper = document.createElement(newTag);
                    
                    // Because structural blocks in Hero schemas hardcode parent styling (e.g., <h1 style="font-size: clamp(...)">)
                    // We must forcibly assign explicit Tailwind classes to the nested injected heading tag
                    // so that the text size and weight visually updates for the user, instead of inheriting standard layout styles.
                    const sizeMap = {
                        'H1': 'text-4xl md:text-5xl font-extrabold',
                        'H2': 'text-3xl md:text-4xl font-bold',
                        'H3': 'text-2xl md:text-3xl font-bold',
                        'H4': 'text-xl md:text-2xl font-bold',
                        'H5': 'text-lg font-bold',
                        'H6': 'text-base font-bold',
                        'P': 'text-base font-normal'
                    };
                    if (sizeMap[newTag]) {
                        wrapper.className = sizeMap[newTag];
                    }

                    while (currentEditingEl.firstChild) {
                        wrapper.appendChild(currentEditingEl.firstChild);
                    }
                    currentEditingEl.appendChild(wrapper);
                }
                
                if (savedRange) {
                    try {
                        const sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(savedRange);
                    } catch(err) {}
                }
                
                setTimeout(() => {
                    reportSelectionState()
                    reportTextChange()
                }, 10)

                return; // Skip native execCommand which could cause messy nesting boundaries
            }
            
            const result = document.execCommand(e.data.command, false, cmdVal)
            console.log('[WYSIWYG] Result:', result)
            
            if (e.data.command === 'createLink' && result && currentEditingEl) {
                // native execCommand doesn't add target="_blank"
                const links = currentEditingEl.querySelectorAll('a');
                links.forEach(a => {
                    const hrefStr = a.getAttribute('href');
                    if (hrefStr && hrefStr.includes(cmdVal)) {
                        a.setAttribute('target', '_blank');
                        a.setAttribute('rel', 'noopener noreferrer');
                    }
                });
            }
            
            // If the browser replaced the element (e.g. changing <p> to <h1>), 
            // the old currentEditingEl is detached. We must find the new one.
            const selAfter = window.getSelection();
            if (selAfter && selAfter.anchorNode) {
                let node = selAfter.anchorNode;
                if (node.nodeType === 3) node = node.parentElement;
                
                let newEditable = node.closest('[contenteditable="true"]');
                // If contenteditable attribute was lost during tag swap, restore it
                if (!newEditable) {
                    const blockContainer = node.closest('[data-block-index]');
                    if (blockContainer) {
                        let topChild = node;
                        while (topChild && topChild.parentElement !== blockContainer && topChild !== blockContainer) {
                            topChild = topChild.parentElement;
                        }
                        if (topChild && topChild !== blockContainer) {
                            newEditable = topChild;
                            newEditable.setAttribute('contenteditable', 'true');
                        }
                    }
                }

                if (newEditable && newEditable !== currentEditingEl) {
                    currentEditingEl = newEditable;
                    currentEditingEl.focus();
                }
            }

            if (currentEditingEl) {
                setTimeout(() => {
                    reportSelectionState()
                    reportTextChange() // Immediately report to parent to trigger auto-save
                }, 10)
            }
          } catch(err) {
            console.error('[WYSIWYG] Error executing command:', err)
          } finally {
            setTimeout(() => { isExecutingCommand = false }, 50)
          }
        }
      })

      document.addEventListener('keyup', (e) => {
          if (currentEditingEl) {
              reportSelectionState()
          }
      })

      window.addEventListener('load', postLayouts)
      window.addEventListener('resize', postLayouts)
      window.addEventListener('scroll', postLayouts, { passive: true })
      document.addEventListener('DOMContentLoaded', postLayouts)
      setTimeout(postLayouts, 50)
    })();
  </script>
</body>
</html>`
}


export const GET = withAuth<{ params: Promise<{ siteId: string }> }>(async (user, req, ctx) => {
  try {
    const { siteId } = await ctx.params
    const payload = await getPayload({ config })
    const numericSiteId = Number(siteId)
    const pageId = new URL(req.url).searchParams.get('pageId')
    const pagePath = new URL(req.url).searchParams.get('path')

    interface NavPage { id: string | number; title?: string; slug?: string; isVisible?: boolean; [key: string]: unknown }

    // Fetch site info
    const site = await payload.findByID({ collection: 'sites', id: numericSiteId })
    if (!site) return new NextResponse('Not found', { status: 404 })

    interface TenantRef { tenant: string | number | { id: string | number } }

    const tenantIds = user.tenants?.map((t: TenantRef) =>
      typeof t.tenant === 'object' ? String(t.tenant.id) : String(t.tenant)
    ) ?? []

    const siteTenantId = typeof site.tenant === 'object' ? String(site.tenant.id) : String(site.tenant)
    if (!tenantIds.includes(siteTenantId)) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    let page: NonNullable<Awaited<ReturnType<typeof payload.findByID>>> | null = null

    if (pageId) {
      if (!/^\d+$/.test(pageId)) {
        return new NextResponse('Invalid pageId', { status: 400 })
      }
      const requestedPage = await payload.findByID({
        collection: 'pages',
        id: pageId,
        draft: true, // From staging: include drafts
      })

      const requestedPageSiteId =
        typeof requestedPage?.site === 'object' ? requestedPage.site?.id : requestedPage?.site

      if (requestedPage && Number(requestedPageSiteId) === numericSiteId) {
        page = requestedPage
      }
    } else if (pagePath !== null) {
      const parsedSlugWithSlash = pagePath === '' ? '/' : (pagePath.startsWith('/') ? pagePath : `/${pagePath}`)
      const parsedSlugWithoutSlash = pagePath === '/' ? '/' : pagePath.replace(/^\/+/, '')
      
      const pagesResult = await payload.find({
        collection: 'pages',
        where: {
          and: [
            { site: { equals: numericSiteId } },
            {
              or: [
                { slug: { equals: parsedSlugWithSlash } },
                { slug: { equals: parsedSlugWithoutSlash } }
              ]
            }
          ],
        },
        limit: 1,
        draft: true, // From staging: include drafts
      })
      if (pagesResult.docs.length > 0) {
        page = pagesResult.docs[0]
      }
    }

    if (!page) {
      let pagesResult = await payload.find({
        collection: 'pages',
        where: {
          site: { equals: numericSiteId },
          isHomepage: { equals: true },
        },
        limit: 1,
        draft: true, // From staging: include drafts
      })

      if (pagesResult.docs.length === 0) {
        pagesResult = await payload.find({
          collection: 'pages',
          where: { site: { equals: numericSiteId } },
          limit: 1,
          draft: true, // From staging: include drafts
        })
      }

      page = pagesResult.docs[0] || null
    }

    const blocks = page?.layout || []

    const visiblePagesResult = await payload.find({
      collection: 'pages',
      where: { site: { equals: numericSiteId } },
      limit: 100,
      sort: 'createdAt',
    })
    
    // Inject global header/footer from site level
    // Remove existing page-level navigation and footer to avoid duplicates, but keep them as fallback
    type PreviewBlock = { blockType: string; [key: string]: unknown };
    const oldNav = blocks.find((b: PreviewBlock) => b.blockType === 'navigation')
    const oldFooter = blocks.find((b: PreviewBlock) => b.blockType === 'footer')
    const combinedBlocks = blocks.filter((b: PreviewBlock) => b.blockType !== 'navigation' && b.blockType !== 'footer')
    
    const finalHeader = site.headerBlock || oldNav
    const finalFooter = site.footerBlock || oldFooter

    const normalizedHeader = finalHeader?.blockType === 'navigation'
      ? {
        ...mergeNavigationBrandingWithSite(finalHeader, site as Parameters<typeof mergeNavigationBrandingWithSite>[1]),
        links: filterNavigationLinksByVisibility(finalHeader.links, visiblePagesResult.docs as unknown as NavPage[]),
      }
      : finalHeader

    const normalizedFooter = finalFooter?.blockType === 'footer'
      ? mergeFooterSocialsWithSite(finalFooter, site as Parameters<typeof mergeFooterSocialsWithSite>[1])
      : finalFooter

    if (normalizedHeader) combinedBlocks.unshift(normalizedHeader)
    if (normalizedFooter) combinedBlocks.push(normalizedFooter)

    const cat = detectCategory(combinedBlocks, site.name || '')
    const t = THEMES[cat] || THEMES.business
    const html = buildFullHTML(combinedBlocks, t, cat, {
      name: page?.seo?.title || site.seo?.metaTitle || site.name,
      description: page?.seo?.description || site.seo?.metaDescription || site.description,
      ogTitle: page?.seo?.title || site.seo?.metaTitle || site.name,
      ogDescription: page?.seo?.description || site.seo?.metaDescription || site.description,
      lang: site.locale || 'en',
    }, site)

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
      },
    })
  } catch (e: unknown) {
    console.error('[Preview Error]', e)
    return new NextResponse('Failed to generate preview. Please try again later.', { status: 500 })
  }
})
