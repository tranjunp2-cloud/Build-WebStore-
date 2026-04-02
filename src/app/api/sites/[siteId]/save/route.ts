export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { saveSiteSchema } from '@/lib/validations/sites'
import { parseRequest } from '@/lib/validations/helpers'
import { normalizeSocialWidgetConfig } from '@/blocks/social-widget/config'

function normalizeBlocksForPersistence(blocks: Record<string, unknown>[]) {
    return blocks.map(block => {
        let b = { ...block }
        
        if (b.blockType === 'socialWidget') {
            b = normalizeSocialWidgetConfig(b) as Record<string, unknown>
        }

        // Defensively sanitize navigation links (legacy drafts might lack 'label')
        if (b.blockType === 'navigation' && Array.isArray(b.links)) {
            b.links = b.links.map((linkRaw: unknown) => {
                const link = (typeof linkRaw === 'object' && linkRaw !== null) ? linkRaw as Record<string, unknown> : {}
                return {
                    ...link,
                    label: String(link.label || link.text || link.title || link.name || 'Link'),
                    url: String(link.url || link.href || link.link || '#')
                }
            })
        }

        // Defensively sanitize footer links
        if (b.blockType === 'footer' && Array.isArray(b.columns)) {
            b.columns = b.columns.map((col: Record<string, unknown>) => {
                if (!col || typeof col !== 'object') return col
                return {
                    ...col,
                    links: Array.isArray(col.links) ? col.links.map((linkRaw: unknown) => {
                        const link = (typeof linkRaw === 'object' && linkRaw !== null) ? linkRaw as Record<string, unknown> : {}
                        return {
                            ...link,
                            label: String(link.label || link.text || link.title || link.name || 'Link'),
                            url: String(link.url || link.href || link.link || '#')
                        }
                    }) : col.links
                }
            })
        }

        return b
    })
}

/**
 * PATCH /api/sites/[siteId]/save
 * Saves updated blocks (layout) and/or theme for a site.
 * Body: { blocks?: unknown[], theme?: unknown }
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ siteId: string }> }
) {
    try {
        // Authenticate — handles both Payload JWT and custom Jose JWT (from verify-otp)
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = await getPayload({ config })

        const { siteId } = await params

        // Verify site exists and check ownership (tenant isolation)
        const existingSite = await payload.findByID({ collection: 'sites', id: siteId })
        if (!existingSite) {
            return NextResponse.json({ error: 'Site not found' }, { status: 404 })
        }
        type TenantRef = string | number | { id: string | number } | null | undefined
        const resolveTenantId = (t: TenantRef): string | null =>
            t == null ? null : String(typeof t === 'object' ? t.id : t)
        const userTenants = (user as unknown as { tenants?: Array<{ tenant: TenantRef }> }).tenants ?? []
        const siteTenantId = resolveTenantId(existingSite.tenant as TenantRef)
        if (!siteTenantId || !userTenants.some(t => resolveTenantId(t.tenant) === siteTenantId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const pageId = req.nextUrl.searchParams.get('pageId')
        const { data, errorResponse } = await parseRequest(req, saveSiteSchema)
        if (errorResponse) return errorResponse
        const { blocks, theme, locale, shippingConfig, headerBlock, footerBlock, siteName, contactInfo, socialLinks, branding, seo, isDraft } = data!
        const normalizedBlocks = blocks ? normalizeBlocksForPersistence(blocks as Record<string, unknown>[]) : undefined

        type SiteUpdateData = Partial<{
            theme: unknown;
            name: unknown;
            locale: "en" | "ms";
            shippingConfig: unknown;
            headerBlock: unknown;
            footerBlock: unknown;
            contactInfo: unknown;
            socialLinks: unknown;
            branding: unknown;
            seo: unknown;
        }>;
        const siteUpdateData: SiteUpdateData = {}
        if (theme) siteUpdateData.theme = theme
        if (siteName) siteUpdateData.name = siteName
        if (locale) siteUpdateData.locale = locale
        if (shippingConfig) siteUpdateData.shippingConfig = shippingConfig
        if (headerBlock !== undefined) siteUpdateData.headerBlock = headerBlock
        if (footerBlock !== undefined) siteUpdateData.footerBlock = footerBlock
        if (contactInfo) siteUpdateData.contactInfo = contactInfo
        if (socialLinks) siteUpdateData.socialLinks = socialLinks
        if (branding) siteUpdateData.branding = branding
        if (seo) siteUpdateData.seo = seo

        if (Object.keys(siteUpdateData).length > 0) {
            await payload.update({
                collection: 'sites',
                id: siteId,
                data: siteUpdateData,
            })
        }

        // Update blocks on the selected page if provided
        if (normalizedBlocks) {
            const numericSiteId = Number(siteId)
            type PageDoc = NonNullable<Awaited<ReturnType<typeof payload.findByID>>>
            let page: PageDoc | null = null

            if (pageId) {
                if (!/^\d+$/.test(pageId)) {
                    return NextResponse.json({ error: 'Invalid pageId' }, { status: 400 })
                }
                const requestedPage = await payload.findByID({
                    collection: 'pages',
                    id: pageId,
                })
                const requestedPageSiteId =
                    typeof requestedPage?.site === 'object' ? requestedPage.site?.id : requestedPage?.site

                if (requestedPage && Number(requestedPageSiteId) === numericSiteId) {
                    page = requestedPage
                } else {
                    return NextResponse.json({ error: 'Page not found or does not belong to site' }, { status: 404 })
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

            if (page) {
                await payload.update({
                    collection: 'pages',
                    id: page.id,
                    data: { layout: normalizedBlocks },
                    draft: isDraft ?? false,
                })
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Saved successfully',
        })

    } catch (error: unknown) {
        console.error('[Save Error]', error)
        return NextResponse.json(
            { error: 'Save failed' },
            { status: 500 },
        )
    }
}
