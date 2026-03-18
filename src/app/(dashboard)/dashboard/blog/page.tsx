'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    Plus,
    Search,
    Trash2,
    MoreHorizontal,
    FileText,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
    Tag,
} from 'lucide-react'

type BlogPost = {
    id: string
    title: string
    slug: string
    status: 'draft' | 'published'
    author: { name?: string; email: string } | string
    category: { name: string; id: string } | string | null
    createdAt: string
    updatedAt: string
}

type BlogCategory = {
    id: string
    name: string
}

type BlogMeta = {
    totalDocs: number
    totalPages: number
    page: number
    limit: number
    hasPrevPage: boolean
    hasNextPage: boolean
}

export default function BlogListPage() {
    const router = useRouter()
    const [posts, setPosts] = useState<BlogPost[]>([])
    const [meta, setMeta] = useState<BlogMeta | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<'' | 'draft' | 'published'>('')
    const [page, setPage] = useState(1)
    const [sortBy, setSortBy] = useState('-createdAt')
    const [categoryFilter, setCategoryFilter] = useState('')
    const [categories, setCategories] = useState<BlogCategory[]>([])
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [bulkActionLoading, setBulkActionLoading] = useState(false)

    const fetchPosts = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams()
            if (search) params.set('search', search)
            if (statusFilter) params.set('status', statusFilter)
            if (categoryFilter) params.set('category', categoryFilter)
            params.set('page', String(page))
            params.set('sort', sortBy)

            const res = await fetch(`/api/blogs?${params.toString()}`, {
                credentials: 'include',
            })
            if (!res.ok) throw new Error('Failed to fetch blog posts')

            const json = await res.json()
            setPosts(json.data || [])
            setMeta(json.meta || null)
        } catch (err: any) {
            setError(err.message || 'Something went wrong')
        } finally {
            setLoading(false)
        }
    }, [search, statusFilter, categoryFilter, sortBy, page])

    useEffect(() => {
        fetchPosts()
    }, [fetchPosts])

    // Fetch categories for filter dropdown
    useEffect(() => {
        fetch('/api/blog-categories', { credentials: 'include' })
            .then((r) => r.json())
            .then((json) => setCategories(json.data || []))
            .catch(() => { })
    }, [])

    // Reset page when filters change
    useEffect(() => {
        setPage(1)
    }, [search, statusFilter, categoryFilter, sortBy])

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to permanently delete this post?')) return
        try {
            const res = await fetch(`/api/blogs/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            })
            if (!res.ok) throw new Error('Failed to delete')
            fetchPosts()
            setSelectedIds((prev) => {
                const next = new Set(prev)
                next.delete(id)
                return next
            })
        } catch {
            alert('Failed to delete blog post')
        }
    }

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return
        if (!confirm(`Delete ${selectedIds.size} selected posts permanently?`)) return
        setBulkActionLoading(true)
        try {
            await Promise.all(
                Array.from(selectedIds).map((id) =>
                    fetch(`/api/blogs/${id}`, { method: 'DELETE', credentials: 'include' })
                )
            )
            setSelectedIds(new Set())
            fetchPosts()
        } catch {
            alert('Some posts failed to delete')
        } finally {
            setBulkActionLoading(false)
        }
    }

    const handleBulkPublish = async () => {
        if (selectedIds.size === 0) return
        setBulkActionLoading(true)
        try {
            await Promise.all(
                Array.from(selectedIds).map((id) =>
                    fetch(`/api/blogs/${id}`, {
                        method: 'PATCH',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'published' }),
                    })
                )
            )
            setSelectedIds(new Set())
            fetchPosts()
        } catch {
            alert('Some posts failed to publish')
        } finally {
            setBulkActionLoading(false)
        }
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === posts.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(posts.map((p) => p.id)))
        }
    }

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const getAuthorName = (author: BlogPost['author']) => {
        if (typeof author === 'string') return author
        return author?.name || author?.email || 'Unknown'
    }

    const getCategoryName = (category: BlogPost['category']) => {
        if (!category) return '—'
        if (typeof category === 'string') return category
        return category.name
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-MY', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        })
    }

    // --- RENDER ---

    // Loading skeleton
    if (loading && posts.length === 0) {
        return (
            <div className="space-y-6 p-6 md:p-8">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="h-8 w-40 animate-pulse rounded-lg bg-white/5" />
                        <div className="mt-2 h-4 w-24 animate-pulse rounded bg-white/5" />
                    </div>
                    <div className="h-10 w-32 animate-pulse rounded-lg bg-white/5" />
                </div>
                <div className="h-10 w-full animate-pulse rounded-lg bg-white/5" />
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-16 w-full animate-pulse rounded-lg bg-white/5" />
                    ))}
                </div>
            </div>
        )
    }

    // Error state
    if (error) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                        <FileText className="h-8 w-8 text-red-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Failed to load blog posts</h3>
                    <p className="text-sm text-gray-400">{error}</p>
                    <button
                        onClick={fetchPosts}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        )
    }

    // Empty state
    if (!loading && posts.length === 0 && !search && !statusFilter) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                        <FileText className="h-8 w-8 text-gray-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">No blog posts yet</h3>
                    <p className="text-sm text-gray-400">Create your first blog post to engage customers</p>
                    <button
                        onClick={() => router.push('/dashboard/blog/new')}
                        className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-400 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Create First Post
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 p-6 md:p-8">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Blog Posts</h1>
                    <p className="mt-1 text-sm text-gray-400">
                        {meta?.totalDocs || 0} post{(meta?.totalDocs || 0) !== 1 ? 's' : ''}
                    </p>
                </div>
                <button
                    onClick={() => router.push('/dashboard/blog/new')}
                    className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-400 transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    Create Post
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search posts..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                    />
                </div>
                {/* Status filter tabs */}
                <div className="flex gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
                    {(['', 'draft', 'published'] as const).map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === s
                                ? 'bg-white/10 text-white'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            {s === '' ? 'All' : s === 'draft' ? 'Draft' : 'Published'}
                        </button>
                    ))}
                </div>
                {/* Sort dropdown */}
                <div className="relative">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="appearance-none rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-8 text-xs font-medium text-gray-400 hover:text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 cursor-pointer"
                    >
                        <option value="-createdAt">Date (Newest)</option>
                        <option value="createdAt">Date (Oldest)</option>
                        <option value="title">Title (A-Z)</option>
                        <option value="-title">Title (Z-A)</option>
                    </select>
                    <ArrowUpDown className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
                {/* Category filter */}
                {categories.length > 0 && (
                    <div className="relative">
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="appearance-none rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-8 text-xs font-medium text-gray-400 hover:text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 cursor-pointer"
                        >
                            <option value="">All Categories</option>
                            {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                        <Tag className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>
                )}
            </div>

            {/* Bulk actions */}
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5">
                    <span className="text-sm text-gray-400">{selectedIds.size} selected</span>
                    <button
                        onClick={handleBulkPublish}
                        disabled={bulkActionLoading}
                        className="rounded-md bg-green-600/20 px-3 py-1 text-xs font-medium text-green-400 hover:bg-green-600/30 disabled:opacity-50 transition-colors"
                    >
                        Publish
                    </button>
                    <button
                        onClick={handleBulkDelete}
                        disabled={bulkActionLoading}
                        className="rounded-md bg-red-600/20 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-600/30 disabled:opacity-50 transition-colors"
                    >
                        Delete
                    </button>
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/10 bg-white/5">
                            <th className="w-10 px-4 py-3">
                                <input
                                    type="checkbox"
                                    checked={posts.length > 0 && selectedIds.size === posts.length}
                                    onChange={toggleSelectAll}
                                    className="rounded border-gray-600 bg-transparent"
                                />
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Title</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Status</th>
                            <th className="hidden px-4 py-3 text-left font-medium text-gray-400 md:table-cell">Category</th>
                            <th className="hidden px-4 py-3 text-left font-medium text-gray-400 lg:table-cell">Author</th>
                            <th className="hidden px-4 py-3 text-left font-medium text-gray-400 md:table-cell">Date</th>
                            <th className="w-12 px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {posts.map((post) => (
                            <tr
                                key={post.id}
                                className="group cursor-pointer hover:bg-white/[0.02] transition-colors"
                                onClick={() => router.push(`/dashboard/blog/${post.id}`)}
                            >
                                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(post.id)}
                                        onChange={() => toggleSelect(post.id)}
                                        className="rounded border-gray-600 bg-transparent"
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    <p className="font-medium text-white truncate max-w-[300px]">{post.title}</p>
                                </td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${post.status === 'published'
                                            ? 'bg-green-500/10 text-green-400'
                                            : 'bg-yellow-500/10 text-yellow-400'
                                            }`}
                                    >
                                        {post.status === 'published' ? 'Published' : 'Draft'}
                                    </span>
                                </td>
                                <td className="hidden px-4 py-3 text-gray-400 md:table-cell">
                                    {getCategoryName(post.category)}
                                </td>
                                <td className="hidden px-4 py-3 text-gray-400 lg:table-cell">
                                    {getAuthorName(post.author)}
                                </td>
                                <td className="hidden px-4 py-3 text-gray-400 md:table-cell">
                                    {formatDate(post.updatedAt)}
                                </td>
                                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => handleDelete(post.id)}
                                        className="rounded-lg p-1.5 text-gray-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all"
                                        title="Delete"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* No results for filters */}
            {!loading && posts.length === 0 && (search || statusFilter) && (
                <div className="py-12 text-center">
                    <p className="text-sm text-gray-400">No posts match your filters</p>
                </div>
            )}

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-white/10 pt-4">
                    <p className="text-sm text-gray-400">
                        Page {meta.page} of {meta.totalPages}
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage((p) => p - 1)}
                            disabled={!meta.hasPrevPage}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-gray-400 hover:bg-white/5 disabled:opacity-30 transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Prev
                        </button>
                        <button
                            onClick={() => setPage((p) => p + 1)}
                            disabled={!meta.hasNextPage}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-gray-400 hover:bg-white/5 disabled:opacity-30 transition-colors"
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
