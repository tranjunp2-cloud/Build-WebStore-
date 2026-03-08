'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard,
    Globe,
    LayoutTemplate,
    Image,
    Settings,
    LogOut,
    MousePointerClick,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'My Sites', href: '/dashboard/sites', icon: Globe },
    { label: 'Templates', href: '/templates', icon: LayoutTemplate },
    { label: 'Media', href: '/dashboard/media', icon: Image },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
]

type SidebarProps = {
    userName: string
    userInitial: string
}

export function DashboardSidebar({ userName, userInitial }: SidebarProps) {
    const pathname = usePathname()

    return (
        <aside className="fixed left-0 top-0 z-40 flex h-screen w-[240px] flex-col border-r border-white/10 bg-[#0B1120]">
            {/* Logo */}
            <div className="flex h-16 items-center gap-2 px-6">
                <MousePointerClick className="h-6 w-6 text-cyan-400" />
                <span className="text-lg font-bold text-white">Web Store</span>
            </div>

            {/* Nav items */}
            <nav className="flex-1 space-y-1 px-3 py-4">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                    const Icon = item.icon

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                                isActive
                                    ? 'bg-blue-600/20 text-blue-400'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                        </Link>
                    )
                })}
            </nav>

            {/* User section */}
            <div className="border-t border-white/10 p-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-xs font-bold text-white">
                        {userInitial}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-white">{userName}</p>
                        <p className="truncate text-xs text-gray-500">Owner</p>
                    </div>
                    <button
                        onClick={async () => {
                            await fetch('/api/users/logout', {
                                method: 'POST',
                                credentials: 'include',
                            })
                            window.location.href = '/login'
                        }}
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-white/5 hover:text-white transition-colors"
                        title="Đăng xuất"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </aside>
    )
}
