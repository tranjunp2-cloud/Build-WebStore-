'use client'

import Link from 'next/link'
import { Menu, ChevronsLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NotificationBell } from './NotificationBell'
import { UserAvatarMenu } from './UserAvatarMenu'
import { ThemeToggle } from './theme-toggle'
import { AppSwitcher } from './AppSwitcher'


type TopHeaderProps = {
    userName: string
    userInitial: string
    userEmail: string
    sidebarOpen: boolean
    setSidebarOpen: (open: boolean) => void
    collapsed: boolean
    onToggleCollapsed: () => void
    /** Gate the width transition until the persisted collapsed state has painted (anti-flash). */
    animateCollapse?: boolean
}

export function TopHeader({ userName, userInitial, userEmail, sidebarOpen, setSidebarOpen, collapsed, onToggleCollapsed, animateCollapse = false }: TopHeaderProps) {
    return (
        <header className="fixed top-0 left-0 w-full h-[56px] bg-[var(--dash-sidebar-bg)] z-50 flex items-center justify-between pr-4 md:pr-6">
            {/* LEFT segment — visually part of the sidebar: same bg (--dash-sidebar-bg) + right
                divider, width tracks the sidebar (250px / 64px mini) so it reads as one column. */}
            <div
                className={cn(
                    // `dark`: segment logo = phần của sidebar → luôn dark khớp sidebar, bất kể theme.
                    // `dash-logo-seg`: ở mobile/tablet segment chỉ là cụm control của top-bar (không phải
                    // cột sidebar) → globals.css neutralize sb-dark về theme (light=trắng, dark=tối).
                    'dash-logo-seg dark sb-dark flex items-center h-full gap-2 lg:gap-4 pl-4',
                    // bg + right divider (col). The header's own full-width border-bottom draws
                    // the line under the logo too — no separate bottom border here (it sat 1px off
                    // and doubled the line in the logo region).
                    'bg-[var(--dash-sidebar-bg)] dash-col-divider',
                    animateCollapse && 'lg:transition-[width] lg:duration-200',
                    // Sidebar column only from lg (desktop / iPad landscape). Tablet portrait + mobile
                    // are a plain top-bar cluster + overlay drawer (no fixed push-sidebar).
                    collapsed ? 'lg:w-[64px] lg:pl-0 lg:gap-0 lg:justify-center' : 'lg:w-[250px] lg:pr-3',
                )}
            >
                {/* Hamburger — mobile + tablet (< lg). Opens the overlay drawer. */}
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
                    className="lg:hidden flex h-10 w-10 items-center justify-center rounded-lg bg-transparent border-none outline-none hover:bg-dash-surface-hover cursor-pointer transition-colors"
                >
                    <Menu className="h-5 w-5 text-dash-text-muted" />
                </button>

                {/* Logo + App Switcher — hidden on desktop (lg) when collapsed (mini rail shows just the logo icon). */}
                <div className={cn('flex items-center gap-2.5 lg:gap-3', collapsed && 'lg:hidden')}>
                    {/* Logo (icon + PrimeWeb wordmark) */}
                    <Link href="/dashboard" className="flex items-center gap-2 no-underline outline-none">
                        <img
                            src="/images/logo-icon-3c4d76.png"
                            alt="PrimeWeb Logo"
                            className="w-[28px] h-[28px] object-contain drop-shadow-[0px_0px_12px_rgba(6,182,212,0.6)]"
                        />
                        <div className="hidden lg:flex items-center text-[16px] font-bold leading-none tracking-tight">
                            <span className="text-dash-text">Prime</span>
                            <span className="text-[#06B6D4]">Web</span>
                        </div>
                    </Link>

                    {/* App Switcher ⊞ — SSO / ecosystem launcher, to the RIGHT of the logo. */}
                    <AppSwitcher />
                </div>

                {/* Collapsed mini rail: logo icon centered so the brand stays visible above the
                    » expand toggle (which lives at the top of the sidebar rail in this state). */}
                {collapsed && (
                    <Link
                        href="/dashboard"
                        aria-label="PrimeWeb dashboard"
                        className="hidden lg:flex items-center justify-center no-underline outline-none lg:mx-auto"
                    >
                        <img
                            src="/images/logo-icon-3c4d76.png"
                            alt="PrimeWeb Logo"
                            className="w-[28px] h-[28px] object-contain drop-shadow-[0px_0px_12px_rgba(6,182,212,0.6)]"
                        />
                    </Link>
                )}

                {/* Collapse toggle « — pinned to the right edge of this segment (design §3.8).
                    Only when expanded; collapsed uses the » at the top of the sidebar rail.
                    Desktop (lg) only; mobile/tablet use the ☰ drawer. */}
                {!collapsed && (
                    <button
                        onClick={onToggleCollapsed}
                        aria-label="Collapse sidebar"
                        aria-expanded={true}
                        aria-controls="dashboard-sidebar"
                        className="hidden lg:flex h-10 w-10 items-center justify-center rounded-lg bg-transparent border-none outline-none hover:bg-dash-surface-hover cursor-pointer transition-colors lg:ml-auto"
                    >
                        <ChevronsLeft className="h-5 w-5 text-dash-text-muted" />
                    </button>
                )}
            </div>

            <div className="flex items-center gap-2 md:gap-4">
                <NotificationBell />
                <ThemeToggle />
                <UserAvatarMenu userName={userName} userInitial={userInitial} userEmail={userEmail} />
            </div>
        </header>
    )
}
