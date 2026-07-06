'use client'

/**
 * Shared atoms for the single-column dashboard revamp.
 * Ports the design's SectionHead / Delta / ComingSoon / HelpTip primitives.
 * Styling comes from dashboard-revamp.css (class names kept identical to the design).
 */
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import {
    LayoutGrid, BarChart3, SearchCheck, Wrench, PackageCheck, ListChecks,
    TrendingUp, TrendingDown, Minus, Clock, Info, type LucideIcon,
} from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

/**
 * Radix Tooltip only opens on hover/focus — it intentionally ignores touch
 * pointers, so info icons never open on iPad/mobile taps. This makes the
 * trigger tap-to-toggle (closes on next outside tap). Desktop hover/focus-open
 * still works unchanged.
 *
 * Radix's TooltipTrigger composes its own `onClick: composeEventHandlers(props.onClick,
 * context.onClose)` — without preventDefault() that unconditionally re-closes right
 * after our handler runs, so a plain toggle never actually opens. Radix's trigger also
 * force-closes on its own onPointerDown whenever already open (its built-in "click
 * trigger again to close" behavior), which races with our toggle if we read `open` from
 * the click closure. wasOpenRef tracks the state onClick should toggle from, kept in sync
 * three ways: (1) onPointerDown captures pre-event state before either handler can mutate
 * it, for taps/clicks; (2) onFocus seeds it for pure-keyboard Tab-entry, which has no
 * pointerdown to sync from — gated on isPointerRef so it doesn't clobber (1) when a
 * pointer click also happens to focus the element; (3) onClick writes its own outcome
 * back, so repeated Enter/Space with no intervening pointer event still toggles correctly.
 *
 * onOpenChange is also routed through changeOpen() so wasOpenRef stays in sync when
 * something OTHER than our onClick changes `open` — e.g. Escape, which Radix closes via
 * onOpenChange directly. Without this, wasOpenRef stays stale after Escape and the next
 * Enter/click is a no-op (toggles to the same stale "from" state instead of reopening).
 */
function useTapTooltip<T extends HTMLElement>() {
    const [open, setOpen] = useState(false)
    const ref = useRef<T>(null)
    const wasOpenRef = useRef(false)
    const isPointerRef = useRef(false)

    const changeOpen = (next: boolean) => {
        wasOpenRef.current = next
        setOpen(next)
    }

    useEffect(() => {
        if (!open) return
        const onOutside = (e: PointerEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) changeOpen(false)
        }
        document.addEventListener('pointerdown', onOutside)
        return () => document.removeEventListener('pointerdown', onOutside)
    }, [open])

    const onPointerDown = () => {
        wasOpenRef.current = open
        isPointerRef.current = true
    }
    const onFocus = () => {
        if (!isPointerRef.current) wasOpenRef.current = true
    }
    const onClick = (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const next = !wasOpenRef.current
        wasOpenRef.current = next
        isPointerRef.current = false
        setOpen(next)
    }

    return { open, onOpenChange: changeOpen, onPointerDown, onFocus, onClick, ref }
}

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
    const { open, onOpenChange, onPointerDown, onFocus, onClick, ref } = useTapTooltip<HTMLSpanElement>()
    return (
        <Tooltip open={open} onOpenChange={onOpenChange}>
            <TooltipTrigger asChild>
                <span
                    ref={ref}
                    className="cs-badge cs-badge-interactive"
                    tabIndex={0}
                    role="note"
                    aria-label={`${label}. ${tip}`}
                    onPointerDown={onPointerDown}
                    onFocus={onFocus}
                    onClick={onClick}
                >
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
    const { open, onOpenChange, onPointerDown, onFocus, onClick, ref } = useTapTooltip<HTMLButtonElement>()
    return (
        <Tooltip open={open} onOpenChange={onOpenChange}>
            <TooltipTrigger asChild>
                <button ref={ref} type="button" className="stat-info" aria-label={tip} aria-expanded={open} onPointerDown={onPointerDown} onFocus={onFocus} onClick={onClick}>
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
