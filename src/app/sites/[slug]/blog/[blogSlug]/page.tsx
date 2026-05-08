import { cache } from 'react'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import DOMPurify from 'isomorphic-dompurify'
import { getServerI18n } from '@/i18n/server'
import { getSiteBasePath } from '@/lib/site-base-path'
import { getCurrentUser } from '@/lib/auth'
import type { TenantMembership } from '@/lib/normalize-tenants'
import { SiteLayoutShell } from '@/components/site-renderer/SiteLayoutShell'
import type { NavPage, SiteRendererProps } from '@/components/site-renderer/SiteRenderer'

export const dynamic = 'force-dynamic'

type Props = {
    params: Promise<{ slug: string; blogSlug: string }>
}

const getSiteAndPost = cache(async function getSiteAndPost(tenantSlug: string, blogSlug: string) {
    const payload = await getPayload({ config })

    const tenantsResult = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: tenantSlug } },
        limit: 1,
    })
    const tenant = tenantsResult.docs[0]
    if (!tenant) return null

    const sitesResult = await payload.find({
        collection: 'sites',
        where: {
            and: [
                { tenant: { equals: tenant.id } },
                { status: { equals: 'published' } },
            ],
        },
        limit: 1,
    })
    const site = sitesResult.docs[0]
    if (!site) return null

    const blogsResult = await payload.find({
        collection: 'blogs',
        where: {
            and: [
                { tenant: { equals: tenant.id } },
                { slug: { equals: blogSlug } },
                { status: { equals: 'published' } },
            ],
        },
        limit: 1,
        depth: 1,
    })
    const post = blogsResult.docs[0]
    if (!post) return null

    const pagesResult = await payload.find({
        collection: 'pages',
        where: {
            and: [
                { site: { equals: site.id } },
                { deletedAt: { exists: false } },
            ],
        },
        limit: 100,
        sort: 'createdAt',
    })

    return { tenant, site, post, pages: pagesResult.docs }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug, blogSlug } = await params
    const data = await getSiteAndPost(slug, blogSlug)
    if (!data) return { title: 'Post Not Found' }

    const seo = data.post.seo as Record<string, unknown> | undefined
    const siteName = data.site.name || 'Store'

    return {
        title: (seo?.metaTitle as string) || `${data.post.title} — ${siteName}`,
        description: (seo?.metaDescription as string) || `Read ${data.post.title} on ${siteName}`,
        openGraph: {
            title: (seo?.metaTitle as string) || (data.post.title as string),
            description: (seo?.metaDescription as string) || undefined,
        },
    }
}

export default async function BlogDetailPage({ params }: Props) {
    const { slug, blogSlug } = await params
    const data = await getSiteAndPost(slug, blogSlug)
    if (!data) notFound()

    const { t } = await getServerI18n()
    const base = await getSiteBasePath(slug)
    const { tenant, site, post, pages } = data

    const primaryColor = (site.theme as { primaryColor?: string } | undefined)?.primaryColor || '#0ea5e9'
    const thumbnail = typeof post.thumbnail === 'object' && post.thumbnail
        ? (post.thumbnail as Record<string, unknown>).url as string
        : null
    const category = typeof post.category === 'object' && post.category
        ? (post.category as Record<string, unknown>).name as string
        : null
    const author = typeof post.author === 'object' && post.author
        ? ([(post.author as any).firstName, (post.author as any).lastName].filter(Boolean).join(' '))
          || ((post.author as Record<string, unknown>).email as string) || null
        : null
    const publishedAt = post.publishedAt
        ? new Date(post.publishedAt as string).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
        })
        : null

    const user = await getCurrentUser()
    const isOwner = !!user && (user.tenants?.map((t: TenantMembership) =>
        typeof t.tenant === 'object' ? String(t.tenant.id) : String(t.tenant)
    ) ?? []).includes(String(tenant.id))

    const siteWithContext = { ...site, tenantSlug: slug, siteBasePath: base }

    return (
        <SiteLayoutShell
            site={siteWithContext as SiteRendererProps['site']}
            pages={pages as unknown as NavPage[]}
            isOwner={isOwner}
        >
            <article className="max-w-3xl mx-auto px-4 py-8">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-sm opacity-60 mb-8">
                    <Link href={base || '/'} className="hover:opacity-100 transition-opacity">
                        {t.storefront.products.home}
                    </Link>
                    <span>/</span>
                    <Link href={`${base}/blog`} className="hover:opacity-100 transition-opacity">
                        {t.storefront.blog.title}
                    </Link>
                    <span>/</span>
                    <span className="opacity-80 truncate">{post.title as string}</span>
                </nav>

                {/* Category */}
                {category && (
                    <span
                        className="text-xs font-medium px-3 py-1 rounded-full inline-block mb-4"
                        style={{ color: primaryColor, backgroundColor: `${primaryColor}20` }}
                    >
                        {category}
                    </span>
                )}

                {/* Title */}
                <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight" style={{ fontFamily: 'var(--font-heading)' }}>
                    {post.title as string}
                </h1>

                {/* Meta */}
                <div className="flex items-center gap-3 text-sm opacity-50 mb-8">
                    {author && <span>By {author}</span>}
                    {author && publishedAt && <span>·</span>}
                    {publishedAt && <span>{publishedAt}</span>}
                </div>

                {/* Featured Image */}
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

                {/* Content */}
                <div
                    className="prose prose-lg max-w-none
                        prose-headings:font-bold
                        prose-a:underline
                        prose-blockquote:border-l-4
                        prose-code:px-1 prose-code:rounded
                        prose-img:rounded-xl"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(typeof post.content === 'string' ? post.content : '') }}
                />

                {/* Back to Blog */}
                <div className="mt-12 pt-8 border-t border-current/10">
                    <Link
                        href={`${base}/blog`}
                        className="text-sm font-medium hover:opacity-80 transition-opacity"
                        style={{ color: primaryColor }}
                    >
                        {t.storefront.blog.backToBlog}
                    </Link>
                </div>
            </article>
        </SiteLayoutShell>
    )
}
