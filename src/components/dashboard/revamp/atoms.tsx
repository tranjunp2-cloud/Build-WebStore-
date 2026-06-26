'use client'

/**
 * Shared atoms for the single-column dashboard revamp.
 * Ports the design's SectionHead / Delta / ComingSoon / HelpTip primitives.
 * Styling comes from dashboard-revamp.css (class names kept identical to the design).
 */
import type { ReactNode } from 'react'
import {
    LayoutGrid, BarChart3, SearchCheck, Wrench, PackageCheck, ListChecks,
    TrendingUp, TrendingDown, Minus, Clock, Info, type LucideIcon,
} from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

/** Lucide icon lookup for dynamic (string-named) block/section icons. */
const ICON_MAP: Record<string, LucideIcon> = {
    'layout-grid': LayoutGrid,
    'bar-chart-3': BarChart3,
    'search-check': SearchCheck,
    wrench: Wrench,
    'package-check': PackageCheck,
    'list-checks': ListChecks,
}

export function BlockIcon({ name, className }: { name: string; className?: string }) {
    const Ico = ICON_MAP[name] ?? LayoutGrid
    return <Ico className={className} aria-hidden />
}

export function SectionHead({ icon, title, sub, right }: { icon: string; title: string; sub?: string; right?: ReactNode }) {
    return (
        <div className="section-head">
            <div className="sh-left">
                <span className="sh-icon"><BlockIcon name={icon} /></span>
                <div>
                    <h2 className="sh-title">{title}</h2>
                    {sub && <div className="sh-sub">{sub}</div>}
                </div>
            </div>
            {right}
        </div>
    )
}

export function Delta({ value }: { value: number }) {
    const dir = value > 0 ? 'up' : value < 0 ? 'down' : 'flat'
    const Ico = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus
    return (
        <span className={`delta ${dir}`}>
            <Ico aria-hidden />{value > 0 ? '+' : ''}{value.toFixed(1)}%
        </span>
    )
}

/** Small slate "Coming Soon" pill. */
export function ComingSoonBadge({ label }: { label: string }) {
    return (
        <span className="cs-badge"><Clock aria-hidden />{label}</span>
    )
}

/**
 * Inline "Coming Soon" pill with an info icon that reveals a Radix tooltip on hover/focus.
 * Used in place of the stat comparison cluster so the badge never overlaps real metrics.
 */
export function ComingSoonBadgeTooltip({ label, tip }: { label: string; tip: string }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="cs-badge cs-badge-interactive" tabIndex={0} role="note" aria-label={`${label}. ${tip}`}>
                    <Clock aria-hidden />{label}<Info className="cs-info" aria-hidden />
                </span>
            </TooltipTrigger>
            <TooltipContent side="top">{tip}</TooltipContent>
        </Tooltip>
    )
}

/**
 * Small info "?" icon with a Radix tooltip. Uses TooltipContent's portal so the popup
 * is NOT clipped by a parent's overflow (e.g. the overflow:hidden stat-card).
 */
export function InfoTooltip({ tip }: { tip: string }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button type="button" className="stat-info" aria-label={tip}>
                    <Info aria-hidden />
                </button>
            </TooltipTrigger>
            <TooltipContent side="top">{tip}</TooltipContent>
        </Tooltip>
    )
}

/** Corner badge + hover tooltip, absolutely positioned over a locked block. */
export function ComingSoonCorner({ label, tip }: { label: string; tip?: string }) {
    return (
        <div className="cs-corner" data-tip={tip}>
            <ComingSoonBadge label={label} />
        </div>
    )
}

/**
 * Wraps content in the locked "coming soon" treatment:
 * dimmed content + corner badge + a non-interactive lock layer.
 */
export function ComingSoonLock({ children, label, tip }: { children: ReactNode; label: string; tip?: string }) {
    return (
        <div className="cs-wrap locked">
            <div className="cs-content">{children}</div>
            <ComingSoonCorner label={label} tip={tip} />
            <div className="cs-lockzone" />
        </div>
    )
}

export function HelpTip({ tip }: { tip: string }) {
    return (
        <span className="help-tip" data-tip={tip}><Info aria-hidden /></span>
    )
}
