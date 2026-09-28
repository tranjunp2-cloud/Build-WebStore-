import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import payloadConfig from '@payload-config'
import Image from 'next/image'
import Link from 'next/link'
import { renderBlogContent } from '@/lib/blog/render-content'
import { getCurrentUser } from '@/lib/auth'
import type { PlatformUser } from '@/types/user'
import { PreviewAccessDenied } from '../../PreviewErrors'
import { BuilderLinkScripts } from '@/components/editor/PreviewScripts'
import { AppShell } from '@/components/AppShell'
import { getServerI18n } from '@/i18n/server'
import { PreviewBackLink } from './PreviewBackLink'
import { resolveTheme, generateThemeCSS } from '@/lib/theme/resolve'
import { blockRegistry } from '@/blocks/registry'
import { BlockErrorBoundary } from '@/blocks/ErrorBoundary'
import { isNavBlock, isFooterBlock } from '@/lib/ai/ensure-navigation'
import { GoogleFontsLoader } from '@/components/site-renderer/GoogleFontsLoader'
import { createPreviewUrlRewriter, rewriteNavLinkUrls } from '@/lib/navigation-url'
import type { NavPageLike } from '@/lib/navigation-url'

export const dynamic = 'force-dynamic'

type Props = {
    params: Promise<{ siteId: string; blogSlug: string }>
    searchParams: Promise<{ builder?: string; editor?: string }>
}

type PreviewBlock = Record<string, unknown> & { blockType: string; __editorBlockIndex?: number }

export default async function PreviewBlogDetailPage({ params, searchParams }: Props) {
    const { siteId, blogSlug } = await params
    const { builder } = await searchParams

    // 1. Auth (P0 — matches main preview page)
    const user = await getCurrentUser() as PlatformUser | null
    if (!user) {
        return redirect('/login?redirect=' + encodeURIComponent(`/preview/${siteId}/blog/${blogSlug}`))
    }

    const payload = await getPayload({ config: payloadConfig })

    // 2. Fetch site (depth:2 to populate tenant + header/footer blocks)
    const site = await payload.findByID({ collection: 'sites', id: siteId, depth: 2 }) as any
    if (!site) return notFound()

    // 3. Tenant isolation (P0 — copied from main preview page)
    const userTenants = user.tenants?.map(
        (t: NonNullable<PlatformUser['tenants']>[number]) =>
            typeof t.tenant === 'object' ? t.tenant.id : t.tenant
    ) || []
    const siteTenantId = typeof site.tenant === 'object' ? site.tenant?.id : site.tenant
    if (!userTenants.includes(siteTenantId)) {
        console.warn('[PreviewBlog] Tenant isolation rejected: siteId=', siteId)
        return <PreviewAccessDenied />
    }

    // 4. Fetch blog — draft:true, NO status filter (fix #1183: AI-gen sites are draft)
    // Include { site } in query to avoid post-fetch cross-site leak when tenant owns multiple sites.
    const blogsResult = await payload.find({
        collection: 'blogs',
        where: {
            and: [
                { tenant: { equals: siteTenantId } },
                { site: { equals: siteId } },
                { slug: { equals: blogSlug } },
            ],
        },
        draft: true,
        limit: 1,
        depth: 1,
    })
    const post = blogsResult.docs[0] as any
    if (!post) return notFound()

    // Cross-site ownership fence — belt-and-suspenders over the query-level site filter above.
    // null/undefined post.site also triggers notFound (no orphan posts allowed).
    const postSiteId = typeof post.site === 'object' ? post.site?.id : post.site
    if (String(postSiteId) !== String(siteId)) return notFound()

    // 5. Resolve canonical nav/footer (mirrors preview/[siteId]/page.tsx injection logic)
    const siteRec = site as Record<string, unknown>
    const siteHeaderBlock = (siteRec.pendingHeaderBlock ?? siteRec.headerBlock) as PreviewBlock | null
    const siteFooterBlock = (siteRec.pendingFooterBlock ?? siteRec.footerBlock) as PreviewBlock | null

    let navBlock: PreviewBlock | null = siteHeaderBlock
        ? { ...siteHeaderBlock, blockType: (siteHeaderBlock.blockType as string) || 'navigation', __editorBlockIndex: -1 }
        : null
    let footerBlock: PreviewBlock | null = siteFooterBlock
        ? { ...siteFooterBlock, blockType: (siteFooterBlock.blockType as string) || 'footer', __editorBlockIndex: -1 }
        : null

    // Fallback: derive from homepage layout when site-level blocks are absent
    if (!navBlock || !footerBlock) {
        const homepageResult = await payload.find({
            collection: 'pages',
            where: { site: { equals: siteId }, isHomepage: { equals: true } },
            draft: true,
            limit: 1,
            depth: 3,
        })
        const homeLayout = ((homepageResult.docs[0] as any)?.layout as PreviewBlock[]) || []
        if (!navBlock) {
            const hn = homeLayout.find(isNavBlock)
            if (hn) navBlock = { ...hn, __editorBlockIndex: -1 }
        }
        if (!footerBlock) {
            const hf = homeLayout.find(isFooterBlock)
            if (hf) footerBlock = { ...hf, __editorBlockIndex: -1 }
        }
    }

    // Last-resort defaults
    const siteName = (site.name as string) || 'My Website'
    if (!navBlock) {
        navBlock = { blockType: 'navigation', __editorBlockIndex: -1, variant: 'simple', logoText: siteName, links: [] }
    }
    if (!footerBlock) {
        footerBlock = {
            blockType: 'footer', __editorBlockIndex: -1, variant: 'simple', logoText: siteName,
            description: `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`, columns: [],
        }
    }

    // Rewrite nav/footer link URLs into preview scope. Unlike the main preview page,
    // this route renders nav/footer WITHOUT SiteRenderer, so raw slugs like `/` would
    // navigate the iframe out to the platform root (#1443). Fetch the site's pages and
    // reuse the same slug→pageId rewriter SiteRenderer uses so every internal nav link
    // resolves to `/preview/{siteId}?pageId=…` and stays inside the preview iframe.
    const navPagesResult = await payload.find({
        collection: 'pages',
        where: { site: { equals: siteId } },
        limit: 100,
    })
    const rewritePreview = createPreviewUrlRewriter({
        pages: navPagesResult.docs as unknown as NavPageLike[],
        siteId,
        isBuilderPreview: !!builder,
    })
    navBlock = {
        ...navBlock,
        links: rewriteNavLinkUrls(navBlock.links, rewritePreview),
        // Logo links home via `_logoHref` (NavLogoLink). Without this the logo falls back
        // to raw '/' and clicking it escapes the iframe to the platform root — same bug as
        // the nav tabs (#1443). Mirrors SiteRenderer's `_logoHref: rewriteUrl('/')`.
        _logoHref: rewritePreview('/'),
        ...(navBlock.ctaButton && typeof navBlock.ctaButton === 'object'
            ? {
                ctaButton: {
                    ...(navBlock.ctaButton as Record<string, unknown>),
                    url: rewritePreview((navBlock.ctaButton as { url?: string }).url),
                },
            }
            : {}),
    }
    footerBlock = {
        ...footerBlock,
        // The `minimal` footer variant mirrors the nav via `_filteredNavLinks`; without it
        // it falls back to RAW site.headerBlock.links and escapes the iframe (#1443). Reuse
        // the already-rewritten nav links. Mirrors SiteRenderer's footer injection.
        _filteredNavLinks: navBlock.links,
        columns: Array.isArray(footerBlock.columns)
            ? (footerBlock.columns as Array<Record<string, unknown>>).map((col) =>
                col && typeof col === 'object'
                    ? { ...col, links: rewriteNavLinkUrls(col.links, rewritePreview) }
                    : col,
            )
            : footerBlock.columns,
    }

    // 6. Theme
    const theme = resolveTheme({
        primaryColor: site.theme?.primaryColor,
        secondaryColor: site.theme?.secondaryColor,
        accentColor: site.theme?.accentColor,
        surfaceColor: site.theme?.surfaceColor,
        textColor: site.theme?.textColor,
        mutedColor: site.theme?.mutedColor,
        fontPairingId: site.theme?.fontPairingId,
        fontHeading: site.theme?.fontHeading,
        fontBody: site.theme?.fontBody,
        spacingPreset: site.theme?.spacingPreset,
        borderRadius: site.theme?.borderRadius,
        shadowPreset: site.theme?.shadowPreset,
        colorMode: site.theme?.colorMode,
        backgroundColor: site.theme?.backgroundColor,
    })
    const themeCSS = generateThemeCSS(theme)
    const primaryColor = (site.theme?.primaryColor as string | undefined) || '#0ea5e9'

    // 7. Post display data
    const thumbnail = typeof post.thumbnail === 'object' && post.thumbnail
        ? (post.thumbnail as Record<string, unknown>).url as string
        : null
    const category = typeof post.category === 'object' && post.category
        ? (post.category as Record<string, unknown>).name as string
        : null
    const author = typeof post.author === 'object' && post.author
        ? ([((post.author as any).firstName), ((post.author as any).lastName)].filter(Boolean).join(' ')
            || ((post.author as Record<string, unknown>).email as string) || null)
        : null
    const publishedAt = post.publishedAt
        ? new Date(post.publishedAt as string).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
        })
        : null

    const { t } = await getServerI18n()

    // Site context for block rendering. blogPreviewPath scopes blog links to the preview
    // namespace without affecting product/other blocks (fix #1183, parity with page.tsx).
    const siteForBlocks = {
        ...site,
        tenantSlug: typeof site.tenant === 'object' && site.tenant !== null
            ? (site.tenant as { slug?: string }).slug || ''
            : '',
        blogPreviewPath: `/preview/${siteId}/blog`,
    }

    const renderBlock = (block: PreviewBlock) => {
        const BlockComponent = blockRegistry.getComponent(block.blockType)
        if (!BlockComponent) return null
        return (
            <BlockErrorBoundary blockType={block.blockType}>
                <BlockComponent block={block as never} theme={theme} site={siteForBlocks as never} page={null} />
            </BlockErrorBoundary>
        )
    }

    return (
        <AppShell>
            <GoogleFontsLoader fontBody={theme.fontBody} fontHeading={theme.fontHeading} />
            <style>{`
                ${themeCSS}
                * { box-sizing: border-box; margin: 0; padding: 0; }
                html { scroll-behavior: smooth; }
                body { font-family: var(--font-body); background: var(--background); color: var(--text); }
                h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading); }
                .container { max-width: 1200px; margin: 0 auto; }
                img { max-width: 100%; height: auto; }
                a { color: inherit; text-decoration: none; }
            `}</style>

            {renderBlock(navBlock)}

            <article className="max-w-3xl mx-auto px-4 py-8">
                {/* Breadcrumb — blog listing not available in preview; link back to preview homepage */}
                <nav className="flex items-center gap-2 text-sm opacity-60 mb-8">
                    <Link href={`/preview/${siteId}`} className="hover:opacity-100 transition-opacity">
                        {t.storefront.products.home}
                    </Link>
                    <span>/</span>
                    <span className="opacity-80 truncate">{post.title as string}</span>
                </nav>

                {category && (
                    <span
                        className="text-xs font-medium px-3 py-1 rounded-full inline-block mb-4"
                        style={{ color: primaryColor, backgroundColor: `${primaryColor}20` }}
                    >
                        {category}
                    </span>
                )}

                <h1
                    className="text-3xl md:text-4xl font-bold mb-4 leading-tight"
                    style={{ fontFamily: 'var(--font-heading)' }}
                >
                    {post.title as string}
                </h1>

                <div className="flex items-center gap-3 text-sm opacity-50 mb-8">
                    {author && <span>By {author}</span>}
                    {author && publishedAt && <span>·</span>}
                    {publishedAt && <span>{publishedAt}</span>}
                </div>

                {thumbnail && (
                    <div className="relative rounded-xl overflow-hidden mb-8 aspect-[16/9]">
                        <Image
                            src={thumbnail}
                            alt={post.title as string}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, 768px"
                            priority
                        />
                    </div>
                )}

                <div
                    className="prose prose-lg max-w-none
                        prose-headings:font-bold
                        prose-a:underline
                        prose-blockquote:border-l-4
                        prose-code:px-1 prose-code:rounded
                        prose-img:rounded-xl"
                    dangerouslySetInnerHTML={{
                        __html: renderBlogContent(post.content),
                    }}
                />

                {/* Back to blog listing — uses history.back() to return to the preview page
                    that contained the blog-list block, preserving the correct pageId. */}
                <div className="mt-12 pt-8 border-t border-current/10">
                    <PreviewBackLink label={t.storefront.blog.backToBlog} primaryColor={primaryColor} />
                </div>
            </article>

            {renderBlock(footerBlock)}

            {/* Builder link handler — opens external links in new tab, allows internal nav */}
            <BuilderLinkScripts />
        </AppShell>
    )
}
