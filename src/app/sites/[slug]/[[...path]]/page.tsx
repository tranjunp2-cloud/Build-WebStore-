import Link from 'next/link'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import { getCurrentUser } from '@/lib/auth'
import config from '@payload-config'
import type { Metadata } from 'next'
import { SiteRenderer, type NavPage } from '@/components/site-renderer/SiteRenderer'
import { MaintenancePage } from '@/components/site-renderer/MaintenancePage'
import type { SiteData } from '@/blocks/types'
import type { PageData } from '@/store/editorStore'
import { StorefrontBlogList } from '@/components/site-renderer/StorefrontBlogList'
import DOMPurify from 'isomorphic-dompurify'
import { getServerI18n } from '@/i18n/server'
import { getSiteBasePath } from '@/lib/site-base-path'
import { resolveImageLibraryS3Map } from '@/lib/images/image-library-resolver'

// Force dynamic — uses getPayload() + SiteRenderer (jsdom chain) at runtime
export const dynamic = 'force-dynamic'

type Props = {
    params: Promise<{ slug: string; path?: string[] }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

async function getTenantAndPage(slug: string, pagePath: string) {
    const reqHeaders = await headers()
    const payload = await getPayload({ config })
    const user = await getCurrentUser()

    let tenant;

    /* REQ-F19: Resolve custom domain route */
    if (slug === 'custom') {
        const hostname = reqHeaders.get('x-tenant-hostname')
        if (!hostname) return null
        
        const tenantsResult = await payload.find({
            collection: 'tenants',
            where: { 'customDomains.domain': { equals: hostname } },
            limit: 1,
        })
        tenant = tenantsResult.docs[0]
    } else {
        // Find tenant by subdomain slug
        const tenantsResult = await payload.find({
            collection: 'tenants',
            where: { slug: { equals: slug } },
            limit: 1,
        })
        tenant = tenantsResult.docs[0]
    }

    if (!tenant) return null

    // Find the site for this tenant
    const sitesResult = await payload.find({
        collection: 'sites',
        where: { tenant: { equals: tenant.id } },
        limit: 1,
    })

    const site = sitesResult.docs[0]
    if (!site) return null

    // Check ownership (used for draft gate + tracking skip)
    interface TenantRef {
        tenant: string | number | { id: string | number }
    }

    const isOwner = !!user && (user.tenants?.map((t: TenantRef) =>
        typeof t.tenant === 'object' ? String(t.tenant.id) : String(t.tenant)
    ) ?? []).includes(String(tenant.id))

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
    const visibilityFilter = !isOwner ? [{ isVisible: { not_equals: false } }] : []
    const deletedFilter = [{ deletedAt: { exists: false } }]
    const pagesResult = await payload.find({
        collection: 'pages',
        where: {
            and: [
                { site: { equals: site.id } },
                { slug: { equals: pageSlug } },
                ...visibilityFilter,
                ...deletedFilter,
            ],
        },
        limit: 1,
        depth: 3,
        draft: isOwner && site.status !== 'published' ? true : false,
    })

    let page = pagesResult.docs[0]

    // Fallback: homepage may have slug 'home' (legacy) — match by isHomepage flag
    if (!page && pagePath === '') {
        const homepageFallback = await payload.find({
            collection: 'pages',
            where: {
                and: [
                    { site: { equals: site.id } },
                    { isHomepage: { equals: true } },
                    ...visibilityFilter,
                    ...deletedFilter,
                ],
            },
            limit: 1,
            depth: 3,
            draft: isOwner && site.status !== 'published' ? true : false,
        })
        page = homepageFallback.docs[0]
    }

    // Fetch ALL pages (including hidden/deleted) so SiteRenderer can build hiddenSlugs
    // and filter nav links client-side. Visibility/404 enforcement is handled above
    // on the current-page lookup; passing partial data here would break the filter.
    const navigationPages = await payload.find({
        collection: 'pages',
        where: {
            and: [
                { site: { equals: site.id } },
            ],
        },
        limit: 100,
        sort: 'createdAt',
    })

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
                depth: 2,
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
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug, path } = await params
    const pagePath = (path ?? []).join('/')
    const data = await getTenantAndPage(slug, pagePath)

    if (!data) return { title: 'Not Found', robots: { index: false, follow: false } }
    if ('maintenance' in data && data.maintenance) {
        return { title: 'Maintenance', robots: { index: false, follow: false } }
    }

    const { site, page } = data
    const blogPost = 'blogPost' in data ? data.blogPost : null

    const title = blogPost?.seo?.metaTitle || blogPost?.title || page?.seo?.title || site.seo?.metaTitle || site.name
    const description = blogPost?.seo?.metaDescription || page?.seo?.description || site.seo?.metaDescription
    type BlogMedia = { url?: string }
    const blogThumb = blogPost ? (blogPost as unknown as { thumbnail?: BlogMedia | string }).thumbnail : null
    const ogImage = blogThumb && typeof blogThumb === 'object' ? blogThumb.url ?? null : null

    // Resolve canonical URL from middleware-injected headers
    const reqHeaders = await headers()
    const tenantHostname = reqHeaders.get('x-tenant-hostname')
    const tenantSlug = reqHeaders.get('x-tenant-slug')
    const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'primeweb.app'

    let baseUrl: string
    if (tenantHostname) {
        baseUrl = `https://${tenantHostname}`
    } else if (tenantSlug) {
        baseUrl = `https://${tenantSlug}.${PLATFORM_DOMAIN}`
    } else if (slug !== 'custom') {
        baseUrl = `https://${slug}.${PLATFORM_DOMAIN}`
    } else {
        baseUrl = ''
    }

    const canonicalPath = pagePath ? `/${pagePath}` : ''
    const canonical = baseUrl ? `${baseUrl}${canonicalPath}` : undefined

    return {
        title,
        description,
        alternates: canonical ? { canonical } : undefined,
        openGraph: {
            title: title ?? undefined,
            description: description ?? undefined,
            type: blogPost ? 'article' : 'website',
            ...(canonical ? { url: canonical } : {}),
            ...(ogImage ? { images: [{ url: ogImage }] } : {}),
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
        const authorName = typeof post.author === 'object'
            ? [post.author?.firstName, post.author?.lastName].filter(Boolean).join(' ') || post.author?.email
            : null
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
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
                        className="prose prose-lg prose-invert max-w-none"
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

    const { site, page, pages, isOwner } = data

    // GH-727 Phase 03: resolve seeded IMAGE_LIBRARY → S3 mappings (best-effort, never throws).
    const payload = await getPayload({ config })
    const imageLibraryS3 = await resolveImageLibraryS3Map(payload, site.id)

    return (
        <SiteRenderer
            site={{ ...site, tenantSlug: slug, siteBasePath: base, imageLibraryS3 } as unknown as SiteData}
            page={page as unknown as PageData}
            pages={pages as unknown as NavPage[]}
            siteId={String(site.id)}
            isOwner={isOwner}
        />
    )
}
