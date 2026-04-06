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

        // Base theme from category
        const baseTheme = THEMES[cat] || THEMES.business

        // Template-specific theme overrides (map DB field names → TemplateTheme names)
        const dt = (template as any).defaultTheme || {}
        const theme = {
            ...baseTheme,
            ...(dt.primaryColor ? { primary: dt.primaryColor } : {}),
            ...(dt.secondaryColor ? { secondary: dt.secondaryColor } : {}),
            ...(dt.fontHeading ? { fontHeading: dt.fontHeading } : {}),
            ...(dt.fontBody ? { fontBody: dt.fontBody } : {}),
            // Dark mode: swap bg/text colors
            ...(dt.colorMode === 'dark' ? {
                bg: '#0f172a',
                text: '#f8fafc',
                muted: '#94a3b8',
            } : dt.colorMode === 'light' ? {
                bg: '#ffffff',
                text: '#111827',
                muted: '#6b7280',
            } : {}),
        }

        // Resolve blocks — v3 templatePages first, fallback to defaultBlocks
        let blocks: Record<string, unknown>[] = []
        const templatePages = (template as any).templatePages
        if (Array.isArray(templatePages) && templatePages.length > 0) {
            const page = templatePages.find(
                (p: any) => p.slug === pageSlug || p.isHomepage === true
            ) || templatePages[0]
            blocks = page?.layout || []
        } else {
            blocks = (template as any).defaultBlocks || []
        }

        // Map hero block.variant → theme.heroStyle for the HTML renderer
        const heroBlock = blocks.find((b: Record<string, unknown>) => b.blockType === 'hero')
        const heroVariantMap: Record<string, string> = {
            'centered': 'centered',
            'split-left': 'split',
            'split-right': 'split',
            'fullscreen': 'fullscreen-search',
            'video': 'video-bg',
            'split-video': 'video-bg',
            'gradient': 'gradient-mockup',
            'parallax': 'geometric',
            'magazine': 'diagonal',
            'slideshow': 'slider',
            'cards-overlay': 'masonry',
            'minimal': 'centered',
        }
        const heroVariant = (heroBlock?.variant as string) || ''
        const mappedHeroStyle = heroVariantMap[heroVariant] || theme.heroStyle
        const finalTheme = { ...theme, heroStyle: mappedHeroStyle }

        const html = buildFullHTML(blocks, finalTheme, cat)
        return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Preview error'
        return new NextResponse(`Error: ${message}`, { status: 500 })
    }
})
