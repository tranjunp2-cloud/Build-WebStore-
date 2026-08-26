export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { generateAutoSEOMeta } from '@/lib/ai/generate-meta'

function extractTextContent(value: unknown, acc: string[] = []): string[] {
    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed) acc.push(trimmed)
        return acc
    }

    if (Array.isArray(value)) {
        value.forEach(item => extractTextContent(item, acc))
        return acc
    }

    if (value && typeof value === 'object') {
        Object.values(value).forEach(entry => extractTextContent(entry, acc))
    }

    return acc
}

import { withAuth } from '@/lib/auth'

type RouteContext = { params: Promise<{ siteId: string; pageId: string }> }

export const POST = withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const payload = await getPayload({ config: configPromise })
        const resolvedParams = await Promise.resolve(ctx.params)
        
        if (!resolvedParams.siteId || !/^\d+$/.test(resolvedParams.siteId) || !resolvedParams.pageId || !/^\d+$/.test(resolvedParams.pageId)) {
            return new NextResponse('Invalid or missing parameters', { status: 400 })
        }

        const { siteId, pageId } = resolvedParams
        const numericSiteId = Number(siteId)

        // Extract tenant IDs from the current user
        interface TenantRef { tenant: string | number | { id: string | number } }
        const tenantIds = user.tenants?.map((t: TenantRef) =>
            typeof t.tenant === 'object' ? t.tenant.id : t.tenant
        ) ?? []

        const page = await payload.findByID({
            collection: 'pages',
            id: pageId,
        })

        const pageSiteId = typeof page?.site === 'object' ? page.site?.id : page?.site

        if (!page || Number(pageSiteId) !== numericSiteId) {
            return new NextResponse('Page not found on this site', { status: 404 })
        }

        const { docs: sites } = await payload.find({
            collection: 'sites',
            where: {
                id: {
                    equals: numericSiteId,
                },
                tenant: {
                    in: tenantIds,
                },
            },
        })

        if (!sites || sites.length === 0) {
            return new NextResponse('Unauthorized or Site Not Found', { status: 403 })
        }

        const site = await payload.findByID({
            collection: 'sites',
            id: numericSiteId,
        })
        const siteName = site?.businessName || site?.name || 'Website'

        // Extract context
        const textContext = Array.isArray(page.layout)
            ? extractTextContent(page.layout).join('. ')
            : ''

        const contentWarning = textContext.length === 0
            ? 'Page has no content. SEO result may be inaccurate.'
            : undefined

        // Fetch tracked keywords from site (AC-15)
        const trackedKeywords = ((site as any)?.seo?.trackedKeywords as Array<{ keyword: string }> | undefined)
            ?.map(k => k.keyword).filter(Boolean) || []

        const { title, description } = await generateAutoSEOMeta(
            'page',
            page.title,
            siteName,
            textContext,
            trackedKeywords,
        )

        // Generate slug if page is not published
        let newSlug: string | undefined
        if (page._status === 'draft') {
            newSlug = title
                .toLowerCase()
                .trim()
                .replace(/[^\w\s-]/g, '')
                .replace(/[\s_-]+/g, '-')
                .replace(/^-+|-+$/g, '')
        }

        // Return with existing meta for comparison (AC-16, BR-06)
        const existing = {
            title: (page as any).seo?.title || null,
            description: (page as any).seo?.description || null,
        }
        const hasExisting = !!(existing.title || existing.description)

        return NextResponse.json({
            proposed: { title, description, ...(newSlug ? { slug: newSlug } : {}) },
            existing,
            hasExisting,
            ...(contentWarning ? { warning: contentWarning } : {}),
            // Backward compat — flat fields for consumers not yet updated
            title,
            description,
            ...(newSlug ? { slug: newSlug } : {}),
        })
    } catch (error) {
        console.error('Error generating SEO:', error)
        return new NextResponse('Internal Error', { status: 500 })
    }
})
