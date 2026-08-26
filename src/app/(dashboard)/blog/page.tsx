'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CategoryModal } from './_components/CategoryModal'
import { useI18n } from '@/i18n'
import {
    Plus,
    Trash2,
    Pencil,
    FileText,
    SearchX,
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
import { TablePagination, shouldShowTablePagination, useTablePageClamp } from '@/components/ui/table-pagination'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { TableEmptyState } from '@/components/ui/table-empty-state'
import { Badge } from '@/components/ui/badge'
import { TableSearch } from '@/components/ui/table-search'
import { FilterChip } from '@/components/ui/filter-chip'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

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
    // GH-1579: snap back when deletions strand page past the last page (meta null until first load → no-op)
    useTablePageClamp(page, meta?.totalDocs ?? 0, limit, setPage, !loading)
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
                    <h3 className="text-lg font-semibold text-foreground">{t.dashboard.blog.loadFailed}</h3>
                    <p className="text-sm text-muted-foreground">{error}</p>
                    <Button onClick={fetchPosts} variant="dashPrimary" size="dash">
                        {t.dashboard.blog.tryAgain}
                    </Button>
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
        // GH-1518: fixed height + overflow-hidden chỉ dành cho mobile/iPad mini (<820px) — card grid
        // bên trong tự scroll (flex-1 min-h-0). Từ 820px (table layout) KHÔNG được khóa chiều cao:
        // table không có tầng scroll riêng nên bị cắt cụt khi nhiều bài → mất pagination footer,
        // trang đứng im. ≥820px trả về scroll tự nhiên của shell (giống Products).
        <div className="flex flex-col w-full font-['Inter'] h-[calc(100vh-120px)] overflow-hidden min-[820px]:h-auto min-[820px]:overflow-visible min-[820px]:pb-20">
            {/* Header Container — title + actions on one row from sm (tablet inline); stacks on mobile */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center w-full gap-4 sm:gap-0">
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

            {/* Filters — shared <TableSearch> + <FilterChip> primitives (GH-1222 DS).
                GH-1516: mobile tightens the header→filters gap (32px read as a dead band). */}
            <div className="flex flex-col xl:flex-row xl:items-center gap-2 w-full mt-4 sm:mt-[32px]">
                <TableSearch
                    value={search}
                    onSearch={setSearch}
                    placeholder={t.dashboard.blog.filters.search}
                    className="w-full xl:max-w-[420px]"
                />

                {/* Mobile (<sm): 3 chips share one row as an equal 3-col grid + hide each chip's
                    "Label :" prefix (value-only) so the whole filter bar is just 2 rows (search + chips).
                    sm+ reverts to the original auto-width flex-wrap. Scoped here — shared FilterChip untouched. */}
                {/* GH-1518: nhắm .chip-trigger (marker của FilterChip) thay vì `button` trần —
                    dropdown panel KHÔNG portal nên `sm:[&_button]:w-auto` cũ ăn lan vào option
                    button bên trong panel, mất w-full → inline-block tự co → option wrap 2 cột. */}
                <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center
                                [&_.chip-trigger]:w-full sm:[&_.chip-trigger]:w-auto [&_.chip-trigger]:px-2.5 sm:[&_.chip-trigger]:px-3
                                [&_.chip-trigger>span]:min-w-0 [&_.chip-trigger>span]:flex-1 sm:[&_.chip-trigger>span]:flex-none
                                [&_[data-chip-label]]:hidden [&_[data-chip-sep]]:hidden sm:[&_[data-chip-label]]:inline sm:[&_[data-chip-sep]]:inline">
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
                    <Button
                        onClick={handleBulkPublish}
                        disabled={bulkActionLoading}
                        variant="dashPrimary"
                        size="dash"
                    >
                        <Eye className="w-[16px] h-[16px]" />
                        {t.dashboard.blog.actions.bulkPublish || 'Publish'}
                    </Button>
                    <Button
                        onClick={() => setShowBulkDeleteModal(true)}
                        disabled={bulkActionLoading}
                        variant="destructive"
                        size="dash"
                    >
                        <Trash2 className="w-[16px] h-[16px]" />
                        {t.dashboard.blog.actions.delete}
                    </Button>
                </div>
            )}

            {/* Card Layout — shown on mobile + iPad mini (< 820px); 1 col on mobile, 2 cols from md.
                iPad Air and up (>= 820px) use the desktop table below. */}
            <div className="grid grid-cols-1 md:grid-cols-2 content-start w-full flex-1 overflow-y-auto min-[820px]:hidden gap-4 mt-[24px] min-h-0">
                {posts.length === 0 ? (
                    <div className="md:col-span-2">
                        <TableEmptyState
                            icon={<SearchX />}
                            title={t.dashboard.blog.noMatches}
                        />
                    </div>
                ) : posts.map((post) => (
                    <div
                        key={`mobile-${post.id}`}
                        className="flex flex-col bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-[16px] p-3 md:p-4 gap-3"
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
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="font-['Inter'] font-[600] text-[14px] leading-[20px] text-foreground line-clamp-2 min-h-[40px] flex-1 min-w-0 cursor-default">
                                                {post.title}
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent
                                            side="top"
                                            align="start"
                                            onClick={(e) => e.stopPropagation()}
                                            className="max-w-[360px] max-h-[50vh] overflow-y-auto whitespace-normal break-words leading-relaxed"
                                            style={{ backgroundColor: 'var(--dash-surface)', color: 'var(--dash-text)', borderColor: 'var(--dash-border)' }}
                                        >
                                            {post.title}
                                        </TooltipContent>
                                    </Tooltip>
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
                        <div className="flex flex-row items-center gap-2 border-t border-border pt-2">
                            <Button
                                onClick={() => router.push(`/blog/${post.id}`)}
                                variant="ghost"
                                className="flex-1 min-w-0 h-8 md:h-9 rounded-[10px] md:rounded-[12px] px-2 gap-1.5 text-[12px] md:text-[13px] font-semibold text-[hsl(var(--success))] bg-[hsl(var(--success))]/10 border border-[hsl(var(--success))]/20 hover:bg-[hsl(var(--success))]/20 hover:text-[hsl(var(--success))]"
                            >
                                <Eye className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
                                <span className="truncate">{t.dashboard.blog.actions.view}</span>
                            </Button>
                            <Button
                                onClick={() => router.push(`/blog/${post.id}`)}
                                variant="ghost"
                                className="flex-1 min-w-0 h-8 md:h-9 rounded-[10px] md:rounded-[12px] px-2 gap-1.5 text-[12px] md:text-[13px] font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/20 hover:bg-[hsl(var(--primary))]/20 hover:text-[hsl(var(--primary))]"
                            >
                                <Pencil className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
                                <span className="truncate">{t.dashboard.blog.actions.edit}</span>
                            </Button>
                            <Button
                                onClick={() => openDeleteConfirm(post)}
                                variant="ghost"
                                className="flex-1 min-w-0 h-8 md:h-9 rounded-[10px] md:rounded-[12px] px-2 gap-1.5 text-[12px] md:text-[13px] font-semibold text-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10 border border-[hsl(var(--destructive))]/20 hover:bg-[hsl(var(--destructive))]/20 hover:text-[hsl(var(--destructive))]"
                            >
                                <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
                                <span className="truncate">{t.dashboard.blog.actions.delete}</span>
                            </Button>
                        </div>
                    </div>
                ))}

                {/* Pagination — spans both columns under the card grid */}
                {meta && shouldShowTablePagination(meta.totalDocs) && (
                    <div className="py-4 shrink-0 md:col-span-2">
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

            {/* Table Layout — iPad Air and up (>= 820px), same as desktop. GH-1222 DS migration */}
            <div className="hidden min-[820px]:block w-full mt-[32px]">
                {posts.length === 0 ? (
                    <TableEmptyState
                        icon={<SearchX />}
                        title={t.dashboard.blog.noMatches}
                    />
                ) : (
                    <Table
                        // dash-table-compact (globals.css): shared compact font + padding below xl so the
                        // table fits iPad Air → pre-desktop without horizontal scroll. Desktop (>= 1280)
                        // restores the original 1100 min-width + full sizing.
                        className="table-fixed w-full dash-table-compact min-[1280px]:min-w-[1100px]"
                        footer={
                            meta && shouldShowTablePagination(meta.totalDocs) ? (
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
                            <col className="w-[10%] min-[1280px]:w-[8%]" />
                            <col className="w-[19%] min-[1280px]:w-[28%]" />
                            <col style={{ width: '13%' }} />
                            <col className="w-[15%] min-[1280px]:w-[12%]" />
                            <col style={{ width: '14%' }} />
                            <col style={{ width: '13%' }} />
                            <col className="w-[11%] min-[1280px]:w-[7%]" />
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
                                            className="w-[44px] h-[33px] min-[1280px]:w-[64px] min-[1280px]:h-[48px] rounded-[10px] min-[1280px]:rounded-[12px] overflow-hidden shrink-0"
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

                                    {/* Title — widest column; truncates, Radix tooltip shows full title on hover (matches Discounts) */}
                                    <TableCell>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span
                                                    className="truncate block font-[600] text-[14px] leading-[1.4285714285714286em] cursor-default"
                                                    style={{ color: 'var(--dash-text)' }}
                                                >
                                                    {post.title}
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent
                                                side="top"
                                                align="start"
                                                onClick={(e) => e.stopPropagation()}
                                                className="max-w-[360px] max-h-[50vh] overflow-y-auto whitespace-normal break-words leading-relaxed"
                                                style={{ backgroundColor: 'var(--dash-surface)', color: 'var(--dash-text)', borderColor: 'var(--dash-border)' }}
                                            >
                                                {post.title}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TableCell>

                                    {/* Category */}
                                    <TableCell>
                                        <Badge variant="outline">
                                            {getCategoryName(post.category)}
                                        </Badge>
                                    </TableCell>

                                    {/* Status — clickable to toggle; TableCell stops row navigation */}
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => handleToggleStatus(post)}
                                            title={post.status === 'published' ? t.dashboard.blog.actions.moveToDraft : t.dashboard.blog.actions.publish}
                                            className="h-auto p-0 hover:bg-transparent"
                                        >
                                            {post.status === 'published' ? (
                                                <Badge variant="success" dot>{t.dashboard.blog.filters.published}</Badge>
                                            ) : (
                                                <Badge variant="secondary" dot>{t.dashboard.blog.filters.draft}</Badge>
                                            )}
                                        </Button>
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
                                        <div className="flex items-center justify-end gap-0.5 min-[1280px]:gap-1">
                                            <TableActionButton
                                                className="h-7 w-7 min-[1280px]:h-8 min-[1280px]:w-8"
                                                onClick={() => router.push(`/blog/${post.id}`)}
                                                title={t.dashboard.blog.actions.edit}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </TableActionButton>
                                            <TableActionButton
                                                className="h-7 w-7 min-[1280px]:h-8 min-[1280px]:w-8"
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
            <ConfirmModal
                open={!!deleteTarget}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={handleConfirmDelete}
                title={t.dashboard.blog.actions.deleteConfirmTitle}
                description={
                    deleteTarget ? (
                        <span>
                            {t.dashboard.blog.actions.deleteConfirmDetails.replace('{title}', deleteTarget.title)}
                            {'\n'}{t.dashboard.blog.actions.deleteConfirmWarn}
                            {deleteTarget.status === 'published' && (
                                <span className="block mt-2 text-warning text-xs">
                                    {t.dashboard.blog.actions.deletePublishedWarning}
                                </span>
                            )}
                        </span>
                    ) : undefined
                }
                confirmLabel={t.dashboard.blog.actions.delete}
                cancelLabel={t.dashboard.blog.actions.cancel}
                variant="danger"
                loading={isDeleting}
            />

            {/* Bulk Delete Confirmation Modal — TC-F17-01-12, Figma: 31958-7197 */}
            <ConfirmModal
                open={showBulkDeleteModal}
                onCancel={() => setShowBulkDeleteModal(false)}
                onConfirm={async () => {
                    await handleBulkDelete()
                    setShowBulkDeleteModal(false)
                }}
                title={t.dashboard.blog.actions.bulkDeleteTitle.replace('{count}', selectedIds.size.toString())}
                description={
                    <span>
                        {t.dashboard.blog.actions.bulkDeleteConfirm.replace('{count}', selectedIds.size.toString())}
                        {'\n'}{t.dashboard.blog.actions.bulkDeleteWarning}
                        {hasPublishedInSelection && (
                            <span className="block mt-2 text-warning text-xs">
                                {t.dashboard.blog.actions.bulkDeletePublishedWarning}
                            </span>
                        )}
                    </span>
                }
                confirmLabel={t.dashboard.blog.actions.delete}
                cancelLabel={t.dashboard.blog.actions.cancel}
                variant="danger"
                loading={bulkActionLoading}
            />

            {isCategoryModalOpen && (
                <CategoryModal
                    onClose={() => setIsCategoryModalOpen(false)}
                    onCategoryUpdated={() => {
                        getBlogCategoriesAction()
                            .then(docs => setCategories(docs || []))
                            .catch(() => { })
                        fetchPosts()
                    }}
                />
            )}
        </div>
    )
}
