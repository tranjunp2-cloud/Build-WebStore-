import { notFound, redirect } from 'next/navigation'
import type { Viewport } from 'next'
import payloadConfig from '@payload-config'
import { getPayload } from 'payload'
import { SiteRenderer } from '@/components/site-renderer/SiteRenderer'
import { PreviewScripts } from '@/components/editor/PreviewScripts'
import { AppShell } from '@/components/AppShell'
import { getCurrentUser } from '@/lib/auth'
import type { NavPage } from '@/components/site-renderer/SiteRenderer'
import type { PlatformUser } from '@/types/user'
import { PreviewAccessDenied, PreviewNoPage, PreviewLoadError } from './PreviewErrors'

interface PreviewPageProps {
    params: Promise<{ siteId: string }>
    searchParams: Promise<{ pageId?: string; v?: string }>
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
    const { pageId } = await searchParams
    
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
        // BUG-F01-26: Previously only non-homepage pages got injection,
        // so homepage with missing nav (from auto-save overwrite or AI omit)
        // would render without menu. Now all pages get the fallback.
        const pageLayout = (page.layout as Array<{ blockType: string }>) || []
        const hasNav = pageLayout.some((b: { blockType: string }) => b.blockType === 'navigation')
        const hasFooter = pageLayout.some((b: { blockType: string }) => b.blockType === 'footer')

        if (!hasNav || !hasFooter) {
            // Check site-level headerBlock/footerBlock first
            const siteHeaderBlock = site.headerBlock as Record<string, unknown> | null
            const siteFooterBlock = site.footerBlock as Record<string, unknown> | null

            let navBlock: Record<string, unknown> | null = siteHeaderBlock ? { ...siteHeaderBlock, blockType: siteHeaderBlock.blockType || 'navigation' } : null
            let footerBlock: Record<string, unknown> | null = siteFooterBlock ? { ...siteFooterBlock, blockType: siteFooterBlock.blockType || 'footer' } : null

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
                }
            }

            // Last resort: build minimal default nav/footer
            if (!navBlock && !hasNav) {
                const siteName = (site.name as string) || 'My Website'
                navBlock = {
                    blockType: 'navigation',
                    variant: 'minimal',
                    logoText: siteName,
                    links: [
                        { label: 'Home', url: '/' },
                        { label: 'About', url: '/about' },
                        { label: 'Products', url: '/products' },
                        { label: 'Contact', url: '/contact' },
                    ],
                } as Record<string, unknown>
            }
            if (!footerBlock && !hasFooter) {
                const siteName = (site.name as string) || 'My Website'
                footerBlock = {
                    blockType: 'footer',
                    variant: 'simple',
                    logoText: siteName,
                    description: `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`,
                    columns: [],
                } as Record<string, unknown>
            }

            const injectedLayout = [
                ...(!hasNav && navBlock ? [navBlock] : []),
                ...pageLayout,
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
                <div className="overflow-x-hidden min-height-screen">
                    {/* Render with true SiteRenderer in Editor Mode */}
                    <SiteRenderer
                        site={site}
                        page={page}
                        pages={navPagesResult.docs as unknown as NavPage[]}
                        isEditor={true}
                    />

                    {/* Editor specific listeners */}
                    <PreviewScripts />
                </div>
            </AppShell>
        )

    } catch (error) {
        console.error('[Preview] Error:', error)
        return <PreviewLoadError />
    }
}
