'use client'

import { useEffect } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * GH-1222 — Shared table pagination row (the F33 / Discounts pager).
 * Left: "Showing X–Y of Z {unit}" + rows-per-page select.
 * Right: prev / numbered pages / next.
 * Designed to sit inside the base `Table` `footer` slot.
 */
/**
 * GH-1579 — Single source of truth for the "hide pagination when the dataset
 * fits on one default page" rule. Callers must gate their footer slot /
 * card-view wrapper with this so no empty bordered bar is left behind when
 * `TablePagination` itself returns null.
 */
export function shouldShowTablePagination(total: number, rowsOptions: number[] = [10, 25, 50, 100]) {
    return total > (rowsOptions[0] ?? 10)
}

/**
 * GH-1579 — When a shrinking dataset strands `page` past the last page (e.g.
 * deleting the last row on page 2 drops total to <=10, which hides the bar),
 * snap back to the last valid page so the table never renders empty with no
 * recovery control. Callers that mutate their dataset in place should use this.
 */
export function useTablePageClamp(page: number, total: number, limit: number, onPageChange: (page: number) => void, enabled = true) {
    useEffect(() => {
        if (!enabled) return
        const totalPages = Math.max(1, Math.ceil(total / limit))
        if (page > totalPages) onPageChange(totalPages)
    }, [enabled, page, total, limit, onPageChange])
}

export interface TablePaginationProps {
    page: number
    total: number
    limit: number
    onPageChange: (page: number) => void
    /** Omit to hide the rows-per-page selector. */
    onLimitChange?: (limit: number) => void
    rowsOptions?: number[]
    labels?: { showing?: string; of?: string; unit?: string; rowsPerPage?: string }
}

export function TablePagination({
    page,
    total,
    limit,
    onPageChange,
    onLimitChange,
    rowsOptions = [10, 25, 50, 100],
    labels,
}: TablePaginationProps) {
    const showing = labels?.showing ?? 'Showing'
    const of = labels?.of ?? 'of'
    const unit = labels?.unit ?? 'items'
    const rowsPerPage = labels?.rowsPerPage ?? 'Rows per page:'

    // GH-1579: nothing to paginate when the dataset fits on one default page.
    if (!shouldShowTablePagination(total, rowsOptions)) return null

    const totalPages = Math.max(1, Math.ceil(total / limit))
    const from = total === 0 ? 0 : (page - 1) * limit + 1
    const to = Math.min(page * limit, total)

    // Page window: always show first + last, plus ±2 around the current page; gaps
    // collapse into an ellipsis. (Cheap pure computation — no memo needed.)
    const pageRange: (number | '…')[] = []
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
            pageRange.push(i)
        } else if (pageRange[pageRange.length - 1] !== '…') {
            pageRange.push('…')
        }
    }

    return (
        <div className="flex items-center justify-between gap-4 flex-wrap text-[13px]" style={{ color: 'var(--dash-text-muted)' }}>
            {/* Left: count + rows per page */}
            <div className="flex items-center gap-4">
                <span>
                    {showing}{' '}
                    <strong style={{ color: 'var(--dash-text)' }}>{from}–{to}</strong>{' '}
                    {of}{' '}
                    <strong style={{ color: 'var(--dash-text)' }}>{total}</strong>{' '}
                    {unit}
                </span>
                {onLimitChange && (
                    <div className="flex items-center gap-2">
                        <span>{rowsPerPage}</span>
                        <div className="relative">
                            <select
                                value={limit}
                                onChange={(e) => onLimitChange(Number(e.target.value))}
                                className="h-[32px] rounded-[8px] px-2 pr-6 text-[13px] cursor-pointer outline-none appearance-none"
                                style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)', color: 'var(--dash-text)' }}
                            >
                                {rowsOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <ChevronDown
                                className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                                style={{ color: 'var(--dash-text-muted)' }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Right: page navigation */}
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                    className="h-[32px] w-[32px] flex items-center justify-center rounded-[8px] transition-colors disabled:opacity-30 cursor-pointer"
                    style={{ border: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)' }}
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                {pageRange.map((p, i) =>
                    p === '…' ? (
                        <span
                            key={`ellipsis-${i}`}
                            className="h-[32px] w-[32px] flex items-center justify-center text-[13px]"
                            style={{ color: 'var(--dash-text-muted)' }}
                        >
                            …
                        </span>
                    ) : (
                        <button
                            key={p}
                            type="button"
                            onClick={() => onPageChange(p)}
                            className="h-[32px] w-[32px] flex items-center justify-center rounded-[8px] text-[13px] font-medium transition-colors cursor-pointer"
                            style={p === page
                                ? { background: 'linear-gradient(90deg,#3b82f6 0%,#2dd4bf 100%)', color: '#fff', border: 'none' }
                                : { border: '1px solid hsl(var(--input-border))', color: 'var(--dash-text-muted)' }
                            }
                        >
                            {p}
                        </button>
                    )
                )}
                <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                    className="h-[32px] w-[32px] flex items-center justify-center rounded-[8px] transition-colors disabled:opacity-30 cursor-pointer"
                    style={{ border: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)' }}
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}
