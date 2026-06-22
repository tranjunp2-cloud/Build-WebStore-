'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { DashboardSidebar, type SidebarBadgeKey } from '@/components/dashboard/Sidebar'
import { TopHeader } from '@/components/dashboard/TopHeader'
import { Toaster } from '@/components/ui/sonner'
import { TenantAccessWatcher } from '@/components/dashboard/TenantAccessWatcher'
import { UserAvatarProvider } from '@/providers/UserAvatarContext'

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
    children: React.ReactNode
}

export function CMSLayoutClient({ userName, userInitial, userEmail, userAvatarUrl = null, currentUserRole = 'viewer', userPermissions = [], isSuperAdmin = false, isProduction = false, badgeCounts, children }: CMSLayoutClientProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    // Collapse state lifted here so TopHeader (« button), Sidebar (mini mode) and <main>
    // (padding) react together. Init false on SSR; localStorage is read post-mount and
    // `hydrated` gates the width/padding transition so a persisted collapsed state
    // doesn't flash an open→closed animation on first paint.
    const [collapsed, setCollapsed] = useState(false)
    const [hydrated, setHydrated] = useState(false)
    const pathname = usePathname()

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
            <div className="dash-shell min-h-screen bg-dash-bg flex flex-col">
                <TenantAccessWatcher />
                <TopHeader
                    userName={userName}
                    userInitial={userInitial}
                    userEmail={userEmail}
                    sidebarOpen={sidebarOpen}
                    setSidebarOpen={setSidebarOpen}
                    collapsed={collapsed}
                    onToggleCollapsed={toggleCollapsed}
                    animateCollapse={hydrated}
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
                        animateCollapse={hydrated}
                        badgeCounts={badgeCounts}
                    />
                    <main
                        className={cn(
                            'flex-1 min-w-0 [overflow-x:clip]',
                            hydrated && 'transition-[padding] duration-200',
                            collapsed ? 'md:pl-[64px]' : 'md:pl-[250px]'
                        )}
                    >
                        <div className="p-4 sm:p-6 md:p-8">
                            {children}
                        </div>
                    </main>
                </div>
                <Toaster
                    position="top-right"
                    style={{ '--width': '207px' } as React.CSSProperties}
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
