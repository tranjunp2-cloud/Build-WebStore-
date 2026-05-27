'use client'

import { useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { RankBadge, CustomerAvatar } from './customers-shared-ui'
import type { ShopCustomerRecord } from '../_lib/shop-customer-record'

export type SortKey = 'email' | 'name' | 'rank' | 'phone' | 'orderCount' | 'latestOrderAt'

const RANK_ORDER: Record<string, number> = { '': 0, bronze: 1, silver: 2, gold: 3, vip: 4 }

type Props = {
    records: ShopCustomerRecord[]
    loading: boolean
    total: number
    page: number
    setPage: (p: number) => void
    limit: number
    setLimit: (l: number) => void
    sortBy: SortKey
    setSortBy: (k: SortKey) => void
    sortDir: 'asc' | 'desc'
    setSortDir: (d: 'asc' | 'desc') => void
    onRowClick: (id: number) => void
    hasFilters: boolean
}

function relativeDate(iso: string, today: string, yesterday: string): string {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    if (d === 0) return today
    if (d === 1) return yesterday
    if (d < 30) return `${d}d ago`
    if (d < 365) return `${Math.floor(d / 30)}mo ago`
    return `${Math.floor(d / 365)}y ago`
}

function SkeletonRow() {
    return (
        <tr className="border-b border-white/[0.04]">
            <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/[0.06] animate-pulse shrink-0" />
                    <div className="h-3 w-32 rounded bg-white/[0.06] animate-pulse" />
                </div>
            </td>
            <td className="px-4 py-3"><div className="h-3 w-24 rounded bg-white/[0.06] animate-pulse" /></td>
            <td className="px-4 py-3"><div className="h-5 w-14 rounded-full bg-white/[0.06] animate-pulse" /></td>
            <td className="px-4 py-3"><div className="h-3 w-28 rounded bg-white/[0.06] animate-pulse" /></td>
            <td className="px-4 py-3 text-right"><div className="h-3 w-8 rounded bg-white/[0.06] animate-pulse ml-auto" /></td>
            <td className="px-4 py-3"><div className="h-3 w-16 rounded bg-white/[0.06] animate-pulse" /></td>
        </tr>
    )
}

function SortableTh({
    label,
    sortKey,
    current,
    dir,
    onSort,
    align = 'left',
}: {
    label: string
    sortKey: SortKey
    current: SortKey
    dir: 'asc' | 'desc'
    onSort: (k: SortKey) => void
    align?: 'left' | 'right'
}) {
    const active = current === sortKey
    return (
        <th
            onClick={() => onSort(sortKey)}
            className={cn(
                'px-4 py-3 text-[11px] font-semibold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap',
                align === 'right' ? 'text-right' : 'text-left',
                active ? 'text-white/80' : 'text-white/45',
            )}
        >
            <span className={cn('inline-flex items-center gap-1', align === 'right' && 'justify-end w-full')}>
                {label}
                <span className="inline-flex flex-col gap-[1px]">
                    <ChevronUp
                        className={cn('w-3 h-3 -mb-[3px]', active && dir === 'asc' ? 'text-blue-400' : 'text-white/20')}
                    />
                    <ChevronDown
                        className={cn('w-3 h-3', active && dir === 'desc' ? 'text-blue-400' : 'text-white/20')}
                    />
                </span>
            </span>
        </th>
    )
}

function TableFooter({
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
    const tb = t.dashboard.shopCustomers.table
    const totalPages = Math.ceil(total / limit)
    const from = Math.min((page - 1) * limit + 1, total)
    const to = Math.min(page * limit, total)

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
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-white/[0.06]" style={{ fontSize: 12, color: 'var(--cus-text-muted)' }}>
            <div className="flex items-center gap-4 flex-wrap">
                <span>
                    {tb.showing}{' '}
                    <strong style={{ color: 'var(--dash-text)' }}>{from}–{to}</strong>
                    {' '}{tb.of}{' '}
                    <strong style={{ color: 'var(--dash-text)' }}>{total}</strong>
                    {' '}{tb.customers}
                </span>
                <div className="flex items-center gap-2">
                    <span>{tb.rowsPerPage}</span>
                    <div className="relative inline-flex items-center">
                        <select
                            value={limit}
                            onChange={e => { setLimit(Number(e.target.value)); setPage(1) }}
                            className="h-7 pl-2 pr-6 rounded-[6px] text-[12px] outline-none cursor-pointer appearance-none"
                            style={{ background: 'var(--cus-surface-select)', border: '1px solid var(--cus-border-strong)', color: 'var(--cus-text-muted)' }}
                        >
                            {[10, 25, 50, 100].map(n => (
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
                    className="flex items-center justify-center rounded-[6px] transition-colors cursor-pointer disabled:opacity-40 hover:bg-white/[0.05]"
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
                    className="flex items-center justify-center rounded-[6px] transition-colors cursor-pointer disabled:opacity-40 hover:bg-white/[0.05]"
                    style={{ minWidth: 30, height: 30, color: 'var(--cus-text-muted)', background: 'transparent', border: 'none' }}
                >
                    <ChevronRight className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    )
}

export function CustomersListTable({
    records,
    loading,
    total,
    page,
    setPage,
    limit,
    setLimit,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    onRowClick,
    hasFilters,
}: Props) {
    const sorted = useMemo(() => {
        const copy = [...records]
        copy.sort((a, b) => {
            if (sortBy === 'rank') {
                const av = RANK_ORDER[a.rank ?? ''] ?? 0
                const bv = RANK_ORDER[b.rank ?? ''] ?? 0
                return sortDir === 'asc' ? av - bv : bv - av
            }
            const av = a[sortBy] ?? ''
            const bv = b[sortBy] ?? ''
            const as = typeof av === 'number' ? av : String(av).toLowerCase()
            const bs = typeof bv === 'number' ? bv : String(bv).toLowerCase()
            if (as < bs) return sortDir === 'asc' ? -1 : 1
            if (as > bs) return sortDir === 'asc' ? 1 : -1
            return 0
        })
        return copy
    }, [records, sortBy, sortDir])

    function handleSort(key: SortKey) {
        if (key === sortBy) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
        else { setSortBy(key); setSortDir('asc') }
    }

    const { t } = useI18n()
    const tb = t.dashboard.shopCustomers.table
    const thProps = { current: sortBy, dir: sortDir, onSort: handleSort }

    if (!loading && records.length === 0) {
        return !hasFilters ? (
            <div className="flex flex-col items-center justify-center py-24 text-center rounded-[16px] border border-white/[0.06]" style={{ background: 'var(--cus-surface-card)' }}>
                <div className="w-12 h-12 rounded-full mb-4 flex items-center justify-center" style={{ background: 'rgba(148,163,184,0.08)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/30">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                </div>
                <p className="text-[16px] font-semibold text-white/70 mb-1">{tb.emptyTitle}</p>
                <p className="text-[13px] text-white/40">{tb.emptySubtitle}</p>
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center rounded-[16px] border border-white/[0.06]" style={{ background: 'var(--cus-surface-card)' }}>
                <p className="text-[16px] font-semibold text-white/70 mb-1">{tb.filteredTitle}</p>
                <p className="text-[13px] text-white/40">{tb.filteredSubtitle}</p>
            </div>
        )
    }

    return (
        <div className="w-full rounded-[16px] border border-white/[0.06] overflow-hidden" style={{ background: 'var(--cus-surface-card)' }}>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[680px]">
                    <thead>
                        <tr className="border-b border-white/[0.06]" style={{ background: 'var(--cus-surface-header)' }}>
                            <SortableTh label={tb.colEmail}   sortKey="email"      {...thProps} />
                            <SortableTh label={tb.colName}    sortKey="name"       {...thProps} />
                            <SortableTh label={tb.colRank}    sortKey="rank"       {...thProps} />
                            <SortableTh label={tb.colPhone}   sortKey="phone"      {...thProps} />
                            <SortableTh label={tb.colOrders}  sortKey="orderCount" {...thProps} align="right" />
                            <SortableTh label={tb.colLastOrder} sortKey="latestOrderAt" {...thProps} />
                        </tr>
                    </thead>
                    <tbody>
                        {loading
                            ? Array.from({ length: 8 }, (_, i) => <SkeletonRow key={i} />)
                            : sorted.map(c => (
                                <tr
                                    key={c.id}
                                    onClick={() => onRowClick(c.id)}
                                    className="border-b border-white/[0.04] cursor-pointer transition-colors hover:bg-white/[0.03]"
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <CustomerAvatar name={c.name} email={c.email} size={28} square />
                                            <span className="text-[13px] font-medium text-[#f1f5f9] truncate max-w-[200px]">{c.email ?? '—'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-[13px] text-[#f1f5f9] block truncate max-w-[140px]">
                                            {c.name || <span className="text-white/30">—</span>}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {c.rank
                                            ? <RankBadge rank={c.rank} />
                                            : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-semibold" style={{ background: 'rgba(107,114,128,0.08)', color: 'var(--cus-text-muted)', border: '1px solid rgba(107,114,128,0.20)' }}>{tb.unranked}</span>
                                        }
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className="text-[12px] font-mono" style={{ color: 'var(--cus-text-muted)' }}>{c.phone || <span className="text-white/30">—</span>}</span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className="text-[13px] font-medium tabular-nums text-[#f1f5f9]">{c.orderCount}</span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className="text-[12px]" style={{ color: 'var(--cus-text-muted)' }}>
                                            {c.latestOrderAt ? relativeDate(c.latestOrderAt, tb.today, tb.yesterday) : '—'}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        }
                    </tbody>
                </table>
            </div>

            {!loading && total > 0 && (
                <TableFooter total={total} page={page} setPage={setPage} limit={limit} setLimit={setLimit} />
            )}

            {!loading && total > limit && (
                <p className="text-xs text-muted-foreground mt-1 px-1">{tb.sortPageOnly}</p>
            )}
        </div>
    )
}
