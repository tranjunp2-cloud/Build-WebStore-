'use client'

/**
 * DashboardSidebar — F18 CMS Core Layout (IA Restructure #1138)
 *
 * Flat sections, NO accordion (design docs/design/F18-cms-layout-design.md §2–§3.6):
 * - Dashboard standalone → ONLINE STORE → CORE OPERATIONS → CRM → SETTINGS → SUPPORT
 * - Section header = static uppercase label, not clickable, no chevron; every item is a leaf-route.
 * - Badges: neutral pill on the right of the label, driven by the `badgeCounts` prop only
 *   (no fake data — nothing renders until the layout wires real counts), hidden when 0/undefined.
 * - Active item: cyan highlight (#06B6D4 — PrimeWeb brand accent, per approved mock).
 * - Footer (language switch + logout) and mobile drawer behavior are unchanged from F18 v1.
 * - Collapse/mini mode (phase-02): desktop aside shrinks to 64px icon-only with EN tooltips
 *   and dot badges; the mobile drawer always renders full. State lives in CMSLayoutClient.
 *
 * Decisions locked 2026-06-11 (Duy Linh): Media stays OUT of the nav (old-version parity);
 * headers per mock (ONLINE STORE / SUPPORT); all badges neutral (no red Orders accent).
 */

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard,
    Globe,
    LayoutTemplate,
    Headphones,
    LogOut,
    Package,
    ShoppingCart,
    Users,
    UserPlus,
    Percent,
    PenLine,
    CreditCard,
    Truck,
    Bell,
    UsersRound,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

// ─── Nav Config (flat sections — design §2 table) ───────────────────────

/** Keys the layout can pass counts for; anything absent simply renders no badge. */
export type SidebarBadgeKey = 'orders' | 'products' | 'discounts' | 'customers' | 'leads'

interface NavLeaf {
    label: { en: string; ms: string }
    icon: typeof LayoutDashboard
    href: string
    /** RBAC permission id (builder/blog/orders/products/settings) — full-access roles bypass. */
    permissionId?: string
    /** CRM items keep the legacy "owner/admin only" gate (parity with the old /customers group). */
    fullAccessOnly?: boolean
    superAdminOnly?: boolean
    /** Dev-only item (Templates Health): hidden on Production, visible on dev/staging/sandbox (phase-03). */
    devOnly?: boolean
    badgeKey?: SidebarBadgeKey
}

interface NavSection {
    /** null = no header (Dashboard standalone block). */
    header: { en: string; ms: string } | null
    items: NavLeaf[]
}

const NAV_SECTIONS: NavSection[] = [
    {
        header: null,
        items: [
            { label: { en: 'Dashboard', ms: 'Papan Pemuka' }, icon: LayoutDashboard, href: '/dashboard' },
        ],
    },
    {
        header: { en: 'Online Store', ms: 'Kedai Online' },
        // Media intentionally absent — old-version parity (decision 2026-06-11)
        items: [
            { label: { en: 'Editor', ms: 'Editor' }, icon: LayoutTemplate, href: '/editor', permissionId: 'builder' },
            { label: { en: 'Blog', ms: 'Blog' }, icon: PenLine, href: '/blog', permissionId: 'blog' },
        ],
    },
    {
        header: { en: 'Core Operations', ms: 'Operasi Teras' },
        items: [
            { label: { en: 'Orders', ms: 'Pesanan' }, icon: ShoppingCart, href: '/orders', permissionId: 'orders', badgeKey: 'orders' },
            { label: { en: 'Products', ms: 'Produk' }, icon: Package, href: '/products', permissionId: 'products', badgeKey: 'products' },
            { label: { en: 'Discounts', ms: 'Diskaun' }, icon: Percent, href: '/discounts', permissionId: 'orders', badgeKey: 'discounts' },
        ],
    },
    {
        header: { en: 'CRM', ms: 'CRM' },
        items: [
            { label: { en: 'All Customers', ms: 'Semua Pelanggan' }, icon: Users, href: '/customers', fullAccessOnly: true, badgeKey: 'customers' },
            { label: { en: 'Contact Leads', ms: 'Kenalan' }, icon: UserPlus, href: '/contact-leads', fullAccessOnly: true, badgeKey: 'leads' },
        ],
    },
    {
        header: { en: 'Settings', ms: 'Tetapan' },
        items: [
            { label: { en: 'Payments', ms: 'Pembayaran' }, icon: CreditCard, href: '/settings/payments', permissionId: 'settings' },
            { label: { en: 'Shipping', ms: 'Penghantaran' }, icon: Truck, href: '/settings/shipping', permissionId: 'settings' },
            { label: { en: 'Domains', ms: 'Domain' }, icon: Globe, href: '/settings/domains', permissionId: 'settings' },
            { label: { en: 'Email Templates', ms: 'Templat E-mel' }, icon: Bell, href: '/settings/email-templates', permissionId: 'settings' },
            // Visible to ALL roles: the target page is the 2-tab Profile+Staff merge (phase-04);
            // the Staff tab is owner-gated inside the page, never here.
            { label: { en: 'Team & Account', ms: 'Pasukan & Akaun' }, icon: UsersRound, href: '/settings/staff' },
        ],
    },
    {
        header: { en: 'Support', ms: 'Sokongan' },
        items: [
            { label: { en: 'Help Center', ms: 'Pusat Bantuan' }, icon: Headphones, href: '/help' },
            // Templates Health (dev drift tool) removed from nav 2026-06-11 (Duy Linh): super-admin
            // page stays reachable by direct URL; showing it to every role on dev/staging was noise.
        ],
    },
]

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

    // Filter sections per role + custom permissions (flat — same rules as the old accordion filter)
    const visibleSections = useMemo(() => {
        const isOwner = currentUserRole === 'owner'
        // editor/viewer are legacy roles — treat as full access to avoid silently breaking existing staff
        const hasFullAccess = isOwner || currentUserRole === 'admin' || currentUserRole === 'editor' || currentUserRole === 'viewer'

        return NAV_SECTIONS
            .map((section) => ({
                ...section,
                items: section.items.filter((leaf) => {
                    if (leaf.devOnly) return !isProduction // env-gate (phase-03), role-independent per design §2
                    if (leaf.superAdminOnly) return isSuperAdmin
                    if (leaf.fullAccessOnly) return hasFullAccess
                    if (!leaf.permissionId) return true
                    if (hasFullAccess) return true
                    return permissions.includes(leaf.permissionId)
                }),
            }))
            .filter((section) => section.items.length > 0) // hide header when its whole section is filtered out
    }, [currentUserRole, permissions, isSuperAdmin, isProduction])

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

    // ─── Logout (shared by full + mini footer) ───────────────────
    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
            })
        } catch (error) {
            console.error('Logout failed:', error)
        } finally {
            document.cookie =
                'payload-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'
            window.location.href = '/login'
        }
    }

    // ─── Render leaf item ────────────────────────────────────────
    const renderLeaf = (leaf: NavLeaf, mini: boolean) => {
        const Icon = leaf.icon
        const label = locale === 'ms' ? leaf.label.ms : leaf.label.en
        const isActive = pathname === leaf.href || pathname?.startsWith(leaf.href + '/')
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
                        ? 'bg-[rgba(6,182,212,0.12)] text-[#06B6D4] shadow-[0_0_16px_rgba(6,182,212,0.25)]'
                        : 'text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text'
                )}
                aria-current={isActive ? 'page' : undefined}
                // Icon-only link needs a name when the tooltip is closed (a11y)
                aria-label={mini ? label : undefined}
            >
                {mini ? (
                    <span className="relative flex">
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        {/* Badge → dot in mini mode (no number); same 0/undefined hide rule */}
                        {hasCount && (
                            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-dash-text-muted" />
                        )}
                    </span>
                ) : (
                    <>
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        <span className="flex-1">{label}</span>
                        {/* Badge — neutral pill, hidden when count is 0/undefined (design §2 badge rules) */}
                        {hasCount && (
                            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-dash-surface-hover px-1.5 text-[11px] font-semibold leading-none text-dash-text-muted">
                                {count > 999 ? '999+' : count}
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

            {/* Footer — language switch + logout; icon-only when collapsed (phase-02) */}
            {mini ? (
                <div
                    className="flex flex-col items-center gap-3 px-3 pt-[17px]"
                    style={{ height: 125, borderTop: '1px solid var(--dash-divider)' }}
                >
                    <button
                        onClick={toggleLocale}
                        aria-label={locale === 'ms' ? 'Switch to English' : 'Switch to Malay'}
                        className="flex h-[38px] w-[38px] items-center justify-center rounded-[12px] border border-dash-border bg-transparent outline-none text-dash-text hover:bg-dash-surface-hover cursor-pointer transition-colors"
                    >
                        <Globe className="h-4 w-4 shrink-0" />
                    </button>
                    <button
                        onClick={handleLogout}
                        aria-label={locale === 'ms' ? 'Log Keluar' : 'Logout'}
                        className="flex h-[38px] w-[38px] items-center justify-center rounded-[12px] border border-dash-border bg-transparent outline-none text-dash-text hover:bg-dash-surface-hover cursor-pointer transition-colors"
                    >
                        <LogOut className="h-4 w-4 shrink-0" />
                    </button>
                </div>
            ) : (
            <div
                className="flex flex-col gap-3 px-3 pt-[17px]"
                style={{ height: 125, borderTop: '1px solid var(--dash-divider)' }}
            >
                <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 shrink-0 text-dash-text" />
                    <div className="flex flex-1 items-center rounded-[16px] border border-dash-border bg-dash-surface px-1 h-[38px]">
                        <button
                            onClick={() => locale !== 'ms' && toggleLocale()}
                            className={cn(
                                'flex-1 flex items-center justify-center rounded-[12px] h-[28px] bg-transparent border-none outline-none text-[12px] font-semibold leading-[1.33] cursor-pointer transition-all',
                                locale === 'ms'
                                    ? '!bg-[#2DD4BF] !text-[#0B1120] shadow-[0_0_12px_rgba(45,212,191,0.4)]'
                                    : 'text-dash-text-muted hover:text-dash-text'
                            )}
                        >
                            MY
                        </button>
                        <button
                            onClick={() => locale !== 'en' && toggleLocale()}
                            className={cn(
                                'flex-1 flex items-center justify-center rounded-[12px] h-[28px] bg-transparent border-none outline-none text-[12px] font-semibold leading-[1.33] cursor-pointer transition-all',
                                locale === 'en'
                                    ? '!bg-[#2DD4BF] !text-[#0B1120] shadow-[0_0_12px_rgba(45,212,191,0.4)]'
                                    : 'text-dash-text-muted hover:text-dash-text'
                            )}
                        >
                            EN
                        </button>
                    </div>
                </div>

                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 rounded-[16px] border border-dash-border bg-transparent outline-none pl-4 h-[44px] text-[14px] font-medium text-dash-text hover:bg-dash-surface-hover cursor-pointer transition-colors"
                >
                    <LogOut className="h-4 w-4 shrink-0 text-dash-text" />
                    <span>{locale === 'ms' ? 'Log Keluar' : 'Logout'}</span>
                </button>
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
                        className="absolute left-0 top-[56px] bottom-0 z-10 flex w-[260px] flex-col bg-[var(--dash-sidebar-bg)] shadow-2xl animate-in slide-in-from-left duration-200"
                        style={{ borderRight: '1px solid var(--dash-col-divider-color)' }}
                    >
                        {renderSidebarContent(false)}
                    </aside>
                </div>
            )}

            {/* Desktop sidebar — 260px full / 64px mini (phase-02); width transition gated post-hydration */}
            <aside
                id="dashboard-sidebar"
                className={cn(
                    'fixed left-0 top-[56px] z-40 hidden md:flex h-[calc(100vh-56px)] flex-col bg-[var(--dash-sidebar-bg)]',
                    animateCollapse && 'transition-[width] duration-200',
                    collapsed ? 'w-[64px]' : 'w-[260px]'
                )}
                style={{ borderRight: '1px solid var(--dash-col-divider-color)' }}
            >
                {renderSidebarContent(collapsed)}
            </aside>
        </>
    )
}
