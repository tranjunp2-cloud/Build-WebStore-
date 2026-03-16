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
import { getCurrentUser } from '@/lib/auth'

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
  const navHtml = blocks.filter(b => b.blockType === 'navigation').map(b => renderNav(b, t)).join('\n')
  const heroHtml = blocks.filter(b => b.blockType === 'hero').map(b => renderHero(b, t, cat)).join('\n')
  const footerHtml = blocks.filter(b => b.blockType === 'footer').map(b => renderSections(b, t, cat)).join('\n')
  const mainHtml = blocks
    .filter(b => !['navigation', 'hero', 'footer'].includes(b.blockType))
    .map(b => renderSections(b, t, cat)).join('\n')

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
</body>
</html>`
}

export async function GET(_req: Request, { params }: { params: Promise<{ siteId: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { siteId } = await params
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
}
