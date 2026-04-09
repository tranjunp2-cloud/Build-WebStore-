export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { normalizeSocialWidgetConfig } from '@/blocks/social-widget/config'

function normalizeEditorLayout(layout: unknown) {
    if (!Array.isArray(layout)) return []

    return layout.map(block => {
        if (block && typeof block === 'object') {
            const b = block as Record<string, unknown>
            if (b.blockType === 'socialWidget') {
                return normalizeSocialWidgetConfig(b)
            }
        }

        return block
    })
}

/**
 * GET /api/sites/[siteId]/editor-data
 * Returns site + homepage data for the editor.
 * Uses Payload's Local API (no REST auth issues).
 */
export const GET = withAuth<{ params: Promise<{ siteId: string }> }>(async (user, req, ctx) => {
    try {
        const payload = await getPayload({ config })
        const { siteId } = await ctx.params
        const numericSiteId = Number(siteId)
        const pageId = new URL(req.url).searchParams.get('pageId')

        // Fetch site (depth: 1 to populate tenant for siteUrl computation)
        const site = await payload.findByID({
            collection: 'sites',
            id: siteId,
            depth: 1,
        })

        if (!site) {
            return NextResponse.json({ error: 'Site not found' }, { status: 404 })
        }

        type TenantRef = string | number | { id: string | number } | null | undefined
        const resolveTenantId = (t: TenantRef): string | null =>
            t == null ? null : String(typeof t === 'object' ? t.id : t)

        const rawTenants = Array.isArray(user.tenants) ? user.tenants : []
        const tenantIds = rawTenants
            .map((t: { tenant: TenantRef }) => resolveTenantId(t.tenant))
            .filter((id): id is string => id !== null)

        const siteTenantId = resolveTenantId(site.tenant as TenantRef)
        if (!siteTenantId || !tenantIds.includes(siteTenantId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        let page: NonNullable<Awaited<ReturnType<typeof payload.findByID>>> | null = null

        if (pageId) {
            if (!/^\d+$/.test(pageId)) {
                return NextResponse.json({ error: 'Invalid pageId' }, { status: 400 })
            }
            let requestedPage: NonNullable<Awaited<ReturnType<typeof payload.findByID>>> | null = null
            try {
                requestedPage = await payload.findByID({
                    collection: 'pages',
                    id: pageId,
                    draft: true,
                })
            } catch {
                // Page not found — fall through to homepage
            }

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

        return NextResponse.json({
            site: {
                id: site.id,
                name: site.name || 'Untitled',
                domain: site.domain || null,
                status: site.status || 'draft',
                theme: site.theme || {},
                siteType: site.siteType || 'business',
                locale: site.locale || 'ms',
                contactInfo: site.contactInfo || {},
                socialLinks: site.socialLinks || {},
                branding: site.branding || {},
                seo: site.seo || {},
                headerBlock: site.headerBlock || null,
                footerBlock: site.footerBlock || null,
                shippingConfig: site.shippingConfig || {},
                publishedAt: site.publishedAt || null,
                tenantSlug: (typeof site.tenant === 'object' && site.tenant !== null)
                    ? (site.tenant as Record<string, unknown>).slug as string || null
                    : null,
            },
            page: page ? {
                id: page.id,
                title: page.title || 'Homepage',
                layout: normalizeEditorLayout(page.layout),
                _status: page._status || 'published',
                updatedAt: page.updatedAt,
            } : null,
        })

    } catch (error) {
        console.error('[Editor Data Error]', error)
        return NextResponse.json(
            { error: 'Failed to load editor data' },
            { status: 500 },
        )
    }
})
