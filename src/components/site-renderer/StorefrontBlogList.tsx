'use client'

import { useEffect, useState, useRef } from 'react'

interface BlogPost {
    id: string
    title: string
    slug: string
    excerpt: string
    date: string
    category: string | null
    categorySlug: string | null
    image: string | null
}

interface StorefrontBlogListProps {
    tenantId: string
    /** Site base path ('' on subdomain/custom, '/sites/<slug>' on local). */
    siteBasePath?: string
    /** @deprecated use siteBasePath */
    tenantSlug?: string
}

const POSTS_PER_PAGE = 12

export function StorefrontBlogList({ tenantId, siteBasePath, tenantSlug }: StorefrontBlogListProps) {
    const [posts, setPosts] = useState<BlogPost[]>([])
    const [totalDocs, setTotalDocs] = useState(0)
    const [page, setPage] = useState(1)
    const [activeCategory, setActiveCategory] = useState<string | null>(null)
    const [categories, setCategories] = useState<{ name: string; slug: string }[]>([])
    const [loading, setLoading] = useState(true)
    const [searchInput, setSearchInput] = useState('')
    const [search, setSearch] = useState('')

    // BUG-F05-06: build blog links using server-provided site base path.
    // Falls back to tenantSlug for backward compatibility with older callers.
    const basePath = typeof siteBasePath === 'string'
        ? siteBasePath
        : tenantSlug ? `/sites/${tenantSlug}` : ''
    const blogBasePath = `${basePath}/blogs`

    // Restore scroll position when returning from blog detail
    useEffect(() => {
        const saved = sessionStorage.getItem('blog-list-scroll')
        if (saved) {
            setTimeout(() => window.scrollTo(0, parseInt(saved)), 100)
            sessionStorage.removeItem('blog-list-scroll')
        }
    }, [])

    // Debounce search input by 300ms
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput.trim())
            setPage(1)
        }, 300)
        return () => clearTimeout(timer)
    }, [searchInput])

    // Fetch categories once
    useEffect(() => {
        fetch(`/api/storefront/blogs?tenant=${tenantId}&limit=100`)
            .then(res => res.json())
            .then(json => {
                const cats = new Map<string, string>()
                for (const doc of json.docs || []) {
                    const catName = typeof doc.category === 'object' ? doc.category?.name : null
                    const catSlug = typeof doc.category === 'object' ? doc.category?.slug : null
                    if (catName && catSlug) cats.set(catSlug, catName)
                }
                setCategories(Array.from(cats.entries()).map(([slug, name]) => ({ slug, name })))
            })
            .catch(() => {})
    }, [tenantId])

    // Fetch posts with pagination + category filter + search
    useEffect(() => {
        setLoading(true)
        const params = new URLSearchParams({
            tenant: tenantId,
            limit: String(POSTS_PER_PAGE),
            page: String(page),
            sort: '-createdAt',
        })
        if (activeCategory) params.set('category', activeCategory)
        if (search) params.set('search', search)

        fetch(`/api/storefront/blogs?${params}`)
            .then(res => res.json())
            .then(json => {
                const docs = json.docs || []
                setPosts(docs.map((doc: any) => {
                    const thumbUrl = typeof doc.thumbnail === 'object' ? doc.thumbnail?.url : null
                    const catName = typeof doc.category === 'object' ? doc.category?.name : null
                    const catSlug = typeof doc.category === 'object' ? doc.category?.slug : null
                    const publishDate = doc.publishedAt || doc.createdAt
                    const content = typeof doc.content === 'string' ? doc.content : ''
                    const text = content.replace(/<[^>]*>/g, '').trim()

                    return {
                        id: String(doc.id),
                        title: doc.title || 'Untitled',
                        slug: doc.slug || '',
                        excerpt: text.length > 120 ? text.substring(0, 117) + '...' : text,
                        date: publishDate ? new Date(publishDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
                        category: catName,
                        categorySlug: catSlug,
                        image: thumbUrl,
                    }
                }))
                setTotalDocs(json.totalDocs || 0)
            })
            .catch(err => console.error('[StorefrontBlogList]', err))
            .finally(() => setLoading(false))
    }, [tenantId, page, activeCategory, search])

    const totalPages = Math.ceil(totalDocs / POSTS_PER_PAGE)

    if (loading && posts.length === 0) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse rounded-2xl overflow-hidden border border-white/5">
                        <div className="aspect-[4/3] bg-white/5" />
                        <div className="p-6 space-y-3">
                            <div className="h-4 w-20 bg-white/5 rounded" />
                            <div className="h-6 w-full bg-white/5 rounded" />
                            <div className="h-4 w-3/4 bg-white/5 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (!loading && posts.length === 0) {
        return (
            <div className="text-center py-20">
                <div className="text-5xl mb-4 opacity-20">📝</div>
                <h3 className="text-xl font-semibold mb-2">No published posts yet</h3>
                <p className="text-sm opacity-60">Check back soon for new content!</p>
            </div>
        )
    }

    return (
        <div>
            {/* Search */}
            <div className="mb-6">
                <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search posts..."
                    className="w-full md:w-80 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                />
            </div>

            {/* Category filter tabs */}
            {categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-10">
                    <button
                        onClick={() => { setActiveCategory(null); setPage(1) }}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                            !activeCategory ? 'bg-blue-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                    >
                        All
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat.slug}
                            onClick={() => { setActiveCategory(cat.slug); setPage(1) }}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                                activeCategory === cat.slug ? 'bg-blue-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Blog grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {posts.map(post => (
                    <a
                        key={post.id}
                        href={`${blogBasePath}/${post.slug}`}
                        onClick={() => sessionStorage.setItem('blog-list-scroll', String(window.scrollY))}
                        className="group rounded-2xl overflow-hidden border border-white/5 hover:border-white/15 transition-all hover:shadow-2xl"
                    >
                        <div className="relative aspect-[4/3] bg-white/5 overflow-hidden">
                            {post.image ? (
                                <img src={post.image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-4xl opacity-10">📝</div>
                            )}
                            {post.category && (
                                <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold bg-black/50 backdrop-blur-md text-white border border-white/10">
                                    {post.category}
                                </span>
                            )}
                        </div>
                        <div className="p-6">
                            <span className="text-xs opacity-50">{post.date}</span>
                            <h3 className="text-lg font-bold mt-2 mb-3 group-hover:text-blue-400 transition-colors line-clamp-2">{post.title}</h3>
                            <p className="text-sm opacity-60 line-clamp-2">{post.excerpt}</p>
                            <span className="inline-block mt-4 text-sm font-semibold text-blue-400">
                                Read more →
                            </span>
                        </div>
                    </a>
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-12">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        ← Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <button
                            key={p}
                            onClick={() => setPage(p)}
                            className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                                p === page ? 'bg-blue-500 text-white' : 'bg-white/5 hover:bg-white/10'
                            }`}
                        >
                            {p}
                        </button>
                    ))}
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-4 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    )
}
