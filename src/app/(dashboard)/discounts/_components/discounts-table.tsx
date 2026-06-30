'use client'

import type { ReactNode } from 'react'
import { Pencil, Trash2, Banknote, Percent } from 'lucide-react'
import { DiscountStatusBadge } from './discount-status-badge'
import { DiscountUsageMeter } from './discount-usage-meter'
import { DiscountsCardList } from './discounts-card-list'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    SortableHead,
    TableActionButton,
} from '@/components/ui/table'
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
    /** Pagination row rendered inside the table card (F33 design). */
    footer?: ReactNode
}

export function DiscountsTable({
    discounts,
    sortBy,
    sortDir,
    onSort,
    onEdit,
    onDelete,
    loading,
    footer,
}: DiscountsTableProps) {
    const { t } = useI18n()
    const d = t.dashboard.discounts.table

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20" style={{ color: 'var(--dash-text-muted)' }}>
                <div className="h-6 w-6 rounded-full border-2 border-t-transparent border-[hsl(var(--primary))] animate-spin" />
            </div>
        )
    }

    return (
        <>
        {/* Mobile / tablet / small-desktop (<xl): card list — matches Blog/Orders
            breakpoint so the 920px table only appears once there's real room. */}
        <div className="xl:hidden">
            <DiscountsCardList discounts={discounts} onEdit={onEdit} onDelete={onDelete} footer={footer} />
        </div>

        {/* Desktop (>=xl): original table, unchanged */}
        <div className="hidden xl:block">
        {/* table-fixed + colgroup by %: stable column widths, no layout shift on description (#7).
           min-w-[920px] keeps layout intact on narrow viewports (horizontal scroll). */}
        <Table className="table-fixed w-full" minWidth={920} footer={footer}>
            <colgroup>
                <col style={{ width: '24%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '8%' }} />
            </colgroup>

            <TableHeader>
                <TableRow>
                    <SortableHead label={d.code}   sortKey="code"       currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
                    <SortableHead label={d.type}   sortKey="type"       currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
                    <SortableHead label={d.value}  sortKey="value"      currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
                    <SortableHead label={d.usage}  sortKey="usageCount" currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
                    <SortableHead label={d.expires} sortKey="expiresAt"  currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
                    <SortableHead label={d.status} sortKey="status"     currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
                    <TableHead className="text-right">{d.actions}</TableHead>
                </TableRow>
            </TableHeader>

            <TableBody>
                {discounts.map((discount) => (
                    <TableRow
                        key={discount.id}
                        clickable
                        onClick={() => onEdit(discount.id)}
                    >
                        {/* Code + description — gap-1 (4px) for breathing room (#6);
                            description truncated to 1 line, full text via themed tooltip (#5).
                            min-w-0 required so truncate works inside flex. */}
                        <TableCell>
                            <div className="flex flex-col gap-1 min-w-0">
                                {/* Code chip — themed pill (bordered, matches Usage-history table) */}
                                <span
                                    className="inline-flex w-fit items-center rounded-[4px] border px-2.5 py-[3px] font-mono text-[12px] font-semibold tracking-wide"
                                    style={{ background: 'var(--dash-surface-hover)', color: 'var(--dash-text)', borderColor: 'var(--dash-border)' }}
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
                                            // Show the FULL description: wrap on multiple lines (no line-clamp).
                                            // For very long text, cap height and allow scroll — Radix tooltip is
                                            // hoverable so the user can scroll to read the rest.
                                            className="max-w-[360px] max-h-[50vh] overflow-y-auto whitespace-normal break-words leading-relaxed"
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
                        </TableCell>

                        {/* Type badge */}
                        <TableCell>
                            {discount.type === 'fixed' ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full pl-2 pr-2.5 py-[3px] text-[11px] font-semibold bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]">
                                    <Banknote className="w-3 h-3 shrink-0" />
                                    {d.typeFixed}
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full pl-2 pr-2.5 py-[3px] text-[11px] font-semibold bg-[hsl(var(--info)/0.15)] text-[hsl(var(--info))]">
                                    <Percent className="w-3 h-3 shrink-0" />
                                    {d.typePercentage}
                                </span>
                            )}
                        </TableCell>

                        {/* Value — nowrap so "RM 500000.00" never wraps (#5) */}
                        <TableCell className="whitespace-nowrap">
                            <span className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--dash-text)' }}>
                                {fmtValue(discount.type, discount.value)}
                            </span>
                        </TableCell>

                        {/* Usage meter */}
                        <TableCell>
                            <DiscountUsageMeter
                                count={discount.usageCount}
                                limit={discount.usageLimit ?? null}
                            />
                        </TableCell>

                        {/* Expires */}
                        <TableCell className="whitespace-nowrap" style={{ color: 'var(--dash-text-muted)' }}>
                            {fmtDate(discount.expiresAt)}
                        </TableCell>

                        {/* Status — effective lifecycle state (expired/scheduled/used-up), not raw DB status */}
                        <TableCell>
                            <DiscountStatusBadge
                                status={discount.status}
                                startsAt={discount.startsAt}
                                expiresAt={discount.expiresAt}
                                usageLimit={discount.usageLimit}
                                usageCount={discount.usageCount}
                            />
                        </TableCell>

                        {/* Actions — stopPropagation so row-click doesn't fire */}
                        <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                                <TableActionButton
                                    onClick={() => onEdit(discount.id)}
                                    title={d.editTitle}
                                >
                                    <Pencil className="h-4 w-4" />
                                </TableActionButton>
                                <TableActionButton
                                    variant="danger"
                                    onClick={() => onDelete(discount)}
                                    title={d.deleteTitle}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </TableActionButton>
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
        </div>
        </>
    )
}
