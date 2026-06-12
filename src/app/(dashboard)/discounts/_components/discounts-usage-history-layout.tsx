'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Lock, Search, X, Receipt, SearchX, ArrowUpRight, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { fmtRM, fmtValue, fmtDate } from '@/lib/discounts/format'
import { useI18n } from '@/i18n'
import { DiscountsTabNav } from './discounts-tab-nav'
import { useUrlPagination } from './use-url-pagination'

interface UsageRow {
    id: string
    discount: { id: string; code: string; type: string; value: number } | null
    /** Code snapshot — survives discount deletion; falls back to the relation for legacy rows. */
    discountCode?: string | null
    /** Type/value snapshots — keep audit fidelity after the discount is hard-deleted. */
    discountType?: string | null
    discountValue?: number | null
    order: { id: string; orderNumber?: string } | null
    amountApplied: number
    customerEmail?: string | null
    usedAt?: string | null
}

interface ApiResponse {
    success: boolean
    docs: UsageRow[]
    totalDocs: number
    totalPages: number
    page: number
}

export function DiscountsUsageHistoryLayout() {
    const { t } = useI18n()
    const d = t.dashboard.discounts.usageHistory

    const [rows, setRows] = useState<UsageRow[]>([])
    const [loading, setLoading] = useState(true)
    // Page + limit synced to URL (?page=N&limit=M); default 10/page (Bug #12 AC, both tabs).
    const { page, setPage, limit, setLimit } = useUrlPagination(10)
    const [totalPages, setTotalPages] = useState(1)
    const [totalDocs, setTotalDocs] = useState(0)
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')

    // Debounce the input so each keystroke doesn't hit the API; reset to page 1 on a new query.
    // Value-compare guard: setPage(1) fires only when the applied query actually CHANGES, so the
    // mount run (search '' === applied '') never clobbers the page restored from ?page=N by
    // useUrlPagination (Bug #12 AC). A first-run flag would not survive React Strict Mode's dev
    // double-effect (refs persist across the simulated remount); comparing values is idempotent.
    const appliedSearch = useRef('')
    useEffect(() => {
        const id = setTimeout(() => {
            const next = search.trim()
            if (next === appliedSearch.current) return
            appliedSearch.current = next
            setDebouncedSearch(next)
            setPage(1)
        }, 300)
        return () => clearTimeout(id)
    }, [search])

    // Server-side search across the WHOLE dataset (not just the current page).
    useEffect(() => {
        setLoading(true)
        const qs = `limit=${limit}&page=${page}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}`
        fetch(`/api/v1/discounts/usage-history?${qs}`)
            .then((r) => r.json())
            .then((json: ApiResponse) => {
                if (json.success) {
                    setRows(json.docs ?? [])
                    setTotalPages(json.totalPages ?? 1)
                    setTotalDocs(json.totalDocs ?? 0)
                }
            })
            .catch(() => {/* silent — empty state shown */})
            .finally(() => setLoading(false))
    }, [page, limit, debouncedSearch])

    const hasAnyData = rows.length > 0 || loading
    const textMuted = { color: 'var(--dash-text-muted)' } as React.CSSProperties
    const textMain  = { color: 'var(--dash-text)' } as React.CSSProperties

    const TABLE_HEADERS = [
        d.tableCode,
        d.tableType,
        d.tableAmountApplied,
        d.tableOrderNum,
        d.tableCustomerEmail,
        d.tableUsedDate,
    ]

    return (
        <div className="flex flex-col gap-5">
            {/* Header (tabs sit BELOW, matching Email Templates) */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-[24px] font-bold" style={textMain}>{d.title}</h1>
                    <p className="mt-1 text-sm" style={textMuted}>
                        {d.subtitle}
                    </p>
                </div>
                <span
                    className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium shrink-0 mt-1"
                    style={{ background: 'var(--dash-surface-hover)', color: 'var(--dash-text-muted)', border: '1px solid var(--dash-border)' }}
                >
                    <Lock className="h-3 w-3" />
                    {d.readOnly}
                </span>
            </div>

            <DiscountsTabNav />

            {/* Search toolbar */}
            <div
                className="group flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 max-w-sm transition-colors focus-within:border-[var(--dash-accent,#6366f1)]"
                style={{ background: 'var(--dash-surface-hover)', borderColor: 'var(--dash-border)' }}
            >
                <Search className="h-4 w-4 shrink-0" style={textMuted} />
                <input
                    className="flex-1 min-w-0 border-0 bg-transparent p-0 text-sm outline-none focus:outline-none focus:ring-0 placeholder:opacity-70"
                    style={textMain}
                    placeholder={d.searchPlaceholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                    <button
                        onClick={() => setSearch('')}
                        className="shrink-0 rounded p-0.5 transition-opacity hover:opacity-70"
                        style={textMuted}
                        aria-label={d.clearSearch}
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {/* Card */}
            <div
                className="rounded-lg border overflow-hidden"
                style={{ background: 'var(--dash-surface)', borderColor: 'var(--dash-border)' }}
            >
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-sm" style={textMuted}>{d.loading}</div>
                ) : !hasAnyData ? (
                    <EmptyNoData />
                ) : rows.length === 0 ? (
                    <EmptyNoResults onClear={() => setSearch('')} />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr style={{ background: 'var(--dash-surface)', borderBottom: '1px solid var(--dash-border)' }}>
                                        {TABLE_HEADERS.map((h) => (
                                            <th
                                                key={h}
                                                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                                                style={textMuted}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((u, i) => (
                                        <tr
                                            key={u.id}
                                            style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--dash-border)' : undefined }}
                                        >
                                            <td className="px-4 py-3">
                                                <span
                                                    className="inline-flex w-fit items-center rounded-[4px] border px-2.5 py-[3px] font-mono text-[12px] font-semibold tracking-wide"
                                                    style={{ background: 'var(--dash-surface-hover)', color: 'var(--dash-text)', borderColor: 'var(--dash-border)' }}
                                                >
                                                    {u.discountCode ?? u.discount?.code ?? '—'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3" style={textMuted}>
                                                {u.discountType != null && u.discountValue != null
                                                    ? fmtValue(u.discountType, u.discountValue)
                                                    : u.discount
                                                        ? fmtValue(u.discount.type, u.discount.value)
                                                        : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-left font-mono text-green-400">
                                                −{fmtRM(u.amountApplied)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {u.order ? (
                                                    <a
                                                        href={`/orders?order=${u.order.id}`}
                                                        className="inline-flex items-center gap-1 text-sky-500 transition-opacity hover:opacity-80 dark:text-sky-400"
                                                    >
                                                        {/* Order # as a kbd-key box (muted mono pill); the ↗ arrow sits OUTSIDE in the link color — matches design */}
                                                        <span
                                                            className="rounded-[3px] border px-[5px] py-px font-mono text-[11px]"
                                                            style={{ background: 'var(--dash-surface-hover)', borderColor: 'var(--dash-border)', color: 'var(--dash-text-muted)' }}
                                                        >
                                                            {u.order.orderNumber ?? u.order.id}
                                                        </span>
                                                        <ArrowUpRight className="h-3 w-3" />
                                                    </a>
                                                ) : '—'}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs" style={textMuted}>
                                                {u.customerEmail ?? '—'}
                                            </td>
                                            <td className="px-4 py-3 text-xs" style={textMuted} title={u.usedAt ?? ''}>
                                                {fmtDate(u.usedAt)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer — phân trang đồng bộ trang Customers (range + rows/trang + paginator có …) */}
                        <UsageHistoryFooter
                            total={totalDocs}
                            page={page}
                            setPage={setPage}
                            limit={limit}
                            setLimit={setLimit}
                        />
                    </>
                )}
            </div>
        </div>
    )
}

/**
 * Footer phân trang — đồng bộ UX với trang Customers (TableFooter):
 * range "Showing from–to of total", chọn rows/trang [10,25,50,100], paginator rút gọn bằng "…".
 */
function UsageHistoryFooter({
    total,
    page,
    setPage,
    limit,
    setLimit,
}: {
    total: number
    page: number
    setPage: (p: number) => void
    limit: number
    setLimit: (l: number) => void
}) {
    const { t } = useI18n()
    const d = t.dashboard.discounts.usageHistory
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const from = total === 0 ? 0 : Math.min((page - 1) * limit + 1, total)
    const to = Math.min(page * limit, total)

    // First + last page luôn hiện; quanh trang hiện tại ±2; phần còn lại gộp thành "…".
    const pageRange = useMemo(() => {
        const delta = 2
        const result: (number | '…')[] = []
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
                result.push(i)
            } else if (result[result.length - 1] !== '…') {
                result.push('…')
            }
        }
        return result
    }, [totalPages, page])

    return (
        <div
            className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3"
            style={{ fontSize: 12, color: 'var(--cus-text-muted)', borderColor: 'var(--dash-border)' }}
        >
            <div className="flex items-center gap-4 flex-wrap">
                <span>
                    {d.showingOf}{' '}
                    <strong style={{ color: 'var(--dash-text)' }}>{from}–{to}</strong>
                    {' '}{d.ofTotal}{' '}
                    <strong style={{ color: 'var(--dash-text)' }}>{total}</strong>
                    {' '}{d.ofRedemptions}
                </span>
                <div className="flex items-center gap-2">
                    <span>{d.rowsPerPage}</span>
                    <div className="relative inline-flex items-center">
                        <select
                            value={limit}
                            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}
                            className="h-7 pl-2 pr-6 rounded-[6px] text-[12px] outline-none cursor-pointer appearance-none"
                            style={{ background: 'var(--cus-surface-select)', border: '1px solid var(--cus-border-strong)', color: 'var(--cus-text-muted)' }}
                        >
                            {[10, 25, 50, 100].map((n) => (
                                <option key={n} value={n}>{n}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-1.5 w-3 h-3 pointer-events-none" style={{ color: 'var(--cus-text-muted)' }} />
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-1">
                <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="flex items-center justify-center rounded-[6px] transition-colors cursor-pointer disabled:opacity-40 hover:bg-black/[0.05] dark:hover:bg-white/[0.05]"
                    style={{ minWidth: 30, height: 30, color: 'var(--cus-text-muted)', background: 'transparent', border: 'none' }}
                >
                    <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {pageRange.map((p, i) =>
                    p === '…' ? (
                        <span key={`ell-${i}`} className="flex items-center justify-center text-[12px]" style={{ minWidth: 30, height: 30, color: 'var(--cus-text-muted)' }}>
                            …
                        </span>
                    ) : (
                        <button
                            key={p}
                            type="button"
                            onClick={() => setPage(p as number)}
                            className="flex items-center justify-center rounded-[6px] text-[12px] font-semibold transition-colors cursor-pointer"
                            style={{
                                minWidth: 30, height: 30,
                                background: page === p ? '#3b82f6' : 'transparent',
                                color: page === p ? '#ffffff' : 'var(--cus-text-muted)',
                                border: 'none',
                            }}
                        >
                            {p}
                        </button>
                    ),
                )}

                <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                    className="flex items-center justify-center rounded-[6px] transition-colors cursor-pointer disabled:opacity-40 hover:bg-black/[0.05] dark:hover:bg-white/[0.05]"
                    style={{ minWidth: 30, height: 30, color: 'var(--cus-text-muted)', background: 'transparent', border: 'none' }}
                >
                    <ChevronRight className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    )
}

function EmptyNoData() {
    const { t } = useI18n()
    const d = t.dashboard.discounts.usageHistory
    return (
        <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
            <div
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: 'var(--dash-surface-hover)', color: 'var(--dash-text-muted)' }}
            >
                <Receipt className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>{d.emptyNoDataTitle}</h4>
            <p className="max-w-sm text-xs" style={{ color: 'var(--dash-text-muted)' }}>
                {d.emptyNoDataSubtitle}
            </p>
        </div>
    )
}

function EmptyNoResults({ onClear }: { onClear: () => void }) {
    const { t } = useI18n()
    const d = t.dashboard.discounts.usageHistory
    return (
        <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
            <div
                className="flex h-12 w-12 items-center justify-center rounded-full border"
                style={{ background: 'var(--dash-surface-hover)', borderColor: 'var(--dash-border)', color: 'var(--dash-text-muted)' }}
            >
                <SearchX className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>{d.emptyNoResultsTitle}</h4>
            <p className="max-w-sm text-xs" style={{ color: 'var(--dash-text-muted)' }}>
                {d.emptyNoResultsSubtitle}
            </p>
            <button
                onClick={onClear}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium mt-1"
                style={{ background: 'var(--dash-surface-hover)', color: 'var(--dash-text)' }}
            >
                <X className="h-3 w-3" />
                {d.clearSearch}
            </button>
        </div>
    )
}
