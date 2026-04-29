import { notFound, redirect } from 'next/navigation'
import type { Viewport } from 'next'
import payloadConfig from '@payload-config'
import { getPayload } from 'payload'
import { PreviewSiteRenderer } from './PreviewSiteRenderer'
import { PreviewScripts, BuilderLinkScripts } from '@/components/editor/PreviewScripts'
import { AppShell } from '@/components/AppShell'
import { getCurrentUser } from '@/lib/auth'
import type { NavPage } from '@/components/site-renderer/SiteRenderer'
import type { PlatformUser } from '@/types/user'
import { PreviewAccessDenied, PreviewNoPage, PreviewLoadError } from './PreviewErrors'

type PreviewLayoutBlock = Record<string, unknown> & {
    blockType: string
    __editorBlockIndex?: number
}

interface PreviewPageProps {
    params: Promise<{ siteId: string }>
    searchParams: Promise<{ pageId?: string; v?: string; builder?: string }>
}

export const dynamic = 'force-dynamic'

// Re-export viewport at the preview page level. Root layout.tsx also exports
// viewport, but force-dynamic pages rendered inside the editor mobile iframe
// (390px wide) occasionally drop the inherited viewport meta in Next.js 15,
// causing blocks to render at the legacy 980px fallback. Explicit re-export
// guarantees the iframe content always gets `width=device-width` so Tailwind
// sm:/md:/lg: breakpoints fire at the correct physical width.
export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
}

export default async function PreviewPage({ params, searchParams }: PreviewPageProps) {
    const { siteId } = await params
    const { pageId, builder } = await searchParams
    
    // 1. Auth Check (P0 Security Rule - Auth Redirect)
    const user = await getCurrentUser() as PlatformUser | null
    if (!user) {
        return redirect('/login?redirect=' + encodeURIComponent(`/preview/${siteId}${pageId ? `?pageId=${pageId}` : ''}`))
    }

    const payload = await getPayload({ config: payloadConfig })

    try {
        // 2. Fetch Site Data
        // Using 'any' cast here as fallback because payload-types.ts is generated in the build step and not consistently available in all dev environments
        const site = await payload.findByID({
            collection: 'sites',
            id: siteId,
            depth: 2,
        }) as any

        if (!site) return notFound()

        // 3. Tenant Isolation Check (P0 Security Rule - Tenant Isolation)
        // Ensure user has access to this site's tenant
        const userTenants = user.tenants?.map((t: NonNullable<PlatformUser['tenants']>[number]) => typeof t.tenant === 'object' ? t.tenant.id : t.tenant) || []
        const siteTenantId = typeof site.tenant === 'object' ? site.tenant?.id : site.tenant
        
        if (!userTenants.includes(siteTenantId)) {
            return <PreviewAccessDenied />
        }

        // 4. Fetch Page Data
        // Using 'any' as fallback type for generated Payload Page interface
        let page: any = null
        if (pageId) {
            page = await payload.findByID({
                collection: 'pages',
                id: pageId,
                draft: true,
                depth: 3,
            })
            if (!page) {
                return notFound()
            }
            // Verify page belongs to the current site (P0 Security Rule - prevent cross-site page access)
            const pageSiteId = typeof page.site === 'object' ? page.site?.id : page.site
            if (String(pageSiteId) !== String(siteId)) {
                return notFound()
            }
        } else {
            // Find Homepage
            const pagesResult = await payload.find({
                collection: 'pages',
                where: {
                    site: { equals: siteId },
                    isHomepage: { equals: true },
                },
                draft: true,
                limit: 1,
                depth: 3,
            })
            page = pagesResult.docs[0] || null
        }

        if (!page) return <PreviewNoPage />

        // 4b. Ensure nav/footer on EVERY page (including homepage).
        // BUG-F01-26: Check for WORKING nav (with links), not just block presence.
        // A nav block with empty links renders as invisible thin bar.
        const pageLayout = ((page.layout as Array<{ blockType: string; links?: unknown[]; columns?: unknown[]; [k: string]: unknown }>) || [])
            .map((block, index) => ({ ...block, __editorBlockIndex: index })) as PreviewLayoutBlock[]
        const existingNav = pageLayout.find((b) => b.blockType === 'navigation')
        const hasNav = Boolean(existingNav && Array.isArray(existingNav.links) && existingNav.links.length > 0)
        const existingFooter = pageLayout.find((b) => b.blockType === 'footer')
        const hasFooter = Boolean(existingFooter)

        if (!hasNav || !hasFooter) {
            // Check site-level headerBlock/footerBlock first
            const siteHeaderBlock = site.headerBlock as Record<string, unknown> | null
            const siteFooterBlock = site.footerBlock as Record<string, unknown> | null

            let navBlock: PreviewLayoutBlock | null = siteHeaderBlock
                ? { ...siteHeaderBlock, blockType: (siteHeaderBlock.blockType as string) || 'navigation', __editorBlockIndex: -1 }
                : null
            let footerBlock: PreviewLayoutBlock | null = siteFooterBlock
                ? { ...siteFooterBlock, blockType: (siteFooterBlock.blockType as string) || 'footer', __editorBlockIndex: -1 }
                : null

            // Fallback: extract from homepage layout if current page is not homepage
            if ((!navBlock || !footerBlock) && !page.isHomepage) {
                const homepageResult = await payload.find({
                    collection: 'pages',
                    where: { site: { equals: siteId }, isHomepage: { equals: true } },
                    draft: true,
                    limit: 1,
                    depth: 3,
                })
                const homepage = homepageResult.docs[0] as any
                if (homepage?.layout) {
                    const homeLayout = homepage.layout as Array<{ blockType: string; [key: string]: unknown }>
                    if (!navBlock) navBlock = homeLayout.find(b => b.blockType === 'navigation') || null
                    if (!footerBlock) footerBlock = homeLayout.find(b => b.blockType === 'footer') || null
                    if (navBlock) navBlock = { ...navBlock, __editorBlockIndex: -1 }
                    if (footerBlock) footerBlock = { ...footerBlock, __editorBlockIndex: -1 }
                }
            }

            // Last resort: build default nav/footer
            if (!navBlock && !hasNav) {
                const siteName = (site.name as string) || 'My Website'
                navBlock = {
                    blockType: 'navigation',
                    __editorBlockIndex: -1,
                    variant: 'simple',
                    logoText: siteName,
                    links: [
                        { label: 'Home', url: '/' },
                        { label: 'About', url: '/about' },
                        { label: 'Products', url: '/products' },
                        { label: 'Contact', url: '/contact' },
                    ],
                } as PreviewLayoutBlock
            }
            if (!footerBlock && !hasFooter) {
                const siteName = (site.name as string) || 'My Website'
                footerBlock = {
                    blockType: 'footer',
                    __editorBlockIndex: -1,
                    variant: 'simple',
                    logoText: siteName,
                    description: `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`,
                    columns: [],
                } as PreviewLayoutBlock
            }

            // Strip broken nav/footer blocks (exist but empty) before injecting working ones
            const cleanedLayout = pageLayout.filter((b) => {
                if (b.blockType === 'navigation' && !hasNav) return false
                return true
            })

            const injectedLayout = [
                ...(!hasNav && navBlock ? [navBlock] : []),
                ...cleanedLayout,
                ...(!hasFooter && footerBlock ? [footerBlock] : []),
            ]
            page = { ...page, layout: injectedLayout }
        }

        // 5. Fetch all pages for navigation filtering parity
        const navPagesResult = await payload.find({
            collection: 'pages',
            where: { site: { equals: siteId } },
            limit: 100,
        })

        return (
            <AppShell>
                <div className="min-h-screen">
                    {/* Render with true SiteRenderer in Editor Mode */}
                    <PreviewSiteRenderer
                        site={{
                            ...site,
                            // Inject tenantSlug so CartWidgetBlock can build the checkout URL.
                            // site.tenant is populated (depth:2) so slug is accessible here.
                            tenantSlug: typeof site.tenant === 'object' && site.tenant !== null
                                ? (site.tenant as { slug?: string }).slug || ''
                                : '',
                        }}
                        page={page}
                        pages={navPagesResult.docs as unknown as NavPage[]}
                        isBuilderPreview={!!builder}
                    />

                    {/* Editor listeners (full) or builder-preview link handler (lightweight) */}
                    {builder ? <BuilderLinkScripts /> : <PreviewScripts />}
                </div>
            </AppShell>
        )

    } catch (error) {
        // Re-throw Next.js special errors (notFound, redirect) so the runtime handles them.
        // Catching NEXT_NOT_FOUND here turns a proper 404 into a Server Component render error.
        if (
            error !== null &&
            typeof error === 'object' &&
            'digest' in error &&
            typeof (error as Record<string, string>).digest === 'string' &&
            (
                (error as Record<string, string>).digest === 'NEXT_NOT_FOUND' ||
                (error as Record<string, string>).digest.startsWith('NEXT_REDIRECT')
            )
        ) {
            throw error
        }
        console.error('[Preview] Error:', error)
        return <PreviewLoadError />
    }
}
