'use client'

import * as React from 'react'
import { ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * GH-1222 — Base Table primitives for the admin dashboard.
 *
 * Why these exist: preflight is OFF (tailwind.config.js), so `border-b`/`divide-y`
 * render invisible. Row separators are painted by the `.dash-table` rule in
 * globals.css (full `border:1px solid` shorthand). These components just wire the
 * structure + consistent spacing/typography/tokens so every table matches the
 * F33 design (see discounts-table.tsx, the reference). All colors use --dash-*
 * tokens → correct contrast in light + dark.
 */

// Rounded, bordered wrapper + horizontal scroll + the .dash-table element.
const Table = React.forwardRef<
    HTMLTableElement,
    React.TableHTMLAttributes<HTMLTableElement> & { minWidth?: number; footer?: React.ReactNode }
>(({ className, minWidth, style, children, footer, ...props }, ref) => (
    <div
        className="rounded-[12px] overflow-hidden"
        // Full `border` shorthand (NOT the `border` utility): preflight is OFF, so a
        // utility-only border has no border-style and renders invisible. The surface
        // fill makes the table read as a card against the page background (F33 design).
        style={{ border: '1px solid var(--dash-border)', background: 'var(--dash-surface)' }}
    >
        <div className="overflow-x-auto">
            <table
                ref={ref}
                className={cn('dash-table', className)}
                style={{ minWidth: minWidth ? `${minWidth}px` : undefined, ...style }}
                {...props}
            >
                {children}
            </table>
        </div>
        {/* Footer (pagination) lives INSIDE the card, separated by a top border —
            matches the F33 design where the pager is part of the table box. */}
        {footer && (
            <div className="px-4 py-3" style={{ borderTop: '1px solid var(--dash-border)' }}>
                {footer}
            </div>
        )}
    </div>
))
Table.displayName = 'Table'

const TableHeader = React.forwardRef<
    HTMLTableSectionElement,
    React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, style, ...props }, ref) => (
    <thead
        ref={ref}
        className={className}
        // Header band = F33 `--surface-2` (the elevation tone, distinct from the body's
        // `--surface`). Our `--dash-surface-hover` is that tone: dark #1F2937 (raised above
        // body #161E2E), light #F1F5F9 (recessed below white) — matches F33 both themes.
        // This band (not text color) is what separates header from body in the F33 design.
        style={{ background: 'var(--dash-surface-hover)', ...style }}
        {...props}
    />
))
TableHeader.displayName = 'TableHeader'

const TableBody = React.forwardRef<
    HTMLTableSectionElement,
    React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => <tbody ref={ref} className={className} {...props} />)
TableBody.displayName = 'TableBody'

const TableRow = React.forwardRef<
    HTMLTableRowElement,
    React.HTMLAttributes<HTMLTableRowElement> & { clickable?: boolean }
>(({ className, clickable, ...props }, ref) => (
    <tr
        ref={ref}
        className={cn(
            'transition-colors',
            // Theme-aware hover: subtle dark wash on light, light wash on dark.
            (clickable || props.onClick) && 'cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
            className,
        )}
        {...props}
    />
))
TableRow.displayName = 'TableRow'

const TableHead = React.forwardRef<
    HTMLTableCellElement,
    React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, style, ...props }, ref) => (
    <th
        ref={ref}
        className={cn(
            // F33 design: 11px bold uppercase, 0.88px tracking.
            'px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap',
            className,
        )}
        // Header text = F33 `--ink-3` (the muted label tone) → `--dash-text-muted`
        // (light #64748B = exact F33; dark #9CA3AF ≈ F33 #94a3b8). Set inline so it's
        // explicit and independent of the `.dash-shell` class remap. Header/body separation
        // comes from the thead band above, not from this text color (per F33).
        style={{ color: 'var(--dash-text-muted)', ...style }}
        {...props}
    />
))
TableHead.displayName = 'TableHead'

const TableCell = React.forwardRef<
    HTMLTableCellElement,
    React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
    <td ref={ref} className={cn('px-4 py-3 text-[13px] align-middle', className)} {...props} />
))
TableCell.displayName = 'TableCell'

/** Sortable header cell with chevron affordance (matches discounts-table). */
function SortableHead<K extends string>({
    label,
    sortKey,
    currentSort,
    currentDir,
    onSort,
    className,
}: {
    label: React.ReactNode
    sortKey: K
    currentSort: string
    currentDir: 'asc' | 'desc'
    onSort: (key: K) => void
    className?: string
}) {
    const active = currentSort === sortKey
    return (
        <th
            className={cn(
                'px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.08em] cursor-pointer select-none whitespace-nowrap',
                className,
            )}
            // Header text = F33 `--ink-3` (--dash-text-muted); the active sort column reads
            // brighter (--dash-text) for the sorted affordance. See TableHead.
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

/**
 * Standard in-table action icon button. Neutral by default; only the `danger`
 * variant turns red on hover (per #1222: icons stay neutral, color on hover).
 */
const TableActionButton = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'danger' }
>(({ className, variant = 'default', children, ...props }, ref) => (
    <button
        ref={ref}
        type="button"
        className={cn(
            'flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors cursor-pointer',
            variant === 'danger'
                ? 'hover:bg-red-500/10 hover:text-red-400'
                : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.06]',
            className,
        )}
        style={{ color: 'var(--dash-text-muted)', background: 'transparent', border: 'none' }}
        {...props}
    >
        {children}
    </button>
))
TableActionButton.displayName = 'TableActionButton'

export {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    SortableHead,
    TableActionButton,
}
