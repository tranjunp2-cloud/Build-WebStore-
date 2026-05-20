'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { DashboardSidebar } from '@/components/dashboard/Sidebar'
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
    isSuperAdmin?: boolean
    children: React.ReactNode
}

export function CMSLayoutClient({ userName, userInitial, userEmail, userAvatarUrl = null, currentUserRole = 'viewer', isSuperAdmin = false, children }: CMSLayoutClientProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const pathname = usePathname()

    // Lắng nghe sự thay đổi của URL và reset scroll bar về đỉnh trang (QA Bug TC-F18.13)
    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
        // Tương tự, để chắc chắn thêm với documentElement
        document.documentElement.scrollTop = 0
    }, [pathname])

    return (
        <UserAvatarProvider initialUrl={userAvatarUrl}>
            <div className="dash-shell min-h-screen bg-dash-bg flex flex-col overflow-x-hidden">
                <TenantAccessWatcher />
                <TopHeader
                    userName={userName}
                    userInitial={userInitial}
                    userEmail={userEmail}
                    sidebarOpen={sidebarOpen}
                    setSidebarOpen={setSidebarOpen}
                />
                <div className="flex flex-1 pt-[56px]">
                    <DashboardSidebar
                        userName={userName}
                        userInitial={userInitial}
                        currentUserRole={currentUserRole}
                        isSuperAdmin={isSuperAdmin}
                        mobileOpen={sidebarOpen}
                        setMobileOpen={setSidebarOpen}
                    />
                    <main className="flex-1 md:pl-[260px] min-w-0">
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
