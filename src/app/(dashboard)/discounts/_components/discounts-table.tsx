'use client'

import { Pencil, Trash2, ChevronsUpDown, ChevronUp, ChevronDown, Banknote, Percent } from 'lucide-react'
import { DiscountStatusBadge } from './discount-status-badge'
import { DiscountUsageMeter } from './discount-usage-meter'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { fmtValue, fmtDate } from '@/lib/discounts/format'
import { useI18n } from '@/i18n'

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
    const { t } = useI18n()
    const d = t.dashboard.discounts.table

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
                {/* table-fixed + colgroup theo %: cột width ổn định & chia đều, không co giãn theo description (#7).
                    Code rộng nhất (chứa description, truncate); các cột data cân đối; min-w giữ layout mobile (scroll ngang). */}
                <table className="w-full border-collapse table-fixed min-w-[920px]">
                    <colgroup>
                        <col style={{ width: '24%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '17%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '8%' }} />
                    </colgroup>
                    <thead>
                        <tr style={{ background: 'var(--dash-surface)', borderBottom: '1px solid var(--dash-border)' }}>
                            <SortableTh label={d.code} sortKey="code" currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
                            <SortableTh label={d.type} sortKey="type" currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
                            <SortableTh label={d.value} sortKey="value" currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
                            <SortableTh label={d.usage} sortKey="usageCount" currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
                            <SortableTh label={d.expires} sortKey="expiresAt" currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
                            <SortableTh label={d.status} sortKey="status" currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
                            <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-text-muted)' }}>{d.actions}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {discounts.map((discount, i) => (
                            <tr
                                key={discount.id}
                                onClick={() => onEdit(discount.id)}
                                // Hover theme-aware: subtle dark wash on light, light wash on dark (white/[0.03]
                                // was invisible in light mode + killed by an inline transparent bg).
                                className="cursor-pointer transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                                style={{
                                    borderBottom: i < discounts.length - 1 ? '1px solid var(--dash-border)' : undefined,
                                }}
                            >
                                {/* Code + description — gap-1 (4px) cho thoáng (#6); description truncate 1 dòng,
                                    hover xem full text qua themed tooltip (#5). min-w-0 để truncate hoạt động trong flex. */}
                                <td className="px-4 py-3">
                                    <div className="flex flex-col gap-1 min-w-0">
                                        {/* Code chip — themed pill matching the Usage-history table for visual consistency */}
                                        <span
                                            className="inline-block w-fit rounded px-2 py-0.5 font-mono text-xs font-semibold"
                                            style={{ background: 'var(--dash-surface-hover)', color: 'var(--dash-text)' }}
                                        >
                                            {discount.code}
                                        </span>
                                        {discount.description && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span
                                                        className="block truncate text-[12px] cursor-default"
                                                        style={{ color: 'var(--dash-text-muted)' }}
                                                    >
                                                        {discount.description}
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent
                                                    side="top"
                                                    align="start"
                                                    onClick={(e) => e.stopPropagation()}
                                                    // Khung gọn chuẩn: rộng vừa, xuống dòng, và line-clamp-5 để chuỗi
                                                    // siêu dài không kéo thành tháp — cắt gọn bằng "…". leading-relaxed cho dễ đọc.
                                                    className="max-w-[260px] whitespace-normal break-words leading-relaxed line-clamp-5"
                                                    style={{
                                                        backgroundColor: 'var(--dash-surface)',
                                                        color: 'var(--dash-text)',
                                                        borderColor: 'var(--dash-border)',
                                                    }}
                                                >
                                                    {discount.description}
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                    </div>
                                </td>

                                {/* Type badge */}
                                <td className="px-4 py-3">
                                    {discount.type === 'fixed' ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] text-[12px] font-medium bg-cyan-500/10 text-cyan-400">
                                            <Banknote className="w-3.5 h-3.5 shrink-0" />
                                            {d.typeFixed}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] text-[12px] font-medium bg-purple-500/10 text-purple-400">
                                            <Percent className="w-3.5 h-3.5 shrink-0" />
                                            {d.typePercentage}
                                        </span>
                                    )}
                                </td>

                                {/* Value — nowrap để "RM 500000.00" không rớt dòng (#5) */}
                                <td className="px-4 py-3 text-left whitespace-nowrap">
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
                                            className="flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.06] cursor-pointer"
                                            title={d.editTitle}
                                            style={{ color: 'var(--dash-text-muted)', background: 'transparent', border: 'none' }}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onDelete(discount)}
                                            className="flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors hover:bg-red-500/10 hover:text-red-400 cursor-pointer"
                                            title={d.deleteTitle}
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
