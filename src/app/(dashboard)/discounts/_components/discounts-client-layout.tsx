'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Download, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { DiscountsToolbar } from './discounts-toolbar'
import { DiscountsTable, type Discount } from './discounts-table'
import { DiscountDeleteDialog } from './discount-delete-dialog'
import { useI18n } from '@/i18n'
import { DiscountsTabNav } from './discounts-tab-nav'
import { useUrlPagination } from './use-url-pagination'

type StatusFilter = 'all' | 'active' | 'inactive'
type TypeFilter = 'all' | 'percentage' | 'fixed'
type SortKey = 'code' | 'type' | 'value' | 'usageCount' | 'expiresAt' | 'createdAt' | 'status'

export function DiscountsClientLayout() {
    const router = useRouter()
    const { t, ti } = useI18n()
    const d = t.dashboard.discounts.list

    const [discounts, setDiscounts] = useState<Discount[]>([])
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(1)
    // Page + limit synced to URL (?page=N&limit=M); default 10/page (Bug #12 AC, both tabs).
    const { page, setPage, limit, setLimit } = useUrlPagination(10)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
    const [sortBy, setSortBy] = useState<SortKey>('createdAt')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
    const [loading, setLoading] = useState(true)
    const [isFirstLoad, setIsFirstLoad] = useState(true)
    // Delete-confirm modal target (null = closed). Same styled modal the edit form uses — no native confirm().
    const [deleteTarget, setDeleteTarget] = useState<Discount | null>(null)

    // Generation ref — stale fetch guard (same pattern as customers layout)
    const genRef = useRef(0)

    const load = useCallback(async () => {
        const gen = ++genRef.current
        setLoading(true)
        try {
            const sort = sortDir === 'desc' ? `-${sortBy}` : sortBy
            const params = new URLSearchParams({
                page: String(page),
                limit: String(limit),
                sort,
            })
            if (statusFilter !== 'all') params.set('status', statusFilter)
            if (typeFilter !== 'all') params.set('type', typeFilter)
            if (search) params.set('search', search)

            const res = await fetch(`/api/v1/discounts?${params.toString()}`, {
                credentials: 'include',
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const json = await res.json()

            if (gen !== genRef.current) return

            // API returns Payload pagination shape: { docs, totalDocs, totalPages, page }
            setDiscounts(json.docs ?? [])
            setTotal(json.totalDocs ?? 0)
            setTotalPages(json.totalPages ?? 1)
            setIsFirstLoad(false)
        } catch (err) {
            if (gen !== genRef.current) return
            console.error('[Discounts load]', err)
            toast.error(d.loadFailed)
        } finally {
            if (gen === genRef.current) setLoading(false)
        }
    }, [search, statusFilter, typeFilter, sortBy, sortDir, page, limit, d.loadFailed])

    useEffect(() => { load() }, [load])

    // Stable handlers — reset page on filter/sort change
    const handleSearch       = useCallback((q: string)              => { setSearch(q);        setPage(1) }, [])
    const handleStatusFilter = useCallback((s: StatusFilter)        => { setStatusFilter(s);  setPage(1) }, [])
    const handleTypeFilter   = useCallback((tf: TypeFilter)         => { setTypeFilter(tf);   setPage(1) }, [])

    const handleSort = useCallback((key: SortKey) => {
        if (sortBy === key) {
            setSortDir(dir => dir === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(key)
            setSortDir('asc')
        }
        setPage(1)
    }, [sortBy])

    const handleEdit = useCallback((id: string) => { router.push(`/discounts/${id}`) }, [router])
    const handleNew = useCallback(() => { router.push('/discounts/new') }, [router])
    const handleExport = useCallback(async () => {
        try {
            const res = await fetch('/api/v1/discounts/export')
            if (res.status === 413) {
                toast.error(d.exportLimitError)
                return
            }
            if (!res.ok) {
                toast.error(d.exportFailed)
                return
            }
            // Stream → blob → download with the server-provided filename (no raw browser navigation).
            const blob = await res.blob()
            const cd = res.headers.get('Content-Disposition') || ''
            const filename = /filename="?([^"]+)"?/.exec(cd)?.[1] ?? 'discounts.csv'
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
        } catch {
            toast.error(d.exportFailed)
        }
    }, [d.exportLimitError, d.exportFailed])

    // Open the styled confirm modal (per F33 design — shared with the edit form, no native confirm()).
    const handleDelete = useCallback((discount: Discount) => { setDeleteTarget(discount) }, [])

    // Run the actual delete after the user confirms in the modal.
    const confirmDelete = useCallback(async () => {
        const discount = deleteTarget
        if (!discount) return
        setDeleteTarget(null)
        // Optimistic remove
        setDiscounts(prev => prev.filter(dc => dc.id !== discount.id))
        try {
            const res = await fetch(`/api/v1/discounts/${discount.id}`, {
                method: 'DELETE',
                credentials: 'include',
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            toast.success(ti(d.deleteSuccess, { code: discount.code }))
        } catch (err) {
            console.error('[Discounts delete]', err)
            // Restore on error
            setDiscounts(prev => [discount, ...prev])
            toast.error(ti(d.deleteFailed, { code: discount.code }))
        }
    }, [deleteTarget, d.deleteSuccess, d.deleteFailed, ti])

    const hasFilters = !!(search || statusFilter !== 'all' || typeFilter !== 'all')
    const isEmpty = !loading && discounts.length === 0

    return (
        <div className="space-y-5 pb-20">
            {/* Header row: title + action buttons (tabs sit BELOW, matching Email Templates) */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-[24px] font-bold" style={{ color: 'var(--dash-text)' }}>
                        {d.title}
                    </h1>
                    <p className="text-[13px] mt-1 max-w-2xl" style={{ color: 'var(--dash-text-muted)' }}>
                        {d.subtitle}
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    <button
                        type="button"
                        onClick={handleExport}
                        className="flex items-center gap-2 h-[36px] px-4 rounded-[10px] text-[13px] font-medium transition-colors hover:bg-white/[0.05] cursor-pointer"
                        style={{ border: '1px solid var(--dash-border)', color: 'var(--dash-text)' }}
                    >
                        <Download className="w-3.5 h-3.5" />
                        {d.exportCsv}
                    </button>
                    <button
                        type="button"
                        onClick={handleNew}
                        className="flex items-center gap-2 h-[36px] px-4 rounded-[10px] text-[13px] font-semibold cursor-pointer text-white"
                        style={{ background: 'linear-gradient(135deg,#0d9488 0%,#0891b2 100%)' }}
                    >
                        <Plus className="w-3.5 h-3.5" />
                        {d.createDiscount}
                    </button>
                </div>
            </div>

            <DiscountsTabNav />

            <DiscountsToolbar
                search={search}
                onSearch={handleSearch}
                statusFilter={statusFilter}
                onStatusFilter={handleStatusFilter}
                typeFilter={typeFilter}
                onTypeFilter={handleTypeFilter}
            />

            {/* Empty states */}
            {isEmpty && !isFirstLoad && (
                <div
                    className="flex flex-col items-center justify-center rounded-[12px] py-20 gap-3"
                    style={{ border: '1px solid var(--dash-border)', background: 'var(--dash-surface)' }}
                >
                    {hasFilters ? (
                        <>
                            <p className="text-[16px] font-semibold" style={{ color: 'var(--dash-text)' }}>{d.emptyNoResults}</p>
                            <p className="text-[14px]" style={{ color: 'var(--dash-text-muted)' }}>{d.emptyNoResultsSubtitle}</p>
                        </>
                    ) : (
                        <>
                            <p className="text-[16px] font-semibold" style={{ color: 'var(--dash-text)' }}>{d.emptyNoDiscounts}</p>
                            <p className="text-[14px]" style={{ color: 'var(--dash-text-muted)' }}>{d.emptyNoDiscountsSubtitle}</p>
                            <button
                                type="button"
                                onClick={handleNew}
                                className="mt-2 flex items-center gap-2 h-[40px] px-5 rounded-[10px] text-[13px] font-semibold text-white cursor-pointer"
                                style={{ background: 'linear-gradient(135deg,#0d9488 0%,#0891b2 100%)' }}
                            >
                                + {d.createDiscount}
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Table — show while loading or has results */}
            {(!isEmpty || loading) && (
                <DiscountsTable
                    discounts={discounts}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    loading={loading}
                />
            )}

            {/* Pagination footer — always visible */}
            {!loading && (
                <div className="flex items-center justify-between gap-4 flex-wrap text-[13px]" style={{ color: 'var(--dash-text-muted)' }}>
                    {/* Left: count + rows per page */}
                    <div className="flex items-center gap-4">
                        <span>
                            {d.showing}{' '}
                            <strong style={{ color: 'var(--dash-text)' }}>
                                {total === 0 ? 0 : (page - 1) * limit + 1}–{Math.min(page * limit, total)}
                            </strong>{' '}
                            {d.of}{' '}
                            <strong style={{ color: 'var(--dash-text)' }}>{total}</strong>{' '}
                            {d.codes}
                        </span>
                        <div className="flex items-center gap-2">
                            <span>{d.rowsPerPage}</span>
                            <select
                                value={limit}
                                onChange={e => { setLimit(Number(e.target.value)); setPage(1) }}
                                className="h-[32px] rounded-[8px] px-2 pr-6 text-[13px] cursor-pointer outline-none appearance-none"
                                style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)', color: 'var(--dash-text)' }}
                            >
                                {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Right: page navigation */}
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            disabled={page <= 1}
                            onClick={() => setPage(p => p - 1)}
                            className="h-[32px] w-[32px] flex items-center justify-center rounded-[8px] transition-colors disabled:opacity-30 cursor-pointer"
                            style={{ border: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)' }}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                            const p = totalPages <= 7 ? i + 1 : i + Math.max(1, page - 3)
                            if (p > totalPages) return null
                            return (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setPage(p)}
                                    className="h-[32px] w-[32px] flex items-center justify-center rounded-[8px] text-[13px] font-medium transition-colors cursor-pointer"
                                    style={p === page
                                        ? { background: '#0891b2', color: '#fff', border: '1px solid #0891b2' }
                                        : { border: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)' }
                                    }
                                >
                                    {p}
                                </button>
                            )
                        })}
                        <button
                            type="button"
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="h-[32px] w-[32px] flex items-center justify-center rounded-[8px] transition-colors disabled:opacity-30 cursor-pointer"
                            style={{ border: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)' }}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Delete confirmation modal (replaces native confirm; matches the edit-form modal) */}
            {deleteTarget && (
                <DiscountDeleteDialog
                    code={deleteTarget.code}
                    usageCount={deleteTarget.usageCount}
                    open={!!deleteTarget}
                    onConfirm={confirmDelete}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}
        </div>
    )
}
