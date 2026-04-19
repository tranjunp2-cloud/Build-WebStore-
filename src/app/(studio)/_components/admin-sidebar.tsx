'use client'

/**
 * AdminSidebar — collapsible navigation sidebar for Studio admin.
 * Width: 232px (expanded) ↔ 64px (collapsed), controlled via pw_sidebar_collapsed.
 * Sections and items from admin-nav-config.ts.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard, BarChart2, FileText, FileEdit, GitPullRequest,
    History, CalendarClock, Archive, Boxes, Package, Zap,
    Activity, Bug, Tag, FolderOpen, Settings, ChevronLeft, ChevronRight,
    Layers,
} from 'lucide-react'
import { NAV_SECTIONS, type NavItem } from './admin-nav-config'
import { useStudioPreferences } from './theme-density-accent-switcher'

// Map href → lucide icon
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
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
    '/studio/issues': Bug,
    '/studio/categories': FolderOpen,
    '/studio/tags': Tag,
    '/studio/settings': Settings,
}

function PhaseGateBadge({ phase }: { phase: number | null }) {
    if (phase === null) {
        return (
            <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ background: 'var(--bg-sunk)', color: 'var(--text-3)' }}>
                Roadmap
            </span>
        )
    }
    if (phase > 1) {
        return (
            <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ background: 'var(--bg-sunk)', color: 'var(--text-3)' }}>
                Ph{phase}
            </span>
        )
    }
    return null
}

function NavItemRow({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
    const pathname = usePathname()
    const isActive = pathname === item.href || (item.href !== '/studio' && pathname.startsWith(item.href))
    const Icon = ICON_MAP[item.href] ?? Layers

    return (
        <Link
            href={item.href}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            className={`studio-nav-item flex items-center gap-3 w-full text-sm no-underline ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
            style={{ color: isActive ? 'var(--accent)' : 'var(--text-2)' }}
        >
            <span className="relative flex-shrink-0">
                <Icon size={18} />
                {item.liveDot && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 border border-white" />
                )}
            </span>

            {!collapsed && (
                <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                        <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{ background: 'var(--bg-sunk)', color: 'var(--text-2)' }}>
                            {item.badge}
                        </span>
                    )}
                    {!item.badge && <PhaseGateBadge phase={item.phase} />}
                </>
            )}
        </Link>
    )
}

export function AdminSidebar() {
    const { sidebarCollapsed, setSidebarCollapsed } = useStudioPreferences()

    return (
        <aside
            className={`studio-sidebar flex flex-col ${sidebarCollapsed ? 'collapsed' : ''}`}
            aria-label="Studio navigation"
        >
            {/* Brand */}
            <div className="flex items-center gap-2 px-4 border-b"
                style={{ height: 'var(--topbar-h)', borderColor: 'var(--border)', flexShrink: 0 }}>
                {!sidebarCollapsed && (
                    <span className="font-semibold text-sm tracking-tight" style={{ color: 'var(--text)' }}>
                        Prime Studio
                    </span>
                )}
                {sidebarCollapsed && (
                    <LayoutDashboard size={20} style={{ color: 'var(--accent)', margin: '0 auto' }} />
                )}
            </div>

            {/* Nav sections */}
            <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Primary navigation">
                {NAV_SECTIONS.map((section) => (
                    <div key={section.title} className="mb-4">
                        {!sidebarCollapsed && (
                            <p className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wider"
                                style={{ color: 'var(--text-3)' }}>
                                {section.title}
                            </p>
                        )}
                        <ul className="flex flex-col gap-0.5" role="list">
                            {section.items.map((item) => (
                                <li key={item.href}>
                                    <NavItemRow item={item} collapsed={sidebarCollapsed} />
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </nav>

            {/* Collapse toggle */}
            <div className="border-t p-2" style={{ borderColor: 'var(--border)' }}>
                <button
                    type="button"
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    className="studio-nav-item flex items-center justify-center w-full"
                    style={{ color: 'var(--text-3)' }}
                >
                    {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    {!sidebarCollapsed && <span className="ml-2 text-xs">Collapse</span>}
                </button>
            </div>
        </aside>
    )
}
