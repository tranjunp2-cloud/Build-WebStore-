'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    Globe,
    Headphones,
    LayoutDashboard,
    LogOut,
    Menu,
    Package,
    Settings,
    ShoppingCart,
    Store,
    X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

type EditorMenuDrawerProps = {
    siteId: string
    open: boolean
    onClose: () => void
}

type NavItem = {
    label: string
    href?: string
    icon?: React.ComponentType<{ className?: string }>
    children?: { label: string; href: string }[]
    badge?: string
}

export function EditorMenuDrawer({ siteId, open, onClose }: EditorMenuDrawerProps) {
    const pathname = usePathname()
    const { locale, toggleLocale } = useI18n()
    const [expandedStore, setExpandedStore] = useState(true)

    useEffect(() => {
        if (!open) return

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }

        document.body.style.overflow = 'hidden'
        window.addEventListener('keydown', onKeyDown)

        return () => {
            document.body.style.overflow = ''
            window.removeEventListener('keydown', onKeyDown)
        }
    }, [onClose, open])

    const navItems = useMemo<NavItem[]>(
        () => [
            { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
            {
                label: 'My Webstore',
                icon: Store,
                children: [
                    { label: 'Editor', href: `/editor/${siteId}` },
                    { label: 'Blog', href: '/blog' },
                ],
            },
            { label: 'Products', href: '/products', icon: Package },
            { label: 'Orders', href: '/orders', icon: ShoppingCart, badge: '5' },
            { label: 'Store Config', href: '/settings', icon: Settings },
            { label: 'Help Center', href: '/help', icon: Headphones },
        ],
        [siteId],
    )

    const handleLogout = async () => {
        try {
            await fetch('/api/users/logout', {
                method: 'POST',
                credentials: 'include',
            })
        } catch (error) {
            console.error('Logout request failed:', error)
        } finally {
            document.cookie = 'payload-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'
            window.location.href = '/login'
        }
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />

            <aside className="absolute left-0 top-0 flex h-full w-[260px] flex-col border-r border-white/[0.08] bg-[#0B1120] shadow-2xl">
                <div className="flex h-[65px] items-center justify-between border-b border-white/[0.08] px-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-[12px] font-bold text-white">
                            P
                        </div>
                        <span className="text-lg font-semibold text-white">PrimeWeb</span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <nav className="flex-1 space-y-1 px-3 pt-6" aria-label="Editor menu">
                    {navItems.map(item => {
                        const Icon = item.icon
                        const isGroup = Boolean(item.children?.length)
                        const isActive = item.href ? pathname === item.href || pathname?.startsWith(item.href + '/') : false

                        if (isGroup) {
                            return (
                                <div key={item.label}>
                                    <button
                                        type="button"
                                        onClick={() => setExpandedStore(prev => !prev)}
                                        className="flex h-[44px] w-full items-center gap-3 rounded-[16px] px-4 text-left text-[14px] font-medium text-[rgba(248,250,252,0.7)] transition-colors hover:bg-white/5 hover:text-white"
                                    >
                                        {Icon ? <Icon className="h-5 w-5 shrink-0" /> : null}
                                        <span className="flex-1">{item.label}</span>
                                        <Menu className={cn('h-4 w-4 shrink-0 transition-transform', expandedStore && 'rotate-90')} />
                                    </button>
                                    <div className={cn('overflow-hidden transition-all', expandedStore ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0')}>
                                        <div className="flex flex-col gap-1 pl-4">
                                            {item.children?.map(child => {
                                                const childActive =
                                                    pathname === child.href ||
                                                    pathname?.startsWith(child.href + '/')

                                                return (
                                                    <Link
                                                        key={child.href}
                                                        href={child.href}
                                                        onClick={onClose}
                                                        className={cn(
                                                            'flex h-10 items-center gap-[18px] rounded-[12px] px-4 text-[14px] font-medium transition-colors',
                                                            childActive
                                                                ? 'text-[#3B82F6]'
                                                                : 'text-[rgba(248,250,252,0.6)] hover:text-white',
                                                        )}
                                                    >
                                                        <span
                                                            className={cn(
                                                                'h-1.5 w-1.5 rounded-full',
                                                                childActive ? 'bg-[#3B82F6]' : 'bg-[rgba(248,250,252,0.6)]',
                                                            )}
                                                        />
                                                        <span>{child.label}</span>
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )
                        }

                        return (
                            <Link
                                key={item.label}
                                href={item.href || '#'}
                                onClick={onClose}
                                className={cn(
                                    'flex h-[44px] items-center gap-3 rounded-[16px] px-4 text-[14px] font-medium transition-colors',
                                    isActive
                                        ? 'bg-[rgba(59,130,246,0.1)] text-[#3B82F6] shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                                        : 'text-[rgba(248,250,252,0.7)] hover:bg-white/5 hover:text-white',
                                )}
                            >
                                {Icon ? <Icon className="h-5 w-5 shrink-0" /> : null}
                                <span className="flex-1">{item.label}</span>
                                {item.badge ? (
                                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#2DD4BF] px-1.5 text-[12px] font-semibold text-[#0B1120]">
                                        {item.badge}
                                    </span>
                                ) : null}
                            </Link>
                        )
                    })}
                </nav>

                <div className="flex flex-col gap-3 border-t border-white/[0.08] px-3 pt-[17px]" style={{ height: 125 }}>
                    <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 shrink-0 text-[rgba(248,250,252,0.5)]" />
                        <div className="flex h-[38px] flex-1 items-center rounded-[16px] border border-white/[0.08] bg-[#1E293B] px-1">
                            <button
                                type="button"
                                onClick={() => locale !== 'ms' && toggleLocale()}
                                className={cn(
                                    'flex flex-1 items-center justify-center rounded-[12px] h-[28px] text-[12px] font-semibold transition-all',
                                    locale === 'ms'
                                        ? 'bg-[#2DD4BF] text-[#0B1120] shadow-[0_0_12px_rgba(45,212,191,0.4)]'
                                        : 'text-[rgba(248,250,252,0.6)] hover:text-white',
                                )}
                            >
                                MY
                            </button>
                            <button
                                type="button"
                                onClick={() => locale !== 'en' && toggleLocale()}
                                className={cn(
                                    'flex flex-1 items-center justify-center rounded-[12px] h-[28px] text-[12px] font-semibold transition-all',
                                    locale === 'en'
                                        ? 'bg-[#2DD4BF] text-[#0B1120] shadow-[0_0_12px_rgba(45,212,191,0.4)]'
                                        : 'text-[rgba(248,250,252,0.6)] hover:text-white',
                                )}
                            >
                                EN
                            </button>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleLogout}
                        className="flex h-[44px] items-center gap-3 rounded-[16px] border border-white/[0.08] pl-4 text-[14px] font-medium text-[#F8FAFC] transition-colors hover:bg-white/5"
                    >
                        <LogOut className="h-4 w-4 shrink-0" />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>
        </div>
    )
}
