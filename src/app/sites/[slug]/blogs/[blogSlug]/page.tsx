import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import DOMPurify from 'isomorphic-dompurify'
import { getServerI18n } from '@/i18n/server'

export const dynamic = 'force-dynamic'

type Props = {
    params: Promise<{ slug: string; blogSlug: string }>
}

async function getSiteAndPost(tenantSlug: string, blogSlug: string) {
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
                { site: { equals: site.id } },
                { slug: { equals: blogSlug } },
                { status: { equals: 'published' } },
            ],
        },
        limit: 1,
        depth: 1,
    })
    const post = blogsResult.docs[0]
    if (!post) return null

    return { tenant, site, post }
}

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
    const { site, post } = data
    const primaryColor = site.theme_primary_color || '#3B82F6'
    const thumbnail = typeof post.thumbnail === 'object' && post.thumbnail
        ? (post.thumbnail as Record<string, unknown>).url as string
        : null
    const category = typeof post.category === 'object' && post.category
        ? (post.category as Record<string, unknown>).name as string
        : null
    const author = typeof post.author === 'object' && post.author
        ? ((post.author as Record<string, unknown>).name as string) || ((post.author as Record<string, unknown>).email as string)
        : null
    const publishedAt = post.publishedAt
        ? new Date(post.publishedAt as string).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
        })
        : null

    return (
        <div className="min-h-screen bg-[#0B1120]">
            <article className="max-w-3xl mx-auto px-4 py-8">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
                    <Link href={`/sites/${slug}`} className="hover:text-gray-300 transition-colors">
                        {t.storefront.products.home}
                    </Link>
                    <span>/</span>
                    <Link href={`/sites/${slug}/blogs`} className="hover:text-gray-300 transition-colors">
                        {t.storefront.blog.title}
                    </Link>
                    <span>/</span>
                    <span className="text-gray-400 truncate">{post.title as string}</span>
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
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
                    {post.title as string}
                </h1>

                {/* Meta */}
                <div className="flex items-center gap-3 text-sm text-gray-500 mb-8">
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
                    className="prose prose-invert prose-lg max-w-none
                        prose-headings:text-white prose-p:text-gray-300
                        prose-a:text-blue-400 prose-strong:text-white
                        prose-blockquote:border-blue-500 prose-blockquote:text-gray-400
                        prose-code:text-teal-400 prose-code:bg-white/5 prose-code:px-1 prose-code:rounded
                        prose-img:rounded-xl"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content as string) }}
                />

                {/* Back to Blog */}
                <div className="mt-12 pt-8 border-t border-white/10">
                    <Link
                        href={`/sites/${slug}/blogs`}
                        className="text-sm font-medium hover:opacity-80 transition-opacity"
                        style={{ color: primaryColor }}
                    >
                        {t.storefront.blog.backToBlog}
                    </Link>
                </div>
            </article>
        </div>
    )
}
