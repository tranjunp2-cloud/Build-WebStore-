'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Lock, X, Receipt, SearchX, ArrowUpRight } from 'lucide-react'
import { fmtRM, fmtValue, fmtDate } from '@/lib/discounts/format'
import { useI18n } from '@/i18n'
import { TableEmptyState } from '@/components/ui/table-empty-state'
import { DiscountsTabNav } from './discounts-tab-nav'
import { useUrlPagination } from './use-url-pagination'
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from '@/components/ui/table'
import { TablePagination } from '@/components/ui/table-pagination'
import { TableSearch } from '@/components/ui/table-search'

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

    // Generation ref — stale-fetch guard (same pattern as discounts-client-layout): rapid page/limit/search
    // changes can let an earlier slow response overwrite a newer one; only the latest generation commits.
    const genRef = useRef(0)

    // Server-side search across the WHOLE dataset (not just the current page).
    useEffect(() => {
        const gen = ++genRef.current
        setLoading(true)
        const qs = `limit=${limit}&page=${page}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}`
        fetch(`/api/v1/discounts/usage-history?${qs}`)
            .then((r) => r.json())
            .then((json: ApiResponse) => {
                if (gen !== genRef.current) return
                if (json.success) {
                    setRows(json.docs ?? [])
                    setTotalPages(json.totalPages ?? 1)
                    setTotalDocs(json.totalDocs ?? 0)
                }
            })
            .catch(() => {/* silent — empty state shown */})
            .finally(() => { if (gen === genRef.current) setLoading(false) })
    }, [page, limit, debouncedSearch])

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

            {/* Search toolbar — shared <TableSearch> (parent keeps debounce → debounceMs=0) */}
            <TableSearch
                value={search}
                onSearch={setSearch}
                placeholder={d.searchPlaceholder}
                debounceMs={0}
                className="max-w-sm"
            />

            {/* Loading state */}
            {loading && (
                <div
                    className="rounded-[12px] border overflow-hidden"
                    style={{ background: 'var(--dash-surface)', borderColor: 'var(--dash-border)' }}
                >
                    <div className="flex items-center justify-center py-16 text-sm" style={textMuted}>{d.loading}</div>
                </div>
            )}

            {/* Empty states — only when not loading. Variant chosen by whether a search is
                active (NOT row count): no rows + no search = genuinely empty; no rows + search
                = filtered-to-empty (show the clear-search affordance). */}
            {!loading && rows.length === 0 && !debouncedSearch.trim() && (
                <TableEmptyState
                    compact
                    icon={<Receipt />}
                    title={d.emptyNoDataTitle}
                    subtitle={d.emptyNoDataSubtitle}
                />
            )}

            {!loading && rows.length === 0 && !!debouncedSearch.trim() && (
                <TableEmptyState
                    compact
                    icon={<SearchX />}
                    title={d.emptyNoResultsTitle}
                    subtitle={d.emptyNoResultsSubtitle}
                    action={
                        <button
                            onClick={() => setSearch('')}
                            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium"
                            style={{ background: 'var(--dash-surface-hover)', color: 'var(--dash-text)' }}
                        >
                            <X className="h-3 w-3" />
                            {d.clearSearch}
                        </button>
                    }
                />
            )}

            {/* Data table — only shown when rows exist */}
            {!loading && rows.length > 0 && (
                <Table footer={(
                    <TablePagination
                        page={page}
                        total={totalDocs}
                        limit={limit}
                        onPageChange={setPage}
                        onLimitChange={(n) => { setLimit(n); setPage(1) }}
                        labels={{ showing: d.showingOf, of: d.ofTotal, unit: d.ofRedemptions, rowsPerPage: d.rowsPerPage }}
                    />
                )}>
                    <TableHeader>
                        <TableRow>
                            {TABLE_HEADERS.map((h) => (
                                <TableHead key={h}>{h}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((u) => (
                            <TableRow key={u.id}>
                                <TableCell>
                                    <span
                                        className="inline-flex w-fit items-center rounded-[4px] border px-2.5 py-[3px] font-mono text-[12px] font-semibold tracking-wide"
                                        style={{ background: 'var(--dash-surface-hover)', color: 'var(--dash-text)', borderColor: 'var(--dash-border)' }}
                                    >
                                        {u.discountCode ?? u.discount?.code ?? '—'}
                                    </span>
                                </TableCell>
                                <TableCell style={textMuted}>
                                    {u.discountType != null && u.discountValue != null
                                        ? fmtValue(u.discountType, u.discountValue)
                                        : u.discount
                                            ? fmtValue(u.discount.type, u.discount.value)
                                            : '—'}
                                </TableCell>
                                <TableCell className="font-mono text-[hsl(var(--success))]">
                                    −{fmtRM(u.amountApplied)}
                                </TableCell>
                                <TableCell>
                                    {u.order ? (
                                        <a
                                            href={`/orders?order=${u.order.id}`}
                                            className="inline-flex items-center gap-1 text-[hsl(var(--info))] transition-opacity hover:opacity-80 dark:text-[hsl(var(--info))]"
                                        >
                                            {/* Order # as a kbd-key box (muted mono pill); the ↗ arrow sits OUTSIDE in the link color */}
                                            <span
                                                className="rounded-[3px] border px-[5px] py-px font-mono text-[11px]"
                                                style={{ background: 'var(--dash-surface-hover)', borderColor: 'var(--dash-border)', color: 'var(--dash-text-muted)' }}
                                            >
                                                {u.order.orderNumber ?? u.order.id}
                                            </span>
                                            <ArrowUpRight className="h-3 w-3" />
                                        </a>
                                    ) : '—'}
                                </TableCell>
                                <TableCell className="font-mono text-xs" style={textMuted}>
                                    {u.customerEmail ?? '—'}
                                </TableCell>
                                <TableCell className="text-xs" style={textMuted} title={u.usedAt ?? ''}>
                                    {fmtDate(u.usedAt)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    )
}
