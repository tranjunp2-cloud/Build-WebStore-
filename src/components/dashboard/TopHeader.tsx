'use client'

import Link from 'next/link'
import { Menu } from 'lucide-react'
import { NotificationBell } from './NotificationBell'
import { UserAvatarMenu } from './UserAvatarMenu'
import { ThemeToggle } from './theme-toggle'


type TopHeaderProps = {
    userName: string
    userInitial: string
    userEmail: string
    sidebarOpen: boolean
    setSidebarOpen: (open: boolean) => void
}

export function TopHeader({ userName, userInitial, userEmail, sidebarOpen, setSidebarOpen }: TopHeaderProps) {
    return (
        <header className="fixed top-0 left-0 w-full h-[56px] bg-dash-surface border-b border-dash-border z-50 flex items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-2 md:gap-4">
                {/* Mobile Hamburger Toggle */}
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
                    className="md:hidden flex h-10 w-10 items-center justify-center rounded-lg bg-transparent border-none outline-none hover:bg-dash-surface-hover cursor-pointer transition-colors"
                >
                    <Menu className="h-5 w-5 text-dash-text-muted" />
                </button>

                {/* Logo */}
                <Link href="/dashboard" className="flex items-center gap-3 no-underline outline-none">
                    <img
                        src="/images/logo-icon-3c4d76.png"
                        alt="PrimeWeb Logo"
                        className="w-[42px] h-[42px] object-contain drop-shadow-[0px_0px_16px_rgba(6,182,212,0.6)]"
                    />
                    <div className="hidden md:flex items-center text-[24px] font-bold leading-[1.33] tracking-tight">
                        <span className="text-dash-text">Prime</span>
                        <span className="text-[#06B6D4]">Web</span>
                    </div>
                </Link>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
                <NotificationBell />
                <ThemeToggle />
                <UserAvatarMenu userName={userName} userInitial={userInitial} userEmail={userEmail} />
            </div>
        </header>
    )
}
