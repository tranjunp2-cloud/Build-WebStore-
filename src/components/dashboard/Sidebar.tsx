'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard,
    Globe,
    LayoutTemplate,
    Image,
    Search,
    BarChart3,
    Settings,
    CreditCard,
    LogOut,
    Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'My Sites', href: '/dashboard/sites', icon: Globe },
    { label: 'Templates', href: '/templates', icon: LayoutTemplate },
    { label: 'Media', href: '/dashboard/media', icon: Image },
    { label: 'SEO', href: '/dashboard/seo', icon: Search, phase: 5 },
    { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, phase: 5 },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
    { label: 'Billing', href: '/dashboard/billing', icon: CreditCard, phase: 5 },
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
                <Sparkles className="h-6 w-6 text-blue-400" />
                <span className="text-lg font-bold text-white">PrimeWeb</span>
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
                            {item.phase && item.phase > 2 && (
                                <span className="ml-auto rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500">
                                    Soon
                                </span>
                            )}
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
                        title="Logout"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </aside>
    )
}

