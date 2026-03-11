import { AppShell } from '@/components/AppShell'
import { DashboardSidebar } from '@/components/dashboard/Sidebar'
import { AssistantButton } from '@/components/assistant/AssistantButton'
import { AssistantPanel } from '@/components/assistant/AssistantPanel'
import { getCurrentUser } from '@/lib/auth'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const user = await getCurrentUser()
    const userName = (user as any)?.firstName || (user as any)?.email?.split('@')[0] || 'User'
    const userInitial = userName.charAt(0).toUpperCase()

    return (
        <AppShell>
            <div className="min-h-screen bg-[#0F172A]">
                <DashboardSidebar userName={userName} userInitial={userInitial} />
                <main className="pl-[240px]">
                    <div className="p-8">
                        {children}
                    </div>
                </main>
                <AssistantButton />
                <AssistantPanel />
            </div>
        </AppShell>
    )
}

