'use client'

/**
 * DashboardSidebar — F18 CMS Core Layout
 * Pixel-perfect match to Figma nodes 30737-17299 (collapsed) & 30737-18063 (expanded).
 *
 * Figma tokens:
 * - Sidebar: width 260, bg #0B1120, border-right rgba(255,255,255,0.08)
 * - Nav: column, gap 4px, padding 24px 12px 0
 * - Nav Button: row, center, gap 12px, px-16, h-auto, radius 16px
 * - Active: bg rgba(59,130,246,0.1), shadow 0 0 20px rgba(59,130,246,0.3), text #3B82F6
 * - Inactive: text rgba(248,250,252,0.7)
 * - Icon: 20x20, Font: Inter 500 14px
 * - Submenu container: x=16 y=48, w=219, h=84, gap 4px
 * - Submenu item: h=40, dot bullet 6x6 at x=16, text at x=34, text rgba(248,250,252,0.6)
 * - Orders badge: #2DD4BF, 20x20, radius full, padding 2px 6px
 * - Footer: h=125, gap 12px, padding 17px 12px 0, border-top rgba(255,255,255,0.08)
 * - Language: Globe 16px + pill bg #1E293B, border rgba(255,255,255,0.08), radius 16, h=38
 * - Active lang: bg #2DD4BF, shadow 0 0 12px rgba(45,212,191,0.4), text #0B1120
 * - Inactive lang: text rgba(248,250,252,0.6)
 * - Logout: row, gap 12px, pl-16, border rgba(255,255,255,0.08), radius 16, icon 16px, text #F8FAFC
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
    LayoutDashboard,
    Globe,
    LayoutTemplate,
    Settings,
    Headphones,
    LogOut,
    ShieldCheck,
    Package,
    Users,
    Menu,
    X,
    ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

// ─── Nav Config (PRD §8 + Figma) ────────────────────────────────────────

interface NavChild {
    label: { en: string; ms: string }
    href: string
}

interface NavItemConfig {
    label: { en: string; ms: string }
    icon: typeof LayoutDashboard
    href: string
    children?: NavChild[]
    badge?: boolean
    superAdminOnly?: boolean
}

const NAV_ITEMS: NavItemConfig[] = [
    {
        label: { en: 'Dashboard', ms: 'Papan Pemuka' },
        icon: LayoutDashboard,
        href: '/dashboard',
    },
    {
        label: { en: 'My Website', ms: 'Laman Web Saya' },
        icon: LayoutTemplate,
        href: '/editor',
        children: [
            { label: { en: 'Editor', ms: 'Editor' }, href: '/editor' },
            { label: { en: 'Blog', ms: 'Blog' }, href: '/blog' },
        ],
    },
    {
        label: { en: 'Products', ms: 'Produk' },
        icon: Package,
        href: '/products',
    },
    {
        label: { en: 'Customers', ms: 'Pelanggan' },
        icon: Users,
        href: '/customers',
    },
    {
        label: { en: 'Settings', ms: 'Tetapan' },
        icon: Settings,
        href: '/settings',
        children: [
            { label: { en: 'Domains', ms: 'Domain' }, href: '/settings/domains' },
            { label: { en: 'Payments', ms: 'Pembayaran' }, href: '/settings/payments' },
            { label: { en: 'Staff', ms: 'Kakitangan' }, href: '/settings/staff' },
            { label: { en: 'Shipping', ms: 'Penghantaran' }, href: '/settings/shipping' },
            { label: { en: 'Account profile', ms: 'Profil Akaun' }, href: '/settings/profile' },
        ],
    },
    {
        label: { en: 'Help Center', ms: 'Pusat Bantuan' },
        icon: Headphones,
        href: '/help',
    },
    {
        label: { en: 'Templates Health', ms: 'Status Templat' },
        icon: ShieldCheck,
        href: '/templates-health',
        superAdminOnly: true,
    },
]


// ─── Types ───────────────────────────────────────────────────────────────

type SidebarProps = {
    userName: string
    userInitial: string
    currentUserRole?: string
    isSuperAdmin?: boolean
    mobileOpen: boolean
    setMobileOpen: (open: boolean) => void
}

// ─── Component ───────────────────────────────────────────────────────────

export function DashboardSidebar({ userName, userInitial, currentUserRole = 'viewer', isSuperAdmin = false, mobileOpen, setMobileOpen }: SidebarProps) {
    const pathname = usePathname()
    const router = useRouter()
    const { locale, toggleLocale } = useI18n()
    const [expandedGroups, setExpandedGroups] = useState<string[]>(() => {
        const expanded: string[] = []
        for (const item of NAV_ITEMS) {
            if (item.children?.some((c) => pathname === c.href || pathname?.startsWith(c.href + '/'))) {
                expanded.push(item.href)
            }
        }
        return expanded
    })

    // Filter NAV_ITEMS based on access rights
    const accessibleNavItems = useMemo(() => {
        return NAV_ITEMS
            .filter(item => !item.superAdminOnly || isSuperAdmin)
            .map(item => {
                if (item.href === '/settings' && item.children) {
                    // Return copied item with filtered children
                    return {
                        ...item,
                        children: item.children.filter(child => {
                            // Only owner can see Staff menu
                            if (child.href === '/settings/staff') {
                                return currentUserRole === 'owner';
                            }

                            return true;
                        })
                    }
                }
                return item;
            })
    }, [currentUserRole, isSuperAdmin]);

    // Close sidebar on route change
    useEffect(() => {
        setMobileOpen(false)
    }, [pathname])

    // Close on Escape
    useEffect(() => {
        if (!mobileOpen) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setMobileOpen(false)
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [mobileOpen])

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

    const toggleGroup = useCallback((href: string) => {
        setExpandedGroups((prev) =>
            prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]
        )
    }, [])

    // ─── Render nav item ────────────────────────────────────────
    const renderNavItem = (item: NavItemConfig) => {
        const Icon = item.icon
        const label = locale === 'ms' ? item.label.ms : item.label.en
        const hasChildren = item.children && item.children.length > 0
        const isGroupExpanded = expandedGroups.includes(item.href)
        const isActive =
            !hasChildren && (pathname === item.href || pathname?.startsWith(item.href + '/'))

        // ── Group with children (My Webstore) ─────────────────
        if (hasChildren) {
            return (
                <div key={item.href}>
                    {/* Figma: layout_M50WQK / layout_3KGU3X — row, center, gap 12, px-16, radius 16, h-44 */}
                    <button
                        onClick={() => toggleGroup(item.href)}
                        className="flex w-full items-center gap-3 rounded-[16px] px-4 h-[44px] bg-transparent border-none outline-none text-[14px] font-medium leading-[1.43] text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors cursor-pointer"
                        aria-expanded={isGroupExpanded}
                        aria-label={label}
                    >
                        <Icon className="h-5 w-5 shrink-0" />
                        <span className="flex-1 text-left">{label}</span>
                        {/* Figma: Chevron 16x16 */}
                        <ChevronDown
                            className={cn(
                                'h-4 w-4 shrink-0 text-[rgba(248,250,252,0.7)] transition-transform duration-200',
                                isGroupExpanded && 'rotate-180'
                            )}
                        />
                    </button>

                    {/* Figma: Submenu container — layout_KILGIG — column, gap 4px, x=16, w=219 */}
                    <div
                        className={cn(
                            'overflow-hidden transition-all duration-200',
                            isGroupExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                        )}
                    >
                        <div className="flex flex-col gap-1 pl-4">
                            {item.children!.map((child) => {
                                const childLabel = locale === 'ms' ? child.label.ms : child.label.en
                                const childActive =
                                    pathname === child.href || pathname?.startsWith(child.href + '/')

                                return (
                                    <Link
                                        key={child.href}
                                        href={child.href}
                                        className={cn(
                                            // Figma: layout_JMHD0B — h-40, radius 12
                                            'no-underline flex items-center gap-[18px] rounded-[12px] px-4 h-[40px] text-[14px] font-medium leading-[1.43] transition-colors',
                                            childActive
                                                ? 'text-[#3B82F6]'
                                                : 'text-dash-text-muted hover:text-dash-text'
                                        )}
                                    >
                                        {/* Figma: Dot bullet — 6x6 circle at x=16 y=17 */}
                                        <span
                                            className={cn(
                                                'h-1.5 w-1.5 shrink-0 rounded-full',
                                                childActive
                                                    ? 'bg-[#3B82F6]'
                                                    : 'bg-[var(--dash-text-muted)]'
                                            )}
                                        />
                                        <span>{childLabel}</span>
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )
        }

        // ── Simple nav item ──────────────────────────────────
        return (
            <Link
                key={item.href}
                href={item.href}
                className={cn(
                    // Figma: layout_M50WQK — row, center, gap 12, px-16, radius 16
                    'no-underline flex items-center gap-3 rounded-[16px] px-4 h-[44px] text-[14px] font-medium leading-[1.43] transition-colors',
                    isActive
                        ? 'bg-[rgba(59,130,246,0.1)] text-[#3B82F6] shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                        : 'text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text'
                )}
                aria-current={isActive ? 'page' : undefined}
            >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="flex-1">{label}</span>
                {/* Figma: Badge — #2DD4BF, 20x20, radius full, padding 2px 6px, Inter 600 12px */}
                {item.badge && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#2DD4BF] px-1.5 text-[12px] font-semibold leading-[1.33] text-[#0B1120]">
                        5
                    </span>
                )}
            </Link>
        )
    }

    // ─── Sidebar Content ─────────────────────────────────────────
    const sidebarContent = (
        <>
            {/* Figma: Navigation — column, gap 4px, padding 24px 12px 0, fill height */}
            <nav
                className="flex-1 flex flex-col gap-1 px-3 pt-6"
                aria-label="CMS Navigation"
            >
                {accessibleNavItems.map(renderNavItem)}


            </nav>

            {/* Figma: Footer — layout_L26FAP — column, gap 12px, padding 17px 12px 0, h=125, border-top */}
            <div
                className="flex flex-col gap-3 px-3 pt-[17px] border-t border-dash-border"
                style={{ height: 125 }}
            >
                {/* Figma: Language row — layout_6MREP8 — row, center, self-stretch, gap 8px */}
                <div className="flex items-center gap-2">
                    {/* Figma: Globe Icon 16x16 */}
                    <Globe className="h-4 w-4 shrink-0 text-dash-text-muted" />
                    {/* Figma: Pill — language switcher */}
                    <div className="flex flex-1 items-center rounded-[16px] border border-dash-border bg-dash-surface px-1 h-[38px]">
                        {/* Figma: MY button — layout_CR9BUZ — padding 6px 12px, radius 12, h=28 */}
                        <button
                            onClick={() => locale !== 'ms' && toggleLocale()}
                            className={cn(
                                'flex-1 flex items-center justify-center rounded-[12px] h-[28px] bg-transparent border-none outline-none text-[12px] font-semibold leading-[1.33] cursor-pointer transition-all',
                                locale === 'ms'
                                    ? '!bg-[#2DD4BF] text-[#0B1120] shadow-[0_0_12px_rgba(45,212,191,0.4)]'
                                    : 'text-dash-text-muted hover:text-dash-text'
                            )}
                        >
                            MY
                        </button>
                        {/* Figma: EN button — active by default */}
                        <button
                            onClick={() => locale !== 'en' && toggleLocale()}
                            className={cn(
                                'flex-1 flex items-center justify-center rounded-[12px] h-[28px] bg-transparent border-none outline-none text-[12px] font-semibold leading-[1.33] cursor-pointer transition-all',
                                locale === 'en'
                                    ? '!bg-[#2DD4BF] text-[#0B1120] shadow-[0_0_12px_rgba(45,212,191,0.4)]'
                                    : 'text-dash-text-muted hover:text-dash-text'
                            )}
                        >
                            EN
                        </button>
                    </div>

                </div>

                {/* Figma: Logout — layout_3Q8UJX — row, center, self-stretch, gap 12, pl-16, border, radius 16, NO fill */}
                <button
                    onClick={async () => {
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
                    }}
                    className="flex items-center gap-3 rounded-[16px] border border-dash-border bg-transparent outline-none pl-4 h-[44px] text-[14px] font-medium text-dash-text hover:bg-dash-surface-hover cursor-pointer transition-colors"
                >
                    {/* Figma: Icon 16x16 */}
                    <LogOut className="h-4 w-4 shrink-0" />
                    <span>{locale === 'ms' ? 'Log Keluar' : 'Logout'}</span>
                </button>
            </div>
        </>
    )

    return (
        <>

            {/* Mobile overlay + drawer — slides in BELOW the header (Figma 30737-17086) */}
            {mobileOpen && (
                <div className="fixed inset-0 z-40 md:hidden">
                    {/* Overlay — starts below header */}
                    <div
                        className="absolute inset-0 top-[56px] bg-black/60"
                        onClick={() => setMobileOpen(false)}
                    />
                    {/* Sidebar drawer — same width 260px, below header */}
                    <aside className="absolute left-0 top-[56px] bottom-0 z-10 flex w-[260px] flex-col border-r border-dash-border bg-dash-bg shadow-2xl animate-in slide-in-from-left duration-200">
                        {sidebarContent}
                    </aside>
                </div>
            )}

            {/* Figma: Desktop sidebar — 260px, border-right */}
            <aside className="fixed left-0 top-[56px] z-40 hidden md:flex h-[calc(100vh-56px)] w-[260px] flex-col border-r border-dash-border bg-dash-bg">
                {sidebarContent}
            </aside>
        </>
    )
}
