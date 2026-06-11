'use client'

import { useState, useEffect } from 'react'
import { Lock, Search, X, Receipt, SearchX, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { fmtRM, fmtValue, fmtDate } from '@/lib/discounts/format'

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

const PAGE_LIMIT = 50

export function DiscountsUsageHistoryLayout() {
    const [rows, setRows] = useState<UsageRow[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalDocs, setTotalDocs] = useState(0)
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')

    // Debounce the input so each keystroke doesn't hit the API; reset to page 1 on a new query.
    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(search.trim())
            setPage(1)
        }, 300)
        return () => clearTimeout(t)
    }, [search])

    // Server-side search across the WHOLE dataset (not just the current page).
    useEffect(() => {
        setLoading(true)
        const qs = `limit=${PAGE_LIMIT}&page=${page}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}`
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
    }, [page, debouncedSearch])

    const hasAnyData = rows.length > 0 || loading
    const textMuted = { color: 'var(--dash-text-muted)' } as React.CSSProperties
    const textMain  = { color: 'var(--dash-text)' } as React.CSSProperties

    return (
        <div className="flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-[18px] font-semibold" style={textMain}>Discount Usage History</h1>
                    <p className="mt-1 text-sm" style={textMuted}>
                        Every code redemption, newest first. This log is immutable for audit — no editing or deleting.
                    </p>
                </div>
                <span
                    className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium shrink-0 mt-1"
                    style={{ background: 'var(--dash-surface-hover)', color: 'var(--dash-text-muted)', border: '1px solid var(--dash-border)' }}
                >
                    <Lock className="h-3 w-3" />
                    Read-only
                </span>
            </div>

            {/* Search toolbar */}
            <div
                className="group flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 max-w-sm transition-colors focus-within:border-[var(--dash-accent,#6366f1)]"
                style={{ background: 'var(--dash-surface-hover)', borderColor: 'var(--dash-border)' }}
            >
                <Search className="h-4 w-4 shrink-0" style={textMuted} />
                <input
                    className="flex-1 min-w-0 border-0 bg-transparent p-0 text-sm outline-none focus:outline-none focus:ring-0 placeholder:opacity-70"
                    style={textMain}
                    placeholder="Search by code or order #…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                    <button
                        onClick={() => setSearch('')}
                        className="shrink-0 rounded p-0.5 transition-opacity hover:opacity-70"
                        style={textMuted}
                        aria-label="Clear search"
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
                    <div className="flex items-center justify-center py-16 text-sm" style={textMuted}>Loading…</div>
                ) : !hasAnyData ? (
                    <EmptyNoData />
                ) : rows.length === 0 ? (
                    <EmptyNoResults onClear={() => setSearch('')} />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b" style={{ borderColor: 'var(--dash-border)' }}>
                                        {['Code', 'Type', 'Amount applied', 'Order #', 'Customer email', 'Used date'].map((h) => (
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
                                    {rows.map((u) => (
                                        <tr
                                            key={u.id}
                                            className="border-b last:border-0"
                                            style={{ borderColor: 'var(--dash-border)' }}
                                        >
                                            <td className="px-4 py-3">
                                                <span
                                                    className="inline-block rounded px-2 py-0.5 font-mono text-xs font-semibold"
                                                    style={{ background: 'var(--dash-surface-hover)', color: 'var(--dash-text)' }}
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
                                                        className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-80"
                                                        style={{ borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }}
                                                    >
                                                        {u.order.orderNumber ?? u.order.id}
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

                        {/* Footer with pagination */}
                        <div
                            className="flex items-center justify-between gap-4 border-t px-4 py-3 text-xs"
                            style={{ borderColor: 'var(--dash-border)', color: 'var(--dash-text-muted)' }}
                        >
                            <span>
                                {debouncedSearch
                                    ? <><strong style={textMain}>{totalDocs}</strong> {totalDocs === 1 ? 'match' : 'matches'}</>
                                    : <>Showing <strong style={textMain}>{rows.length}</strong> of{' '}
                                        <strong style={textMain}>{totalDocs}</strong> redemptions</>
                                }
                            </span>
                            {totalPages > 1 && (
                                <div className="flex items-center gap-1">
                                    <button
                                        disabled={page <= 1}
                                        onClick={() => setPage((p) => p - 1)}
                                        className="rounded p-1 disabled:opacity-30"
                                        style={{ color: 'var(--dash-text-muted)' }}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => setPage(p)}
                                            className="rounded px-2 py-0.5 text-xs font-medium min-w-[28px]"
                                            style={
                                                p === page
                                                    ? { background: 'var(--brand, #14b8a6)', color: '#fff' }
                                                    : { color: 'var(--dash-text-muted)' }
                                            }
                                        >
                                            {p}
                                        </button>
                                    ))}
                                    <button
                                        disabled={page >= totalPages}
                                        onClick={() => setPage((p) => p + 1)}
                                        className="rounded p-1 disabled:opacity-30"
                                        style={{ color: 'var(--dash-text-muted)' }}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

function EmptyNoData() {
    return (
        <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
            <div
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: 'var(--dash-surface-hover)', color: 'var(--dash-text-muted)' }}
            >
                <Receipt className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>No redemptions yet</h4>
            <p className="max-w-sm text-xs" style={{ color: 'var(--dash-text-muted)' }}>
                When a customer applies a discount code at checkout, a read-only record appears here — one row per order.
                History is preserved even if the code is later deleted.
            </p>
        </div>
    )
}

function EmptyNoResults({ onClear }: { onClear: () => void }) {
    return (
        <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
            <div
                className="flex h-12 w-12 items-center justify-center rounded-full border"
                style={{ background: 'var(--dash-surface-hover)', borderColor: 'var(--dash-border)', color: 'var(--dash-text-muted)' }}
            >
                <SearchX className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>No redemptions match your search</h4>
            <p className="max-w-sm text-xs" style={{ color: 'var(--dash-text-muted)' }}>
                Search by discount code or order number. Clear the search to see all redemptions.
            </p>
            <button
                onClick={onClear}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium mt-1"
                style={{ background: 'var(--dash-surface-hover)', color: 'var(--dash-text)' }}
            >
                <X className="h-3 w-3" />
                Clear search
            </button>
        </div>
    )
}
