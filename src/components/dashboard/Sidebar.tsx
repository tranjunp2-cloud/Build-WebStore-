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
import { Globe, ChevronsRight, ChevronsLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { AppSwitcher } from './AppSwitcher'
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
    /** Expand the rail from mini mode — rendered as the » button at the top of the collapsed rail. */
    onToggleCollapsed?: () => void
    /** Enable the width transition only after the persisted state has painted (anti hydration-flash). */
    animateCollapse?: boolean
    /**
     * True on the Production deploy (VERCEL_ENV === 'production', resolved server-side in
     * layout.tsx). Gates devOnly items — staging/preview/local all keep them visible.
     */
    isProduction?: boolean
}

// ─── Component ───────────────────────────────────────────────────────────

export function DashboardSidebar({ userName, userInitial, currentUserRole = 'viewer', permissions = [], isSuperAdmin = false, mobileOpen, setMobileOpen, badgeCounts, collapsed = false, animateCollapse = false, isProduction = false, onToggleCollapsed }: SidebarProps) {
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
            {/* Mini rail: expand toggle » sits at the top, directly under the logo icon in the header
                (collapsed-state brand placement). Hidden in the full/mobile drawer (« lives in the header). */}
            {mini && onToggleCollapsed && (
                <div className="flex justify-center pt-1 pb-0 shrink-0">
                    <button
                        onClick={onToggleCollapsed}
                        aria-label="Expand sidebar"
                        aria-expanded={false}
                        aria-controls="dashboard-sidebar"
                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-transparent border-none outline-none text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text cursor-pointer transition-colors"
                    >
                        <ChevronsRight className="h-5 w-5" />
                    </button>
                </div>
            )}

            {/* Flat nav — scrolls as one column; section headers are static labels (no accordion) */}
            <nav
                className={cn(
                    'sidebar-scroll flex-1 flex flex-col gap-1 px-3 overflow-y-auto',
                    // Mini rail: tighter top gap so the » toggle sits close to the first icon
                    // (full/mobile keep the original pt-6 rhythm).
                    mini ? 'pt-2' : 'pt-6',
                )}
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
                <div className="dash-sidebar-footer flex flex-col items-center gap-3 px-3 py-[17px]">
                    <button
                        onClick={toggleLocale}
                        aria-label={locale === 'ms' ? 'Switch to English' : 'Switch to Malay'}
                        className="flex h-[38px] w-[38px] items-center justify-center rounded-[12px] border border-dash-border bg-transparent outline-none text-dash-text hover:bg-dash-surface-hover cursor-pointer transition-colors"
                    >
                        <Globe className="h-4 w-4 shrink-0" />
                    </button>
                </div>
            ) : (
            <div className="dash-sidebar-footer flex flex-col gap-3 px-3 py-[17px]">
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
                // z above the top-bar (z-50): the drawer runs from top-0 and OVERLAYS the header's
                // ☰ + logo so they don't show twice — it reads as one black bar from the very top.
                <div className="fixed inset-0 z-[60] lg:hidden">
                    <div
                        className="absolute inset-0 bg-black/60"
                        onClick={() => setMobileOpen(false)}
                    />
                    <aside
                        // `dark`: sidebar luôn dark bất kể theme app (light/dark) — yêu cầu cố định.
                        className="dark sb-dark absolute left-0 top-0 bottom-0 z-10 flex w-[250px] flex-col bg-[var(--dash-sidebar-bg)] shadow-2xl animate-in slide-in-from-left duration-200"
                        style={{ borderRight: '1px solid var(--dash-col-divider-color)' }}
                    >
                        {/* Drawer header — replaces the top-bar's ☰ + logo (same 56px band):
                            SSO app-switcher (⊞) LEFT of the logo (design §3.7), close (« ) on the right. */}
                        <div
                            className="flex h-[56px] shrink-0 items-center justify-between pl-4 pr-2"
                            style={{ borderBottom: '1px solid var(--dash-col-divider-color)' }}
                        >
                            <div className="flex items-center gap-2.5">
                                <AppSwitcher />
                                <Link
                                    href="/dashboard"
                                    onClick={() => setMobileOpen(false)}
                                    className="flex items-center gap-2 no-underline outline-none"
                                >
                                    <img
                                        src="/images/logo-icon-3c4d76.png"
                                        alt="PrimeWeb Logo"
                                        className="h-[28px] w-[28px] object-contain drop-shadow-[0px_0px_12px_rgba(6,182,212,0.6)]"
                                    />
                                    <div className="flex items-center text-[16px] font-bold leading-none tracking-tight">
                                        <span className="text-dash-text">Prime</span>
                                        <span className="text-[#06B6D4]">Web</span>
                                    </div>
                                </Link>
                            </div>
                            <button
                                onClick={() => setMobileOpen(false)}
                                aria-label="Close menu"
                                className="flex h-10 w-10 items-center justify-center rounded-lg border-none bg-transparent text-dash-text-muted outline-none transition-colors hover:bg-dash-surface-hover hover:text-dash-text cursor-pointer"
                            >
                                <ChevronsLeft className="h-5 w-5" />
                            </button>
                        </div>
                        {renderSidebarContent(false)}
                    </aside>
                </div>
            )}

            {/* Desktop sidebar — 250px full / 64px mini (phase-02); width transition gated post-hydration */}
            <aside
                id="dashboard-sidebar"
                className={cn(
                    // `dark`: sidebar luôn dark bất kể theme app (light/dark) — yêu cầu cố định.
                    'dark sb-dark fixed left-0 top-[56px] z-40 hidden lg:flex h-[calc(100vh-56px)] flex-col bg-[var(--dash-sidebar-bg)]',
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
