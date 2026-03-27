'use client'

import { useState } from 'react'
import { DashboardSidebar } from '@/components/dashboard/Sidebar'
import { TopHeader } from '@/components/dashboard/TopHeader'
import { Toaster } from '@/components/ui/sonner'

type CMSLayoutClientProps = {
    userName: string
    userInitial: string
    children: React.ReactNode
}

export function CMSLayoutClient({ userName, userInitial, children }: CMSLayoutClientProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false)

    return (
        <div className="min-h-screen bg-[#0B1120] flex flex-col">
            <TopHeader
                userName={userName}
                userInitial={userInitial}
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
            />
            <div className="flex flex-1 pt-[56px]">
                <DashboardSidebar
                    userName={userName}
                    userInitial={userInitial}
                    mobileOpen={sidebarOpen}
                    setMobileOpen={setSidebarOpen}
                />
                <main className="flex-1 md:pl-[260px] min-w-0">
                    <div className="p-4 sm:p-6 md:p-8">
                        {children}
                    </div>
                </main>
            </div>
            <Toaster position="bottom-right" />
        </div>
    )
}
