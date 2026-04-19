'use client'

/**
 * AdminShell — client-side wrapper combining Sidebar + Topbar + Toaster.
 * Receives server-fetched user + counts from the layout server component.
 *
 * .studio-shell applies CSS grid: sidebar-w | 1fr, with sidebar-collapsed variant.
 * The sidebar-collapsed class is driven by sidebarCollapsed state from useStudioPreferences.
 */
import { Toaster } from 'sonner'
import { AdminSidebar } from './admin-sidebar'
import { AdminTopbar } from './admin-topbar'
import { useStudioPreferences } from './theme-density-accent-switcher'
import type { AdminUser } from '@/lib/admin/auth-guard'
import type { SidebarCounts } from './sidebar-counts'

export function AdminShell({
    user,
    counts,
    children,
}: {
    user: AdminUser
    counts: SidebarCounts
    children: React.ReactNode
}) {
    const { sidebarCollapsed } = useStudioPreferences()

    return (
        <div className={`studio-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
            <AdminSidebar user={user} counts={counts} />

            <div className="studio-main-col">
                <AdminTopbar user={user} />

                <main
                    className="flex-1 overflow-auto"
                    style={{ padding: 'var(--pad)' }}
                    id="studio-main"
                    tabIndex={-1}
                >
                    {children}
                </main>
            </div>

            {/* Toast system — 2.5s auto-dismiss, supports Undo action */}
            <Toaster
                position="bottom-right"
                duration={2500}
                toastOptions={{
                    classNames: {
                        toast: 'rounded-lg border text-sm',
                        actionButton: 'text-xs font-medium',
                    },
                }}
            />
        </div>
    )
}
