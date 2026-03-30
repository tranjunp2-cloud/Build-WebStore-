import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'

import { saveSiteSchema } from '@/lib/validations/sites'
import { parseRequest } from '@/lib/validations/helpers'
import { normalizeSocialWidgetConfig } from '@/blocks/social-widget/config'

function normalizeBlocksForPersistence(blocks: Record<string, unknown>[]) {
    return blocks.map(block => {
        if (block?.blockType === 'socialWidget') {
            return normalizeSocialWidgetConfig(block)
        }

        return block
    })
}

/**
 * PATCH /api/sites/[siteId]/save
 * Saves updated blocks (layout) and/or theme for a site.
 * Body: { blocks?: any[], theme?: any }
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ siteId: string }> }
) {
    try {
        const payload = await getPayload({ config })

        // Try standard Payload auth first
        let user: any = null
        try {
            const authResult = await payload.auth({ headers: req.headers })
            user = authResult.user
        } catch (authErr) {
            console.warn('[Save] Standard auth failed, trying cookie fallback')
        }

        // Fallback: read payload-token from cookies
        if (!user) {
            const cookieStore = await cookies()
            const token = cookieStore.get('payload-token')?.value
            if (token) {
                try {
                    // Create new headers with Authorization bearer token
                    const authHeaders = new Headers(req.headers)
                    authHeaders.set('Authorization', `JWT ${token}`)
                    const authResult = await payload.auth({ headers: authHeaders })
                    user = authResult.user
                } catch (fallbackErr) {
                    console.warn('[Save] Cookie fallback auth failed too')
                }
            }
        }

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { siteId } = await params

        const site = await payload.findByID({
            collection: 'sites',
            id: siteId,
        })
        if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

        const tenantIds = user.tenants?.map((t: any) =>
            typeof t.tenant === 'object' ? String(t.tenant.id) : String(t.tenant)
        ) ?? []
        const siteTenantId = typeof site.tenant === 'object' ? String(site.tenant.id) : String(site.tenant)
        if (!tenantIds.includes(siteTenantId)) {
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
                const requestedPage = await payload.findByID({
                    collection: 'pages',
                    id: pageId,
                })
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

    } catch (error: any) {
        console.error('[Save Error]', error)
        return NextResponse.json(
            { error: 'Save failed' },
            { status: 500 },
        )
    }
}
