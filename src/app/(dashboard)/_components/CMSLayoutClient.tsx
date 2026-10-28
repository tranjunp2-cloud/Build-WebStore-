'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { DashboardSidebar, type SidebarBadgeKey } from '@/components/dashboard/Sidebar'
import { TopHeader } from '@/components/dashboard/TopHeader'
import { Toaster } from '@/components/ui/sonner'
import { TenantAccessWatcher } from '@/components/dashboard/TenantAccessWatcher'
import { UserAvatarProvider } from '@/providers/UserAvatarContext'
import { DashboardEmptyState } from '@/components/dashboard/DashboardEmptyState'
import { AgentRefresh } from '@/lib/agent-changes/agent-refresh'
import { shouldShowNoWebsiteGuard } from './dashboard-guard-paths'
import { BADGE_ENTITY_KINDS, countsMayChange } from './sidebar-badge-refresh'

type CMSLayoutClientProps = {
    userName: string
    userInitial: string
    userEmail: string
    userAvatarUrl?: string | null
    currentUserRole?: string
    userPermissions?: string[]
    isSuperAdmin?: boolean
    /** Resolved server-side in layout.tsx (VERCEL_ENV) — gates dev-only nav items. */
    isProduction?: boolean
    /** Dynamic sidebar badge counts (F18 #1138), tenant-scoped, computed in layout.tsx. */
    badgeCounts?: Partial<Record<SidebarBadgeKey, number>>
    /** Whether current tenant has a usable website (GH-1392). Default true → fail-open. */
    hasWebsite?: boolean
    /** Current tenant name, resolved server-side; shown in the header feedback report. */
    storeName?: string
    children: React.ReactNode
}

export function CMSLayoutClient({ userName, userInitial, userEmail, userAvatarUrl = null, currentUserRole = 'viewer', userPermissions = [], isSuperAdmin = false, isProduction = false, badgeCounts, hasWebsite = true, storeName, children }: CMSLayoutClientProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    // Collapse state lifted here so TopHeader (« button), Sidebar (mini mode) and <main>
    // (padding) react together. Init false on SSR; localStorage is read post-mount and
    // `hydrated` gates the width/padding transition so a persisted collapsed state
    // doesn't flash an open→closed animation on first paint.
    const [collapsed, setCollapsed] = useState(false)
    const [hydrated, setHydrated] = useState(false)
    const pathname = usePathname()
    // GH-1392: when the tenant has no usable website, replace guarded page content
    // with the no-website empty state (sidebar/header stay so the user can still
    // navigate to excluded pages and the create-site CTA).
    const showNoWebsiteGuard = shouldShowNoWebsiteGuard(pathname, hasWebsite)

    useEffect(() => {
        try {
            setCollapsed(localStorage.getItem('sidebar_collapsed') === 'true')
        } catch { }
        // One frame later than the persisted-state render — if both landed in the same
        // batch the transition class would animate the initial open→collapsed jump.
        const raf = requestAnimationFrame(() => setHydrated(true))
        return () => cancelAnimationFrame(raf)
    }, [])

    const toggleCollapsed = useCallback(() => {
        setCollapsed((prev) => {
            const next = !prev
            try { localStorage.setItem('sidebar_collapsed', String(next)) } catch { }
            return next
        })
    }, [])

    // Lắng nghe sự thay đổi của URL và reset scroll bar về đỉnh trang (QA Bug TC-F18.13)
    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
        // Tương tự, để chắc chắn thêm với documentElement
        document.documentElement.scrollTop = 0
    }, [pathname])

    return (
        <UserAvatarProvider initialUrl={userAvatarUrl}>
            {/* .dash-shell-root scopes --dash-content-pl (globals.css) — left edge of the CONTENT
                column (sidebar width + p-8 gutter) so fixed bottom save-bars align with the cards
                at lg+ (GH-1592). Value lives in CSS (responsive 246/250/64px + 2rem), not inline,
                because an inline style can't vary per breakpoint. Scoped to this root marker (not
                bare .dash-shell): modals/popovers self-apply dash-shell for theming and would
                re-declare the var without the .dash-sidebar-mini gate. */}
            <div
                className={cn('dash-shell dash-shell-root min-h-screen bg-dash-bg flex flex-col', collapsed && 'dash-sidebar-mini')}
            >
                <TenantAccessWatcher />
                {/* The layout computes the badge counts on the server: render it again when the assistant changes one. */}
                <AgentRefresh kinds={BADGE_ENTITY_KINDS} when={countsMayChange} />
                <TopHeader
                    userName={userName}
                    userInitial={userInitial}
                    userEmail={userEmail}
                    sidebarOpen={sidebarOpen}
                    setSidebarOpen={setSidebarOpen}
                    collapsed={collapsed}
                    onToggleCollapsed={toggleCollapsed}
                    animateCollapse={hydrated}
                    storeName={storeName}
                />
                <div className="flex flex-1 pt-[56px]">
                    <DashboardSidebar
                        userName={userName}
                        userInitial={userInitial}
                        currentUserRole={currentUserRole}
                        permissions={userPermissions}
                        isSuperAdmin={isSuperAdmin}
                        isProduction={isProduction}
                        mobileOpen={sidebarOpen}
                        setMobileOpen={setSidebarOpen}
                        collapsed={collapsed}
                        onToggleCollapsed={toggleCollapsed}
                        animateCollapse={hydrated}
                        badgeCounts={badgeCounts}
                    />
                    <main
                        className={cn(
                            'flex-1 min-w-0 [overflow-x:clip]',
                            hydrated && 'transition-[padding] duration-200',
                            // Fixed push-sidebar only from lg (desktop / iPad landscape). Tablet
                            // portrait + mobile use the overlay drawer → content stays full-width.
                            collapsed ? 'lg:pl-[64px]' : 'lg:pl-[246px] 2xl:pl-[250px]'
                        )}
                    >
                        <div className="p-4 sm:p-6 md:p-8">
                            {showNoWebsiteGuard ? <DashboardEmptyState /> : children}
                        </div>
                    </main>
                </div>
                <Toaster
                    position="top-right"
                    // GH-1538 #12: was 207px — way too narrow, wrapped normal-length messages
                    // (e.g. "Sitemap submitted — N URLs sent to Google") onto 3 lines. This
                    // Toaster's own style/toastOptions here fully override the shared defaults
                    // in components/ui/sonner.tsx (props spread, not merged) so the width had
                    // to be fixed at this call site, not just the shared wrapper.
                    style={{ '--width': '300px' } as React.CSSProperties}
                    toastOptions={{
                        classNames: {
                            toast: "bg-dash-surface border border-dash-border shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] rounded-[16px] px-[24px] flex items-center gap-[8px] min-h-[46px] w-full",
                            title: "text-[14px] font-medium text-dash-text",
                            success: "[&>div>svg]:text-[#05DF72]",
                            error: "[&>div>svg]:text-red-500",
                            icon: "w-[20px] h-[20px]",
                        }
                    }}
                />
            </div>
        </UserAvatarProvider>
    )
}
