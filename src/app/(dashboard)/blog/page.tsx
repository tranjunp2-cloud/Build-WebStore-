'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { CategoryModal } from './_components/CategoryModal'
import { useI18n } from '@/i18n'
import {
    Plus,
    Trash2,
    Pencil,
    FileText,
    SearchX,
    X,
    Loader2,
    Eye,
    Clock,
    Tag,
    ArrowDownUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { getBlogCategoriesAction, listBlogsAction, deleteBlogAction, bulkDeleteBlogsAction, updateBlogStatusAction } from './actions'
import { resolveApiError } from '@/lib/ui/resolve-api-error'
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    TableActionButton,
} from '@/components/ui/table'
import { TablePagination } from '@/components/ui/table-pagination'
import { TableEmptyState } from '@/components/ui/table-empty-state'
import { Badge } from '@/components/ui/badge'
import { TableSearch } from '@/components/ui/table-search'
import { FilterChip } from '@/components/ui/filter-chip'
import { Button } from '@/components/ui/button'

type BlogPost = {
    id: string
    title: string
    slug: string
    status: 'draft' | 'published'
    author: { name?: string; email?: string; firstName?: string; lastName?: string } | string
    category: { name: string; id: string } | string | null
    thumbnail?: { url?: string; id?: string } | string | null
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
                <div className="w-5 h-5 flex shrink-0 items-center justify-center rounded-[4px] bg-[hsl(var(--primary))] group-hover:opacity-80 transition-opacity">
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M4.00004 7.8L1.20004 5L0.266708 5.93333L4.00004 9.66667L12 1.66667L11.0667 0.733337L4.00004 7.8Z" fill="white" /></svg>
                </div>
            ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0 stroke-[hsl(var(--input-border))] group-hover:stroke-[hsl(var(--primary))]/50 transition-colors">
                    <rect x="1" y="1" width="18" height="18" rx="3" fill="transparent" strokeWidth="1.5" />
                </svg>
            )}
        </div>
    )
}

export default function BlogListPage() {
    const { t } = useI18n()
    const sub = t.common.subscriptionErrors
    const router = useRouter()
    const [posts, setPosts] = useState<BlogPost[]>([])
    const [meta, setMeta] = useState<BlogMeta | null>(null)
    const [loading, setLoading] = useState(true)
    const hasLoaded = useRef(false)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<'' | 'draft' | 'published'>('')
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(10)
    const [sortBy, setSortBy] = useState('-updatedAt')
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
                limit: limit,
                sort: sortBy,
            })

            setPosts(res.data || [])
            setMeta(res.meta || null)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Something went wrong')
        } finally {
            setLoading(false)
            hasLoaded.current = true
        }
    }, [search, statusFilter, categoryFilter, sortBy, page, limit])

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
            const result = await deleteBlogAction(deleteTarget.id)
            if (result && 'error' in result && result.error) {
                toast.error(resolveApiError(result, t.dashboard.blog.actions.deleteFailed, sub))
                return
            }
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
            const result = await updateBlogStatusAction(post.id, newStatus)
            if (result && typeof result === 'object' && 'error' in result && result.error) {
                toast.error(resolveApiError(result, t.dashboard.blog.actions.updateFailed, sub))
                return
            }
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
            const result = await bulkDeleteBlogsAction(Array.from(selectedIds))
            if (result && 'error' in result && result.error) {
                toast.error(resolveApiError(result, t.dashboard.blog.actions.bulkDeleteFailed, sub))
                return
            }
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
            const results = await Promise.all(
                Array.from(selectedIds).map((id) => updateBlogStatusAction(id, 'published'))
            )
            const blocked = results.find(r => r && typeof r === 'object' && 'error' in r && r.error)
            if (blocked && typeof blocked === 'object' && 'error' in blocked) {
                toast.error(resolveApiError(blocked, t.dashboard.blog.actions.bulkPublishFailed, sub))
                fetchPosts()
                return
            }
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

    const hasPublishedInSelection = posts.some(
        (p) => selectedIds.has(p.id) && p.status === 'published'
    )

    const getCategoryName = (category: BlogPost['category']) => {
        if (!category) return '—'
        if (typeof category === 'string') return category
        return category.name
    }

    // --- RENDER ---

    // Loading skeleton — only on first load, not during filter refetch
    if (!hasLoaded.current && loading) {
        return (
            <div className="space-y-6">
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
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                        <FileText className="h-8 w-8 text-destructive" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">{t.dashboard.blog.loadFailed}</h3>
                    <p className="text-sm text-gray-400">{error}</p>
                    <button
                        onClick={fetchPosts}
                        className="rounded-lg bg-[linear-gradient(90deg,#3b82f6_0%,#2dd4bf_100%)] px-4 py-2 text-sm font-medium !text-white hover:opacity-90 transition-colors"
                    >
                        {t.dashboard.blog.tryAgain}
                    </button>
                </div>
            </div>
        )
    }

    // Empty state — genuine first-load (no filters active, no posts at all). Leave as-is (marketing/onboarding).
    if (!loading && posts.length === 0 && !search && !statusFilter && !categoryFilter) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                        <FileText className="h-8 w-8 text-gray-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">{t.dashboard.blog.noPostsTitle}</h3>
                    <p className="text-sm text-gray-400">{t.dashboard.blog.noPostsSubtitle}</p>
                    <Button variant="dashPrimary" size="dash" onClick={() => router.push('/blog/new')}>
                        <Plus className="w-3.5 h-3.5" />
                        {t.dashboard.blog.createPost}
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col w-full font-['Inter'] h-[calc(100vh-120px)] overflow-hidden">
            {/* Header Container */}
            <div className="flex flex-col xl:flex-row xl:justify-between xl:items-center w-full gap-4 xl:gap-0">
                <div className="flex flex-col items-stretch gap-[4px] min-w-[242.98px] h-[56px]">
                    <div className="w-full h-[32px]">
                        <h1 className="mt-[-1px] w-[242px] h-[32px] text-foreground text-[24px] font-[700] leading-[1.3333333333333333em]">
                            {t.dashboard.blog.title}
                        </h1>
                    </div>
                    <div className="w-full h-[20px]">
                        <p className="w-max h-[20px] text-[hsl(var(--muted-foreground))] text-[14px] font-[400] leading-[1.4285714285714286em]">
                            {t.dashboard.blog.subtitle}
                        </p>
                    </div>
                </div>

                <div className="flex flex-row items-center gap-2 shrink-0">
                    <Button variant="dashSecondary" size="dash" onClick={() => setIsCategoryModalOpen(true)}>
                        <Tag className="w-3.5 h-3.5" />
                        {t.dashboard.blog.category}
                    </Button>
                    <Button variant="dashPrimary" size="dash" onClick={() => router.push('/blog/new')}>
                        <Plus className="w-3.5 h-3.5" />
                        {t.dashboard.blog.createPost}
                    </Button>
                </div>
            </div>

            {/* Filters — shared <TableSearch> + <FilterChip> primitives (GH-1222 DS) */}
            <div className="flex flex-col xl:flex-row xl:items-center gap-3 w-full mt-[32px]">
                <TableSearch
                    value={search}
                    onSearch={setSearch}
                    placeholder={t.dashboard.blog.filters.search}
                    className="w-full xl:max-w-[420px]"
                />

                <div className="flex flex-wrap items-center gap-2">
                    <FilterChip<'' | 'draft' | 'published'>
                        icon={Clock}
                        label={t.dashboard.blog.filters.statusLabel}
                        value={statusFilter}
                        onChange={setStatusFilter}
                        options={[
                            { key: '', label: t.dashboard.blog.filters.allStatus },
                            { key: 'draft', label: t.dashboard.blog.filters.draft },
                            { key: 'published', label: t.dashboard.blog.filters.published },
                        ]}
                    />

                    <FilterChip<string>
                        icon={Tag}
                        label={t.dashboard.blog.filters.categoryLabel}
                        value={categoryFilter}
                        onChange={setCategoryFilter}
                        options={[
                            { key: '', label: t.dashboard.blog.filters.allCategories },
                            ...categories.map(cat => ({ key: cat.id, label: cat.name })),
                        ]}
                    />

                    <FilterChip<string>
                        icon={ArrowDownUp}
                        label={t.dashboard.blog.filters.sortLabel}
                        value={sortBy}
                        onChange={setSortBy}
                        options={[
                            { key: '-updatedAt', label: t.dashboard.blog.filters.sortNewest },
                            { key: 'updatedAt', label: t.dashboard.blog.filters.sortOldest },
                            { key: 'title', label: t.dashboard.blog.filters.sortNameAsc },
                            { key: '-title', label: t.dashboard.blog.filters.sortNameDesc },
                        ]}
                    />
                </div>
            </div>

            {selectedIds.size > 0 && (
                <div className="flex items-center gap-[12px] mt-[24px] -mb-[8px] w-full">
                    <button
                        onClick={handleBulkPublish}
                        disabled={bulkActionLoading}
                        className="flex items-center gap-[8px] rounded-[10px] px-[16px] py-[10px] bg-[hsl(var(--primary))] text-white font-['Inter'] font-[600] text-[14px] leading-[1.4285714285714286em] hover:opacity-90 transition-opacity disabled:opacity-50 shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),0px_10px_15px_-3px_rgba(0,0,0,0.1)]"
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
                    <TableEmptyState
                        icon={<SearchX />}
                        title={t.dashboard.blog.noMatches}
                    />
                ) : posts.map((post) => (
                    <div
                        key={`mobile-${post.id}`}
                        className="flex flex-col bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-[16px] p-4 gap-4"
                    >
                        {/* Top Content Row */}
                        <div className="flex flex-row gap-4">
                            {/* Image */}
                            <div className="shrink-0 w-[96px] h-[80px] bg-[hsl(var(--background))] rounded-[12px] border border-[hsl(var(--border))] overflow-hidden">
                                {post.thumbnail ? (
                                    <img
                                        src={getThumbUrl(typeof post.thumbnail === 'object' ? post.thumbnail.url : '')}
                                        alt="Thumbnail"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <span className="text-[hsl(var(--muted-foreground))] text-xs">{t.dashboard.blog.noImage}</span>
                                    </div>
                                )}
                            </div>

                            {/* Content details */}
                            <div className="flex flex-col flex-1 min-w-0 gap-[10px]">
                                {/* Title & Checkbox */}
                                <div className="flex flex-row justify-between items-start gap-2">
                                    <span className="font-['Inter'] font-[600] text-[14px] leading-[20px] text-foreground line-clamp-2 flex-1 min-w-0">
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
                                    <div className="flex items-center bg-[hsl(var(--primary)/0.1)] rounded-[12px] border border-[hsl(var(--primary)/0.3)] px-[9px] py-[3px]">
                                        <span className="font-['Inter'] font-[500] text-[12px] leading-[16px] text-[hsl(var(--primary))] truncate max-w-[80px]">
                                            {getCategoryName(post.category)}
                                        </span>
                                    </div>
                                    {post.status === 'published' ? (
                                        <div className="flex items-center bg-[hsl(var(--success)/0.1)] rounded-[12px] border border-[hsl(var(--success)/0.3)] px-[9px] py-[3px]">
                                            <span className="font-['Inter'] font-[500] text-[12px] leading-[16px] text-[hsl(var(--success))]">{t.dashboard.blog.filters.published}</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center bg-[hsl(var(--warning)/0.1)] rounded-[12px] border border-[hsl(var(--warning)/0.3)] px-[9px] py-[3px]">
                                            <span className="font-['Inter'] font-[500] text-[12px] leading-[16px] text-[hsl(var(--warning))]">{t.dashboard.blog.filters.draft}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Author & Date */}
                                <div className="flex flex-row justify-between items-center">
                                    <span className="font-['Inter'] font-[400] text-[12px] leading-[16px] text-[hsl(var(--muted-foreground))] truncate max-w-[100px]">
                                        {typeof post.author === 'object' && post.author ? (post.author.firstName ? `${post.author.firstName} ${post.author.lastName || ''}`.trim() : post.author.email?.split('@')[0]) : t.dashboard.blog.unknownAuthor}
                                    </span>
                                    <span className="font-['Inter'] font-[400] text-[12px] leading-[16px] text-[hsl(var(--muted-foreground))]">
                                        {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(post.updatedAt))}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons Row */}
                        <div className="flex flex-row items-center gap-2 border-t border-[hsl(var(--border))] pt-3">
                            <button
                                onClick={() => router.push(`/blog/${post.id}`)}
                                className="flex items-center justify-center gap-1.5 bg-[hsl(var(--success)/0.1)] rounded-[12px] h-[36px] flex-1 hover:opacity-80 transition-opacity"
                            >
                                <Eye className="w-4 h-4 text-[hsl(var(--success))]" />
                                <span className="font-['Inter'] font-[500] text-[14px] leading-[20px] text-[hsl(var(--success))]">{t.dashboard.blog.actions.view}</span>
                            </button>
                            <button
                                onClick={() => router.push(`/blog/${post.id}`)}
                                className="flex items-center justify-center gap-1.5 bg-[hsl(var(--primary)/0.1)] rounded-[12px] h-[36px] flex-1 hover:opacity-80 transition-opacity"
                            >
                                <Pencil className="w-4 h-4 text-[hsl(var(--primary))]" />
                                <span className="font-['Inter'] font-[500] text-[14px] leading-[20px] text-[hsl(var(--primary))]">{t.dashboard.blog.actions.edit}</span>
                            </button>
                            <button
                                onClick={() => openDeleteConfirm(post)}
                                className="flex items-center justify-center gap-1.5 bg-[hsl(var(--destructive)/0.1)] rounded-[12px] h-[36px] flex-1 hover:opacity-80 transition-opacity"
                            >
                                <Trash2 className="w-4 h-4 text-[hsl(var(--destructive))]" />
                                <span className="font-['Inter'] font-[500] text-[14px] leading-[20px] text-[hsl(var(--destructive))]">{t.dashboard.blog.actions.delete}</span>
                            </button>
                        </div>
                    </div>
                ))}

                {/* Mobile pagination */}
                {meta && meta.totalDocs > meta.limit && (
                    <div className="py-4 shrink-0">
                        <TablePagination
                            page={meta.page}
                            total={meta.totalDocs}
                            limit={meta.limit}
                            onPageChange={setPage}
                            labels={{ unit: 'posts' }}
                        />
                    </div>
                )}
            </div>

            {/* Desktop Table Layout (visible only at xl+) — GH-1222 DS migration */}
            <div className="hidden xl:block w-full mt-[32px]">
                {posts.length === 0 ? (
                    <TableEmptyState
                        icon={<SearchX />}
                        title={t.dashboard.blog.noMatches}
                    />
                ) : (
                    <Table
                        className="table-fixed w-full"
                        minWidth={1100}
                        footer={
                            meta ? (
                                <TablePagination
                                    page={meta.page}
                                    total={meta.totalDocs}
                                    limit={meta.limit}
                                    onPageChange={setPage}
                                    onLimitChange={(n) => { setLimit(n); setPage(1) }}
                                    labels={{
                                        showing: t.dashboard.blog.pagination.showing,
                                        of: t.dashboard.blog.pagination.of,
                                        unit: t.dashboard.blog.pagination.unit,
                                        rowsPerPage: t.dashboard.blog.pagination.rowsPerPage,
                                    }}
                                />
                            ) : undefined
                        }
                    >
                        {/* table-fixed + % colgroup: even, stable columns. Title gets the widest
                            share (28%) and truncates; hover shows full title. Order: checkbox,
                            thumbnail, title, category, status, author, date, actions.
                            NB: no inter-tag whitespace/comments — colgroup rejects text nodes (hydration). */}
                        <colgroup>
                            <col style={{ width: '5%' }} />
                            <col style={{ width: '8%' }} />
                            <col style={{ width: '28%' }} />
                            <col style={{ width: '13%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '14%' }} />
                            <col style={{ width: '13%' }} />
                            <col style={{ width: '7%' }} />
                        </colgroup>

                        <TableHeader>
                            <TableRow>
                                {/* Select-all checkbox */}
                                <TableHead className="text-center">
                                    <BlogCheckbox
                                        checked={posts.length > 0 && selectedIds.size === posts.length}
                                        onClick={toggleSelectAll}
                                    />
                                </TableHead>
                                <TableHead>{t.dashboard.blog.table.thumbnail}</TableHead>
                                <TableHead>{t.dashboard.blog.table.title}</TableHead>
                                <TableHead>{t.dashboard.blog.table.category}</TableHead>
                                <TableHead>{t.dashboard.blog.table.status}</TableHead>
                                <TableHead>{t.dashboard.blog.table.author}</TableHead>
                                <TableHead>{t.dashboard.blog.table.date}</TableHead>
                                <TableHead className="text-right">{t.dashboard.blog.table.actions}</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {posts.map((post) => (
                                <TableRow
                                    key={post.id}
                                    clickable
                                    onClick={() => router.push(`/blog/${post.id}`)}
                                >
                                    {/* Checkbox — stopPropagation so it doesn't trigger row navigation */}
                                    <TableCell
                                        className="text-center"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <BlogCheckbox
                                            checked={selectedIds.has(post.id)}
                                            onClick={() => toggleSelect(post.id)}
                                        />
                                    </TableCell>

                                    {/* Thumbnail */}
                                    <TableCell>
                                        <div
                                            className="w-[64px] h-[48px] rounded-[12px] overflow-hidden shrink-0"
                                            style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)' }}
                                        >
                                            {post.thumbnail && (
                                                <img
                                                    src={getThumbUrl(typeof post.thumbnail === 'object' ? post.thumbnail.url : '')}
                                                    alt={post.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            )}
                                        </div>
                                    </TableCell>

                                    {/* Title — widest column; truncates, native tooltip shows full title on hover */}
                                    <TableCell>
                                        <span
                                            title={post.title}
                                            className="truncate block font-[600] text-[14px] leading-[1.4285714285714286em]"
                                            style={{ color: 'var(--dash-text)' }}
                                        >
                                            {post.title}
                                        </span>
                                    </TableCell>

                                    {/* Category */}
                                    <TableCell>
                                        <Badge variant="outline">
                                            {getCategoryName(post.category)}
                                        </Badge>
                                    </TableCell>

                                    {/* Status — clickable to toggle; TableCell stops row navigation */}
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => handleToggleStatus(post)}
                                            title={post.status === 'published' ? t.dashboard.blog.actions.moveToDraft : t.dashboard.blog.actions.publish}
                                            className="cursor-pointer transition-colors"
                                        >
                                            {post.status === 'published' ? (
                                                <Badge variant="success" dot>{t.dashboard.blog.filters.published}</Badge>
                                            ) : (
                                                <Badge variant="secondary" dot>{t.dashboard.blog.filters.draft}</Badge>
                                            )}
                                        </button>
                                    </TableCell>

                                    {/* Author */}
                                    <TableCell>
                                        <span className="truncate block text-[14px]" style={{ color: 'var(--dash-text-muted)' }}>
                                            {typeof post.author === 'object' && post.author
                                                ? (post.author.firstName
                                                    ? `${post.author.firstName} ${post.author.lastName || ''}`.trim()
                                                    : post.author.email?.split('@')[0])
                                                : t.dashboard.blog.unknownAuthor}
                                        </span>
                                    </TableCell>

                                    {/* Date */}
                                    <TableCell>
                                        <span className="text-[14px]" style={{ color: 'var(--dash-text-muted)' }}>
                                            {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(post.updatedAt))}
                                        </span>
                                    </TableCell>

                                    {/* Actions — stopPropagation so buttons don't trigger row navigation */}
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-end gap-1">
                                            <TableActionButton
                                                onClick={() => router.push(`/blog/${post.id}`)}
                                                title={t.dashboard.blog.actions.edit}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </TableActionButton>
                                            <TableActionButton
                                                variant="danger"
                                                onClick={() => openDeleteConfirm(post)}
                                                title={t.dashboard.blog.actions.delete}
                                            >
                                                <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                            </TableActionButton>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>


            {/* Delete Confirmation Modal — AC-2, Figma: 31958-7172 */}
            {
                deleteTarget && typeof document !== 'undefined' && createPortal(
                    <div className="dash-shell fixed inset-0 w-screen h-screen z-[999] flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                        <div
                            className="w-full flex flex-col items-center gap-[16px] rounded-[16px] p-[25px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]"
                            style={{
                                maxWidth: 347,
                                background: 'var(--dash-surface)',
                                border: '1px solid hsl(var(--primary)/0.3)',
                            }}
                        >
                            {/* Icon */}
                            <div className="flex justify-center items-center w-[64px] h-[64px] rounded-full bg-[hsl(var(--destructive)/0.1)] border border-[hsl(var(--destructive)/0.3)] shrink-0">
                                <Trash2 className="w-[27px] h-[24px] text-[hsl(var(--destructive))]" strokeWidth={1.5} />
                            </div>

                            {/* Text block */}
                            <div className="flex flex-col gap-[4px] w-full">
                                {/* Title */}
                                <div className="flex justify-center items-center w-full px-[92px]">
                                    <h3 className="font-['Inter'] font-[600] text-[20px] leading-[1.2em] text-center text-foreground">
                                        {t.dashboard.blog.actions.deleteConfirmTitle}
                                    </h3>
                                </div>
                                {/* Body */}
                                <p className="font-['Inter'] font-[400] text-[16px] leading-[1.5em] text-center text-[hsl(var(--muted-foreground))] w-full">
                                    {t.dashboard.blog.actions.deleteConfirmDetails.replace('{title}', deleteTarget.title)}
                                    {'\n'}{t.dashboard.blog.actions.deleteConfirmWarn}
                                </p>
                            </div>

                            {/* Warning box — only for published */}
                            {deleteTarget.status === 'published' && (
                                <div className="flex justify-center items-center gap-[10px] rounded-[6px] p-[6px] bg-[hsl(var(--warning)/0.1)] w-full">
                                    <p className="font-['Inter'] font-[400] text-[12px] leading-[1.333em] text-center text-[hsl(var(--warning))]" style={{ maxWidth: 296 }}>
                                        {t.dashboard.blog.actions.deletePublishedWarning}
                                    </p>
                                </div>
                            )}

                            {/* Buttons */}
                            <div className="flex flex-row justify-center items-center gap-[16px] w-full">
                                {/* Cancel */}
                                <button
                                    onClick={() => setDeleteTarget(null)}
                                    className="flex-1 flex items-center justify-center gap-[10px] py-[8px] px-[16px] rounded-[10px] bg-[hsl(var(--background))] border border-[hsl(var(--input-border))] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] hover:bg-white/5 transition-colors"
                                >
                                    <span className="font-['Inter'] font-[500] text-[14px] leading-[1.4286em] text-foreground">
                                        {t.dashboard.blog.actions.cancel}
                                    </span>
                                </button>
                                {/* Delete */}
                                <button
                                    onClick={handleConfirmDelete}
                                    disabled={isDeleting}
                                    className="flex-1 flex flex-row items-center justify-center gap-[6px] px-[10px] h-[36px] rounded-[10px] bg-[hsl(var(--destructive))] border border-[hsl(var(--input-border))] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isDeleting ? (
                                        <Loader2 className="w-4 h-4 animate-spin !text-white" />
                                    ) : (
                                        <Trash2 className="w-[16px] h-[16px] !text-white" />
                                    )}
                                    <span className="font-['Inter'] font-[500] text-[14px] leading-[1.4286em] !text-white">
                                        {isDeleting ? t.dashboard.blog.actions.deleting : t.dashboard.blog.actions.delete}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }

            {/* Bulk Delete Confirmation Modal — TC-F17-01-12, Figma: 31958-7197 */}
            {
                showBulkDeleteModal && typeof document !== 'undefined' && createPortal(
                    <div className="dash-shell fixed inset-0 w-screen h-screen z-[999] flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                        <div
                            className="w-full flex flex-col items-center gap-[16px] rounded-[16px] p-[25px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]"
                            style={{
                                maxWidth: 347,
                                background: 'var(--dash-surface)',
                                border: '1px solid hsl(var(--primary)/0.3)',
                            }}
                        >
                            {/* Icon */}
                            <div className="flex justify-center items-center w-[64px] h-[64px] rounded-full bg-[hsl(var(--destructive)/0.1)] border border-[hsl(var(--destructive)/0.3)] shrink-0">
                                <Trash2 className="w-[27px] h-[24px] text-[hsl(var(--destructive))]" strokeWidth={1.5} />
                            </div>

                            {/* Text block */}
                            <div className="flex flex-col gap-[4px] w-full">
                                {/* Title */}
                                <div className="flex justify-center items-center w-full px-[92px]">
                                    <h3 className="font-['Inter'] font-[600] text-[20px] leading-[1.2em] text-center text-foreground">
                                        {t.dashboard.blog.actions.bulkDeleteTitle.replace('{count}', selectedIds.size.toString())}
                                    </h3>
                                </div>
                                {/* Body */}
                                <p className="font-['Inter'] font-[400] text-[16px] leading-[1.5em] text-center text-[hsl(var(--muted-foreground))] w-full">
                                    {t.dashboard.blog.actions.bulkDeleteConfirm.replace('{count}', selectedIds.size.toString())}
                                    {'\n'}{t.dashboard.blog.actions.bulkDeleteWarning}
                                </p>
                            </div>

                            {/* Warning box — only when selection has published posts */}
                            {hasPublishedInSelection && (
                                <div className="flex justify-center items-center gap-[10px] rounded-[6px] p-[6px] bg-[hsl(var(--warning)/0.1)] w-full">
                                    <p className="font-['Inter'] font-[400] text-[12px] leading-[1.333em] text-center text-[hsl(var(--warning))]" style={{ maxWidth: 296 }}>
                                        {t.dashboard.blog.actions.bulkDeletePublishedWarning}
                                    </p>
                                </div>
                            )}

                            {/* Buttons */}
                            <div className="flex flex-row justify-center items-center gap-[16px] w-full">
                                {/* Cancel */}
                                <button
                                    onClick={() => setShowBulkDeleteModal(false)}
                                    className="flex-1 flex items-center justify-center gap-[10px] py-[8px] px-[16px] rounded-[10px] bg-[hsl(var(--background))] border border-[hsl(var(--input-border))] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] hover:bg-white/5 transition-colors"
                                >
                                    <span className="font-['Inter'] font-[500] text-[14px] leading-[1.4286em] text-foreground">
                                        {t.dashboard.blog.actions.cancel}
                                    </span>
                                </button>
                                {/* Delete */}
                                <button
                                    onClick={async () => {
                                        await handleBulkDelete()
                                        setShowBulkDeleteModal(false)
                                    }}
                                    disabled={bulkActionLoading}
                                    className="flex-1 flex flex-row items-center justify-center gap-[6px] px-[10px] h-[36px] rounded-[10px] bg-[hsl(var(--destructive))] border border-[hsl(var(--input-border))] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {bulkActionLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin !text-white" />
                                    ) : (
                                        <Trash2 className="w-[16px] h-[16px] !text-white" />
                                    )}
                                    <span className="font-['Inter'] font-[500] text-[14px] leading-[1.4286em] !text-white">
                                        {bulkActionLoading ? t.dashboard.blog.actions.deleting : t.dashboard.blog.actions.delete}
                                    </span>
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
        </div>
    )
}
