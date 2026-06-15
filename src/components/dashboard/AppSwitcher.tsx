'use client'

/**
 * AppSwitcher (⊞) — 9-dot ecosystem launcher in the top header (F18 #1138 phase-03).
 *
 * Sits LEFT of the logo (after ☰ on mobile — design §3.3/§3.7). Items come from the
 * static config in src/config/app-switcher.ts (UI-only, direct links — no SSO backend yet).
 * Dropdown closes on click-outside and ESC, mirroring the UserAvatarMenu pattern.
 */

import { useState, useRef, useEffect } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { APP_SWITCHER_APPS, SSO_PORTAL_URL } from '@/config/app-switcher'

/** 9-dot waffle launcher icon (design §3.7 — "lưới 9 chấm"). */
function WaffleIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
            {[5, 12, 19].map((cy) =>
                [5, 12, 19].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2} />),
            )}
        </svg>
    )
}

export function AppSwitcher() {
    const { t } = useI18n()
    const [open, setOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    // Current app (Web Store) is not shown — only other ecosystem apps are switchable.
    const otherApps = APP_SWITCHER_APPS.filter((app) => !app.current)

    // Close on click outside (same pattern as UserAvatarMenu)
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Close on Escape
    useEffect(() => {
        if (!open) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [open])

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setOpen(!open)}
                aria-label={t.cms.appSwitcher.switchApp}
                aria-haspopup="menu"
                aria-expanded={open}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-transparent border-none outline-none hover:bg-dash-surface-hover cursor-pointer transition-colors"
            >
                <WaffleIcon className="h-5 w-5 text-dash-text-muted" />
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute left-0 top-[48px] z-50 w-[220px] rounded-[16px] border border-dash-border bg-dash-surface py-2 shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150"
                >
                    {/* Switchable apps — direct links (SSO URL). The current app (Web Store) is
                        NOT listed; only other ecosystem apps appear here once configured. */}
                    {otherApps.map((app) => (
                        <a
                            key={app.id}
                            role="menuitem"
                            href={app.url}
                            className={cn(
                                'no-underline flex items-center gap-3 px-4 h-[40px] text-[14px] font-medium',
                                'text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors',
                            )}
                        >
                            <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ background: app.colorDot ?? 'var(--dash-text-muted)' }}
                            />
                            <span className="flex-1">{app.name}</span>
                        </a>
                    ))}

                    {/* Footer — secure SSO redirect link (design §3.7). Goes straight to the
                        SSO portal, not a /settings route. Top divider only when apps listed above. */}
                    <div className={cn('mx-2', otherApps.length > 0 && 'mt-1 border-t border-dash-border pt-1')}>
                        <a
                            role="menuitem"
                            href={SSO_PORTAL_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setOpen(false)}
                            className="no-underline flex items-center justify-between gap-2 px-2 h-[36px] text-[12px] font-normal text-dash-text-muted hover:text-dash-text transition-colors"
                        >
                            <span>{t.cms.appSwitcher.ssoRedirect}</span>
                            <ArrowUpRight className="h-4 w-4 shrink-0" />
                        </a>
                    </div>
                </div>
            )}
        </div>
    )
}
