export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { saveSiteSchema } from '@/lib/validations/sites'
import { parseRequest } from '@/lib/validations/helpers'
import { normalizeBlocksForPersistence } from '@/lib/block-normalization'


/** Only persist theme fields defined in the Sites collection schema.
 *  Extra keys (from AI or stale client state) are stripped so Payload
 *  does not throw a validation error (BUG-F05-025). */
const ALLOWED_THEME_KEYS = new Set([
    'primaryColor', 'secondaryColor', 'backgroundColor',
    'fontHeading', 'fontBody', 'borderRadius', 'colorMode',
    'accentColor', 'surfaceColor', 'textColor', 'mutedColor',
    'spacingPreset', 'shadowPreset',
])

function sanitizeTheme(raw: Record<string, unknown>): Record<string, unknown> {
    const clean: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(raw)) {
        if (ALLOWED_THEME_KEYS.has(key) && value !== undefined && value !== null && value !== '') {
            clean[key] = value
        }
    }
    return clean
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
        // Navigation: allow draft links (empty/#) but reject malformed external URLs
        if (headerBlock && typeof headerBlock === 'object') {
            const hb = headerBlock as Record<string, unknown>
            if (Array.isArray(hb.links)) {
                for (const link of hb.links) {
                    const l = link as Record<string, unknown>
                    const url = typeof l.url === 'string' ? l.url.trim() : ''
                    if (!url || url === '#') continue
                    if (url.startsWith('/') && !url.startsWith('//')) continue
                    if (url.startsWith('//')) return NextResponse.json({ error: `Invalid URL: protocol-relative URLs not allowed` }, { status: 400 })
                    try { const u = new URL(url); if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error() }
                    catch { return NextResponse.json({ error: `Invalid URL: "${url}"` }, { status: 400 }) }
                }
            }
        }
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
        if (theme) siteUpdateData.theme = sanitizeTheme(theme as Record<string, unknown>)
        if (siteName) siteUpdateData.name = siteName as string
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
                let requestedPage: PageDoc | null = null
                try {
                    requestedPage = await payload.findByID({
                        collection: 'pages',
                        id: pageId,
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
        const errMsg = error instanceof Error ? error.message : String(error)
        const errName = error instanceof Error ? error.name : 'Unknown'
        console.error('[Save Error]', errName + ':', errMsg)
        if (error && typeof error === 'object' && 'data' in error) {
            console.error('[Save Error] Validation data:', JSON.stringify((error as Record<string, unknown>).data, null, 2))
        }
        return NextResponse.json(
            { error: 'Save failed: ' + errMsg },
            { status: 500 },
        )
    }
}
