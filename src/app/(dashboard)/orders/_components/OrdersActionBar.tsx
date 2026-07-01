"use client"

import { useState, useMemo } from 'react'
import { Calendar, Clock, CreditCard, ArrowDownUp } from 'lucide-react'
import { useI18n } from '@/i18n'
import { TableSearch } from '@/components/ui/table-search'
import { FilterChip } from '@/components/ui/filter-chip'

const PAYMENT_METHOD_VALUES: Record<string, string> = {
    all: 'all',
    cod: 'cod',
    qrBanking: 'qr_banking',
    bankTransfer: 'bank_transfer',
    card: 'card',
    fpx: 'fpx',
    ewallet: 'ewallet',
}

const SORT_VALUES: Record<string, string> = {
    dateNewest: '-createdAt',
    dateOldest: 'createdAt',
    totalHigh: '-total',
    totalLow: 'total',
}

/**
 * Orders toolbar — composes the shared <TableSearch> + <FilterChip> primitives
 * (GH-1222), same as discounts/blog. Search debounce stays in the parent layout
 * (searchQuery → debouncedSearch), so TableSearch propagates immediately
 * (debounceMs=0) and only owns the controlled input UI.
 *
 * pendingCount/onBulkConfirm/isConfirming are kept for caller API compatibility
 * (the bulk-confirm CTA is rendered elsewhere).
 */
export function OrdersActionBar({
    search = '',
    onSearch,
    onFilterStatus,
    onFilterDate,
    onFilterPaymentMethod,
    onSort,
}: {
    pendingCount?: number
    onBulkConfirm?: () => void
    isConfirming?: boolean
    search?: string
    onSearch?: (val: string) => void
    onFilterStatus?: (val: string) => void
    onFilterDate?: (val: string) => void
    onFilterPaymentMethod?: (val: string) => void
    onSort?: (val: string) => void
}) {
    const { t } = useI18n()
    const o = t.dashboard.orders

    const DATE_OPTIONS = useMemo(() => [
        { key: 'all', label: o.filterDates.allDates },
        { key: 'today', label: o.filterDates.today },
        { key: 'thisWeek', label: o.filterDates.thisWeek },
        { key: 'thisMonth', label: o.filterDates.thisMonth },
    ], [o])

    const STATUS_OPTIONS = useMemo(() => [
        { key: 'all', label: o.filterStatus.allStatus },
        { key: 'pending', label: o.status.pending },
        { key: 'confirmed', label: o.status.confirmed },
        { key: 'ready_to_ship', label: o.status.readyToShip },
        { key: 'shipped', label: o.status.shipped },
        { key: 'completed', label: o.status.completed },
        { key: 'cancelled', label: o.status.cancelled },
        { key: 'refunded', label: o.status.refunded },
    ], [o])

    const PAYMENT_OPTIONS = useMemo(() => Object.entries(PAYMENT_METHOD_VALUES).map(([key, val]) => ({
        key: val,
        label: (o.paymentFilter as Record<string, string>)[key],
    })), [o])

    const SORT_OPTIONS = useMemo(() => Object.entries(SORT_VALUES).map(([key, val]) => ({
        key: val,
        label: (o.sort as Record<string, string>)[key],
    })), [o])

    // Selected values (first option is the default; FilterChip highlights when changed).
    const [dateVal, setDateVal] = useState('all')
    const [statusVal, setStatusVal] = useState('all')
    const [paymentVal, setPaymentVal] = useState('all')
    const [sortVal, setSortVal] = useState('-createdAt')

    // Always 2 rows: search (row 1) + filters (row 2) — stays clean even at 1280 with the
    // sidebar open (inline 1-row gets cramped there). Search caps width on desktop.
    return (
        <div className="flex flex-col gap-3 w-full">
            <TableSearch
                value={search}
                onSearch={(q) => onSearch?.(q)}
                placeholder={o.search}
                debounceMs={0}
                className="w-full xl:max-w-[480px]"
            />

            {/* All 4 selects on ONE row at every width below xl (grid-cols-4) → search +
                filters = 2 rows total. Desktop (xl+): original auto-width flex-wrap row.
                To fit 4 pills on a phone the below-xl chips are progressively trimmed:
                  • label grows (flex-1), stays left-aligned, truncates (min-w-0);
                  • the leading icon hides below sm (shows again from sm up);
                  • the " : value" hides below 820px (mobile + iPad mini) so the pill is
                    just Date / Status / Payment / Sort — the picked option is still shown
                    once the dropdown opens; from iPad Air (>=820) the value returns;
                  • padding/font shrink on the smallest widths.
                All tweaks target `.chip-trigger` (not the dropdown options) and reset at
                xl so desktop stays byte-identical. */}
            <div className="grid grid-cols-4 gap-1.5 md:gap-2 w-full
                            xl:flex xl:items-center xl:flex-wrap
                            [&_.chip-trigger]:w-full xl:[&_.chip-trigger]:w-auto
                            [&_.chip-trigger]:px-2 min-[820px]:[&_.chip-trigger]:px-3
                            [&_.chip-trigger]:text-[12px] sm:[&_.chip-trigger]:text-[13px]
                            [&_.chip-trigger>span]:flex-1 [&_.chip-trigger>span]:text-left [&_.chip-trigger>span]:min-w-0
                            xl:[&_.chip-trigger>span]:flex-none
                            [&_.chip-icon]:hidden sm:[&_.chip-icon]:inline
                            [&_[data-chip-sep]]:hidden [&_[data-chip-value]]:hidden
                            min-[820px]:[&_[data-chip-sep]]:inline min-[820px]:[&_[data-chip-value]]:inline">
                <FilterChip<string>
                    icon={Calendar}
                    label={o.filterLabels.date}
                    value={dateVal}
                    options={DATE_OPTIONS}
                    onChange={(v) => { setDateVal(v); onFilterDate?.(v) }}
                />
                <FilterChip<string>
                    icon={Clock}
                    label={o.filterLabels.status}
                    value={statusVal}
                    options={STATUS_OPTIONS}
                    onChange={(v) => { setStatusVal(v); onFilterStatus?.(v) }}
                />
                <FilterChip<string>
                    icon={CreditCard}
                    label={o.filterLabels.payment}
                    value={paymentVal}
                    options={PAYMENT_OPTIONS}
                    onChange={(v) => { setPaymentVal(v); onFilterPaymentMethod?.(v === 'all' ? '' : v) }}
                />
                <FilterChip<string>
                    icon={ArrowDownUp}
                    label={o.filterLabels.sort}
                    value={sortVal}
                    options={SORT_OPTIONS}
                    onChange={(v) => { setSortVal(v); onSort?.(v) }}
                />
            </div>
        </div>
    )
}
