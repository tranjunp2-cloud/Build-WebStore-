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

    // GH-1516: desktop (xl+) puts search + all 4 filter chips on ONE row — search
    // flexes between a 220px floor (still usable at 1280 with the sidebar open) and a
    // 480px cap, chips keep their auto width; flex-wrap is the safety net if a locale's
    // labels outgrow the row. Below xl stays 2 rows: search (row 1) + filters (row 2).
    return (
        <div className="flex flex-col gap-3 w-full xl:flex-row xl:flex-wrap xl:items-center">
            <TableSearch
                value={search}
                onSearch={(q) => onSearch?.(q)}
                placeholder={o.search}
                debounceMs={0}
                className="w-full xl:w-auto xl:flex-1 xl:min-w-[220px] xl:max-w-[480px]"
            />

            {/* Below xl, chips show only the selected value in a two-column phone /
                four-column tablet grid. Desktop restores the original one-line
                "Label : value" auto-width flex layout. Visually hidden labels remain
                available to screen readers; icons stay hidden below sm. Long localized
                values can wrap and grow the chip below xl instead of being truncated.
                All tweaks target `.chip-trigger`, not the dropdown options. */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full xl:w-auto
                            xl:flex xl:items-center xl:flex-wrap
                            [&_.chip-trigger]:w-full xl:[&_.chip-trigger]:w-auto
                            [&_.chip-trigger]:h-auto [&_.chip-trigger]:min-h-11
                            md:[&_.chip-trigger]:min-h-10 xl:[&_.chip-trigger]:h-10
                            [&_.chip-trigger>span]:flex-1 [&_.chip-trigger>span]:min-w-0
                            [&_.chip-trigger>span]:text-left [&_.chip-trigger>span]:whitespace-normal
                            [&_.chip-trigger>span]:overflow-visible
                            xl:[&_.chip-trigger>span]:flex-none xl:[&_.chip-trigger>span]:whitespace-nowrap
                            xl:[&_.chip-trigger>span]:overflow-hidden
                            [&_.chip-icon]:hidden sm:[&_.chip-icon]:inline
                            [&_[data-chip-label]]:sr-only
                            xl:[&_[data-chip-label]]:not-sr-only xl:[&_[data-chip-label]]:whitespace-nowrap
                            [&_[data-chip-sep]]:hidden xl:[&_[data-chip-sep]]:inline
                            [&_[data-chip-value]]:block [&_[data-chip-value]]:w-full
                            [&_[data-chip-value]]:max-w-full [&_[data-chip-value]]:whitespace-normal
                            [&_[data-chip-value]]:break-words
                            xl:[&_[data-chip-value]]:inline xl:[&_[data-chip-value]]:whitespace-nowrap">
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
