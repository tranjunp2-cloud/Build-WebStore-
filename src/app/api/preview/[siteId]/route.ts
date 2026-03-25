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

// Force dynamic rendering — never cache this route
export const dynamic = 'force-dynamic'
export const revalidate = 0

export function buildFullHTML(blocks: any[], theme?: TemplateTheme, category?: string, meta?: { name?: string; description?: string; lang?: string }): string {
  const cat = category || 'business'
  const t = theme || THEMES[cat] || THEMES.business

  // Extract site info from blocks for SEO
  const heroBlock = blocks.find(b => b.blockType === 'hero')
  const navBlock = blocks.find(b => b.blockType === 'navigation')
  const siteName = meta?.name || navBlock?.logoText || 'Website'
  const siteDesc = meta?.description || heroBlock?.subheadline || `${siteName} — Professional website`
  const lang = meta?.lang || 'en'

  // Set category for image selection in renderers
  setHeroCategory(cat)
  setSectionCategory(cat)

  // Separate nav/hero from other sections for semantic HTML
  const addDataAttr = (html: string, index: number, type: string) => {
    return html.replace(/^<([a-z0-9]+)\s/i, `<$1 data-block-index="${index}" data-block-type="${type}" `)
  }

  const navHtml = blocks.map((b, i) => b.blockType === 'navigation' ? addDataAttr(renderNav(b, t), i, b.blockType) : '').filter(Boolean).join('\n')
  const heroHtml = blocks.map((b, i) => b.blockType === 'hero' ? addDataAttr(renderHero(b, t, cat), i, b.blockType) : '').filter(Boolean).join('\n')
  const footerHtml = blocks.map((b, i) => b.blockType === 'footer' ? addDataAttr(renderSections(b, t, cat), i, b.blockType) : '').filter(Boolean).join('\n')
  const mainHtml = blocks
    .map((b, i) => !['navigation', 'hero', 'footer'].includes(b.blockType) ? addDataAttr(renderSections(b, t, cat), i, b.blockType) : '')
    .filter(Boolean)
    .join('\n')

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${siteName}</title>
  <meta name="description" content="${siteDesc.substring(0, 160)}">
  <meta property="og:title" content="${siteName}">
  <meta property="og:description" content="${siteDesc.substring(0, 160)}">
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
  })}
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
        if (target.tagName === 'IMG') {
          let blockContainer = target.closest('[data-block-index]')
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
        } else {
           window.parent.postMessage({ type: 'PREVIEW_CANVAS_CLICKED' }, '*')
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
      })

      if (pagesResult.docs.length === 0) {
        pagesResult = await payload.find({
          collection: 'pages',
          where: { site: { equals: numericSiteId } },
          limit: 1,
        })
      }

      page = pagesResult.docs[0]
    }

    const blocks = page?.layout || []

    const cat = detectCategory(blocks, site.name || '')
    const t = THEMES[cat] || THEMES.business
    const html = buildFullHTML(blocks, t, cat, {
      name: site.name,
      description: site.description,
    })

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
      },
    })
  } catch (e: any) {
    console.error('[Preview Error]', e.message)
    return new NextResponse(`Error: ${e.message}`, { status: 500 })
  }
})
