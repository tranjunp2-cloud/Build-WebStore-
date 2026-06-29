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
import { PreviewSiteMissingNotice } from './PreviewSiteMissingNotice'
import { resolveImageLibraryS3Map } from '@/lib/images/image-library-resolver'
import { isNavBlock, isFooterBlock } from '@/lib/ai/ensure-navigation'

type PreviewLayoutBlock = Record<string, unknown> & {
    blockType: string
    __editorBlockIndex?: number
}

interface PreviewPageProps {
    params: Promise<{ siteId: string }>
    searchParams: Promise<{ pageId?: string; v?: string; builder?: string; editor?: string }>
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
    const { pageId, builder, editor } = await searchParams
    const isEditorIframe = !!editor || !!builder

    // 1. Auth Check (P0 Security Rule - Auth Redirect)
    const user = await getCurrentUser() as PlatformUser | null
    if (!user) {
        return redirect('/login?redirect=' + encodeURIComponent(`/preview/${siteId}${pageId ? `?pageId=${pageId}` : ''}`))
    }

    const payload = await getPayload({ config: payloadConfig })

    // 2. Fetch Site Data
    // Data-fetching and validation are kept outside try-catch so Next.js navigation
    // errors (notFound, redirect) propagate correctly to the runtime instead of
    // being swallowed by the catch block and rendered as PreviewLoadError.
    // Using 'any' cast here as fallback because payload-types.ts is generated in the build step and not consistently available in all dev environments
    const site = await payload.findByID({
        collection: 'sites',
        id: siteId,
        depth: 2,
        // findByID THROWS NotFound by default — disableErrors makes it return null
        // so the guard below handles a missing site as a 404 instead of crashing the RSC render.
        disableErrors: true,
    }) as any

    if (!site) {
        // Stale/deleted siteId — e.g. the builder's persisted localStorage id points
        // at a row that was removed or reseeded. Inside the editor/builder iframe,
        // notify the parent so it can clear the stale id and recover; a standalone
        // visit still gets a real 404.
        if (isEditorIframe) return <PreviewSiteMissingNotice siteId={siteId} />
        return notFound()
    }

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
            // Same as the site lookup: return null on missing id instead of throwing NotFound.
            disableErrors: true,
        })
        if (!page) {
            return notFound()
        }
        // Verify page belongs to the current site (P0 Security Rule - prevent cross-site page access)
        const pageSiteId = typeof page.site === 'object' ? page.site?.id : page.site
        if (String(pageSiteId) !== String(siteId)) {
            return notFound()
        }
        // Page Preview (no builder=1) behaves like live site: hidden/deleted/draft pages → 404.
        // Builder mode is exempt so the owner can still view and edit these pages in the editor.
        const isHiddenPage =
            page.isVisible === false ||
            (page.deletedAt != null && page.deletedAt !== '') ||
            page.status === 'draft'
        if (isHiddenPage && !isEditorIframe) {
            const notFoundResult = await payload.find({
                collection: 'pages',
                where: {
                    and: [
                        { site: { equals: siteId } },
                        { or: [{ slug: { equals: '/404' } }, { slug: { equals: '404' } }] },
                    ],
                },
                draft: true,
                limit: 1,
                depth: 3,
            })
            page = notFoundResult.docs[0] || {
                id: 0,
                title: '404 — Page Not Found',
                slug: '404',
                layout: [{
                    blockType: 'hero',
                    variant: 'centered',
                    headline: '404',
                    subheadline: 'This page is not visible to visitors.',
                }],
            }
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

    // 5. Nav/footer injection + render (try-catch only wraps complex rendering logic)
    try {
        // BUG-F01-26: Check for WORKING nav (with links), not just block presence.
        // A nav block with empty links renders as invisible thin bar.
        const pageLayout = ((page.layout as Array<{ blockType: string; links?: unknown[]; columns?: unknown[]; [k: string]: unknown }>) || [])
            .map((block, index) => ({ ...block, __editorBlockIndex: index })) as PreviewLayoutBlock[]
        const existingNav = pageLayout.find(isNavBlock)
        const hasNav = Boolean(existingNav && Array.isArray(existingNav.links) && existingNav.links.length > 0)
        const existingFooter = pageLayout.find(isFooterBlock)
        const hasFooter = Boolean(existingFooter)

        // F26: site-level header/footer are CANONICAL. Per-page nav/footer blocks embedded in a
        // page's layout are non-canonical artifacts that go stale — only the page open during a
        // locale switch gets its nav translated, so non-home pages keep an English nav. Always
        // resolve the single site header/footer and inject it, stripping per-page nav/footer.
        // Mirrors SiteRenderer.applyGlobalSystemBlocks() so /preview matches the storefront.
        // Prefer pending (draft) versions so unpublished locale switches show immediately.
        const pendingHb = (site as Record<string, unknown>).pendingHeaderBlock as Record<string, unknown> | null
        const pendingFb = (site as Record<string, unknown>).pendingFooterBlock as Record<string, unknown> | null
        const siteHeaderBlock = pendingHb ?? (site.headerBlock as Record<string, unknown> | null)
        const siteFooterBlock = pendingFb ?? (site.footerBlock as Record<string, unknown> | null)

        // When a canonical site header/footer exists, strip the page's own and replace it. For
        // legacy sites with no site-level header, keep the page's nav (or derive a fallback).
        let navBlock: PreviewLayoutBlock | null = null
        let stripPerPageNav = false
        if (siteHeaderBlock) {
            navBlock = { ...siteHeaderBlock, blockType: (siteHeaderBlock.blockType as string) || 'navigation', __editorBlockIndex: -1 }
            stripPerPageNav = true
        }
        let footerBlock: PreviewLayoutBlock | null = null
        let stripPerPageFooter = false
        if (siteFooterBlock) {
            footerBlock = { ...siteFooterBlock, blockType: (siteFooterBlock.blockType as string) || 'footer', __editorBlockIndex: -1 }
            stripPerPageFooter = true
        }

        // Legacy fallback (no site-level header/footer): derive from homepage layout, then defaults.
        if ((!navBlock && !hasNav) || (!footerBlock && !hasFooter)) {
            if (!page.isHomepage) {
                const homepageResult = await payload.find({
                    collection: 'pages',
                    where: { site: { equals: siteId }, isHomepage: { equals: true } },
                    draft: true,
                    limit: 1,
                    depth: 3,
                })
                const homepage = homepageResult.docs[0] as any
                if (homepage?.layout) {
                    const homeLayout = homepage.layout as PreviewLayoutBlock[]
                    if (!navBlock && !hasNav) {
                        const hn = homeLayout.find(isNavBlock)
                        if (hn) navBlock = { ...hn, __editorBlockIndex: -1 }
                    }
                    if (!footerBlock && !hasFooter) {
                        const hf = homeLayout.find(isFooterBlock)
                        if (hf) footerBlock = { ...hf, __editorBlockIndex: -1 }
                    }
                }
            }
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
        }

        // Strip per-page nav/footer when we have a replacement to inject (canonical site header, or a
        // derived fallback for a page that had none); otherwise keep the page's existing block.
        const cleanedLayout = pageLayout.filter((b) => {
            if (isNavBlock(b) && (stripPerPageNav || !hasNav)) return false
            if (isFooterBlock(b) && (stripPerPageFooter || !hasFooter)) return false
            return true
        })
        const injectedLayout = [
            ...(navBlock ? [navBlock] : []),
            ...cleanedLayout,
            ...(footerBlock ? [footerBlock] : []),
        ]
        page = { ...page, layout: injectedLayout }

        // Fetch all pages for navigation filtering parity
        const navPagesResult = await payload.find({
            collection: 'pages',
            where: { site: { equals: siteId } },
            limit: 100,
        })

        const imageLibraryS3 = await resolveImageLibraryS3Map(payload, siteId)

        return (
            <AppShell>
                <div className="min-h-screen">
                    {/* Render with true SiteRenderer in Editor Mode */}
                    <PreviewSiteRenderer
                        site={{
                            ...site,
                            // F26-04: override headerBlock / footerBlock / globalBlocks with the
                            // DRAFT (pending) versions so /preview reflects the latest editor save,
                            // including locale switches that haven't been published yet.
                            headerBlock: (site as Record<string, unknown>).pendingHeaderBlock ?? site.headerBlock,
                            footerBlock: (site as Record<string, unknown>).pendingFooterBlock ?? site.footerBlock,
                            globalBlocks: (site as Record<string, unknown>).pendingGlobalBlocks ?? site.globalBlocks,
                            tenantSlug: typeof site.tenant === 'object' && site.tenant !== null
                                ? (site.tenant as { slug?: string }).slug || ''
                                : '',
                            // Route blog-list links to /preview/{siteId}/blog/* so clicking
                            // a blog card stays in the preview namespace instead of navigating
                            // to the published-only storefront route (fix #1183). Uses a
                            // dedicated field so product/other blocks are not affected.
                            blogPreviewPath: `/preview/${siteId}/blog`,
                            imageLibraryS3,
                        }}
                        page={page}
                        pages={navPagesResult.docs as unknown as NavPage[]}
                        isBuilderPreview={!!builder}
                        isEditorIframe={isEditorIframe}
                    />

                    {/* Editor listeners (full) or builder-preview link handler (lightweight) */}
                    {builder ? <BuilderLinkScripts /> : <PreviewScripts />}
                </div>
            </AppShell>
        )

    } catch (error) {
        console.error('[Preview] Error:', error)
        return <PreviewLoadError />
    }
}
