'use client'

import { ChevronUp, ChevronDown, Users, SearchX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { RankBadge, CustomerAvatar } from './customers-shared-ui'
import { CustomersListCards } from './customers-list-card'
import { Badge } from '@/components/ui/badge'
import { TablePagination } from '@/components/ui/table-pagination'
import { TableEmptyState } from '@/components/ui/table-empty-state'
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from '@/components/ui/table'
import type { ShopCustomerRecord, SortKey } from '../_lib/shop-customer-record'

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
        <TableRow>
            <TableCell>
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/[0.06] animate-pulse shrink-0" />
                    <div className="h-3 w-32 rounded bg-white/[0.06] animate-pulse" />
                </div>
            </TableCell>
            <TableCell><div className="h-3 w-24 rounded bg-white/[0.06] animate-pulse" /></TableCell>
            <TableCell><div className="h-5 w-14 rounded-full bg-white/[0.06] animate-pulse" /></TableCell>
            <TableCell><div className="h-3 w-28 rounded bg-white/[0.06] animate-pulse" /></TableCell>
            <TableCell className="text-right"><div className="h-3 w-8 rounded bg-white/[0.06] animate-pulse ml-auto" /></TableCell>
            <TableCell><div className="h-3 w-16 rounded bg-white/[0.06] animate-pulse" /></TableCell>
        </TableRow>
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
            )}
            style={{ color: active ? 'var(--dash-text)' : 'var(--dash-text-muted)' }}
        >
            <span className={cn('inline-flex items-center gap-1', align === 'right' && 'justify-end w-full')}>
                {label}
                <span className="inline-flex flex-col gap-[1px]">
                    <ChevronUp
                        className={cn('w-3 h-3 -mb-[3px]', active && dir === 'asc' ? 'text-[hsl(var(--primary))]' : 'opacity-20')}
                    />
                    <ChevronDown
                        className={cn('w-3 h-3', active && dir === 'desc' ? 'text-[hsl(var(--primary))]' : 'opacity-20')}
                    />
                </span>
            </span>
        </th>
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
    function handleSort(key: SortKey) {
        if (key === sortBy) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
        else { setSortBy(key); setSortDir('asc') }
    }

    const { t } = useI18n()
    const tb = t.dashboard.shopCustomers.table
    const thProps = { current: sortBy, dir: sortDir, onSort: handleSort }

    if (!loading && records.length === 0) {
        return !hasFilters ? (
            <TableEmptyState icon={<Users />} title={tb.emptyTitle} subtitle={tb.emptySubtitle} />
        ) : (
            <TableEmptyState icon={<SearchX />} title={tb.filteredTitle} subtitle={tb.filteredSubtitle} />
        )
    }

    const footer = !loading && total > 0
        ? (
            <TablePagination
                page={page}
                total={total}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={(n) => { setLimit(n); setPage(1) }}
                labels={{ showing: tb.showing, of: tb.of, unit: tb.customers, rowsPerPage: tb.rowsPerPage }}
            />
        )
        : undefined

    return (
        <>
        {/* Mobile + iPad mini (<820px): card list — avoids horizontal scroll of the table */}
        <div className="min-[820px]:hidden">
            <CustomersListCards records={records} loading={loading} onRowClick={onRowClick} footer={footer} />
        </div>

        {/* iPad Air and up (>=820px): table. Matches /blog convention: `dash-table-compact`
            (globals.css) shrinks font+padding below xl and NO min-w floor → table-fixed w-full
            shrinks to fit any iPad width (no horizontal scroll). min-w only at desktop (>=1280)
            restores the original 760px floor → desktop byte-identical. */}
        <div className="hidden min-[820px]:block">
        <Table className="table-fixed w-full dash-table-compact min-[1280px]:min-w-[760px]" footer={footer}>
            {/* table-fixed + % colgroup: even columns. Email is slightly wider (it carries
                the avatar + address); the other 5 are equal width for a balanced rhythm. */}
            <colgroup>
                <col style={{ width: '20%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '16%' }} />
            </colgroup>
            <TableHeader>
                <TableRow>
                    <SortableTh label={tb.colEmail}      sortKey="email"         {...thProps} />
                    <SortableTh label={tb.colName}       sortKey="name"          {...thProps} />
                    <SortableTh label={tb.colRank}       sortKey="rank"          {...thProps} />
                    <SortableTh label={tb.colPhone}      sortKey="phone"         {...thProps} />
                    <SortableTh label={tb.colOrders}     sortKey="orderCount"    {...thProps} />
                    <SortableTh label={tb.colLastOrder}  sortKey="latestOrderAt" {...thProps} />
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading
                    ? Array.from({ length: 8 }, (_, i) => <SkeletonRow key={i} />)
                    : records.map((c) => (
                        <TableRow
                            key={c.id}
                            onClick={() => onRowClick(c.id)}
                            clickable
                        >
                            <TableCell>
                                <div className="flex items-center gap-2 min-w-0">
                                    <CustomerAvatar name={c.name} email={c.email} size={28} square />
                                    <span className="text-[13px] font-medium truncate max-w-[200px]" style={{ color: 'var(--dash-text)' }}>{c.email ?? '—'}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <span className="text-[13px] block truncate max-w-[140px]" style={{ color: 'var(--dash-text)' }}>
                                    {c.name || <span style={{ color: 'var(--dash-text-muted)', opacity: 0.4 }}>—</span>}
                                </span>
                            </TableCell>
                            <TableCell>
                                {c.rank
                                    ? <RankBadge rank={c.rank} />
                                    : <Badge variant="secondary" className="rounded-full">{tb.unranked}</Badge>
                                }
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                                <span className="text-[12px] font-mono" style={{ color: 'var(--dash-text-muted)' }}>{c.phone || <span style={{ opacity: 0.3 }}>—</span>}</span>
                            </TableCell>
                            <TableCell>
                                <span className="text-[13px] font-medium tabular-nums" style={{ color: 'var(--dash-text)' }}>{c.orderCount}</span>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                                <span className="text-[12px]" style={{ color: 'var(--dash-text-muted)' }}>
                                    {c.latestOrderAt ? relativeDate(c.latestOrderAt, tb.today, tb.yesterday) : '—'}
                                </span>
                            </TableCell>
                        </TableRow>
                    ))
                }
            </TableBody>
        </Table>
        </div>
        </>
    )
}
