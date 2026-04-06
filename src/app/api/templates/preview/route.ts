/**
 * Template Preview API — renders a template's homepage with its own theme.
 * Supports both v3 (templatePages) and legacy (defaultBlocks).
 */
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { buildFullHTML } from '@/lib/htmlBuilder'
import { THEMES } from '../../preview/renderers'
import { withAuth } from '@/lib/auth'

export const GET = withAuth(async (_user, req) => {
    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')
        const pageSlug = searchParams.get('page') || 'home'
        if (!id) return NextResponse.json({ error: 'Missing id param' }, { status: 400 })

        const payload = await getPayload({ config })
        const template = await payload.findByID({ collection: 'templates', id: Number(id), overrideAccess: true })
        if (!template) return new NextResponse('Template not found', { status: 404 })

        // Resolve category
        const categories = (template as any).category || []
        const cat = Array.isArray(categories) ? categories[0] : categories

        // Resolve theme — prefer template's own theme over generic category theme
        const templateTheme = (template as any).defaultTheme || {}
        const theme = {
            ...(THEMES[cat] || THEMES.business),
            // Override with template-specific colors if available
            ...(templateTheme.primaryColor ? { primaryColor: templateTheme.primaryColor } : {}),
            ...(templateTheme.secondaryColor ? { secondaryColor: templateTheme.secondaryColor } : {}),
            ...(templateTheme.fontHeading ? { fontHeading: templateTheme.fontHeading } : {}),
            ...(templateTheme.fontBody ? { fontBody: templateTheme.fontBody } : {}),
            ...(templateTheme.colorMode ? { colorMode: templateTheme.colorMode } : {}),
        }

        // Resolve blocks — v3 templatePages first, fallback to defaultBlocks
        let blocks: Record<string, unknown>[] = []
        const templatePages = (template as any).templatePages
        if (Array.isArray(templatePages) && templatePages.length > 0) {
            // Find requested page (default: homepage)
            const page = templatePages.find(
                (p: any) => p.slug === pageSlug || p.isHomepage === true
            ) || templatePages[0]
            blocks = page?.layout || []
        } else {
            // Legacy fallback
            blocks = (template as any).defaultBlocks || []
        }

        const html = buildFullHTML(blocks, theme, cat)
        return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Preview error'
        return new NextResponse(`Error: ${message}`, { status: 500 })
    }
})
