'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Mascot, type SceneName } from '@/mascot'
import { emptySceneForPath } from '@/components/mascot/scene-for-path'

/**
 * GH-1222 — Standard "no data" empty state for dashboard tables.
 *
 * Reference: the Shop Customers list (customers-list-table.tsx) — a bordered surface
 * card with the 3D mascot, a bold title, and a muted subtitle. Use this in
 * place of the table whenever a list has no rows (empty or filtered-to-empty), so every
 * screen reads the same.
 *
 * The mascot's pose follows the route (products holds a box, orders a truck...); pass
 * `scene="searchEmpty"` when filters or a search produced no rows. `icon` (lucide) shows in
 * the mascot's place until the 3D robot is ready, and on devices that can't render it.
 * `action` renders an optional CTA below the texts (e.g. a "Create" button).
 */
export interface TableEmptyStateProps {
    /** Lucide (or any) icon — the mascot's placeholder, auto-sized to 24px + muted. */
    icon?: React.ReactNode
    /** Mascot pose; defaults to the route's scene. */
    scene?: SceneName
    title: string
    subtitle?: string
    /** Optional call-to-action rendered below the subtitle (e.g. a primary button). */
    action?: React.ReactNode
    /** Shorter vertical padding + a smaller mascot for embedded panels (e.g. a detail tab). */
    compact?: boolean
    className?: string
}

export function TableEmptyState({ icon, scene, title, subtitle, action, compact = false, className }: TableEmptyStateProps) {
    const pathname = usePathname()
    const iconCircle = icon && (
        <div
            className="w-12 h-12 rounded-full flex items-center justify-center [&>svg]:w-6 [&>svg]:h-6 [&>svg]:opacity-40"
            style={{ background: 'hsl(var(--muted-foreground) / 0.1)', color: 'var(--dash-text-muted)' }}
        >
            {icon}
        </div>
    )
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center text-center rounded-[16px]',
                compact ? 'py-8' : 'py-12 md:py-16',
                className,
            )}
            style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)' }}
        >
            <Mascot
                scene={scene ?? emptySceneForPath(pathname)}
                size={compact ? 104 : 148}
                fps={30}
                fallback={iconCircle}
                className="mb-2"
            />
            <p className="text-[16px] font-semibold mb-1" style={{ color: 'var(--dash-text)' }}>{title}</p>
            {subtitle && <p className="text-[13px] max-w-[360px]" style={{ color: 'var(--dash-text-muted)' }}>{subtitle}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    )
}
