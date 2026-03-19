import { AppShell } from '@/components/AppShell'
import { DashboardSidebar } from '@/components/dashboard/Sidebar'
import { Toaster } from '@/components/ui/sonner'
import { getCurrentUser } from '@/lib/auth'
import type { PlatformUser } from '@/types/user'
import { I18nProvider } from '@/i18n'

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
        <AppShell>
            <I18nProvider>
                <div className="min-h-screen bg-[#0F172A]">
                <DashboardSidebar userName={userName} userInitial={userInitial} />
                <main className="pt-14 md:pt-0 md:pl-[240px]">
                    <div className="p-4 sm:p-6 md:p-8">
                        {children}
                    </div>
                </main>
                <Toaster position="bottom-right" />
                </div>
            </I18nProvider>
        </AppShell>
    )
}

