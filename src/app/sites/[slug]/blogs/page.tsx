import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getServerI18n } from '@/i18n/server'

export const dynamic = 'force-dynamic'

type Props = {
    params: Promise<{ slug: string }>
}

async function getSiteAndBlogs(slug: string) {
    const payload = await getPayload({ config })

    const tenantsResult = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: slug } },
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
                { status: { equals: 'published' } },
            ],
        },
        sort: '-publishedAt',
        limit: 50,
        depth: 1,
    })

    return { tenant, site, blogs: blogsResult.docs }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const data = await getSiteAndBlogs(slug)
    if (!data) return { title: 'Blog' }

    const siteName = data.site.name || 'Store'
    return {
        title: `Blog — ${siteName}`,
        description: data.site.seo_meta_description || `Latest posts from ${siteName}`,
    }
}

export default async function BlogListingPage({ params }: Props) {
    const { slug } = await params
    const data = await getSiteAndBlogs(slug)
    if (!data) notFound()

    const { t } = await getServerI18n()
    const { site, blogs } = data
    const primaryColor = site.theme_primary_color || '#3B82F6'

    return (
        <div className="min-h-screen bg-[#0B1120]">
            {/* Header */}
            <div className="w-full border-b border-white/10 py-8">
                <div className="max-w-5xl mx-auto px-4">
                    <h1 className="text-3xl font-bold text-white">{t.storefront.blog.title}</h1>
                    <p className="text-gray-400 mt-2">{t.storefront.blog.latestPosts} {site.name}</p>
                </div>
            </div>

            {/* Blog Grid */}
            <div className="max-w-5xl mx-auto px-4 py-8">
                {blogs.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-gray-500 text-lg">{t.storefront.blog.noPosts}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {blogs.map((post: Record<string, unknown>) => {
                            const thumbnail = typeof post.thumbnail === 'object' && post.thumbnail
                                ? (post.thumbnail as Record<string, unknown>).url as string
                                : null
                            const category = typeof post.category === 'object' && post.category
                                ? (post.category as Record<string, unknown>).name as string
                                : null
                            const publishedAt = post.publishedAt
                                ? new Date(post.publishedAt as string).toLocaleDateString('en-US', {
                                    year: 'numeric', month: 'short', day: 'numeric',
                                })
                                : null

                            return (
                                <Link
                                    key={post.id as string}
                                    href={`/sites/${slug}/blogs/${post.slug}`}
                                    className="group flex flex-col rounded-xl border border-white/10 bg-[#111827] overflow-hidden hover:border-white/20 transition-colors"
                                >
                                    {/* Thumbnail */}
                                    {thumbnail ? (
                                        <div className="relative aspect-[16/9] overflow-hidden">
                                            <Image
                                                src={thumbnail}
                                                alt={post.title as string}
                                                fill
                                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                            />
                                        </div>
                                    ) : (
                                        <div className="aspect-[16/9] bg-white/5 flex items-center justify-center">
                                            <span className="text-gray-600 text-sm">No image</span>
                                        </div>
                                    )}

                                    {/* Content */}
                                    <div className="flex flex-col gap-2 p-4">
                                        {category && (
                                            <span
                                                className="text-xs font-medium px-2 py-0.5 rounded-full w-fit"
                                                style={{ color: primaryColor, backgroundColor: `${primaryColor}20` }}
                                            >
                                                {category}
                                            </span>
                                        )}
                                        <h2 className="text-white font-semibold text-lg line-clamp-2 group-hover:text-gray-200 transition-colors">
                                            {post.title as string}
                                        </h2>
                                        {publishedAt && (
                                            <span className="text-gray-500 text-xs">{publishedAt}</span>
                                        )}
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
