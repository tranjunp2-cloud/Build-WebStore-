'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import {
    ChevronDown,
    Globe,
    Headphones,
    LayoutDashboard,
    LayoutTemplate,
    LogOut,
    Package,
    Settings,
    ShoppingCart,
    Users,
    X,
} from 'lucide-react'
import { NotificationBell } from '@/components/dashboard/NotificationBell'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

type LocaleLabel = { en: string; ms: string }

type NavItem = {
    label: LocaleLabel
    href: string
    icon?: React.ComponentType<{ className?: string }>
    children?: { label: LocaleLabel; href: string; roleFilter?: (role: string) => boolean }[]
    badge?: string
    roleFilter?: (role: string) => boolean
}

type EditorMenuDrawerProps = {
    siteId: string
    open: boolean
    onClose: () => void
    currentUserRole?: string
    userName?: string
    userInitial?: string
    userAvatarUrl?: string | null
    hasUnsavedChanges?: boolean
}

export function EditorMenuDrawer({ siteId, open, onClose, currentUserRole = 'viewer', userName, userInitial, userAvatarUrl, hasUnsavedChanges }: EditorMenuDrawerProps) {
    const pathname = usePathname()
    const router = useRouter()
    const { t, locale, toggleLocale } = useI18n()
    const menu = t.editor.menu
    const [expandedGroups, setExpandedGroups] = useState<string[]>(['/editor'])
    const [pendingAction, setPendingAction] = useState<{ href: string } | 'logout' | null>(null)

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

    const navItems = useMemo<NavItem[]>(() => {
        const items: NavItem[] = [
            { label: { en: 'Dashboard', ms: 'Papan Pemuka' }, href: '/dashboard', icon: LayoutDashboard },
            {
                label: { en: 'My Website', ms: 'Laman Web Saya' },
                href: '/editor',
                icon: LayoutTemplate,
                children: [
                    { label: { en: 'Editor', ms: 'Editor' }, href: `/editor/${siteId}` },
                    { label: { en: 'Blog', ms: 'Blog' }, href: '/blog' },
                ],
            },
            { label: { en: 'Products', ms: 'Produk' }, href: '/products', icon: Package },
            { label: { en: 'Orders', ms: 'Pesanan' }, href: '/orders', icon: ShoppingCart },
            { label: { en: 'Customers', ms: 'Pelanggan' }, href: '/customers', icon: Users },
            {
                label: { en: 'Settings', ms: 'Tetapan' },
                href: '/settings',
                icon: Settings,
                children: [
                    { label: { en: 'Domains', ms: 'Domain' }, href: '/settings/domains' },
                    { label: { en: 'Payments', ms: 'Pembayaran' }, href: '/settings/payments' },
                    { label: { en: 'Staff', ms: 'Kakitangan' }, href: '/settings/staff', roleFilter: (role) => role === 'owner' },
                    { label: { en: 'Shipping', ms: 'Penghantaran' }, href: '/settings/shipping' },
                    { label: { en: 'Account Profile', ms: 'Profil Akaun' }, href: '/settings/profile' },
                ],
            },
            { label: { en: 'Help Center', ms: 'Pusat Bantuan' }, href: '/help', icon: Headphones },
        ]
        // Filter children by role
        return items.map(item => {
            if (!item.children) return item
            return { ...item, children: item.children.filter(c => !c.roleFilter || c.roleFilter(currentUserRole)) }
        })
    }, [siteId, currentUserRole])

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', {
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

    const guardedNavigate = (href: string) => (e: React.MouseEvent) => {
        e.preventDefault()
        if (hasUnsavedChanges) {
            setPendingAction({ href })
            return
        }
        onClose()
        router.push(href)
    }

    const handleUnsavedConfirm = () => {
        const action = pendingAction
        setPendingAction(null)
        if (action === 'logout') {
            onClose()
            void handleLogout()
        } else if (action) {
            onClose()
            router.push(action.href)
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
                        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                        const isExpanded = expandedGroups.includes(item.href)
                        const label = item.label[locale] || item.label.en

                        if (isGroup) {
                            return (
                                <div key={item.href}>
                                    <button
                                        type="button"
                                        onClick={() => setExpandedGroups(prev =>
                                            prev.includes(item.href) ? prev.filter(g => g !== item.href) : [...prev, item.href]
                                        )}
                                        className="flex h-[44px] w-full items-center gap-3 rounded-[16px] px-4 text-left text-[14px] font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                                    >
                                        {Icon ? <Icon className="h-5 w-5 shrink-0" /> : null}
                                        <span className="flex-1">{label}</span>
                                        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', isExpanded && 'rotate-180')} />
                                    </button>
                                    <div className={cn('overflow-hidden transition-all', isExpanded ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0')}>
                                        <div className="flex flex-col gap-1 pl-4">
                                            {item.children?.map(child => {
                                                const childActive =
                                                    pathname === child.href ||
                                                    pathname?.startsWith(child.href + '/')
                                                const childLabel = child.label[locale] || child.label.en

                                                return (
                                                    <Link
                                                        key={child.href}
                                                        href={child.href}
                                                        onClick={guardedNavigate(child.href)}
                                                        className={cn(
                                                            'flex h-10 items-center gap-3 rounded-[12px] px-4 text-[14px] font-medium transition-colors',
                                                            childActive
                                                                ? 'text-[#3B82F6]'
                                                                : 'text-slate-300 hover:text-white',
                                                        )}
                                                    >
                                                        <span
                                                            className="h-2 w-2 shrink-0 rounded-full"
                                                            style={{ backgroundColor: childActive ? '#3B82F6' : 'var(--editor-text-muted)' }}
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

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={guardedNavigate(item.href)}
                                className={cn(
                                    'flex h-[44px] items-center gap-3 rounded-[16px] px-4 text-[14px] font-medium transition-colors',
                                    isActive
                                        ? 'bg-[rgba(59,130,246,0.1)] text-[#3B82F6] shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                                        : 'text-slate-300 hover:bg-white/5 hover:text-white',
                                )}
                            >
                                {Icon ? <Icon className="h-5 w-5 shrink-0" /> : null}
                                <span className="flex-1">{label}</span>
                                {item.badge ? (
                                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#2DD4BF] px-1.5 text-[12px] font-semibold text-[#0B1120]">
                                        {item.badge}
                                    </span>
                                ) : null}
                            </Link>
                        )
                    })}
                </nav>

                <div className="flex flex-col gap-3 border-t border-white/[0.08] px-3 pt-[17px]" style={{ height: 182 }}>
                    {/* User info + Notification bell */}
                    <div className="flex items-center gap-3">
                        <Link href="/settings/profile" onClick={guardedNavigate('/settings/profile')} className="flex h-[42px] flex-1 items-center gap-3 rounded-[16px] border border-white/[0.08] pl-[17px] pr-px py-px hover:bg-white/5 transition-colors">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-[0_0_0_2px_rgba(59,130,246,0.3)] overflow-hidden bg-[rgba(255,255,255,0.06)]">
                                {userAvatarUrl
                                    ? <img src={userAvatarUrl} alt="avatar" className="w-full h-full object-cover" />
                                    : <span className="text-[12px] font-bold text-white">{userInitial || '?'}</span>
                                }
                            </div>
                            <span className="text-[14px] font-medium text-[#F8FAFC]">{userName || t.editor.menuDrawer.defaultUserName}</span>
                        </Link>
                        <div className="notification-bell-sidebar">
                            <NotificationBell />
                        </div>
                    </div>

                    {/* Language toggle */}
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
                        onClick={() => {
                            if (hasUnsavedChanges) { setPendingAction('logout'); return }
                            void handleLogout()
                        }}
                        className="flex h-[44px] items-center gap-3 rounded-[16px] border border-white/[0.08] pl-4 text-[14px] font-medium text-[#F8FAFC] transition-colors hover:bg-white/5"
                    >
                        <LogOut className="h-4 w-4 shrink-0" />
                        <span>{menu.logout}</span>
                    </button>
                </div>
            </aside>

            <Dialog open={pendingAction !== null} onOpenChange={(open) => { if (!open) setPendingAction(null) }}>
                <DialogContent className="editor-portal max-w-sm dark:border-white/[0.08] border-[rgba(0,0,0,0.1)] dark:bg-[#0F172A] bg-white dark:text-white text-slate-900">
                    <DialogHeader>
                        <DialogTitle className="dark:text-white text-slate-900">{menu.unsavedTitle}</DialogTitle>
                        <DialogDescription className="dark:text-slate-400 text-slate-500">
                            {menu.unsavedConfirm}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <button
                            type="button"
                            onClick={() => setPendingAction(null)}
                            className="flex-1 rounded-[10px] border dark:border-white/[0.08] border-[rgba(0,0,0,0.1)] py-2 text-[13px] font-medium dark:text-slate-300 text-slate-600 dark:hover:bg-white/5 hover:bg-slate-50 transition-colors"
                        >
                            {menu.unsavedStay}
                        </button>
                        <button
                            type="button"
                            onClick={handleUnsavedConfirm}
                            className="flex-1 rounded-[10px] bg-rose-500/20 py-2 text-[13px] font-medium text-rose-400 hover:bg-rose-500/30 transition-colors"
                        >
                            {menu.unsavedLeave}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
