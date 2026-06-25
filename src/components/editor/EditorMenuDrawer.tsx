'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { LogOut, Moon, Sun, X } from 'lucide-react'
import { NotificationBell } from '@/components/dashboard/NotificationBell'
import { LanguageToggle } from '@/components/shared/LanguageToggle'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { useTheme } from '@/providers/theme-provider'
import {
    NAV_SECTIONS,
    filterNavSections,
    type NavLeaf,
    type SidebarBadgeKey,
} from '@/config/sidebar-nav'
import { isPathActive } from '@/lib/sidebar/is-path-active'
import { formatBadgeCount } from '@/lib/sidebar/format-badge-count'

type EditorMenuDrawerProps = {
    siteId: string
    open: boolean
    onClose: () => void
    currentUserRole?: string
    userName?: string
    userInitial?: string
    userAvatarUrl?: string | null
    /** RBAC inputs — same gate as the dashboard sidebar. Restrictive defaults never widen visibility. */
    permissions?: string[]
    isSuperAdmin?: boolean
    isProduction?: boolean
    badgeCounts?: Partial<Record<SidebarBadgeKey, number>>
    hasUnsavedChanges?: boolean
}

export function EditorMenuDrawer({
    siteId,
    open,
    onClose,
    // Fail CLOSED while userData loads (props undefined): '' is NOT in hasFullAccess, so with the
    // default empty permissions the drawer shows only no-gate items until the real role arrives —
    // never flashes restricted nav (CRM etc.) to a limited user. Dashboard resolves role server-side
    // so it has no such window; this keeps the two sidebars' visibility consistent.
    currentUserRole = '',
    userName,
    userInitial,
    userAvatarUrl,
    permissions = [],
    isSuperAdmin = false,
    isProduction = false,
    badgeCounts,
    hasUnsavedChanges,
}: EditorMenuDrawerProps) {
    const pathname = usePathname()
    const router = useRouter()
    const { t, locale, toggleLocale } = useI18n()
    const { theme, toggle: toggleTheme } = useTheme()
    const isDark = theme === 'dark'
    const menu = t.editor.menu
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

    // Same flat sections + 5-tier RBAC gate as the dashboard sidebar (shared config — no drift).
    const visibleSections = useMemo(
        () => filterNavSections(NAV_SECTIONS, { currentUserRole, permissions, isSuperAdmin, isProduction }),
        [currentUserRole, permissions, isSuperAdmin, isProduction],
    )

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
        } catch (error) {
            console.error('Logout request failed:', error)
        } finally {
            document.cookie = 'payload-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'
            window.location.href = '/login'
        }
    }

    // Editor-only unsaved-changes guard — intercept EVERY nav click + logout while the page is dirty.
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

    // Flat leaf renderer — mirrors dashboard renderLeaf (cyan active + glow, neutral count badge).
    // The single editor-only special-case: the Editor leaf deep-links to the current site.
    const renderLeaf = (leaf: NavLeaf) => {
        const Icon = leaf.icon
        const href = leaf.href === '/editor' ? `/editor/${siteId}` : leaf.href
        const label = locale === 'ms' ? leaf.label.ms : leaf.label.en
        const isActive = isPathActive(pathname, href)
        const count = leaf.badgeKey ? badgeCounts?.[leaf.badgeKey] : undefined
        const hasCount = count != null && count > 0

        return (
            <Link
                key={href}
                href={href}
                onClick={guardedNavigate(href)}
                className={cn(
                    // Identical sizing to the dashboard sidebar renderLeaf (1:1 parity)
                    'no-underline flex items-center gap-3 px-4 rounded-[12px] h-[32px] 2xl:h-[34px] text-[13px] font-medium leading-[1.43] transition-colors',
                    isActive
                        ? 'bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))] shadow-[0_0_16px_hsl(var(--primary)/0.25)]'
                        : 'text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text',
                )}
                aria-current={isActive ? 'page' : undefined}
            >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="flex-1">{label}</span>
                {hasCount && (
                    <span className={cn(
                        'flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none',
                        isActive
                            ? 'bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]'
                            : 'bg-dash-surface-hover text-dash-text-muted'
                    )}>
                        {formatBadgeCount(count)}
                    </span>
                )}
            </Link>
        )
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />

            <aside className="absolute left-0 top-0 flex h-full w-[250px] flex-col border-r border-dash-border bg-[var(--dash-sidebar-bg)] shadow-2xl">
                <div className="flex h-[65px] items-center justify-between border-b border-dash-border px-4">
                    {/* Logo — matches the dashboard header (TopHeader): real logo image + Prime/Web split */}
                    <div className="flex items-center gap-2">
                        <Image
                            src="/images/logo-icon-3c4d76.png"
                            alt="PrimeWeb Logo"
                            width={28}
                            height={28}
                            className="object-contain drop-shadow-[0px_0px_12px_hsl(var(--primary)/0.6)]"
                        />
                        <div className="flex items-center text-[16px] font-bold leading-none tracking-tight">
                            <span className="text-dash-text">Prime</span>
                            <span className="text-[hsl(var(--primary))]">Web</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-dash-text-muted transition-colors hover:bg-dash-surface-hover hover:text-dash-text"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Flat nav — static uppercase section headers, no accordion (parity with dashboard) */}
                <nav className="sidebar-scroll flex-1 flex flex-col gap-1 overflow-y-auto px-3 pt-6" aria-label="Editor menu">
                    {visibleSections.map((section, idx) => (
                        <div key={section.header?.en ?? `section-${idx}`} className="flex flex-col gap-1">
                            {section.header && (
                                <div className="px-4 pt-1.5 2xl:pt-2 pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-dash-text-muted opacity-50 select-none">
                                    {locale === 'ms' ? section.header.ms : section.header.en}
                                </div>
                            )}
                            {section.items.map((leaf) => renderLeaf(leaf))}
                        </div>
                    ))}
                </nav>

                <div className="flex flex-col gap-3 border-t border-dash-border px-3 pt-[17px]" style={{ height: 182 }}>
                    {/* User info + theme toggle + notification bell */}
                    <div className="flex items-center gap-3">
                        <Link
                            href="/settings/profile"
                            onClick={guardedNavigate('/settings/profile')}
                            className="flex h-[42px] min-w-0 flex-1 items-center gap-3 rounded-[16px] border border-dash-border pl-4 pr-px py-px transition-colors hover:bg-dash-surface-hover"
                        >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-dash-surface-hover shadow-[0_0_0_2px_hsl(var(--primary)/0.3)]">
                                {userAvatarUrl
                                    ? <Image src={userAvatarUrl} alt="avatar" width={32} height={32} className="h-full w-full object-cover" />
                                    : <span className="text-[12px] font-bold text-dash-text">{userInitial || '?'}</span>
                                }
                            </div>
                            {/* min-w-0 lets the span shrink inside flex so truncate takes effect */}
                            <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-dash-text">
                                            {userName || t.editor.menuDrawer.defaultUserName}
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="editor-portal">
                                        {userName || t.editor.menuDrawer.defaultUserName}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </Link>
                        {/* Light/dark theme toggle — amber icon forced inline (bypasses light-mode remap) */}
                        <button
                            type="button"
                            onClick={toggleTheme}
                            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[16px] border border-dash-border text-dash-text-muted transition-colors hover:bg-dash-surface-hover hover:text-dash-text"
                        >
                            {isDark
                                ? <Sun className="h-5 w-5" style={{ color: 'hsl(var(--warning))' }} />
                                : <Moon className="h-5 w-5" style={{ color: 'hsl(var(--warning))' }} />}
                        </button>
                        <div className="notification-bell-sidebar">
                            <NotificationBell />
                        </div>
                    </div>

                    <LanguageToggle locale={locale} toggleLocale={toggleLocale} />

                    <button
                        type="button"
                        onClick={() => {
                            if (hasUnsavedChanges) { setPendingAction('logout'); return }
                            void handleLogout()
                        }}
                        className="flex h-[42px] items-center gap-3 rounded-[16px] border border-dash-border pl-4 text-[14px] font-medium text-dash-text transition-colors hover:bg-dash-surface-hover"
                    >
                        <LogOut className="h-4 w-4 shrink-0" />
                        <span>{menu.logout}</span>
                    </button>
                </div>
            </aside>

            <Dialog open={pendingAction !== null} onOpenChange={(open) => { if (!open) setPendingAction(null) }}>
                <DialogContent className="editor-portal max-w-sm border-[var(--editor-border)] bg-[var(--editor-surface)] text-[var(--editor-text)]">
                    <DialogHeader>
                        <DialogTitle className="text-[var(--editor-text)]">{menu.unsavedTitle}</DialogTitle>
                        <DialogDescription className="text-[var(--editor-text-muted)]">
                            {menu.unsavedConfirm}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <button
                            type="button"
                            onClick={() => setPendingAction(null)}
                            className="flex-1 rounded-[10px] border border-[var(--editor-border)] py-2 text-[13px] font-medium text-[var(--editor-text-muted)] hover:bg-white/5 transition-colors"
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
