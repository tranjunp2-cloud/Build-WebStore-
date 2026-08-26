'use client'

/**
 * AdminSidebar — matches design bundle shell.jsx:37-72 exactly.
 *
 * Structure:
 *   sidebar-head: logo-mark "WS" + "Web Store · Admin" + collapse chevron (top-right)
 *   scroll body: nav-section-title (uppercase) + nav-item rows (icon + label + count/liveDot)
 *   sidebar-foot: avatar (initials) + name + role
 *
 * Intentional deviations from bundle:
 *   - Bundle uses plain <svg> chevron; we use lucide ChevronRight for consistency.
 *   - Bundle hardcodes "DN"/"Duy Nguyen"; we derive initials from the passed user prop.
 *   - Count values come from real DB via SidebarCounts prop (not hardcoded).
 *   - liveDot renders as .live-dot.on span (matches bundle CSS exactly).
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard, BarChart2, FileText, FileEdit, GitPullRequest,
    History, CalendarClock, Archive, Boxes, Package, Zap,
    Activity, Bug, Tag, FolderOpen, Settings, Layers, ShieldCheck, Sparkles, Database,
} from 'lucide-react'
import { useStudioPreferences } from './theme-density-accent-switcher'
import type { SidebarCounts } from './sidebar-counts'
import type { AdminUser } from '@/lib/admin/auth-guard'

// ── Icon map ──────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
    '/studio': LayoutDashboard,
    '/studio/analytics': BarChart2,
    '/studio/templates': FileText,
    '/studio/drafts': FileEdit,
    '/studio/review': GitPullRequest,
    '/studio/versions': History,
    '/studio/scheduled': CalendarClock,
    '/studio/archived': Archive,
    '/studio/blocks': Boxes,
    '/studio/packs': Package,
    '/studio/performance': Zap,
    '/studio/generations': Activity,
    '/studio/migration': Layers,
    '/studio/qa': ShieldCheck,
    '/studio/issues': Bug,
    '/studio/categories': FolderOpen,
    '/studio/tags': Tag,
    '/studio/settings': Settings,
}

// ── Nav structure — mirrors shell.jsx nav array exactly ───────────────────────
type NavEntry = {
    href: string
    label: string
    count?: (c: SidebarCounts) => number | null
    liveDot?: boolean
    /** Show "Soon" pill — used for Phase 2 placeholder routes */
    soon?: true
}

type NavSection = {
    section: string
    items: NavEntry[]
}

const NAV: NavSection[] = [
    {
        section: 'Workspace',
        items: [
            { href: '/studio', label: 'Dashboard' },
            { href: '/studio/analytics', label: 'Analytics', soon: true },
        ],
    },
    {
        section: 'Templates',
        items: [
            { href: '/studio/templates', label: 'All templates', count: (c) => c.templates },
            { href: '/studio/drafts', label: 'Drafts', count: (c) => c.drafts },
            { href: '/studio/review', label: 'Review workflow', count: (c) => c.review },
            { href: '/studio/versions', label: 'Versions' },
            { href: '/studio/scheduled', label: 'Scheduled', count: (c) => c.scheduled },
            { href: '/studio/archived', label: 'Archived' },
        ],
    },
    {
        section: 'Migration',
        items: [
            { href: '/studio/migration', label: 'Website Migration' },
        ],
    },
    {
        section: 'Intelligence',
        items: [
            { href: '/studio/blocks', label: 'Block usage' },
            { href: '/studio/packs', label: 'Content packs' },
            { href: '/studio/performance', label: 'AI quality' },
        ],
    },
    {
        section: 'Monitoring',
        items: [
            { href: '/studio/generations', label: 'User generations', liveDot: true },
            { href: '/studio/qa', label: 'QA Control Center' },
            { href: '/studio/issues', label: 'Issues & feedback', count: (c) => c.issues },
        ],
    },
    {
        section: 'Organize',
        items: [
            { href: '/studio/categories', label: 'Categories' },
            { href: '/studio/tags', label: 'Tags & AI prompts', soon: true },
        ],
    },
    {
        section: 'Admin',
        items: [
            { href: '/studio/settings', label: 'Settings', soon: true },
        ],
    },
]

// ── Nav item row ───────────────────────────────────────────────────────────────
function NavItemRow({
    item,
    collapsed,
    counts,
}: {
    item: NavEntry
    collapsed: boolean
    counts: SidebarCounts
}) {
    const pathname = usePathname()
    const isActive = pathname === item.href ||
        (item.href !== '/studio' && pathname.startsWith(item.href))
    const Icon = ICON_MAP[item.href] ?? Layers
    const countVal = item.count ? item.count(counts) : null
    const showCount = countVal !== null && countVal > 0

    return (
        <Link
            href={item.href}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            className={`nav-item${isActive ? ' active' : ''}`}
        >
            {/* Icon */}
            <span className="nav-icon">
                <Icon size={16} />
            </span>

            {/* Label + badge — hidden when collapsed */}
            {!collapsed && (
                <>
                    <span className="nav-label">{item.label}</span>
                    {item.liveDot && (
                        <span className="live-dot on" style={{ marginLeft: 'auto' }} aria-label="Live" />
                    )}
                    {!item.liveDot && showCount && (
                        <span className="count">{countVal}</span>
                    )}
                    {item.soon && !item.liveDot && !showCount && (
                        <span
                            style={{
                                marginLeft: 'auto',
                                fontSize: 10,
                                fontWeight: 600,
                                padding: '1px 6px',
                                borderRadius: 999,
                                background: 'var(--bg-sunk)',
                                color: 'var(--text-3)',
                                letterSpacing: '0.02em',
                                lineHeight: '16px',
                            }}
                            aria-label="Coming soon"
                        >
                            Soon
                        </span>
                    )}
                </>
            )}
        </Link>
    )
}

// ── Collapse chevron SVG (matches bundle exactly) ─────────────────────────────
function CollapseChevron({ collapsed }: { collapsed: boolean }) {
    return (
        <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ transform: collapsed ? 'none' : 'rotate(180deg)', transition: 'transform 200ms ease' }}
            aria-hidden
        >
            <path d="m9 18 6-6-6-6" />
        </svg>
    )
}

// ── AdminSidebar ───────────────────────────────────────────────────────────────
export function AdminSidebar({
    user,
    counts,
}: {
    user: AdminUser
    counts: SidebarCounts
}) {
    const { sidebarCollapsed, setSidebarCollapsed } = useStudioPreferences()

    // Derive initials (max 2 chars) from name
    const initials = user.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()

    // Role label — always "Admin · staging" in prod; derived from user.roles for accuracy
    const envLabel = process.env.NODE_ENV === 'production' ? 'production' : 'staging'
    const roleLabel = `Admin · ${envLabel}`

    return (
        <aside
            className="studio-sidebar"
            aria-label="Studio navigation"
        >
            {/* ── Head: logo-mark + label + collapse chevron ─── */}
            <div className="sidebar-head">
                <div className="logo-mark" aria-hidden>WS</div>
                <span className="sidebar-label">Web Store · Admin</span>
                <button
                    type="button"
                    className="icon-btn"
                    style={{ marginLeft: 'auto', width: 24, height: 24 }}
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    <CollapseChevron collapsed={sidebarCollapsed} />
                </button>
            </div>

            {/* ── Scroll body: nav sections ─── */}
            <div style={{ flex: 1, overflow: 'auto' }} className="scroll-thin">
                {NAV.map((sec) => (
                    <div key={sec.section} className="nav-section">
                        <div className="nav-section-title">{sec.section}</div>
                        {sec.items.map((item) => (
                            <NavItemRow
                                key={item.href}
                                item={item}
                                collapsed={sidebarCollapsed}
                                counts={counts}
                            />
                        ))}
                    </div>
                ))}
            </div>

            {/* ── Foot: avatar + name + role ─── */}
            <div className="sidebar-foot">
                <div className="avatar" title={user.email} aria-label={`User: ${user.name}`}>
                    {initials}
                </div>
                <div className="who">
                    <div className="who-name">{user.name}</div>
                    <div className="role">{roleLabel}</div>
                </div>
            </div>
        </aside>
    )
}
