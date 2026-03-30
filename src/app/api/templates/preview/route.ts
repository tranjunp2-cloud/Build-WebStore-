/**
 * Template Preview API — renders a template's defaultBlocks with industry-aware styling.
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
        if (!id) return NextResponse.json({ error: 'Missing id param' }, { status: 400 })

        const payload = await getPayload({ config })
        const template = await payload.findByID({ collection: 'templates', id: Number(id) })
        if (!template) return new NextResponse('Template not found', { status: 404 })

        const blocks = (template as any).defaultBlocks || []
        const categories = (template as any).category || []
        const cat = Array.isArray(categories) ? categories[0] : categories
        const theme = THEMES[cat] || THEMES.business

        const html = buildFullHTML(blocks, theme, cat)
        return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    } catch (e: any) {
        return new NextResponse(`Error: ${e.message}`, { status: 500 })
    }
})
