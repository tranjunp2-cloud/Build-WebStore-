'use client'

import { Clock, Tag } from 'lucide-react'
import { useI18n } from '@/i18n'
import { TableSearch } from '@/components/ui/table-search'
import { FilterChip } from '@/components/ui/filter-chip'

export type StatusFilter = 'all' | 'active' | 'inactive'
type TypeFilter = 'all' | 'percentage' | 'fixed'

interface DiscountsToolbarProps {
    search: string
    onSearch: (q: string) => void
    statusFilter: StatusFilter
    onStatusFilter: (s: StatusFilter) => void
    typeFilter: TypeFilter
    onTypeFilter: (t: TypeFilter) => void
}

/**
 * Discounts list toolbar — thin composition of the shared <TableSearch> +
 * <FilterChip> primitives (GH-1222). Only the discounts-specific filter options
 * and i18n wiring live here; the visuals/behaviour come from the shared components.
 */
export function DiscountsToolbar({
    search,
    onSearch,
    statusFilter,
    onStatusFilter,
    typeFilter,
    onTypeFilter,
}: DiscountsToolbarProps) {
    const { t } = useI18n()
    const tb = t.dashboard.discounts.toolbar

    const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
        { key: 'all', label: tb.statusAll },
        { key: 'active', label: tb.statusActive },
        { key: 'inactive', label: tb.statusInactive },
    ]

    const TYPE_OPTIONS: { key: TypeFilter; label: string }[] = [
        { key: 'all', label: tb.typeAll },
        { key: 'percentage', label: tb.typePercentage },
        { key: 'fixed', label: tb.typeFixed },
    ]

    return (
        <div className="flex flex-wrap items-center gap-2">
            {/* Full-width own row below lg so the placeholder isn't clipped on mobile (override the
                component's built-in max-w-[360px]); filters wrap below. Capped flex at lg+. */}
            <TableSearch value={search} onSearch={onSearch} placeholder={tb.searchPlaceholder} className="w-full max-w-none lg:flex-1 lg:max-w-[360px]" />

            <FilterChip<StatusFilter>
                icon={Clock}
                label={tb.statusLabel}
                value={statusFilter}
                options={STATUS_OPTIONS}
                onChange={onStatusFilter}
            />

            <FilterChip<TypeFilter>
                icon={Tag}
                label={tb.typeLabel}
                value={typeFilter}
                options={TYPE_OPTIONS}
                onChange={onTypeFilter}
            />
        </div>
    )
}
