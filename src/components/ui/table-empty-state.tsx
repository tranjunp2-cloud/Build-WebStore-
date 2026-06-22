import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * GH-1222 — Standard "no data" empty state for dashboard tables.
 *
 * Reference: the Shop Customers list (customers-list-table.tsx) — a bordered surface
 * card with a circular muted icon, a bold title, and a muted subtitle. Use this in
 * place of the table whenever a list has no rows (empty or filtered-to-empty), so every
 * screen reads the same.
 *
 * Pass a lucide icon as `icon` (auto-sized + muted here). `action` renders an optional
 * CTA below the texts (e.g. a "Create" button).
 */
export interface TableEmptyStateProps {
    /** Lucide (or any) icon — rendered inside the circle, auto-sized to 24px + muted. */
    icon?: React.ReactNode
    title: string
    subtitle?: string
    /** Optional call-to-action rendered below the subtitle (e.g. a primary button). */
    action?: React.ReactNode
    /** Shorter vertical padding for embedded panels (e.g. a detail tab) vs full-page tables. */
    compact?: boolean
    className?: string
}

export function TableEmptyState({ icon, title, subtitle, action, compact = false, className }: TableEmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center text-center rounded-[16px]',
                compact ? 'py-12' : 'py-24',
                className,
            )}
            style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)' }}
        >
            {icon && (
                <div
                    className="w-12 h-12 rounded-full mb-4 flex items-center justify-center [&>svg]:w-6 [&>svg]:h-6 [&>svg]:opacity-40"
                    style={{ background: 'hsl(var(--muted-foreground) / 0.1)', color: 'var(--dash-text-muted)' }}
                >
                    {icon}
                </div>
            )}
            <p className="text-[16px] font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>{title}</p>
            {subtitle && <p className="text-[13px]" style={{ color: 'var(--dash-text-muted)' }}>{subtitle}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    )
}
