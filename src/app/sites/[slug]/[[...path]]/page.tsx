import { ScrollToTop } from '@/components/storefront/scroll-to-top'
import { localizedSiteAndPage, siteBrand } from '@/lib/i18n/locale-display'
import { getCachedPublishedTranslations, readPageTranslations } from '@/lib/i18n/page-translations'
import { siteLanguagesOf, VISITOR_LANGUAGE_COOKIE, visitorLanguage } from '@/lib/site-languages'
import { LiveLanguageProvider } from '@/components/site-renderer/live-language'
import Link from 'next/link'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { getPayload } from 'payload'
import { getCurrentUser } from '@/lib/auth'
import config from '@payload-config'
import type { Metadata } from 'next'
import { SiteRenderer, type NavPage } from '@/components/site-renderer/SiteRenderer'
import { MaintenancePage } from '@/components/site-renderer/MaintenancePage'
import { isCachedStoreUnavailable, storeUnavailableLocaleOf } from '@/lib/storefront/cached-store-availability'
import { STORE_UNAVAILABLE_COPY } from '@/lib/storefront/store-unavailable'
import type { SiteData } from '@/blocks/types'
import { publicAuthorName, toPublicDoc, toPublicSite } from '@/lib/storefront/public-site-dto'
import type { PageData } from '@/store/editorStore'
import { StorefrontBlogList } from '@/components/site-renderer/StorefrontBlogList'
import DOMPurify from 'isomorphic-dompurify'
import { getServerI18n } from '@/i18n/server'
import { getSiteBasePath } from '@/lib/site-base-path'
import { resolveImageLibraryS3Map, resolveImageLibraryS3MapCached } from '@/lib/images/image-library-resolver'
import { resolveStorefrontOrigin, type TenantLike } from '@/lib/seo/canonical'
import { serializeJsonLd } from '@/lib/seo/json-ld'
import { resolveMetadataImageUrl } from '@/lib/seo/metadata-image'
import {
    getCachedTenantBySlug,
    getCachedTenantByDomain,
    getCachedSiteByTenant,
    getCachedVisitorPage,
    getCachedVisitorHomepage,
    getCachedNavigationPages,
    STOREFRONT_POPULATE,
    withPublicSiteTenant,
    withPublicSiteTenants,
} from '@/lib/cache/tenant'
import { proseThemeVars } from '@/lib/theme/prose-theme'

// Force dynamic — reads headers() (custom-domain) + cookies (getCurrentUser) per
// request, so the route stays dynamic. Heavy Payload reads on the anonymous
// visitor path are served from unstable_cache (5-min TTL, tag-invalidated on
// publish/edit); the owner-preview path stays uncached to show live drafts.
export const dynamic = 'force-dynamic'

type Props = {
    params: Promise<{ slug: string; path?: string[] }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * One resolution per request: `generateMetadata` and the page both call this, and React `cache()` makes the second
 * call reuse the first (owner previews and blog posts are uncached reads, so they ran twice per view) (TC-PERF-062).
 */
const getTenantAndPage = cache(async (slug: string, pagePath: string) => {
    const reqHeaders = await headers()
    const payload = await getPayload({ config })
    const user = await getCurrentUser()

    let tenant;

    /* REQ-F19: Resolve custom domain route */
    if (slug === 'custom') {
        const hostname = reqHeaders.get('x-tenant-hostname')
        if (!hostname) return null
        // Cached identity lookup (depth:0) — only tenant.id is consumed below.
        tenant = await getCachedTenantByDomain(hostname)
    } else {
        // Find tenant by subdomain slug (cached).
        tenant = await getCachedTenantBySlug(slug)
    }

    if (!tenant) return null

    // #2179: banned or expired store → unavailable page for everyone, owner included (the middleware serves the
    // real 503; this is the fallback when its lookup failed or the site is opened at /sites/<slug> directly).
    if (await isCachedStoreUnavailable(tenant as { id: string | number; status?: unknown })) {
        return { unavailable: true as const, locale: await storeUnavailableLocaleOf(tenant.id) }
    }

    // Check ownership (used for draft gate + tracking skip + cache gating).
    // Computed before the site/page reads so the owner-preview path can opt out
    // of the published-only cache and see live drafts.
    interface TenantRef {
        tenant: string | number | { id: string | number }
    }

    const isOwner = !!user && (user.tenants?.map((t: TenantRef) =>
        typeof t.tenant === 'object' ? String(t.tenant.id) : String(t.tenant)
    ) ?? []).includes(String(tenant.id))

    // Find the site for this tenant.
    // Owner → live (uncached) so just-saved drafts/settings show immediately.
    // Visitor → cached published view (5-min TTL, tag-invalidated on publish/edit).
    const site = isOwner
        ? (await payload.find({
            collection: 'sites',
            where: { tenant: { equals: tenant.id } },
            limit: 1,
            pagination: false,
            populate: STOREFRONT_POPULATE,
        })).docs[0]
        : await getCachedSiteByTenant(String(tenant.id))

    if (!site) return null

    // Require authentication to view draft sites
    if (site.status === 'draft') {
        if (!isOwner) {
            // AC-3: Was published → maintenance mode (503); never published → 404
            if (site.publishedAt) {
                return { tenant, site, page: null, pages: [], maintenance: true, isOwner: false }
            }
            return null // Never published → 404
        }
    }

    // Find the page by slug
    const pageSlug = pagePath === '' ? '/' : `/${pagePath}`

    // BUG-F05-01: explicitly fetch published versions for live site.
    // Editor saves with draft:true; publish route promotes to published.
    // Owner previewing unpublished site sees drafts; visitors see published.
    // BUG-F05-08: hide pages with isVisible=false from visitors (owner can still access per spec)
    // BUG-F05-11: exclude soft-deleted pages (deletedAt set) from live site
    let page
    if (isOwner) {
        // Owner path stays uncached + draft-aware. No visibility filter (owners
        // can open hidden pages); soft-deleted pages still excluded.
        const deletedFilter = [{ deletedAt: { exists: false } }]
        const ownerDraft = site.status !== 'published'
        const pagesResult = await payload.find({
            collection: 'pages',
            where: { and: [{ site: { equals: site.id } }, { slug: { in: [pageSlug, pageSlug.replace(/^\//, '')] } }, ...deletedFilter] },
            limit: 1,
            pagination: false,
            depth: 3,
            draft: ownerDraft,
            populate: STOREFRONT_POPULATE,
        })
        page = withPublicSiteTenant(pagesResult.docs[0])
        // Fallback: homepage may have slug 'home' (legacy) — match by isHomepage flag
        if (!page && pagePath === '') {
            const homepageFallback = await payload.find({
                collection: 'pages',
                where: { and: [{ site: { equals: site.id } }, { isHomepage: { equals: true } }, ...deletedFilter] },
                limit: 1,
                pagination: false,
                depth: 3,
                draft: ownerDraft,
                populate: STOREFRONT_POPULATE,
            })
            page = withPublicSiteTenant(homepageFallback.docs[0])
        }
    } else {
        // Visitor path: cached, published + visible + non-deleted (filters mirrored
        // inside the cache helpers). Same result as the uncached query, just cached.
        page = await getCachedVisitorPage(String(site.id), pageSlug)
        if (!page && pagePath === '') {
            page = await getCachedVisitorHomepage(String(site.id))
        }
    }

    // Fetch ALL pages (including hidden/deleted) so SiteRenderer can build hiddenSlugs
    // and filter nav links client-side. Visibility/404 enforcement is handled above
    // on the current-page lookup; passing partial data here would break the filter.
    const navigationPages = isOwner
        ? await payload.find({
            collection: 'pages',
            where: { and: [{ site: { equals: site.id } }] },
            limit: 100,
            pagination: false,
            sort: 'createdAt',
            populate: STOREFRONT_POPULATE,
        }).then((result) => ({ docs: withPublicSiteTenants(result.docs) }))
        : { docs: await getCachedNavigationPages(String(site.id)) }

    // Blog listing page: /blogs or /blogs?category=X&page=N
    if (!page && pagePath === 'blogs') {
        return { tenant, site, page: null, pages: navigationPages.docs, blogListing: true, isOwner }
    }

    // Blog detail page: /blogs/{slug}
    if (!page && pagePath.startsWith('blogs/')) {
        const blogSlug = pagePath.replace('blogs/', '')
        if (blogSlug) {
            const blogResult = await payload.find({
                collection: 'blogs',
                where: {
                    and: [
                        { tenant: { equals: tenant.id } },
                        { slug: { equals: blogSlug } },
                        { status: { equals: 'published' } },
                    ],
                },
                limit: 1,
                pagination: false,
                depth: 2,
                populate: STOREFRONT_POPULATE,
            })
            const blogPost = blogResult.docs[0]
            if (blogPost) {
                return { tenant, site, page: null, pages: navigationPages.docs, blogPost, isOwner }
            }
            // Explicit 404 for missing/unpublished blog post
            notFound()
        }
    }

    return { tenant, site, page, pages: navigationPages.docs, isOwner }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug, path } = await params
    const pagePath = (path ?? []).join('/')
    const data = await getTenantAndPage(slug, pagePath)

    if (!data) return { title: 'Not Found', robots: { index: false, follow: false } }
    if ('unavailable' in data && data.unavailable) {
        return { title: STORE_UNAVAILABLE_COPY[data.locale ?? 'en'].title, robots: { index: false, follow: false } }
    }
    if ('maintenance' in data && data.maintenance) {
        return { title: 'Maintenance', robots: { index: false, follow: false } }
    }

    const { site, page } = data
    const blogPost = 'blogPost' in data ? data.blogPost : null

    const title = blogPost?.seo?.metaTitle || blogPost?.title || page?.seo?.title || site.seo?.metaTitle || site.name
    const description = blogPost?.seo?.metaDescription || page?.seo?.description || site.seo?.metaDescription
    const blogThumb = blogPost ? (blogPost as unknown as { thumbnail?: unknown }).thumbnail : null
    const ogImage = resolveMetadataImageUrl(
        blogThumb,
        page?.seo?.ogImage,
        site.seo?.ogImage,
        site.branding?.logo,
    )

    // Resolve canonical URL — prefer primary custom domain, then middleware header, then subdomain
    const reqHeaders = await headers()
    const tenantHostname = reqHeaders.get('x-tenant-hostname')
    const baseUrl = resolveStorefrontOrigin(data.tenant as unknown as TenantLike, { fallbackHostname: tenantHostname, slug })

    const canonicalPath = pagePath ? `/${pagePath}` : ''
    const canonical = baseUrl ? `${baseUrl}${canonicalPath}` : undefined

    const rawGoogleVerification = (site.seo as { googleVerificationToken?: unknown } | undefined)?.googleVerificationToken
    const googleVerification = typeof rawGoogleVerification === 'string'
        ? rawGoogleVerification.trim().replace(/^google-site-verification=/i, '') || undefined
        : undefined

    const DEFAULT_FAVICON = '/favicon.ico'
    const faviconUrl = (site.branding as { favicon?: string } | undefined)?.favicon || DEFAULT_FAVICON

    return {
        title,
        description,
        icons: { icon: faviconUrl },
        verification: googleVerification ? { google: googleVerification } : undefined,
        alternates: canonical ? { canonical } : undefined,
        openGraph: {
            title: title ?? undefined,
            description: description ?? undefined,
            type: blogPost ? 'article' : 'website',
            ...(canonical ? { url: canonical } : {}),
            ...(ogImage ? { images: [{ url: ogImage }] } : {}),
        },
        twitter: {
            card: 'summary_large_image',
            title: title ?? undefined,
            description: description ?? undefined,
            ...(ogImage ? { images: [ogImage] } : {}),
        },
        robots: page?.seo?.noIndex ? { index: false, follow: false } : undefined,
    }
}

export default async function TenantSitePage({ params }: Props) {
    const { slug, path } = await params
    const pagePath = (path ?? []).join('/')
    const data = await getTenantAndPage(slug, pagePath)

    if (!data) {
        notFound()
    }

    if ('unavailable' in data && data.unavailable) {
        return <MaintenancePage variant="unavailable" locale={data.locale ?? 'en'} />
    }

    const { t } = await getServerI18n()
    const base = await getSiteBasePath(slug)

    // AC-3: Maintenance mode — was published, now draft
    if ('maintenance' in data && data.maintenance) {
        return <MaintenancePage siteName={data.site?.name as string} />
    }

    // Blog listing page — /blogs
    if ('blogListing' in data && data.blogListing) {
        const { tenant, site } = data
        return (
            <div className="min-h-screen bg-[#0B1120] text-white">
                <div className="max-w-5xl mx-auto px-6 py-16">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">{t.storefront.blog.title}</h1>
                    <p className="text-lg opacity-60 mb-12">{t.storefront.blog.latestStories}</p>
                    <StorefrontBlogList tenantId={String(tenant.id)} siteBasePath={base} />
                </div>
            </div>
        )
    }

    // Blog detail page — render published blog post
    if ('blogPost' in data && data.blogPost) {
        const { blogPost } = data
        type BlogPost = {
            title?: string; slug?: string; content?: string; status?: string
            publishedAt?: string; createdAt?: string; updatedAt?: string
            thumbnail?: { url?: string } | string
            category?: { name?: string } | string
            author?: { firstName?: string; lastName?: string; email?: string } | string
            seo?: { metaTitle?: string; metaDescription?: string }
        }
        const post = blogPost as BlogPost
        const thumbUrl = typeof post.thumbnail === 'object' ? post.thumbnail?.url : null
        const catName = typeof post.category === 'object' ? post.category?.name : null
        const authorName = publicAuthorName(post.author)
        const publishDate = post.publishedAt || post.createdAt

        const jsonLd = {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: post.title,
            ...(thumbUrl && { image: thumbUrl }),
            ...(publishDate && { datePublished: new Date(publishDate).toISOString() }),
            ...(post.updatedAt && { dateModified: new Date(post.updatedAt).toISOString() }),
            ...(authorName && { author: { '@type': 'Person', name: authorName } }),
            ...(post.seo?.metaDescription && { description: post.seo.metaDescription }),
        }

        return (
            <div className="min-h-screen bg-[#0B1120] text-white">
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
                <article className="max-w-3xl mx-auto px-6 py-16">
                    {catName && (
                        <span className="text-sm font-bold uppercase tracking-wider text-blue-500 mb-4 block">{catName}</span>
                    )}
                    <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">{post.title}</h1>
                    <div className="flex items-center gap-4 text-sm opacity-60 mb-8">
                        {authorName && <span>By {authorName}</span>}
                        {publishDate && (
                            <time dateTime={publishDate}>
                                {new Date(publishDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </time>
                        )}
                    </div>
                    {thumbUrl && (
                        <div className="rounded-2xl overflow-hidden mb-10 aspect-video bg-white/5 flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={thumbUrl}
                                alt={post.title}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}
                    <div
                        className="prose prose-lg max-w-none"
                        style={proseThemeVars}
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(typeof post.content === 'string' ? post.content : '') }}
                    />
                    <div className="mt-16 pt-8 border-t border-white/10">
                        <Link href={`${base}/blogs`} className="text-blue-500 hover:text-blue-400 font-medium">
                            {t.storefront.blog.backToAll}
                        </Link>
                    </div>
                </article>
            </div>
        )
    }

    if (!data.page) {
        notFound()
    }

    const { pages, isOwner } = data
    // visitors get the site's primary language (Menu → Quick language): the pages as written plus
    // that language's published copy — an owner looking at a site not yet live reads the draft one
    // (release: Payload documents are untyped here, so the site's fields are named for the language helpers)
    const siteDoc = data.site as unknown as Parameters<typeof siteLanguagesOf>[0] & Parameters<typeof localizedSiteAndPage>[0] & { id: string | number; status?: unknown; name?: unknown }
    const draft = isOwner && siteDoc.status !== 'published'
    const slots = draft
        ? await readPageTranslations(data.page.id, 'draft')
        : await getCachedPublishedTranslations(String(siteDoc.id), data.page.id)
    // ...or the language the visitor chose in the menu's language switcher, when the site has it
    const languages = siteLanguagesOf(siteDoc, draft ? 'edited' : 'live')
    const language = visitorLanguage(languages, (await cookies()).get(VISITOR_LANGUAGE_COOKIE)?.value)
    const { site, page } = localizedSiteAndPage(siteDoc, data.page as unknown as { layout?: unknown }, language, slots, siteBrand(siteDoc))

    // GH-727 Phase 03: resolve seeded IMAGE_LIBRARY → S3 mappings (best-effort, never throws).
    const payload = await getPayload({ config })
    const imageLibraryS3 = isOwner
        ? await resolveImageLibraryS3Map(payload, site.id)
        : await resolveImageLibraryS3MapCached(payload, site.id)

    const tenantHostname = (await headers()).get('x-tenant-hostname')
    const origin = resolveStorefrontOrigin(data.tenant as unknown as TenantLike, { fallbackHostname: tenantHostname, slug })

    return (
        <>
        <ScrollToTop />
        <LiveLanguageProvider languages={languages} active={language}>
            <SiteRenderer
                site={toPublicSite({ ...site, domain: origin, tenantSlug: slug, siteBasePath: base, imageLibraryS3 }) as unknown as SiteData}
                page={toPublicDoc(page) as unknown as PageData}
                pages={toPublicDoc(pages) as unknown as NavPage[]}
                siteId={String(site.id)}
                isOwner={isOwner}
            />
        </LiveLanguageProvider>
        </>
    )
}
