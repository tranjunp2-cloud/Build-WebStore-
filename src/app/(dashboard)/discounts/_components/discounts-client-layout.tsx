'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Download, Plus, Percent, SearchX } from 'lucide-react'
import { TablePagination, shouldShowTablePagination, useTablePageClamp } from '@/components/ui/table-pagination'
import { Button } from '@/components/ui/button'
import { TableEmptyState } from '@/components/ui/table-empty-state'
import { DiscountsToolbar, type StatusFilter } from './discounts-toolbar'
import { DiscountsTable, type Discount } from './discounts-table'
import { DiscountDeleteDialog } from './discount-delete-dialog'
import { useI18n } from '@/i18n'
import { DiscountsTabNav } from './discounts-tab-nav'
import { useUrlPagination } from './use-url-pagination'

type TypeFilter = 'all' | 'percentage' | 'fixed'
type SortKey = 'code' | 'type' | 'value' | 'usageCount' | 'expiresAt' | 'createdAt' | 'status'

export function DiscountsClientLayout() {
    const router = useRouter()
    const { t, ti } = useI18n()
    const d = t.dashboard.discounts.list

    const [discounts, setDiscounts] = useState<Discount[]>([])
    const [total, setTotal] = useState(0)
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

    // GH-1579: snap back when deletions strand page past the last page.
    // Disabled while loading so the URL-restored ?page=N isn't clobbered before data arrives.
    useTablePageClamp(page, total, limit, setPage, !loading)

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
            // Refetch AFTER the server commit to reconcile records + total in one shot:
            // deleting across the 11→10 boundary must pull in the row that lives on the
            // next server page (a bare total decrement would strand it invisibly), and
            // the page clamp handles any page overflow after the refetch (GH-1579).
            load()
        } catch (err) {
            console.error('[Discounts delete]', err)
            // Restore on error
            setDiscounts(prev => [discount, ...prev])
            toast.error(ti(d.deleteFailed, { code: discount.code }))
        }
    }, [deleteTarget, d.deleteSuccess, d.deleteFailed, ti, load])

    const hasFilters = !!(search || statusFilter !== 'all' || typeFilter !== 'all')
    const isEmpty = !loading && discounts.length === 0

    return (
        <div className="space-y-5 pb-20">
            {/* Header row: title + action buttons (tabs sit BELOW, matching Email Templates) */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                    <h1 className="text-[24px] font-bold" style={{ color: 'var(--dash-text)' }}>
                        {d.title}
                    </h1>
                    <p className="text-[13px] mt-1 max-w-2xl" style={{ color: 'var(--dash-text-muted)' }}>
                        {d.subtitle}
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    <Button variant="dashSecondary" size="dash" onClick={handleExport}>
                        <Download />
                        {d.exportCsv}
                    </Button>
                    <Button variant="dashPrimary" size="dash" onClick={handleNew}>
                        <Plus />
                        {d.createDiscount}
                    </Button>
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
                hasFilters ? (
                    <TableEmptyState
                        icon={<SearchX />}
                        title={d.emptyNoResults}
                        subtitle={d.emptyNoResultsSubtitle}
                    />
                ) : (
                    <TableEmptyState
                        icon={<Percent />}
                        title={d.emptyNoDiscounts}
                        subtitle={d.emptyNoDiscountsSubtitle}
                        action={
                            <Button variant="dashPrimary" size="dash" onClick={handleNew}>
                                <Plus className="w-3.5 h-3.5" />
                                {d.createDiscount}
                            </Button>
                        }
                    />
                )
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
                    // Pagination lives INSIDE the table card (F33 design) — shared <TablePagination>.
                    footer={shouldShowTablePagination(total) ? (
                        <TablePagination
                            page={page}
                            total={total}
                            limit={limit}
                            onPageChange={setPage}
                            onLimitChange={(n) => { setLimit(n); setPage(1) }}
                            labels={{ showing: d.showing, of: d.of, unit: d.codes, rowsPerPage: d.rowsPerPage }}
                        />
                    ) : undefined}
                />
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
