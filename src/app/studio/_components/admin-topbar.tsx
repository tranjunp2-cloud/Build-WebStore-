'use client'

/**
 * AdminTopbar — matches design bundle shell.jsx:75-100 exactly.
 *
 * Structure (left → right):
 *   crumbs: "Admin / <Section>"
 *   topbar-search: icon + VN placeholder + ⌘K kbd (non-functional)
 *   icon-btn: Tweaks (sliders icon) → opens tweaks popover
 *   icon-btn: theme toggle (sun/moon)
 *   icon-btn: bell with red dot (stub, no real notifications)
 *   avatar: user initials → CSS hover dropdown (sign out)
 *
 * Intentional deviations from bundle:
 *   - Bundle has a separate onOpenTweaks prop; we manage tweaks state locally
 *     via useState (no Radix) since bundle also uses plain CSS .tweaks-panel.open.
 *   - Theme toggle is a separate icon-btn rather than merged into tweaks,
 *     matching bundle line 94 exactly.
 *   - Tweaks panel combines theme + density + accent in one popover per bundle
 *     styles.css .tweaks-panel spec.
 *   - User dropdown kept from original for sign-out functionality.
 */
import { usePathname } from 'next/navigation'
import { Search, SlidersHorizontal, Sun, Moon, Bell, LogOut } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { CreateIssueModal } from './modals/create-issue-modal'
import { useStudioPreferences, type Theme, type Density, type Accent } from './theme-density-accent-switcher'
import { NAV_SECTIONS } from './admin-nav-config'
import type { AdminUser } from '@/lib/admin/auth-guard'

// ── Breadcrumb derivation ─────────────────────────────────────────────────────
function useCrumbs(pathname: string): string[] {
    for (const section of NAV_SECTIONS) {
        for (const item of section.items) {
            if (item.href === pathname) return [item.label]
            if (item.href !== '/studio' && pathname.startsWith(item.href)) {
                return [item.label]
            }
        }
    }
    return []
}

// ── Accent swatch config ──────────────────────────────────────────────────────
const ACCENTS: { value: Accent; hex: string; label: string }[] = [
    { value: 'blue',   hex: '#2563EB', label: 'Blue' },
    { value: 'teal',   hex: '#0D9488', label: 'Teal' },
    { value: 'violet', hex: '#7C3AED', label: 'Violet' },
    { value: 'slate',  hex: '#475569', label: 'Slate' },
]

// ── Density options ───────────────────────────────────────────────────────────
const DENSITIES: { value: Density; label: string }[] = [
    { value: 'compact',  label: 'Compact' },
    { value: 'default',  label: 'Default' },
    { value: 'spacious', label: 'Spacious' },
]

// ── Tweaks panel ──────────────────────────────────────────────────────────────
function TweaksPanel({
    open,
    onClose,
    theme,
    setTheme,
    density,
    setDensity,
    accent,
    setAccent,
}: {
    open: boolean
    onClose: () => void
    theme: Theme
    setTheme: (t: Theme) => void
    density: Density
    setDensity: (d: Density) => void
    accent: Accent
    setAccent: (a: Accent) => void
}) {
    const ref = useRef<HTMLDivElement>(null)

    // Close on outside click
    useEffect(() => {
        if (!open) return
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose()
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open, onClose])

    if (!open) return null

    return (
        <div className="tweaks-panel open" ref={ref} role="dialog" aria-label="Tweaks panel">
            <div className="tweaks-head">
                <SlidersHorizontal size={13} aria-hidden />
                Tweaks
            </div>
            <div className="tweaks-body">
                {/* Theme */}
                <div className="tweak">
                    <div className="tweak-label">Theme</div>
                    <div className="seg" style={{ width: '100%' }}>
                        {(['light', 'dark'] as Theme[]).map((t) => (
                            <button
                                key={t}
                                type="button"
                                className={theme === t ? 'active' : ''}
                                onClick={() => setTheme(t)}
                                style={{ flex: 1, justifyContent: 'center' }}
                            >
                                {t === 'light' ? <Sun size={11} aria-hidden /> : <Moon size={11} aria-hidden />}
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Density */}
                <div className="tweak">
                    <div className="tweak-label">Density</div>
                    <div className="seg" style={{ width: '100%' }}>
                        {DENSITIES.map((d) => (
                            <button
                                key={d.value}
                                type="button"
                                className={density === d.value ? 'active' : ''}
                                onClick={() => setDensity(d.value)}
                                style={{ flex: 1, justifyContent: 'center' }}
                            >
                                {d.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Accent */}
                <div className="tweak">
                    <div className="tweak-label">Accent</div>
                    <div className="tweak-row">
                        {ACCENTS.map((a) => (
                            <button
                                key={a.value}
                                type="button"
                                className={`accent-swatch${accent === a.value ? ' active' : ''}`}
                                onClick={() => setAccent(a.value)}
                                aria-label={a.label}
                                aria-pressed={accent === a.value}
                                style={{ backgroundColor: a.hex }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── AdminTopbar ───────────────────────────────────────────────────────────────
export function AdminTopbar({ user }: { user: AdminUser }) {
    const pathname = usePathname()
    const crumbs = useCrumbs(pathname)
    const { theme, setTheme, density, setDensity, accent, setAccent } = useStudioPreferences()
    const [tweaksOpen, setTweaksOpen] = useState(false)
    const [showReportIssue, setShowReportIssue] = useState(false)

    // Derive initials for avatar (max 2 chars)
    const initials = user.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()

    return (
        <>
            <header className="studio-topbar" style={{ borderColor: 'var(--border)' }}>
                {/* Breadcrumbs — "Admin / Section" */}
                <div className="crumbs">
                    <span>Admin</span>
                    {crumbs.map((c, i) => (
                        <span key={i} style={{ display: 'contents' }}>
                            <span className="sep">/</span>
                            <span className={i === crumbs.length - 1 ? 'current' : ''}>{c}</span>
                        </span>
                    ))}
                </div>

                {/* Search stub — VN copy + ⌘K */}
                <div className="topbar-search" role="search" aria-label="Search (non-functional)">
                    <Search size={13} aria-hidden />
                    <span style={{ flex: 1 }}>Tìm template, category, tag…</span>
                    <kbd>⌘K</kbd>
                </div>

                {/* Tweaks icon-btn */}
                <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setTweaksOpen((v) => !v)}
                    aria-label="Tweaks"
                    aria-expanded={tweaksOpen}
                >
                    <SlidersHorizontal size={15} />
                </button>

                {/* Theme toggle icon-btn */}
                <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                >
                    {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                </button>

                {/* Bell icon-btn with red dot (stub — no real notifications) */}
                <button
                    type="button"
                    className="icon-btn"
                    aria-label="Notifications (coming soon)"
                    title="Notifications — coming soon"
                    onClick={() => setShowReportIssue(true)}
                >
                    <Bell size={15} />
                    <span className="dot" aria-hidden />
                </button>

                {/* User avatar + sign-out dropdown — CSS :hover via .avatar-menu class */}
                <div className="avatar-menu">
                    <button
                        type="button"
                        aria-label={`User menu — ${user.email}`}
                        className="avatar"
                        style={{ background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}
                    >
                        {initials}
                    </button>
                    <div className="avatar-dropdown" role="menu">
                        <div className="avatar-dropdown-info">
                            <p className="dn">{user.name}</p>
                            <p className="de">{user.email}</p>
                        </div>
                        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                        <a href="/admin/logout" role="menuitem">
                            <LogOut size={13} />
                            Sign out
                        </a>
                    </div>
                </div>
            </header>

            {/* Tweaks panel — fixed bottom-right, outside header flow */}
            <TweaksPanel
                open={tweaksOpen}
                onClose={() => setTweaksOpen(false)}
                theme={theme}
                setTheme={setTheme}
                density={density}
                setDensity={setDensity}
                accent={accent}
                setAccent={setAccent}
            />

            {/* Report issue modal */}
            {showReportIssue && (
                <CreateIssueModal
                    onClose={() => setShowReportIssue(false)}
                    onCreated={() => setShowReportIssue(false)}
                />
            )}
        </>
    )
}
