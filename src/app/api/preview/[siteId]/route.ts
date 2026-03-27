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

import { buildFullHTML } from '@/lib/htmlBuilder'

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
