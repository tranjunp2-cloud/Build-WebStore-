import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { buildFullHTML } from '@/app/api/preview/[siteId]/route'

/**
 * GET /api/templates/preview?id={templateId}
 * Renders a template's defaultBlocks + defaultTheme into full premium HTML.
 * Used by gallery iframe preview.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')
        if (!id) {
            return new NextResponse('Missing template id', { status: 400 })
        }

        const payload = await getPayload({ config })
        const template: any = await payload.findByID({ collection: 'templates', id })

        if (!template) {
            return new NextResponse('Template not found', { status: 404 })
        }

        const theme = template.defaultTheme || {
            primaryColor: '#3B82F6',
            secondaryColor: '#8B5CF6',
            fontHeading: 'Outfit',
            fontBody: 'Inter',
            colorMode: 'dark',
        }

        const blocks = template.defaultBlocks || []
        const html = buildFullHTML(template.name || 'Template Preview', blocks, theme)

        return new NextResponse(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'public, max-age=3600',
            },
        })
    } catch (error: any) {
        console.error('[Template Preview Error]', error)
        return new NextResponse(
            `<html><body style="background:#09090b;color:#fff;font-family:sans-serif;padding:4rem;text-align:center"><h1>Error</h1><p>${error.message}</p></body></html>`,
            { status: 500, headers: { 'Content-Type': 'text/html' } }
        )
    }
}
