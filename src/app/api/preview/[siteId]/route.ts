/**
 * Site Preview API — Renders a site's blocks into premium HTML.
 * Loads blocks from the pages collection (layout field), NOT from sites.
 * Uses industry-aware renderers for true visual diversity.
 */
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { renderNav, renderHero, renderSections, THEMES, baseCSS, getGoogleFontsLink, TemplateTheme } from '../renderers'
import { setHeroCategory } from '../renderers/hero'
import { setSectionCategory } from '../renderers/sections'
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
  const heroHtml = blocks.map((b, i) => b.blockType === 'hero' ? addDataAttr(renderHero(b as any, t, cat), i, b.blockType) : '').filter(Boolean).join('\n')
  const footerHtml = blocks.map((b, i) => b.blockType === 'footer' ? addDataAttr(renderSections(b as any, t, cat, site as any), i, b.blockType) : '').filter(Boolean).join('\n')
  const mainHtml = blocks
    .map((b, i) => !['navigation', 'hero', 'footer'].includes(b.blockType) ? addDataAttr(renderSections(b as any, t, cat, site as any), i, b.blockType) : '')
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
    (function() {
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
        }, '*')
      }

      const clearHoverState = () => {
        if (hoverTimer) {
          clearTimeout(hoverTimer)
          hoverTimer = null
        }

        hoveredEl = null
        hoveredBlock = null
        window.parent.postMessage({ type: 'BLOCK_MOUSEOUT' }, '*')
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
          }, '*')
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
            }, '*')
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
            blockIndex: parseInt(blockContainer.getAttribute('data-block-index')),
            blockType: blockContainer.getAttribute('data-block-type')
          }, '*')
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

      document.addEventListener('pointerdown', () => {
        window.parent.postMessage({ type: 'PREVIEW_POINTER_DOWN' }, '*')
      })

      // US-F05-06: WYSIWYG Text Editing
      let currentEditingEl = null
      let originalText = ''

      const cleanUpEditing = () => {
        if (!currentEditingEl) return
        currentEditingEl.removeAttribute('contenteditable')
        const newText = currentEditingEl.innerText?.trim()
        window.parent.postMessage({
          type: 'TEXT_EDITED',
          blockIndex: parseInt(currentEditingEl.closest('[data-block-index]')?.getAttribute('data-block-index')),
          oldText: originalText,
          newText: newText
        }, '*')
        currentEditingEl = null
        window.parent.postMessage({ type: 'TEXT_EDITING_STOPPED' }, '*')
      }

      document.addEventListener('dblclick', (e) => {
        let target = e.target
        let blockContainer = target.closest('[data-block-index]')
        if (!blockContainer || excludedBlockTypes.includes(blockContainer.getAttribute('data-block-type'))) return

        if (validTags.includes(target.tagName) && target.children.length <= 1) {
          e.preventDefault()
          e.stopPropagation()
          if (currentEditingEl && currentEditingEl !== target) {
            cleanUpEditing()
          }
          currentEditingEl = target
          currentEditingEl.setAttribute('contenteditable', 'true')
          currentEditingEl.focus()
          originalText = currentEditingEl.innerText?.trim()
          
          const rect = target.getBoundingClientRect()
          window.parent.postMessage({
            type: 'TEXT_EDITING_STARTED',
            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
            blockIndex: parseInt(blockContainer.getAttribute('data-block-index'))
          }, '*')
        }
      })

      document.addEventListener('blur', (e) => {
        if (currentEditingEl === e.target) {
          cleanUpEditing()
        }
      }, true)

      document.addEventListener('keydown', (e) => {
        if (currentEditingEl && (e.key === 'Enter' || e.key === 'Escape')) {
          e.preventDefault()
          cleanUpEditing()
          window.getSelection()?.removeAllRanges() // Remove selection
        }
      })

      // Image click handling
      document.addEventListener('click', (e) => {
        let target = e.target
        let blockContainer = target.closest('[data-block-index]')
        if (target.tagName === 'IMG') {
          if (!blockContainer || excludedBlockTypes.includes(blockContainer.getAttribute('data-block-type'))) return
          
          const rect = target.getBoundingClientRect()
          window.parent.postMessage({
            type: 'IMAGE_CLICKED',
            src: target.src,
            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
            blockIndex: parseInt(blockContainer.getAttribute('data-block-index')),
            blockType: blockContainer.getAttribute('data-block-type')
          }, '*')
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
          }, '*')
        } else {
           window.parent.postMessage({ type: 'PREVIEW_CANVAS_CLICKED' }, '*')
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
          }, '*')
        } catch (err) {
          console.error('Drop error:', err)
        }
      })

      // Parent command execution (for bold, italic etc from RichTextToolbar)
      window.addEventListener('message', (e) => {
        if (e.data?.type === 'EXEC_COMMAND') {
          document.execCommand(e.data.command, false, e.data.value)
          currentEditingEl?.focus() // keep focus on the element
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


export const GET = withAuth<{ params: Promise<{ siteId: string }> }>(async (_user, req, ctx) => {
  try {
    const { siteId } = await ctx.params
    const payload = await getPayload({ config })
    const numericSiteId = Number(siteId)
    const pageId = new URL(req.url).searchParams.get('pageId')

    // Fetch site info
    const site: any = await payload.findByID({ collection: 'sites', id: numericSiteId })
    if (!site) return new NextResponse('Not found', { status: 404 })

    let page: any = null

    if (pageId) {
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
    const oldNav = blocks.find((b: any) => b.blockType === 'navigation')
    const oldFooter = blocks.find((b: any) => b.blockType === 'footer')
    const combinedBlocks = blocks.filter((b: any) => b.blockType !== 'navigation' && b.blockType !== 'footer')
    
    const finalHeader = site.headerBlock || oldNav
    const finalFooter = site.footerBlock || oldFooter

    const normalizedHeader = finalHeader?.blockType === 'navigation'
      ? {
        ...mergeNavigationBrandingWithSite(finalHeader, site),
        links: filterNavigationLinksByVisibility(finalHeader.links, visiblePagesResult.docs),
      }
      : finalHeader

    const normalizedFooter = finalFooter?.blockType === 'footer'
      ? mergeFooterSocialsWithSite(finalFooter, site)
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
  } catch (e: any) {
    console.error('[Preview Error]', e)
    return new NextResponse('Failed to generate preview. Please try again later.', { status: 500 })
  }
})
