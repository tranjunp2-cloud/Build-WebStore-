'use client'

import Link from 'next/link'
import { Menu, ChevronsLeft, ChevronsRight } from 'lucide-react'
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
        <header className="fixed top-0 left-0 w-full h-[56px] bg-dash-surface border-b border-dash-border z-50 flex items-center justify-between pr-4 md:pr-6">
            {/* LEFT segment — visually part of the sidebar: same bg (--dash-sidebar-bg) + right
                divider, width tracks the sidebar (260px / 64px mini) so it reads as one column. */}
            <div
                className={cn(
                    'flex items-center h-full gap-2 md:gap-4 pl-4',
                    // bg + right divider (col) + bottom divider = line between logo and the sidebar below
                    'md:bg-[var(--dash-sidebar-bg)] dash-col-divider md:[border-bottom:1px_solid_var(--dash-divider)]',
                    animateCollapse && 'md:transition-[width] md:duration-200',
                    collapsed ? 'md:w-[64px] md:pl-0 md:gap-0 md:justify-center' : 'md:w-[260px] md:pr-3',
                )}
            >
                {/* Mobile Hamburger Toggle */}
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
                    className="md:hidden flex h-10 w-10 items-center justify-center rounded-lg bg-transparent border-none outline-none hover:bg-dash-surface-hover cursor-pointer transition-colors"
                >
                    <Menu className="h-5 w-5 text-dash-text-muted" />
                </button>

                {/* App Switcher ⊞ + Logo — hidden on desktop when collapsed (64px rail only fits the « toggle). */}
                <div className={cn('flex items-center gap-2 md:gap-4', collapsed && 'md:hidden')}>
                    {/* App Switcher ⊞ — before the logo, after ☰ on mobile (design §3.3/§3.7) */}
                    <AppSwitcher />

                    {/* Logo */}
                    <Link href="/dashboard" className="flex items-center gap-2 no-underline outline-none">
                        <img
                            src="/images/logo-icon-3c4d76.png"
                            alt="PrimeWeb Logo"
                            className="w-[28px] h-[28px] object-contain drop-shadow-[0px_0px_12px_rgba(6,182,212,0.6)]"
                        />
                        <div className="hidden md:flex items-center text-[16px] font-bold leading-none tracking-tight">
                            <span className="text-dash-text">Prime</span>
                            <span className="text-[#06B6D4]">Web</span>
                        </div>
                    </Link>
                </div>

                {/* Sidebar collapse toggle — pinned to the right edge of this segment (the
                    sidebar/content boundary, design §3.8). Desktop only; mobile uses the ☰ drawer. */}
                <button
                    onClick={onToggleCollapsed}
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    aria-expanded={!collapsed}
                    aria-controls="dashboard-sidebar"
                    className={cn(
                        'hidden md:flex h-10 w-10 items-center justify-center rounded-lg bg-transparent border-none outline-none hover:bg-dash-surface-hover cursor-pointer transition-colors',
                        collapsed ? 'md:mx-auto' : 'md:ml-auto',
                    )}
                >
                    {collapsed
                        ? <ChevronsRight className="h-5 w-5 text-dash-text-muted" />
                        : <ChevronsLeft className="h-5 w-5 text-dash-text-muted" />}
                </button>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
                <NotificationBell />
                <ThemeToggle />
                <UserAvatarMenu userName={userName} userInitial={userInitial} userEmail={userEmail} />
            </div>
        </header>
    )
}
