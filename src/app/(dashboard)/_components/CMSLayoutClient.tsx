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
        <div className="min-h-screen bg-[#0F172A] flex flex-col">
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
            <Toaster 
                position="top-right"
                style={{ '--width': '207px' } as React.CSSProperties}
                toastOptions={{
                    classNames: {
                        toast: "bg-[#1E293B] border border-white/[0.08] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] rounded-[16px] px-[24px] flex items-center gap-[8px] min-h-[46px] w-full",
                        title: "text-[14px] font-medium text-slate-50",
                        icon: "text-[#05DF72] w-[20px] h-[20px]",
                    }
                }}
            />
        </div>
    )
}
