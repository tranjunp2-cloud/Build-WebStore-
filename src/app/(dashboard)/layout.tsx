import { DashboardSidebar } from '@/components/dashboard/Sidebar'
import { Toaster } from '@/components/ui/sonner'
import { getCurrentUser } from '@/lib/auth'
import type { PlatformUser } from '@/types/user'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const user = await getCurrentUser()
    const typedUser = user as PlatformUser | null
    const userName = typedUser?.firstName || typedUser?.email?.split('@')[0] || 'User'
    const userInitial = userName.charAt(0).toUpperCase()

    return (
        <div className="min-h-screen bg-[#0F172A]">
            <DashboardSidebar userName={userName} userInitial={userInitial} />
            <main className="pl-[240px]">
                <div className="p-8">
                    {children}
                </div>
            </main>
            <Toaster position="bottom-right" />
        </div>
    )
}
