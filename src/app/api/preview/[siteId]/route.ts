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
      let hoveredEl = null;

      document.addEventListener('mouseover', (e) => {
        let target = e.target
        let blockContainer = target.closest('[data-block-index]')
        if (!blockContainer) {
          window.parent.postMessage({ type: 'BLOCK_MOUSEOUT' }, '*')
          return
        }
        
        if (!validTags.includes(target.tagName) || target.children.length > 1) {
          return
        }
        
        const text = target.innerText?.trim()
        if (!text || text.length < 2) return

        hoveredEl = target
        const rect = target.getBoundingClientRect()
        
        window.parent.postMessage({
          type: 'BLOCK_HOVERED',
          rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
          text: text,
          blockIndex: parseInt(blockContainer.getAttribute('data-block-index')),
          blockType: blockContainer.getAttribute('data-block-type')
        }, '*')
      })

      document.addEventListener('dblclick', (e) => {
        if (hoveredEl && hoveredEl === e.target) {
          window.parent.postMessage({ type: 'BLOCK_CLICKED' }, '*')
          e.preventDefault()
        }
      })
    })();
  </script>
</body>
</html>`
}

export const GET = withAuth<{ params: Promise<{ siteId: string }> }>(async (_user, _req, ctx) => {
  try {
    const { siteId } = await ctx.params
    const payload = await getPayload({ config })
    const numericSiteId = Number(siteId)

    // Fetch site info
    const site: any = await payload.findByID({ collection: 'sites', id: numericSiteId })
    if (!site) return new NextResponse('Not found', { status: 404 })

    // Fetch blocks from pages collection (homepage or first page)
    let pagesResult = await payload.find({
      collection: 'pages',
      where: {
        site: { equals: numericSiteId },
        isHomepage: { equals: true },
      },
      limit: 1,
    })

    // Fallback: get first page for this site
    if (pagesResult.docs.length === 0) {
      pagesResult = await payload.find({
        collection: 'pages',
        where: { site: { equals: numericSiteId } },
        limit: 1,
      })
    }

    const page: any = pagesResult.docs[0]
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
