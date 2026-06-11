'use client'

import { Pencil, Trash2, ChevronsUpDown, ChevronUp, ChevronDown, Banknote, Percent } from 'lucide-react'
import { DiscountStatusBadge } from './discount-status-badge'
import { DiscountUsageMeter } from './discount-usage-meter'
import { fmtValue, fmtDate } from '@/lib/discounts/format'

export interface Discount {
    id: string
    code: string
    description?: string | null
    type: 'percentage' | 'fixed'
    value: number
    status: 'active' | 'inactive'
    usageCount: number
    usageLimit?: number | null
    expiresAt?: string | null
    startsAt?: string | null
}

type SortKey = 'code' | 'type' | 'value' | 'usageCount' | 'expiresAt' | 'createdAt' | 'status'

interface DiscountsTableProps {
    discounts: Discount[]
    sortBy: string
    sortDir: 'asc' | 'desc'
    onSort: (key: SortKey) => void
    onEdit: (id: string) => void
    onDelete: (discount: Discount) => void
    loading: boolean
}

function SortableTh({
    label,
    sortKey,
    currentSort,
    currentDir,
    onSort,
}: {
    label: string
    sortKey: SortKey
    currentSort: string
    currentDir: 'asc' | 'desc'
    onSort: (key: SortKey) => void
}) {
    const active = currentSort === sortKey
    return (
        <th
            className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap"
            style={{ color: active ? 'var(--dash-text)' : 'var(--dash-text-muted)' }}
            onClick={() => onSort(sortKey)}
        >
            <span className="inline-flex items-center gap-1">
                {label}
                {active ? (
                    currentDir === 'asc'
                        ? <ChevronUp className="w-3.5 h-3.5" />
                        : <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                    <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />
                )}
            </span>
        </th>
    )
}

export function DiscountsTable({
    discounts,
    sortBy,
    sortDir,
    onSort,
    onEdit,
    onDelete,
    loading,
}: DiscountsTableProps) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20" style={{ color: 'var(--dash-text-muted)' }}>
                <div className="h-6 w-6 rounded-full border-2 border-t-transparent border-blue-400 animate-spin" />
            </div>
        )
    }

    return (
        <div className="rounded-[12px] overflow-hidden border" style={{ borderColor: 'var(--dash-border)' }}>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr style={{ background: 'var(--dash-surface)', borderBottom: '1px solid var(--dash-border)' }}>
                            <SortableTh label="Code" sortKey="code" currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
                            <SortableTh label="Type" sortKey="type" currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
                            <SortableTh label="Value" sortKey="value" currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
                            <SortableTh label="Usage" sortKey="usageCount" currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
                            <SortableTh label="Expires" sortKey="expiresAt" currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
                            <SortableTh label="Status" sortKey="status" currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
                            <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-text-muted)' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {discounts.map((discount, i) => (
                            <tr
                                key={discount.id}
                                onClick={() => onEdit(discount.id)}
                                className="cursor-pointer transition-colors hover:bg-white/[0.03]"
                                style={{
                                    borderBottom: i < discounts.length - 1 ? '1px solid var(--dash-border)' : undefined,
                                    background: 'transparent',
                                }}
                            >
                                {/* Code + description */}
                                <td className="px-4 py-3">
                                    <div className="flex flex-col gap-0.5">
                                        <span
                                            className="inline-block font-mono text-[12px] font-bold px-2 py-0.5 rounded-[5px] w-fit tracking-wide"
                                            style={{ background: 'rgba(255,255,255,0.88)', color: '#0f172a' }}
                                        >
                                            {discount.code}
                                        </span>
                                        {discount.description && (
                                            <span className="text-[12px]" style={{ color: 'var(--dash-text-muted)' }}>
                                                {discount.description}
                                            </span>
                                        )}
                                    </div>
                                </td>

                                {/* Type badge */}
                                <td className="px-4 py-3">
                                    {discount.type === 'fixed' ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] text-[12px] font-medium bg-cyan-500/10 text-cyan-400">
                                            <Banknote className="w-3.5 h-3.5 shrink-0" />
                                            Fixed
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] text-[12px] font-medium bg-purple-500/10 text-purple-400">
                                            <Percent className="w-3.5 h-3.5 shrink-0" />
                                            Percentage
                                        </span>
                                    )}
                                </td>

                                {/* Value */}
                                <td className="px-4 py-3 text-left">
                                    <span className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--dash-text)' }}>
                                        {fmtValue(discount.type, discount.value)}
                                    </span>
                                </td>

                                {/* Usage meter */}
                                <td className="px-4 py-3">
                                    <DiscountUsageMeter
                                        count={discount.usageCount}
                                        limit={discount.usageLimit ?? null}
                                    />
                                </td>

                                {/* Expires */}
                                <td className="px-4 py-3 whitespace-nowrap text-[13px]" style={{ color: 'var(--dash-text-muted)' }}>
                                    {fmtDate(discount.expiresAt)}
                                </td>

                                {/* Status */}
                                <td className="px-4 py-3">
                                    <DiscountStatusBadge status={discount.status} />
                                </td>

                                {/* Actions — stop propagation so row-click doesn't fire */}
                                <td
                                    className="px-4 py-3"
                                    onClick={e => e.stopPropagation()}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        <button
                                            type="button"
                                            onClick={() => onEdit(discount.id)}
                                            className="flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors hover:bg-white/[0.06] cursor-pointer"
                                            title="Edit"
                                            style={{ color: 'var(--dash-text-muted)', background: 'transparent', border: 'none' }}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onDelete(discount)}
                                            className="flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors hover:bg-red-500/10 hover:text-red-400 cursor-pointer"
                                            title="Delete"
                                            style={{ color: 'var(--dash-text-muted)', background: 'transparent', border: 'none' }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
