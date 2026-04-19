'use client'

/**
 * AdminTopbar — page title, global search stub, theme/density/accent switchers,
 * and user avatar dropdown menu.
 */
import { usePathname } from 'next/navigation'
import { Search, Sun, Moon, Monitor, LogOut } from 'lucide-react'
import {
    useStudioPreferences,
    type Theme,
    type Density,
    type Accent,
} from './theme-density-accent-switcher'
import { NAV_SECTIONS } from './admin-nav-config'
import type { AdminUser } from '@/lib/admin/auth-guard'

// Derive page title from pathname using nav config
function usePageTitle(pathname: string): string {
    for (const section of NAV_SECTIONS) {
        for (const item of section.items) {
            if (item.href === pathname || (item.href !== '/studio' && pathname.startsWith(item.href))) {
                return item.label
            }
        }
    }
    return 'Studio'
}

const DENSITY_OPTIONS: { value: Density; label: string }[] = [
    { value: 'compact', label: 'Compact' },
    { value: 'default', label: 'Default' },
    { value: 'spacious', label: 'Spacious' },
]

const ACCENT_SWATCHES: { value: Accent; hex: string; label: string }[] = [
    { value: 'blue', hex: '#2563EB', label: 'Blue' },
    { value: 'teal', hex: '#0D9488', label: 'Teal' },
    { value: 'violet', hex: '#7C3AED', label: 'Violet' },
    { value: 'slate', hex: '#475569', label: 'Slate' },
]

export function AdminTopbar({ user }: { user: AdminUser }) {
    const pathname = usePathname()
    const pageTitle = usePageTitle(pathname)
    const { theme, setTheme, density, setDensity, accent, setAccent } = useStudioPreferences()

    function cycleTheme() {
        const next: Theme = theme === 'light' ? 'dark' : 'light'
        setTheme(next)
    }

    return (
        <header
            className="studio-topbar flex items-center gap-3 px-4 flex-shrink-0"
            style={{ borderColor: 'var(--border)' }}
        >
            {/* Page title */}
            <h1 className="text-sm font-semibold flex-1 truncate" style={{ color: 'var(--text)' }}>
                {pageTitle}
            </h1>

            {/* Global search stub — ⌘K non-functional in Phase 01 */}
            <button
                type="button"
                aria-label="Search (⌘K) — coming soon"
                title="Search (⌘K) — coming soon"
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs border cursor-not-allowed"
                style={{
                    background: 'var(--bg-sunk)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-3)',
                }}
                disabled
            >
                <Search size={13} />
                <span>Search…</span>
                <kbd className="ml-2 text-[10px] opacity-60">⌘K</kbd>
            </button>

            {/* Theme toggle */}
            <button
                type="button"
                onClick={cycleTheme}
                aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                className="studio-nav-item flex items-center justify-center w-8 h-8 rounded-md"
                style={{ color: 'var(--text-2)', padding: 0 }}
            >
                {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </button>

            {/* Density switcher */}
            <div className="flex items-center gap-1" role="group" aria-label="Density">
                {DENSITY_OPTIONS.map((opt) => (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDensity(opt.value)}
                        aria-pressed={density === opt.value}
                        aria-label={`${opt.label} density`}
                        className="text-[10px] px-2 py-0.5 rounded border transition-colors"
                        style={{
                            borderColor: density === opt.value ? 'var(--accent)' : 'var(--border)',
                            color: density === opt.value ? 'var(--accent)' : 'var(--text-3)',
                            background: density === opt.value
                                ? 'color-mix(in srgb, var(--accent) 10%, transparent)'
                                : 'transparent',
                        }}
                    >
                        {opt.label[0]}
                    </button>
                ))}
            </div>

            {/* Accent picker */}
            <div className="flex items-center gap-1.5" role="group" aria-label="Accent color">
                {ACCENT_SWATCHES.map((swatch) => (
                    <button
                        key={swatch.value}
                        type="button"
                        onClick={() => setAccent(swatch.value)}
                        aria-pressed={accent === swatch.value}
                        aria-label={`${swatch.label} accent`}
                        className="w-4 h-4 rounded-full border-2 transition-transform hover:scale-110"
                        style={{
                            backgroundColor: swatch.hex,
                            borderColor: accent === swatch.value ? 'var(--text)' : 'transparent',
                        }}
                    />
                ))}
            </div>

            {/* User avatar menu */}
            <div className="relative group">
                <button
                    type="button"
                    aria-label={`User menu — ${user.email}`}
                    className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold text-white focus-visible:outline-none"
                    style={{ background: 'var(--accent)' }}
                >
                    {user.name.charAt(0).toUpperCase()}
                </button>

                {/* Dropdown — CSS-only hover (no Radix needed for Phase 01 shell) */}
                <div
                    className="absolute right-0 top-full mt-1 w-48 rounded-lg border shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50"
                    style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)' }}
                    role="menu"
                >
                    <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                        <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{user.name}</p>
                        <p className="text-[11px] truncate" style={{ color: 'var(--text-3)' }}>{user.email}</p>
                    </div>
                    <div className="p-1">
                        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Payload CMS route, not a Next.js page */}
                        <a
                            href="/admin/logout"
                            role="menuitem"
                            className="flex items-center gap-2 px-3 py-2 rounded-md text-xs hover:bg-[var(--bg-sunk)] transition-colors no-underline"
                            style={{ color: 'var(--danger)' }}
                        >
                            <LogOut size={13} />
                            Sign out
                        </a>
                    </div>
                </div>
            </div>
        </header>
    )
}
