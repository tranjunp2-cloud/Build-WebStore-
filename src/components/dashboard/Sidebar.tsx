'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard,
    Globe,
    LayoutTemplate,
    Image,
    Settings,
    LogOut,
    Loader2,
    MousePointerClick,
    Search,
    ShoppingBag,
    ClipboardList,
    BarChart3,
    Menu,
    X,
    FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'My Sites', href: '/sites', icon: Globe },
    { label: 'SEO', href: '/dashboard/seo', icon: Search },
    { label: 'Products', href: '/products', icon: ShoppingBag },
    { label: 'Orders', href: '/orders', icon: ClipboardList },
    { label: 'Blog', href: '/blog', icon: FileText },
    { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { label: 'Media', href: '/media', icon: Image },
    { label: 'Settings', href: '/settings', icon: Settings },
  ]

type SidebarProps = {
    userName: string
    userInitial: string
}

export function DashboardSidebar({ userName, userInitial }: SidebarProps) {
    const pathname = usePathname()
    const [mobileOpen, setMobileOpen] = useState(false)
    const [loggingOut, setLoggingOut] = useState(false)

    // Close sidebar on route change
    useEffect(() => {
        setMobileOpen(false)
    }, [pathname])

    // Close on Escape
    useEffect(() => {
        if (!mobileOpen) return
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
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
        return () => { document.body.style.overflow = '' }
    }, [mobileOpen])

    const sidebarContent = (
        <>
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
                        disabled={loggingOut}
                        onClick={async () => {
                            if (loggingOut) return
                            setLoggingOut(true)
                            try {
                                await fetch('/api/users/logout', {
                                    method: 'POST',
                                    credentials: 'include',
                                })
                                toast.success('Đã đăng xuất thành công')
                            } catch {
                                toast.error('Lỗi khi đăng xuất, vui lòng thử lại!')
                            }
                            // Always clear cookie client-side as fallback
                            document.cookie = 'payload-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'
                            window.location.href = '/login'
                        }}
                        className={cn(
                            "rounded-lg p-1.5 text-gray-500 hover:bg-white/5 hover:text-white transition-colors",
                            loggingOut && "opacity-50 cursor-not-allowed"
                        )}
                        title="Log Out"
                    >
                        {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                    </button>
                </div>
            </div>
        </>
    )

    return (
        <>
            {/* Mobile top bar */}
            <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center gap-3 border-b border-white/10 bg-[#0B1120]/95 backdrop-blur-md px-4 md:hidden">
                <button
                    onClick={() => setMobileOpen(true)}
                    aria-label="Open menu"
                    className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
                >
                    <Menu className="h-5 w-5" />
                </button>
                <MousePointerClick className="h-5 w-5 text-cyan-400" />
                <span className="text-base font-bold text-white">Web Store</span>
            </div>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
                    <aside className="relative z-10 flex h-screen w-[280px] flex-col bg-[#0B1120] shadow-2xl animate-in slide-in-from-left duration-200">
                        {/* Close button */}
                        <button
                            onClick={() => setMobileOpen(false)}
                            aria-label="Close menu"
                            className="absolute top-4 right-4 rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                        {sidebarContent}
                    </aside>
                </div>
            )}

            {/* Desktop sidebar — hidden on mobile */}
            <aside className="fixed left-0 top-0 z-40 hidden md:flex h-screen w-[240px] flex-col border-r border-white/10 bg-[#0B1120]">
                {sidebarContent}
            </aside>
        </>
    )
}
