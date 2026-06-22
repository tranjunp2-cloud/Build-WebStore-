'use client'

/**
 * DashboardSidebar — F18 CMS Core Layout (IA Restructure #1138)
 *
 * Flat sections, NO accordion (design docs/design/F18-cms-layout-design.md §2–§3.6):
 * - Dashboard standalone → ONLINE STORE → CORE OPERATIONS → CRM → SETTINGS → SUPPORT
 * - Section header = static uppercase label, not clickable, no chevron; every item is a leaf-route.
 * - Badges: neutral pill on the right of the label, driven by the `badgeCounts` prop only
 *   (no fake data — nothing renders until the layout wires real counts), hidden when 0/undefined.
 * - Active item: teal highlight via --primary token (theme-aware: light #00D3D4 / dark #2DD4BF, GH-1192).
 * - Footer (language switch) and mobile drawer behavior are unchanged from F18 v1.
 * - Collapse/mini mode (phase-02): desktop aside shrinks to 64px icon-only with EN tooltips
 *   and dot badges; the mobile drawer always renders full. State lives in CMSLayoutClient.
 *
 * Decisions locked 2026-06-11 (Duy Linh): Media stays OUT of the nav (old-version parity);
 * headers per mock (ONLINE STORE / SUPPORT); all badges neutral (no red Orders accent).
 */

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { NAV_SECTIONS, filterNavSections, type NavLeaf, type SidebarBadgeKey } from '@/config/sidebar-nav'
import { isPathActive } from '@/lib/sidebar/is-path-active'
import { formatBadgeCount } from '@/lib/sidebar/format-badge-count'
import { LanguageToggle } from '@/components/shared/LanguageToggle'

// Re-export so badge-count modules (sidebar-badge-counts.ts, -cached.ts) keep importing from here.
export type { SidebarBadgeKey }

// ─── Types ───────────────────────────────────────────────────────────────

type SidebarProps = {
    userName: string
    userInitial: string
    currentUserRole?: string
    permissions?: string[]
    isSuperAdmin?: boolean
    mobileOpen: boolean
    setMobileOpen: (open: boolean) => void
    /** Live counts per badge key. Absent/0 → badge hidden. Layout wires real data later (UI-only phase). */
    badgeCounts?: Partial<Record<SidebarBadgeKey, number>>
    /** Desktop mini mode (64px icon-only). Mobile drawer ignores this and always renders full. */
    collapsed?: boolean
    /** Enable the width transition only after the persisted state has painted (anti hydration-flash). */
    animateCollapse?: boolean
    /**
     * True on the Production deploy (VERCEL_ENV === 'production', resolved server-side in
     * layout.tsx). Gates devOnly items — staging/preview/local all keep them visible.
     */
    isProduction?: boolean
}

// ─── Component ───────────────────────────────────────────────────────────

export function DashboardSidebar({ userName, userInitial, currentUserRole = 'viewer', permissions = [], isSuperAdmin = false, mobileOpen, setMobileOpen, badgeCounts, collapsed = false, animateCollapse = false, isProduction = false }: SidebarProps) {
    const pathname = usePathname()
    const { locale, toggleLocale } = useI18n()

    // Filter sections per role + custom permissions (shared 5-tier gate — same rules for both sidebars)
    const visibleSections = useMemo(
        () => filterNavSections(NAV_SECTIONS, { currentUserRole, permissions, isSuperAdmin, isProduction }),
        [currentUserRole, permissions, isSuperAdmin, isProduction],
    )

    // Close sidebar on route change
    useEffect(() => {
        setMobileOpen(false)
    }, [pathname, setMobileOpen])

    // Close on Escape
    useEffect(() => {
        if (!mobileOpen) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setMobileOpen(false)
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [mobileOpen, setMobileOpen])

    // Prevent body scroll when mobile sidebar is open
    useEffect(() => {
        if (mobileOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [mobileOpen])

    // Logout lives in the top-header user menu (UserAvatarMenu) — removed from the sidebar footer.

    // ─── Render leaf item ────────────────────────────────────────
    const renderLeaf = (leaf: NavLeaf, mini: boolean) => {
        const Icon = leaf.icon
        const label = locale === 'ms' ? leaf.label.ms : leaf.label.en
        const isActive = isPathActive(pathname, leaf.href)
        const count = leaf.badgeKey ? badgeCounts?.[leaf.badgeKey] : undefined
        const hasCount = count != null && count > 0

        const link = (
            <Link
                key={leaf.href}
                href={leaf.href}
                className={cn(
                    // Responsive height: 34px on large screens (≥1536px / 1920), tighter on smaller laptops
                    'no-underline flex items-center rounded-[12px] h-[32px] 2xl:h-[34px] text-[13px] font-medium leading-[1.43] transition-colors',
                    mini ? 'justify-center px-0' : 'gap-3 px-4',
                    isActive
                        ? 'bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))] shadow-[0_0_16px_hsl(var(--primary)/0.25)]'
                        : 'text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text'
                )}
                aria-current={isActive ? 'page' : undefined}
                // Icon-only link needs a name when the tooltip is closed (a11y)
                aria-label={mini ? label : undefined}
            >
                {mini ? (
                    <span className="relative flex">
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        {/* Badge → dot in mini mode (no number). All dots cyan; the active item is
                            dimmed (its row is already highlighted) while the rest stay full cyan. */}
                        {hasCount && (
                            <span className={cn(
                                'absolute -right-1 -top-1 h-2 w-2 rounded-full',
                                isActive ? 'bg-[hsl(var(--primary)/0.4)]' : 'bg-[hsl(var(--primary))]'
                            )} />
                        )}
                    </span>
                ) : (
                    <>
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        <span className="flex-1">{label}</span>
                        {/* Badge — cyan when item active, neutral otherwise; hidden when 0/undefined */}
                        {hasCount && (
                            <span className={cn(
                                'flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none',
                                isActive
                                    ? 'bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]'
                                    : 'bg-dash-surface-hover text-dash-text-muted'
                            )}>
                                {formatBadgeCount(count)}
                            </span>
                        )}
                    </>
                )}
            </Link>
        )

        if (!mini) return link

        // Tooltip only mounts in mini mode (labels are visible when expanded)
        return (
            <Tooltip key={leaf.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{leaf.label.en}</TooltipContent>
            </Tooltip>
        )
    }

    // ─── Sidebar Content (mini = desktop collapsed; mobile drawer always full) ─
    const renderSidebarContent = (mini: boolean) => (
        <>
            {/* Flat nav — scrolls as one column; section headers are static labels (no accordion) */}
            <nav
                className="sidebar-scroll flex-1 flex flex-col gap-1 px-3 pt-6 overflow-y-auto"
                aria-label="Main navigation"
            >
                {visibleSections.map((section, idx) => (
                    <div key={section.header?.en ?? `section-${idx}`} className="flex flex-col gap-1">
                        {section.header && (
                            mini ? (
                                // Collapsed: thin divider keeps the section rhythm without text
                                <div className="mx-2 mt-4 mb-1 border-t border-dash-border" aria-hidden="true" />
                            ) : (
                                // opacity-50 (NOT text-…-muted/60): the token is a plain var() without
                                // <alpha-value>, so Tailwind never generates the /60 modifier class
                                <div className="px-4 pt-1.5 2xl:pt-2 pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-dash-text-muted opacity-50 select-none">
                                    {locale === 'ms' ? section.header.ms : section.header.en}
                                </div>
                            )
                        )}
                        {section.items.map((leaf) => renderLeaf(leaf, mini))}
                    </div>
                ))}
            </nav>

            {/* Footer — language switch; icon-only when collapsed (phase-02) */}
            {mini ? (
                <div
                    className="flex flex-col items-center gap-3 px-3 py-[17px]"
                    style={{ borderTop: '1px solid var(--dash-divider)' }}
                >
                    <button
                        onClick={toggleLocale}
                        aria-label={locale === 'ms' ? 'Switch to English' : 'Switch to Malay'}
                        className="flex h-[38px] w-[38px] items-center justify-center rounded-[12px] border border-dash-border bg-transparent outline-none text-dash-text hover:bg-dash-surface-hover cursor-pointer transition-colors"
                    >
                        <Globe className="h-4 w-4 shrink-0" />
                    </button>
                </div>
            ) : (
            <div
                className="flex flex-col gap-3 px-3 py-[17px]"
                style={{ borderTop: '1px solid var(--dash-divider)' }}
            >
                <LanguageToggle locale={locale} toggleLocale={toggleLocale} />
            </div>
            )}
        </>
    )

    return (
        <>
            {/* Mobile overlay + drawer — slides in BELOW the header; every item is a leaf so any
                click navigates and the route-change effect closes the drawer (design §1.3) */}
            {mobileOpen && (
                <div className="fixed inset-0 z-40 md:hidden">
                    <div
                        className="absolute inset-0 top-[56px] bg-black/60"
                        onClick={() => setMobileOpen(false)}
                    />
                    <aside
                        className="absolute left-0 top-[56px] bottom-0 z-10 flex w-[250px] flex-col bg-[var(--dash-sidebar-bg)] shadow-2xl animate-in slide-in-from-left duration-200"
                        style={{ borderRight: '1px solid var(--dash-col-divider-color)' }}
                    >
                        {renderSidebarContent(false)}
                    </aside>
                </div>
            )}

            {/* Desktop sidebar — 250px full / 64px mini (phase-02); width transition gated post-hydration */}
            <aside
                id="dashboard-sidebar"
                className={cn(
                    'fixed left-0 top-[56px] z-40 hidden md:flex h-[calc(100vh-56px)] flex-col bg-[var(--dash-sidebar-bg)]',
                    animateCollapse && 'transition-[width] duration-200',
                    collapsed ? 'w-[64px]' : 'w-[250px]'
                )}
                style={{ borderRight: '1px solid var(--dash-col-divider-color)' }}
            >
                {renderSidebarContent(collapsed)}
            </aside>
        </>
    )
}
