'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { FilterDropdown } from './_components/FilterDropdown'
import { CategoryModal } from './_components/CategoryModal'
import { BlogPagination } from './_components/BlogPagination'
import { useI18n } from '@/i18n'
import {
    Plus,
    Search,
    Trash2,
    SquarePen,
    Check,
    FileText,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
    Tag,
    AlertTriangle,
    X,
    Loader2,
    Eye,
    EyeOff,
    ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { getBlogCategoriesAction, listBlogsAction, deleteBlogAction, bulkDeleteBlogsAction, updateBlogStatusAction } from './actions'

type BlogPost = {
    id: string
    title: string
    slug: string
    status: 'draft' | 'published'
    author: { name?: string; email: string } | string
    category: { name: string; id: string } | string | null
    thumbnail?: any
    createdAt: string
    updatedAt: string
}

type BlogCategory = {
    id: string
    name: string
}

const s3Public = process.env.NEXT_PUBLIC_S3_ENDPOINT || 'http://localhost:9000'
const getThumbUrl = (url?: string) => url ? url.replace(/https?:\/\/minio:\d+/, s3Public) : ''

type BlogMeta = {
    totalDocs: number
    totalPages: number
    page: number
    limit: number
    hasPrevPage: boolean
    hasNextPage: boolean
}

function BlogCheckbox({ checked, onClick }: { checked: boolean; onClick: () => void }) {
    return (
        <div className="flex justify-center items-center cursor-pointer group" onClick={(e) => { e.stopPropagation(); onClick(); }}>
            {checked ? (
                <div className="w-5 h-5 flex shrink-0 items-center justify-center rounded-[4px] bg-[#2DD4BF] group-hover:opacity-80 transition-opacity">
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M4.00004 7.8L1.20004 5L0.266708 5.93333L4.00004 9.66667L12 1.66667L11.0667 0.733337L4.00004 7.8Z" fill="white" /></svg>
                </div>
            ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0 stroke-[#374151] group-hover:stroke-[#2DD4BF]/50 transition-colors">
                    <rect x="1" y="1" width="18" height="18" rx="3" fill="transparent" strokeWidth="2" />
                </svg>
            )}
        </div>
    )
}

export default function BlogListPage() {
    const { t } = useI18n()
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
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)

    const fetchPosts = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await listBlogsAction({
                search: search || undefined,
                status: statusFilter || undefined,
                category: categoryFilter || undefined,
                page: page,
                sort: sortBy,
            })

            setPosts(res.data || [])
            setMeta(res.meta || null)
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
        getBlogCategoriesAction()
            .then(docs => setCategories(docs || []))
            .catch(() => { })
    }, [])

    // Reset page when filters change
    useEffect(() => {
        setPage(1)
    }, [search, statusFilter, categoryFilter, sortBy])

    // Delete confirmation modal state
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string; status: string } | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)

    const openDeleteConfirm = (post: BlogPost) => {
        setDeleteTarget({ id: post.id, title: post.title, status: post.status })
    }

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        setIsDeleting(true)
        try {
            await deleteBlogAction(deleteTarget.id)
            toast.success(t.dashboard.blog.actions.deleteSuccess.replace('{title}', deleteTarget.title))
            fetchPosts()
            setSelectedIds((prev) => {
                const next = new Set(prev)
                next.delete(deleteTarget.id)
                return next
            })
        } catch {
            toast.error(t.dashboard.blog.actions.deleteFailed)
        } finally {
            setIsDeleting(false)
            setDeleteTarget(null)
        }
    }

    const handleToggleStatus = async (post: BlogPost) => {
        const newStatus = post.status === 'published' ? 'draft' : 'published'
        try {
            await updateBlogStatusAction(post.id, newStatus)
            toast.success(t.dashboard.blog.actions.statusUpdated.replace('{status}', newStatus === 'published' ? t.dashboard.blog.filters.published.toLowerCase() : t.dashboard.blog.filters.draft.toLowerCase()))
            fetchPosts()
        } catch {
            toast.error(t.dashboard.blog.actions.updateFailed || 'Failed to update post status')
        }
    }

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return
        setBulkActionLoading(true)
        try {
            await bulkDeleteBlogsAction(Array.from(selectedIds))
            toast.success(t.dashboard.blog.actions.bulkDeleteSuccess.replace('{count}', selectedIds.size.toString()))
            setSelectedIds(new Set())
            fetchPosts()
        } catch {
            toast.error(t.dashboard.blog.actions.bulkDeleteFailed)
        } finally {
            setBulkActionLoading(false)
        }
    }

    const handleBulkPublish = async () => {
        if (selectedIds.size === 0) return
        setBulkActionLoading(true)
        try {
            await Promise.all(
                Array.from(selectedIds).map((id) => updateBlogStatusAction(id, 'published'))
            )
            toast.success(t.dashboard.blog.actions.bulkPublishSuccess.replace('{count}', selectedIds.size.toString()))
            setSelectedIds(new Set())
            fetchPosts()
        } catch {
            toast.error(t.dashboard.blog.actions.bulkPublishFailed)
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
        if (!category) return '\u2014'
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
    if (!loading && posts.length === 0 && !search && !statusFilter && !categoryFilter) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                        <FileText className="h-8 w-8 text-gray-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">{t.dashboard.blog.noPostsTitle}</h3>
                    <p className="text-sm text-gray-400">{t.dashboard.blog.noPostsSubtitle}</p>
                    <button
                        onClick={() => router.push('/blog/new')}
                        className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-400 transition-colors"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        {t.dashboard.blog.createPost}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col w-full max-w-[1594px] mx-auto p-[24px] font-['Inter'] h-[calc(100vh-120px)] overflow-hidden">
            {/* Header Container */}
            <div className="flex flex-col xl:flex-row xl:justify-between xl:items-center w-full gap-4 xl:gap-0">
                <div className="flex flex-col items-stretch gap-[4px] min-w-[242.98px] h-[56px]">
                    <div className="w-full h-[32px]">
                        <h1 className="mt-[-1px] w-[242px] h-[32px] text-[#F8FAFC] text-[24px] font-[700] leading-[1.3333333333333333em]">
                            {t.dashboard.blog.title}
                        </h1>
                    </div>
                    <div className="w-full h-[20px]">
                        <p className="w-max h-[20px] text-[rgba(248,250,252,0.6)] text-[14px] font-[400] leading-[1.4285714285714286em]">
                            {t.dashboard.blog.subtitle}
                        </p>
                    </div>
                </div>

                <div className="flex flex-row items-center gap-[12px]">
                    <button
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="flex flex-row items-center justify-center gap-[10px] bg-[#1E293B] border border-[rgba(255,255,255,0.08)] rounded-[16px] px-[16px] py-[14px] hover:bg-white/5 transition-colors"
                    >
                        <span className="text-[#F8FAFC] text-[14px] font-[600] leading-[1.4285714285714286em] text-center">{t.dashboard.blog.category}</span>
                    </button>
                    <button
                        onClick={() => router.push('/blog/new')}
                        className="flex flex-row items-center justify-center gap-[8px] rounded-[16px] px-[24px] py-[11px] bg-[linear-gradient(90deg,rgba(59,130,246,1)_0%,rgba(45,212,191,1)_100%)] shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),0px_10px_15px_-3px_rgba(0,0,0,0.1)] text-[#FFFFFF] hover:opacity-90 transition-opacity"
                    >
                        <Plus className="w-[20px] h-[20px] text-[#FFFFFF]" />
                        <span className="text-[16px] font-[600] leading-[1.5em] text-center">{t.dashboard.blog.createPost}</span>
                    </button>
                </div>
            </div>

            {/* Filters Container */}
            <div className="flex flex-col xl:flex-row justify-between w-full mt-[32px] gap-[16px]">
                {/* Search Bar */}
                <div className="flex flex-row items-center bg-[#1E293B] border border-[rgba(255,255,255,0.08)] rounded-[16px] relative w-full xl:flex-1 xl:max-w-[831px] h-[50px] shrink-1">
                    <Search className="absolute left-[16px] top-[15px] w-[20px] h-[20px] text-[#9CA3AF]" />
                    <input
                        type="text"
                        placeholder={t.dashboard.blog.filters.search}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-transparent border-none outline-none text-[#F8FAFC] placeholder:text-[rgba(248,250,252,0.4)] pl-[48px] pr-[16px] py-[12px] text-[16px] font-[400] leading-[1.2102272510528564em]"
                    />
                </div>

                {/* Dropdowns */}
                <div className="flex flex-col xl:flex-row items-center gap-[12px] w-full xl:w-auto shrink-0">
                    {/* All Status Dropdown */}
                    <FilterDropdown
                        className="w-full xl:w-[241px] h-[50px]"
                        value={statusFilter}
                        onChange={(val) => setStatusFilter(val as '' | 'draft' | 'published')}
                        placeholder={t.dashboard.blog.filters.allStatus}
                        options={[
                            { label: t.dashboard.blog.filters.allStatus, value: '' },
                            { label: t.dashboard.blog.filters.draft, value: 'draft' },
                            { label: t.dashboard.blog.filters.published, value: 'published' }
                        ]}
                    />

                    {/* All Categories Dropdown */}
                    <FilterDropdown
                        className="w-full xl:w-[241px] h-[50px]"
                        value={categoryFilter}
                        onChange={setCategoryFilter}
                        placeholder={t.dashboard.blog.filters.allCategories}
                        options={[
                            { label: t.dashboard.blog.filters.allCategories, value: '' },
                            ...categories.map(cat => ({ value: cat.id, label: cat.name }))
                        ]}
                    />

                    {/* Newest (Sort) Dropdown */}
                    <FilterDropdown
                        className="w-full xl:w-[241px] h-[50px]"
                        value={sortBy}
                        onChange={setSortBy}
                        placeholder={t.dashboard.blog.filters.sortNewest}
                        options={[
                            { label: t.dashboard.blog.filters.sortNewest, value: '-createdAt' },
                            { label: t.dashboard.blog.filters.sortOldest, value: 'createdAt' },
                            { label: t.dashboard.blog.filters.sortNameAsc, value: 'title' },
                            { label: t.dashboard.blog.filters.sortNameDesc, value: '-title' }
                        ]}
                    />
                </div>
            </div>

            {selectedIds.size > 0 && (
                <div className="flex items-center gap-[12px] mt-[24px] -mb-[8px] w-full">
                    <button
                        onClick={handleBulkPublish}
                        disabled={bulkActionLoading}
                        className="flex items-center gap-[8px] rounded-[10px] px-[16px] py-[10px] bg-[#2DD4BF] text-white font-['Inter'] font-[600] text-[14px] leading-[1.4285714285714286em] hover:opacity-90 transition-opacity disabled:opacity-50 shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),0px_10px_15px_-3px_rgba(0,0,0,0.1)]"
                    >
                        <Eye className="w-[16px] h-[16px]" />
                        <span>{t.dashboard.blog.actions.bulkPublish || 'Publish'}</span>
                    </button>
                    <button
                        onClick={() => setShowBulkDeleteModal(true)}
                        disabled={bulkActionLoading}
                        className="flex items-center gap-[8px] rounded-[10px] px-[16px] py-[10px] bg-[#FF6B6B] text-white font-['Inter'] font-[600] text-[14px] leading-[1.4285714285714286em] hover:opacity-90 transition-opacity disabled:opacity-50 shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),0px_10px_15px_-3px_rgba(0,0,0,0.1)]"
                    >
                        <Trash2 className="w-[16px] h-[16px]" />
                        <span>{t.dashboard.blog.actions.delete}</span>
                    </button>
                </div>
            )}

            {/* Mobile Card Layout (visible only below xl) */}
            <div className="flex flex-col w-full flex-1 overflow-y-auto xl:hidden gap-4 mt-[24px] min-h-0">
                {posts.length === 0 ? (
                    <div className="flex flex-col w-full items-center justify-center gap-[16px] py-[64px]">
                        <FileText className="w-[64px] h-[64px] text-[rgba(248,250,252,0.2)]" strokeWidth={2} />
                        <span className="font-['Inter'] text-[16px] font-[400] leading-[1.5em] text-[rgba(248,250,252,0.6)]">
                            {t.dashboard.blog.noMatches}
                        </span>
                        {(search || statusFilter || categoryFilter) && (
                            <button
                                onClick={() => { setSearch(''); setStatusFilter(''); setCategoryFilter(''); }}
                                className="flex items-center gap-[6px] px-[16px] py-[8px] rounded-[10px] border border-[rgba(248,250,252,0.15)] text-[rgba(248,250,252,0.6)] hover:text-white hover:border-[rgba(248,250,252,0.3)] transition-colors font-['Inter'] text-[14px] font-[500]"
                            >
                                <X className="w-[14px] h-[14px]" />
                                <span>{t.dashboard.blog.resetFilters || 'Reset Filters'}</span>
                            </button>
                        )}
                    </div>
                ) : posts.map((post) => (
                    <div
                        key={`mobile-${post.id}`}
                        className="flex flex-col bg-[rgba(30,41,59,0.6)] border border-[rgba(255,255,255,0.08)] rounded-[16px] p-4 gap-4"
                    >
                        {/* Top Content Row */}
                        <div className="flex flex-row gap-4">
                            {/* Image */}
                            <div className="shrink-0 w-[96px] h-[80px] bg-[#0B1120] rounded-[12px] border border-[rgba(255,255,255,0.08)] overflow-hidden">
                                {post.thumbnail ? (
                                    <img
                                        src={getThumbUrl(typeof post.thumbnail === 'object' ? post.thumbnail.url : '')}
                                        alt="Thumbnail"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <span className="text-[#9CA3AF] text-xs">{t.dashboard.blog.noImage}</span>
                                    </div>
                                )}
                            </div>

                            {/* Content details */}
                            <div className="flex flex-col flex-1 min-w-0 gap-[10px]">
                                {/* Title & Checkbox */}
                                <div className="flex flex-row justify-between items-start gap-2">
                                    <span className="font-['Inter'] font-[600] text-[14px] leading-[20px] text-[#F8FAFC] line-clamp-2 flex-1 min-w-0">
                                        {post.title}
                                    </span>
                                    <div className="shrink-0 pt-0.5">
                                        <BlogCheckbox
                                            checked={selectedIds.has(post.id)}
                                            onClick={() => toggleSelect(post.id)}
                                        />
                                    </div>
                                </div>

                                {/* Badges */}
                                <div className="flex flex-row items-center gap-2 flex-wrap">
                                    <div className="flex items-center bg-[rgba(59,130,246,0.1)] rounded-[12px] border border-[rgba(59,130,246,0.3)] px-[9px] py-[3px]">
                                        <span className="font-['Inter'] font-[500] text-[12px] leading-[16px] text-[#3B82F6] truncate max-w-[80px]">
                                            {getCategoryName(post.category)}
                                        </span>
                                    </div>
                                    {post.status === 'published' ? (
                                        <div className="flex items-center bg-[rgba(0,201,80,0.1)] rounded-[12px] border border-[rgba(0,201,80,0.3)] px-[9px] py-[3px]">
                                            <span className="font-['Inter'] font-[500] text-[12px] leading-[16px] text-[#05DF72]">{t.dashboard.blog.filters.published}</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center bg-[rgba(245,158,11,0.1)] rounded-[12px] border border-[rgba(245,158,11,0.3)] px-[9px] py-[3px]">
                                            <span className="font-['Inter'] font-[500] text-[12px] leading-[16px] text-[#F59E0B]">{t.dashboard.blog.filters.draft}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Author & Date */}
                                <div className="flex flex-row justify-between items-center">
                                    <span className="font-['Inter'] font-[400] text-[12px] leading-[16px] text-[rgba(248,250,252,0.6)] truncate max-w-[100px]">
                                        {typeof post.author === 'object' && post.author ? ((post.author as any).firstName ? `${(post.author as any).firstName} ${(post.author as any).lastName || ''}`.trim() : post.author.email?.split('@')[0]) : t.dashboard.blog.unknownAuthor}
                                    </span>
                                    <span className="font-['Inter'] font-[400] text-[12px] leading-[16px] text-[rgba(248,250,252,0.6)]">
                                        {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(post.updatedAt))}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons Row */}
                        <div className="flex flex-row items-center gap-2 border-t border-[rgba(255,255,255,0.05)] pt-3">
                            <button
                                onClick={() => router.push(`/blog/${post.id}`)}
                                className="flex items-center justify-center gap-1.5 bg-[rgba(0,201,80,0.1)] rounded-[12px] h-[36px] flex-1 hover:opacity-80 transition-opacity"
                            >
                                <Eye className="w-4 h-4 text-[#05DF72]" />
                                <span className="font-['Inter'] font-[500] text-[14px] leading-[20px] text-[#05DF72]">{t.dashboard.blog.actions.view}</span>
                            </button>
                            <button
                                onClick={() => router.push(`/blog/${post.id}`)}
                                className="flex items-center justify-center gap-1.5 bg-[rgba(59,130,246,0.1)] rounded-[12px] h-[36px] flex-1 hover:opacity-80 transition-opacity"
                            >
                                <SquarePen className="w-4 h-4 text-[#3B82F6]" />
                                <span className="font-['Inter'] font-[500] text-[14px] leading-[20px] text-[#3B82F6]">Edit</span>
                            </button>
                            <button
                                onClick={() => openDeleteConfirm(post)}
                                className="flex items-center justify-center gap-1.5 bg-[rgba(251,44,54,0.1)] rounded-[12px] h-[36px] flex-1 hover:opacity-80 transition-opacity"
                            >
                                <Trash2 className="w-4 h-4 text-[#FF6467]" />
                                <span className="font-['Inter'] font-[500] text-[14px] leading-[20px] text-[#FF6467]">Delete</span>
                            </button>
                        </div>
                    </div>
                ))}

                {meta && meta.totalPages > 1 && (
                    <div className="flex items-center justify-center py-4 shrink-0">
                        <BlogPagination
                            currentPage={meta.page}
                            totalPages={meta.totalPages}
                            onPageChange={setPage}
                        />
                    </div>
                )}
            </div>

            {/* Desktop Table Layout (visible only at xl+) */}
            <div className="hidden xl:flex flex-col w-full bg-[rgba(30,41,59,0.6)] border border-[rgba(255,255,255,0.08)] rounded-[16px] mt-[32px] overflow-hidden flex-1 min-h-0 shrink-0">
                <div className="flex flex-col flex-1 w-full bg-transparent overflow-x-auto overflow-y-hidden min-h-0 custom-scrollbar">
                    <div className="flex flex-col flex-1 min-w-[1200px] w-full min-h-0">
                        {/* Header */}
                        <div className="flex justify-between items-center w-full h-[56px] shrink-0 bg-[rgba(11,17,32,0.5)] border-b border-[rgba(255,255,255,0.05)]">
                            <div className="flex justify-center items-center w-[66.55px] h-full shrink-0">
                                <BlogCheckbox checked={posts.length > 0 && selectedIds.size === posts.length} onClick={toggleSelectAll} />
                            </div>
                            <div className="w-[127.67px] shrink-0 pl-6 h-full flex items-center">
                                <span className="font-['Inter'] text-[12px] font-[600] leading-[1.3333333333333333em] uppercase tracking-[0.025em] text-[rgba(248,250,252,0.6)]">{t.dashboard.blog.table.thumbnail}</span>
                            </div>
                            <div className="flex-1 min-w-[200px] shrink-0 pl-6 h-full flex items-center">
                                <span className="font-['Inter'] text-[12px] font-[600] leading-[1.3333333333333333em] uppercase tracking-[0.025em] text-[rgba(248,250,252,0.6)]">{t.dashboard.blog.table.title}</span>
                            </div>
                            <div className="w-[155.3px] shrink-0 pl-6 h-full flex items-center">
                                <span className="font-['Inter'] text-[12px] font-[600] leading-[1.3333333333333333em] uppercase tracking-[0.025em] text-[rgba(248,250,252,0.6)]">{t.dashboard.blog.table.category}</span>
                            </div>
                            <div className="w-[135.7px] shrink-0 pl-6 h-full flex items-center">
                                <span className="font-['Inter'] text-[12px] font-[600] leading-[1.3333333333333333em] uppercase tracking-[0.025em] text-[rgba(248,250,252,0.6)]">{t.dashboard.blog.table.status}</span>
                            </div>
                            <div className="w-[157.33px] shrink-0 pl-6 h-full flex items-center">
                                <span className="font-['Inter'] text-[12px] font-[600] leading-[1.3333333333333333em] uppercase tracking-[0.025em] text-[rgba(248,250,252,0.6)]">{t.dashboard.blog.table.author}</span>
                            </div>
                            <div className="w-[142.13px] shrink-0 pl-6 h-full flex items-center">
                                <span className="font-['Inter'] text-[12px] font-[600] leading-[1.3333333333333333em] uppercase tracking-[0.025em] text-[rgba(248,250,252,0.6)]">{t.dashboard.blog.table.date}</span>
                            </div>
                            <div className="w-[124.83px] shrink-0 pl-6 h-full flex items-center">
                                <span className="font-['Inter'] text-[12px] font-[600] leading-[1.3333333333333333em] uppercase tracking-[0.025em] text-[rgba(248,250,252,0.6)]">{t.dashboard.blog.table.actions}</span>
                            </div>
                        </div>

                        <div className="flex flex-col w-full flex-1 overflow-y-auto min-h-0">
                            {posts.length === 0 ? (
                                <div className="flex flex-col w-full items-center justify-center gap-[16px] py-[64px]">
                                    <FileText className="w-[64px] h-[64px] text-[rgba(248,250,252,0.2)]" strokeWidth={2} />
                                    <span className="font-['Inter'] text-[16px] font-[400] leading-[1.5em] text-[rgba(248,250,252,0.6)]">
                                        {t.dashboard.blog.noMatches}
                                    </span>
                                    {(search || statusFilter || categoryFilter) && (
                                        <button
                                            onClick={() => { setSearch(''); setStatusFilter(''); setCategoryFilter(''); }}
                                            className="flex items-center gap-[6px] px-[16px] py-[8px] rounded-[10px] border border-[rgba(248,250,252,0.15)] text-[rgba(248,250,252,0.6)] hover:text-white hover:border-[rgba(248,250,252,0.3)] transition-colors font-['Inter'] text-[14px] font-[500]"
                                        >
                                            <X className="w-[14px] h-[14px]" />
                                            <span>{t.dashboard.blog.resetFilters || 'Reset Filters'}</span>
                                        </button>
                                    )}
                                </div>
                            ) : posts.map((post, index) => (
                                <div
                                    key={post.id}
                                    className={`flex flex-row items-center w-full h-[80.5px] cursor-pointer hover:bg-white/[0.02] transition-colors ${index !== posts.length - 1 ? 'border-b border-[rgba(255,255,255,0.05)]' : ''}`}
                                    onClick={() => router.push(`/blog/${post.id}`)}
                                >
                                    <div className="flex justify-center items-center w-[66.55px] h-[80.5px] shrink-0">
                                        <BlogCheckbox checked={selectedIds.has(post.id)} onClick={() => toggleSelect(post.id)} />
                                    </div>

                                    <div className="w-[127.67px] h-[80.5px] pl-[24px] flex items-center shrink-0">
                                        <div className="w-[64px] h-[48px] bg-[rgba(255,255,255,0.05)] rounded-[12px] border border-[rgba(255,255,255,0.08)] overflow-hidden">
                                            {post.thumbnail && (
                                                <img src={getThumbUrl(typeof post.thumbnail === 'object' ? post.thumbnail.url : '')} alt={post.title} className="w-full h-full object-cover" />
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-[200px] h-[80.5px] pl-[24px] flex items-center pr-[16px]">
                                        <span className="truncate font-['Inter'] text-[14px] font-[600] leading-[1.4285714285714286em] text-[#F8FAFC]">
                                            {post.title}
                                        </span>
                                    </div>

                                    <div className="w-[155.3px] h-[80.5px] pl-[24px] flex items-center shrink-0">
                                        <div className="rounded-[12px] px-[12px] py-[4px] border border-solid border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.1)]">
                                            <span className="font-['Inter'] text-[12px] font-[500] leading-[1.3333333333333333em] text-[#FFFFFF]">
                                                {getCategoryName(post.category)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="w-[135.7px] h-[80.5px] pl-[24px] flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => handleToggleStatus(post)}
                                            title={post.status === 'published' ? t.dashboard.blog.actions.moveToDraft : t.dashboard.blog.actions.publish}
                                            className={`rounded-[12px] px-[12px] py-[4px] border border-solid transition-colors cursor-pointer ${post.status === 'published'
                                                ? 'bg-[rgba(0,201,80,0.1)] border-[rgba(0,201,80,0.3)]'
                                                : 'bg-[rgba(106,114,130,0.1)] border-[rgba(106,114,130,0.3)]'
                                                }`}
                                        >
                                            <span className={`font-['Inter'] text-[12px] font-[500] leading-[1.3333333333333333em] flex items-center gap-1.5 ${post.status === 'published' ? 'text-[#05DF72]' : 'text-[#99A1AF]'
                                                }`}>
                                                {post.status === 'published' ? t.dashboard.blog.filters.published : t.dashboard.blog.filters.draft}
                                            </span>
                                        </button>
                                    </div>

                                    <div className="w-[157.33px] h-[80.5px] pl-[24px] flex items-center shrink-0">
                                        <span className="truncate font-['Inter'] text-[14px] font-[400] leading-[1.4285714285714286em] text-[rgba(248,250,252,0.7)]">
                                            {typeof post.author === 'object' && post.author ? ((post.author as any).firstName ? `${(post.author as any).firstName} ${(post.author as any).lastName || ''}`.trim() : post.author.email?.split('@')[0]) : t.dashboard.blog.unknownAuthor}
                                        </span>
                                    </div>

                                    <div className="w-[142.13px] h-[80.5px] pl-[24px] flex flex-col justify-center shrink-0">
                                        <span className="font-['Inter'] text-[14px] font-[400] leading-[1.4285714285714286em] text-[rgba(248,250,252,0.6)]">
                                            {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(post.updatedAt))}
                                        </span>
                                    </div>

                                    <div className="w-[124.83px] h-[80.5px] pl-[24px] flex flex-row gap-[8px] items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                                        <button onClick={() => router.push(`/blog/${post.id}`)} className="rounded-[8px] p-[6px] text-[rgba(248,250,252,0.6)] hover:bg-[rgba(255,255,255,0.05)] hover:text-white transition-all w-[32px] h-[32px] flex items-center justify-center" title={t.dashboard.blog.actions.edit}>
                                            <SquarePen className="h-[16px] w-[16px]" strokeWidth={1.33} />
                                        </button>
                                        <button onClick={() => openDeleteConfirm(post)} className="rounded-[8px] p-[6px] text-[rgba(248,250,252,0.6)] hover:bg-[rgba(239,68,68,0.1)] hover:text-red-400 transition-all w-[32px] h-[32px] flex items-center justify-center" title={t.dashboard.blog.actions.delete}>
                                            <Trash2 className="h-[16px] w-[16px]" strokeWidth={1.33} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {meta && meta.totalPages > 1 && (
                    <div className="flex items-center justify-end px-[24px] py-[16px] w-full shrink-0 bg-transparent">
                        <BlogPagination
                            currentPage={meta.page}
                            totalPages={meta.totalPages}
                            onPageChange={setPage}
                        />
                    </div>
                )}
            </div>


            {/* Delete Confirmation Modal — AC-2 */}
            {
                deleteTarget && typeof document !== 'undefined' && createPortal(
                    <div className="fixed inset-0 w-screen h-screen z-[999] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
                        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1120] p-6 shadow-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-red-400" />
                                    {t.dashboard.blog.actions.deleteConfirmTitle}
                                </h3>
                                <button
                                    onClick={() => setDeleteTarget(null)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <p className="text-sm text-gray-400 mb-2">
                                {(t.dashboard.blog.actions.bulkDeleteConfirm || 'Are you sure you want to delete {count} posts?').replace('{count}', '1')}
                            </p>
                            <p className="text-xs text-gray-600 mb-4">
                                {t.dashboard.blog.actions.bulkDeleteWarning}
                            </p>

                            {deleteTarget.status === 'published' && (
                                <div className="mb-5 flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
                                    <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-yellow-400">
                                        {t.dashboard.blog.actions.deletePublishedWarning || 'Warning: This post is currently published and visible to your customers. Deleting it will immediately remove it from your storefront.'}
                                    </p>
                                </div>
                            )}

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setDeleteTarget(null)}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                                >
                                    {t.dashboard.blog.actions.cancel || 'Cancel'}
                                </button>
                                <button
                                    onClick={handleConfirmDelete}
                                    disabled={isDeleting}
                                    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isDeleting ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> {t.dashboard.blog.actions.deleting || 'Deleting...'}</>
                                    ) : (
                                        <><Trash2 className="w-4 h-4" /> {t.dashboard.blog.actions.delete}</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }

            {/* Bulk Delete Confirmation Modal — TC-F17-01-12 */}
            {
                showBulkDeleteModal && typeof document !== 'undefined' && createPortal(
                    <div className="fixed inset-0 w-screen h-screen z-[999] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
                        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1120] p-6 shadow-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-red-400" />
                                    {t.dashboard.blog.actions.delete}
                                </h3>
                                <button
                                    onClick={() => setShowBulkDeleteModal(false)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <p className="text-sm text-gray-400 mb-2">
                                {(t.dashboard.blog.actions.bulkDeleteConfirm || 'Bạn có chắc muốn xóa {count} bài viết?').replace('{count}', selectedIds.size.toString())}
                            </p>
                            <p className="text-xs text-gray-600 mb-4">
                                {t.dashboard.blog.actions.bulkDeleteWarning || 'Hành động này không thể hoàn tác.'}
                            </p>

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowBulkDeleteModal(false)}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                                >
                                    {t.dashboard.blog.actions.cancel || 'Hủy'}
                                </button>
                                <button
                                    onClick={async () => {
                                        await handleBulkDelete()
                                        setShowBulkDeleteModal(false)
                                    }}
                                    disabled={bulkActionLoading}
                                    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {bulkActionLoading ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</>
                                    ) : (
                                        <><Trash2 className="w-4 h-4" /> {t.dashboard.blog.actions.delete}</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }

            {
                isCategoryModalOpen && typeof document !== 'undefined' && createPortal(
                    <CategoryModal
                        onClose={() => setIsCategoryModalOpen(false)}
                        onCategoryUpdated={() => {
                            getBlogCategoriesAction()
                                .then(docs => setCategories(docs || []))
                                .catch(() => { })
                            fetchPosts()
                        }}
                    />,
                    document.body
                )
            }
        </div >
    )
}

